# API Keys Setup

Digital Garden keeps all secrets in **one local file** on your machine. Never paste API keys into chat or commit them to git.

## Quick setup

1. Copy the example env file:
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Open `backend/.env` in your editor (not in chat).
3. Replace placeholders with your real keys.
4. Restart the backend (or relaunch **Digital Garden.app**).

## Required keys

| Variable | Required for | Get a key |
|----------|--------------|-----------|
| `ANTHROPIC_API_KEY` | Chat, inline AI, tab completion, agentic search | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `TAVILY_API_KEY` | Web search in chat (optional until you test search) | [tavily.com](https://tavily.com) → API Keys |

## Example `backend/.env`

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
TAVILY_API_KEY=tvly-...
VAULT_PATH=~/vault
MODEL=claude-sonnet-4-6
MAX_TOKENS=8192
THINKING_BUDGET=10000
```

## Verify configuration

With the backend running:

```bash
curl http://127.0.0.1:8000/health
```

Look for:

```json
{
  "status": "ok",
  "ai": {
    "anthropic_configured": true,
    "tavily_configured": false
  }
}
```

If `anthropic_configured` is `false`, chat and AI features will not work until you update `backend/.env`.

## Rules for contributors & AI agents

- **Never** ask the user to paste keys in chat
- **Never** hardcode keys in Python or TypeScript source
- Keys live only in `backend/.env` (gitignored)
- `.env.example` uses placeholders (`sk-ant-...`, `tvly-...`) for documentation only
