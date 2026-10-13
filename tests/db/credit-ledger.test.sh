#!/usr/bin/env bash
# Concurrency + failure-path tests for credit reservation/ledger SQL functions.
# Runs against an ISOLATED local Postgres (PGHOST/PGPORT), never the project database.
set -euo pipefail
: "${PGHOST:?set PGHOST to a local test server}"
[[ "$PGHOST" == /tmp/* ]] || { echo "refusing to run against non-local PGHOST"; exit 1; }
Q() { psql -qtAX -v ON_ERROR_STOP=1 -c "$1"; }
pass=0; fail=0
check() { if [[ "$2" == "$3" ]]; then echo "ok   - $1"; pass=$((pass+1)); else echo "FAIL - $1 (expected '$3', got '$2')"; fail=$((fail+1)); fi; }
newuser() { local id; id=$(Q "INSERT INTO auth.users(email) VALUES ('t$RANDOM@x') RETURNING id"); Q "UPDATE public.profiles SET token_balance=$1 WHERE id='$id'" >/dev/null; echo "$id"; }
bal() { Q "SELECT token_balance FROM public.profiles WHERE id='$1'"; }

# 1. Concurrent reservations cannot overdraft
U=$(newuser 1000)
for i in $(seq 1 20); do Q "SELECT public.reserve_credits('$U', 100) IS NOT NULL" > ${TMPDIR:-/tmp}/r_$i & done; wait
ok=$(cat ${TMPDIR:-/tmp}/r_* | grep -c t || true); rm -f ${TMPDIR:-/tmp}/r_*
check "20 parallel holds of 100 on 1000 → exactly 10 succeed" "$ok" "10"
check "balance never negative after parallel holds" "$(bal "$U")" "0"
check "ledger reconciles with balance" "$(Q "SELECT 1000 + COALESCE(sum(amount),0) FROM public.balance_transactions WHERE user_id='$U'")" "0"

# 2. Settlement refunds unused hold, and is idempotent
U=$(newuser 1000); R=$(Q "SELECT public.reserve_credits('$U', 500)")
check "hold deducts up front" "$(bal "$U")" "500"
check "settle returns actual charge" "$(Q "SELECT public.settle_credits('$R', 120)")" "120"
check "unused hold refunded" "$(bal "$U")" "880"
Q "SELECT public.settle_credits('$R', 400)" >/dev/null
check "second settle has no effect" "$(bal "$U")" "880"
Q "SELECT public.release_credits('$R')" >/dev/null
check "release after settle has no effect" "$(bal "$U")" "880"

# 3. Parallel settle/release of the same hold → applied exactly once
U=$(newuser 1000); R=$(Q "SELECT public.reserve_credits('$U', 300)")
for i in $(seq 1 10); do if (( i % 2 )); then Q "SELECT public.settle_credits('$R', 100)" >/dev/null & else Q "SELECT public.release_credits('$R')" >/dev/null & fi; done; wait
b=$(bal "$U"); [[ "$b" == "900" || "$b" == "1000" ]] && r=yes || r="no($b)"
check "racing settle/release finalize once (900 or 1000)" "$r" "yes"
check "exactly one finalize ledger row" "$(Q "SELECT count(*) FROM public.balance_transactions WHERE user_id='$U' AND kind <> 'usage_hold'")" "1"

# 4. Overage beyond hold is capped at remaining balance
U=$(newuser 100); R=$(Q "SELECT public.reserve_credits('$U', 100)")
check "overage capped to hold when balance is 0" "$(Q "SELECT public.settle_credits('$R', 300)")" "100"
check "balance stays at 0, not negative" "$(bal "$U")" "0"

# 5. Hard block at zero (even free/zero-cost requests) and insufficient funds
check "zero balance blocks a free request" "$(Q "SELECT public.reserve_credits('$U', 0) IS NULL")" "t"
U=$(newuser 50)
check "hold larger than balance rejected" "$(Q "SELECT public.reserve_credits('$U', 51) IS NULL")" "t"
check "rejected hold leaves balance untouched" "$(bal "$U")" "50"
Q "UPDATE public.profiles SET blocked=true WHERE id='$U'" >/dev/null
check "banned user cannot reserve" "$(Q "SELECT public.reserve_credits('$U', 1) IS NULL")" "t"

# 6. Stale holds are released
U=$(newuser 1000); R=$(Q "SELECT public.reserve_credits('$U', 400)")
Q "UPDATE public.credit_reservations SET created_at = now() - interval '1 hour' WHERE id='$R'" >/dev/null
Q "SELECT public.release_stale_credits()" >/dev/null
check "stale hold auto-released" "$(bal "$U")" "1000"

# 7. Admin adjustments: idempotent references, validation, underflow
U=$(newuser 100)
for i in $(seq 1 10); do Q "SELECT new_balance FROM public.admin_adjust_balance('$U', 50, 'Promo grant', 'admin:test', 'ref-dup-00001')" >/dev/null & done; wait
check "10 duplicate submissions credit once" "$(bal "$U")" "150"
check "one ledger row for duplicate reference" "$(Q "SELECT count(*) FROM public.balance_transactions WHERE reference='ref-dup-00001'")" "1"
check "ledger stores before/after/admin" "$(Q "SELECT balance_before||'/'||balance_after||'/'||admin_identity FROM public.balance_transactions WHERE reference='ref-dup-00001'")" "100/150/admin:test"
e() { psql -qtAX -c "$1" 2>&1 | grep -c ERROR || true; }
check "underflow rejected" "$(e "SELECT * FROM public.admin_adjust_balance('$U', -151, 'Correction', 'admin:test', 'ref-under-0001')")" "1"
check "balance unchanged after underflow" "$(bal "$U")" "150"
check "missing reason rejected" "$(e "SELECT * FROM public.admin_adjust_balance('$U', 5, '  ', 'admin:test', 'ref-noreason-1')")" "1"
check "zero amount rejected" "$(e "SELECT * FROM public.admin_adjust_balance('$U', 0, 'Nothing', 'admin:test', 'ref-zero-00001')")" "1"
check "reused reference with different amount rejected" "$(e "SELECT * FROM public.admin_adjust_balance('$U', 999, 'Promo grant', 'admin:test', 'ref-dup-00001')")" "1"
check "exact deduct to zero allowed" "$(Q "SELECT new_balance FROM public.admin_adjust_balance('$U', -150, 'Correction', 'admin:test', 'ref-zero-ok-01')")" "0"

# 8. Top-up approval cannot double-credit
U=$(newuser 0); T=$(Q "INSERT INTO public.topup_requests(user_id, method, amount, tx_ref) VALUES ('$U','bkash','500','TX1') RETURNING id")
for i in $(seq 1 5); do psql -qtAX -c "SELECT public.approve_topup('$T', 1000, '', 'admin:test')" >/dev/null 2>&1 & done; wait
check "parallel top-up approvals credit once" "$(bal "$U")" "1000"

# 9. Direct execution blocked for client roles
check "authenticated role cannot call reserve_credits" "$(Q "SELECT has_function_privilege('authenticated','public.reserve_credits(uuid,bigint,text)','EXECUTE')")" "f"
check "authenticated role cannot call admin_adjust_balance" "$(Q "SELECT has_function_privilege('authenticated','public.admin_adjust_balance(uuid,bigint,text,text,text)','EXECUTE')")" "f"
check "authenticated cannot update balances" "$(Q "SELECT has_column_privilege('authenticated','public.profiles','token_balance','UPDATE')")" "f"

echo "--- $pass passed, $fail failed"
[[ $fail -eq 0 ]]
