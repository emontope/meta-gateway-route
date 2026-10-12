# Toperouter Gateway

Build Toperouter: an AI Meta-Gateway (aggregator of AI proxy gateways) with a properly skeuomorphic Gray/Purple UI and massive logo (no neon glow, clean and fast, no fake mock data).

1. Core Concept:
- Top-level unified API and key (Toperouter).
- Upstream gateways (OpenRouter, Zenmux, DeepInfra, Together, etc.).
- Underlying models (OpenAI, DeepSeek, Anthropic, Qwen, etc.).
- BYOK setup: Users/admins can add upstream proxy gateway keys and run live latency/connection tests.
- Unified API Key generation: Users create a Toperouter API key to query models across connected gateways via a working OpenAI-compatible proxy route (/v1/chat/completions).

2. Auth & Storage:
- Google Auth and GitHub Auth via Supabase/Lovable Cloud (no email or phone).
- Database tables for API keys, upstream gateway configurations, usage logs, and request routing.

3. UI & Design:
- Tactile, skeuomorphic gray and purple theme with inset shadows, bevels, physical buttons, and a massive distinct logo.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://meta-gateway-route.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7e2000d3-93de-44c4-8447-d9476fabc1c1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
