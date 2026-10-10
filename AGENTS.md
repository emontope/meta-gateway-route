<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Toperouter architecture rules

- Upstream gateway API keys are readable only by service-role code (column-level GRANT excludes `api_key`) — they must never reach the browser.
- The OpenAI-compatible proxy lives under `/api/public/v1/*` and authenticates by SHA-256 hash of the `tr-` key — public prefix is required to bypass site auth for external callers.
- Routing order: `slug/model` prefix → routing_rules by priority → enabled gateways by last latency; fail over on 429/5xx — keeps behavior predictable.
- Skeuomorphic styling lives in `src/styles.css` component classes (`panel`, `well`, `btn`, `field`, `led`) — reuse them instead of ad-hoc shadows.
- Console features use dedicated authenticated routes and shared ConsoleShell/ConsoleViews modules — keeps navigation deep-linkable without duplicating management logic.
- Public setup guides live under a `/docs` Outlet layout with per-guide metadata and shared copy controls — keeps configurations shareable and reusable.
- ProviderMatrix uses externalized authentic brand marks and explicitly separates model-family identity from live availability — prevents logos from implying a configured connection.
- Console loading uses shared list/table skeletons and the semantic Skeleton primitive — preserves layout while real records load without introducing mock data.
