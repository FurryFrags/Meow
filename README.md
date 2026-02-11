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
