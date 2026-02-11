# agent-core

Local-first Python agent skeleton that starts immediately with safe defaults:

- No user prompts required.
- No required API keys in default mode.
- Uses local capabilities only unless you explicitly enable integrations.
- Strict logging enabled.
- Graceful shutdown on `SIGINT`/`SIGTERM`.

## One-command startup

```bash
python -m pip install -e . && python -m agent_core.main
```

The scheduler runs every 60 seconds by default and keeps all social platform adapters disabled unless explicitly enabled in `config/defaults.yaml`.


## Platform adapters

The platform layer now includes adapters for X/Twitter, Reddit, LinkedIn, Facebook, Instagram, and TikTok with a shared interface:

- `login(session_store)`
- `fetch_feed()`
- `draft_response(context)`
- `post(content)`
- `health_check()`

Safety defaults:

- Persistent local session/cookie files under `data/sessions/`.
- Rate limiting + randomized jitter + retry/backoff on adapter actions.
- Capability matrix that can disable unsupported actions per platform.
- Fail-closed content safety checks before posting.

See `src/agent_core/platforms/README.md` for policy and platform limitation details.
