# PLANNING

## Overview

- **llama.cpp** runs in Docker (e.g. container name `llamacpp`), serving on port 8080.
- **llamacpp droid** is an Electron app that runs/stops those containers and streams `docker logs -f <container>` (and optional system monitor) from a desktop UI.

## Scope

1. **Containers** — Add/delete container configs; run/stop via `docker run` / `docker stop`; status via `docker inspect`.
2. **Logs** — Live `docker logs -f` for any container in a scrollable viewer.
3. **Monitor** — Live `nvidia-smi` and `top` (when the Monitor tab is active).
4. **Settings** — All container configs and log container name stored in localStorage so updates/installs keep the user’s setup.
5. **Scripts** — install, update, start, stop at repo root; .desktop entry for launcher.

## Integration

- Requires Docker and (for GPU) `nvidia-smi`. No change to the llama.cpp server or its API.
- See **docs/SYSTEMS.md** for full functionality and behaviour.
