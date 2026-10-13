[knt]
full readme. single block. no separation.
one strike. complete delivery.
talons out.

---

EH Mamun 👿@#9002111185000#: wing snap. whole thing. one file. delivered clean.

```markdown
# Toperouter Gateway
## AI Meta-Gateway — Unified Proxy. Infinite Models.

Route every API request through **one gateway**, access **every model**, pay **one platform**. No vendor lock-in. No gatekeeping.

---

## What Is Toperouter?

A **meta-gateway aggregator**. Think of it as the nervous system between your app and the AI provider ecosystem.

You connect upstream gateways (OpenRouter, DeepInfra, Together, Zenmux, etc.). They connect to underlying model providers (OpenAI, DeepSeek, Anthropic, Qwen, Llama, etc.). Toperouter sits in the middle — unified API, unified key, unified latency monitoring, unified billing.

**One request. Infinite routing options.**

---

## Core Features

### 🔄 Unified API Gateway
- OpenAI-compatible `/v1/chat/completions` endpoint
- Route to any upstream provider with a single API call
- Built-in load balancing & failover logic
- Real-time latency monitoring per gateway

### 🔐 Multi-Auth & Self-Hosted Keys
- **Google Auth** + **GitHub Auth** (Supabase)
- BYOK (Bring Your Own Key) for upstream gateways
- Users add their own OpenRouter/DeepInfra/Together keys
- Admin panel to test connections live
- API key generation for Toperouter itself

### 📊 Live Gateway Intelligence
- Latency tests across all upstream providers
- Connection health status & availability
- Usage tracking & cost breakdown per gateway
- Request routing history & analytics

### 🎨 Skeuomorphic UI
- Gray & purple tactile design
- Inset shadows, bevels, physical button affordance
- No neon. No fake glow. Clean & fast.
- Massive, distinctive logo
- Mobile-first responsiveness

### ⚡ OpenAI-Compatible Proxy
```bash
curl https://toperouter.app/v1/chat/completions \
  -H "Authorization: Bearer sk-toperouter-xxxxx" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "hello"}],
    "upstream_gateway": "openrouter"
  }'
```

---

## How It Works

### Setup (5 mins)

1. **Sign in** → Google or GitHub (no email required)
2. **Add upstream gateways** → OpenRouter key, DeepInfra key, etc.
3. **Run connection tests** → See latency & availability live
4. **Generate API key** → Use Toperouter key in your app
5. **Start routing** → Query `/v1/chat/completions` with `upstream_gateway` param

### Architecture

```
┌─────────────────────────────────────────┐
│         Your App / Mobile Client        │
└────────────────┬────────────────────────┘
                 │
                 ↓ (single API key)
┌─────────────────────────────────────────┐
│        Toperouter API Gateway           │
│  • Auth (Google/GitHub)                 │
│  • Key rotation & rate limiting         │
│  • Latency monitoring                   │
│  • Request logging & analytics          │
└────┬─────────────┬────────────┬─────────┘
     │             │            │
     ↓             ↓            ↓
 OpenRouter   DeepInfra    Together.ai
  (latency)   (latency)    (latency)
     │             │            │
     ↓             ↓            ↓
  OpenAI    DeepSeek      Anthropic
  Qwen       Llama        Mistral
```

---

## Gateway Configuration

### Add Upstream Gateway (Admin Panel)

```json
{
  "name": "OpenRouter",
  "provider": "openrouter",
  "api_key": "sk-or-v1-xxxxxxxxx",
  "base_url": "https://openrouter.ai/api/v1",
  "models": ["gpt-4o", "claude-3-sonnet", "deepseek-chat"],
  "priority": 1,
  "active": true
}
```

### Test Connection Live

Click **"Test Latency"** → Toperouter pings the gateway → Shows:
- ✅ Connection status
- ⏱️ Avg response time (ms)
- 💾 Available models
- 📉 Last 24h uptime %

---

## API Reference

### Authenticate

```bash
# Generate API key in dashboard
# Use in header:
Authorization: Bearer sk-toperouter-xxxxx
```

### Chat Completion

```bash
POST /v1/chat/completions

{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "What is a meta-gateway?"
    }
  ],
  "upstream_gateway": "openrouter",
  "temperature": 0.7,
  "max_tokens": 200
}
```

**Response**: Standard OpenAI format.

### List Available Gateways

```bash
GET /v1/gateways

Response:
{
  "gateways": [
    {
      "id": "openrouter",
      "name": "OpenRouter",
      "status": "active",
      "latency_ms": 142,
      "uptime_percent": 99.8
    },
    ...
  ]
}
```

### Usage Analytics

```bash
GET /v1/usage?period=24h

Response:
{
  "total_requests": 1847,
  "total_tokens": 234500,
  "cost_breakdown": {
    "openrouter": "$12.30",
    "deepinfra": "$5.80"
  }
}
```

---

## Database Schema

### Users
```sql
id, email (nullable), google_id, github_id, created_at
```

### API Keys
```sql
id, user_id, key_hash, name, created_at, last_used_at, active
```

### Upstream Gateways
```sql
id, user_id, provider, api_key_encrypted, base_url, models (json), 
priority, active, latency_ms, last_test_at, uptime_percent
```

### Request Logs
```sql
id, user_id, model, upstream_gateway, tokens_used, latency_ms, 
cost, response_time, created_at
```

---

## Deployment

### Lovable Cloud (Recommended)
Live app already deployed: **[meta-gateway-route.lovable.app](https://meta-gateway-route.lovable.app)**

Push to `main` → Lovable auto-deploys.

### Self-Hosted (Node + Express + Supabase)

```bash
git clone <repo>
cd toperouter-gateway
npm i

# .env
SUPABASE_URL=xxx
SUPABASE_KEY=xxx
GOOGLE_CLIENT_ID=xxx
GITHUB_CLIENT_ID=xxx

npm run dev
# http://localhost:5000
```

### Docker

```bash
docker build -t toperouter .
docker run -p 5000:5000 -e SUPABASE_URL=xxx toperouter
```

---

## Design Philosophy

### Skeuomorphic, Not Flat
- **Inset shadows** on input fields (pressed into the page)
- **Beveled buttons** with tactile feedback
- **Physical card stacks** for gateway status
- **Massive logo** — distinctive, memorable, not hidden
- Gray + purple palette — cool, professional, fast

### Performance-First
- No animations on critical path
- Latency tests cached (5 min TTL)
- Lazy-load analytics
- SVG icons, minimal bundle size

### User Intent
- New users see gateway setup in 30 seconds
- One-click latency test
- Live uptime badges
- Copy API key in one tap

---

## Roadmap

- [ ] **v1.0** — Core gateway routing + auth + latency monitoring
- [ ] **v1.1** — Advanced routing rules (geo, model type, cost min/max)
- [ ] **v1.2** — Request caching layer
- [ ] **v1.3** — Team billing & shared gateways
- [ ] **v2.0** — CLI tool + local caching proxy
- [ ] **v2.1** — Model auto-selection (latency/cost optimizer)

---

## Development

Built with [Lovable](https://lovable.dev).

**Continue in editor**: [Project Link](https://lovable.dev/projects/7e2000d3-93de-44c4-8447-d9476fabc1c1)

```bash
git clone <repo>
cd toperouter
npm i
npm run dev
```

Push to `main` → Lovable syncs → Live.

---

## Support

- **Docs** — [docs.toperouter.app](https://docs.toperouter.app)
- **Issues** — GitHub Issues
- **Discord** — [Join community](https://discord.gg/toperouter)
- **Email** — support@toperouter.app

---

**Ship faster. Route everywhere. Pay once.**

Made with [Lovable](https://lovable.dev). Deployed live.
```

Delivered.