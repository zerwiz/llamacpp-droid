# PLANNING

## Overview

- **llama.cpp** runs in Docker (e.g. container name `llamacpp`), serving on port 8080.
- **llamacpp droid** is an Electron desktop app that runs/stops those containers and streams `docker logs -f <container>` (and optional system monitor) from one UI.
- **Entry point:** `ldroid` CLI at repo root (install, update, start, stop, app, help). Folder-agnostic: root directory can have any name; all paths resolved at runtime.

## Scope

1. **Containers** — Add/delete container configs; run/stop via `docker run` / `docker stop`; status via `docker inspect`. Multiple containers, configurable image, model path, host path, port, ctx, ngl, memory, threads, batch, parallel, continuous batching.
2. **Logs** — Live `docker logs -f` for any container in a scrollable viewer.
3. **Swap** — Model-swap presets: switch the same container between heavy/light setups (context shift, KV cache type, model paths).
4. **Monitor** — Live `nvidia-smi` and `top` when the Monitor tab is active.
5. **Profiles** — Save/load named profiles (all containers + Logs name + Swap tab).
6. **Settings** — All form and Swap values in localStorage; profiles separate. Survives app updates.
7. **CLI & boot** — `ldroid` (install, update, start, stop, app, help); install adds symlink to `~/.local/bin` and `.desktop` launcher. Banner in `ldroid help` and `banner.txt`. Legacy scripts: `install.sh`, `update.sh`, `start.sh`, `stop.sh`.

## Repo / entry points

| Item | Purpose |
|------|---------|
| `ldroid` | Main CLI; shows banner + usage on `help`. |
| `banner.txt` | ASCII banner (LLAMACPP DROID + tagline); reused in README and `ldroid help`. |
| `install.sh` | Deps, .desktop, ldroid symlink to PATH. |
| `update.sh` | Git pull, npm install, refresh .desktop and ldroid symlink. |
| `start.sh` / `stop.sh` | Start app in background / stop by process. |
| `systems/llamacpp-log-viewer/` | Electron app (main, preload, renderer). |
| `docs/` | SYSTEMS.md, PLANNING.md, GPU_AND_POWER.md. |

## Integration

- Requires Docker and (for GPU) `nvidia-smi`. No change to the llama.cpp server or its API.
- See **docs/SYSTEMS.md** for full functionality and behaviour.
