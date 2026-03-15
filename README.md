# llamacpp droid

```
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   ██╗     ██╗     █████╗ ███╗   ███╗ █████╗           ║
    ║   ██║     ██║    ██╔══██╗████╗ ████║██╔══██╗          ║
    ║   ██║     ██║    ███████║██╔████╔██║███████║          ║
    ║   ██║     ██║    ██╔══██║██║╚██╔╝██║██╔══██║          ║
    ║   ██║     ██║    ██║  ██║██║ ╚═╝ ██║██║  ██║          ║
    ║   ╚█████╗ ╚█████╗╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝          ║
    ║                                                       ║
    ║   ██████╗ ██████╗  ██████╗ ██╗██████╗                 ║
    ║   ██╔══██╗██╔══██╗██╔═══██╗██║██╔══██╗                ║
    ║   ██║  ██║██████╔╝██║   ██║██║██║  ██║                ║
    ║   ██║  ██║██╔══██╗██║   ██║██║██║  ██║                ║
    ║   ██████╔╝██║  ██║╚██████╔╝██║██████╔╝                ║
    ║   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚═════╝                 ║
    ║                                                       ║
    ║              Run containers. Stream logs.             ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
```

Desktop app to **run and manage** [llama.cpp](https://github.com/ggml-org/llama.cpp) Docker containers and **stream their logs** from one UI. No need to type `docker run` in the terminal—configure images, models, ports, and swap presets in the app.

Built with **Electron**. Linux (tested with `--no-sandbox` for environments without setuid sandbox).

---

## Capabilities

- **Containers** — Add and configure multiple llama.cpp server containers: image, model path, host path for models, port, ctx-size, ngl, memory, threads, batch, parallel slots, continuous batching. Create (without starting), run, or stop each container from the form.
- **Logs** — Live stream `docker logs -f` for any container in a scrollable, terminal-style viewer. Start, stop, or clear the stream.
- **Swap** — Context shift, KV cache type (K/V), and model-swap presets: switch the same container between a heavy setup (e.g. 30B, 20k ctx) and a light one (e.g. 7B, 4k ctx). Configurable heavy/light model paths, ctx, ngl, and cache types. Link to official llama.cpp server README.
- **Monitor** — GPU (nvidia-smi) and processes (top) in real time while the Monitor tab is active.
- **Profiles** — Save the full current setup (all containers, Logs name, Swap tab) as a named profile and load different profiles to switch between model/config setups quickly.
- **Settings** — All form and Swap values persist in localStorage; profiles stored separately. Survives app updates and reinstalls.

---

## Prerequisites

- **Node.js** 18+
- **Docker** (for running and logging containers)
- (Optional) NVIDIA GPU + drivers for CUDA-backed llama.cpp images

---

## Quick start

The project is **folder-agnostic**: you can clone it into or rename the root folder to anything. All scripts resolve paths at runtime from the script location.

From the project root, use the **ldroid** CLI (or the legacy scripts):

```bash
./ldroid install   # install dependencies + desktop launcher + ldroid to PATH (once)
./ldroid start     # launch the app
```

Or with the legacy scripts:

```bash
./install.sh       # install dependencies (once)
./start.sh         # launch the app
```

After `ldroid install`, the `ldroid` command is linked into `~/.local/bin` (or `$XDG_BIN_HOME`). Ensure that directory is in your PATH to run `ldroid` from anywhere.

If you move or rename the project folder later, run `ldroid install` (or `./install.sh`) again so the desktop launcher and `ldroid` symlink point to the new path.

**Terminal commands (ldroid):**

| Command | Description |
|---------|-------------|
| `ldroid install` | Install deps, desktop launcher, and `ldroid` into PATH (run once) |
| `ldroid update` | Pull latest code (if git) and refresh deps + launcher |
| `ldroid start` | Start the app (background) |
| `ldroid stop` | Stop the running app |
| `ldroid app` | Same as start |
| `ldroid help` | Show usage |

From the repo root you can run `./ldroid help` or `./ldroid install` etc. After install, use `ldroid` from any directory.

To update the app:

```bash
ldroid update
# or
./update.sh
```

To stop the app:

```bash
ldroid stop
# or
./stop.sh
```

---

## Using the app

1. **Container tab**: Adjust options if needed (defaults match the standard llama.cpp server-cuda run). **Create container** creates the container from the form but does not start it. **Run container** removes any existing container with the same name and starts a new one. **Stop container** stops the running container. Status shows whether the container is running.
2. **Profiles** (header): Use the **Profile** dropdown to **load** a saved settings profile (all containers, Logs name, Swap tab). Use **Save current as…** to save the current setup under a name (e.g. “Heavy 30B”, “Light 7B”). Use **Delete** to remove the selected profile from the list.
3. **Logs tab**: Set the container name (default `llamacpp`), click **Start stream** to follow logs, **Clear** to clear the panel, **Stop stream** to stop following.
4. **Swap tab**: Configure heavy/light presets and use **Heavy** / **Light** to swap the same container between setups. See [docs/SYSTEMS.md](docs/SYSTEMS.md) and the in-app link to the llama.cpp server README.
5. **Monitor tab**: View nvidia-smi and top output while the tab is active.

---

## Project structure

| Path | Description |
|------|-------------|
| `ldroid` | CLI: `install`, `update`, `start`, `stop`, `app`, `help` (preferred entry point) |
| `install.sh` | Install app dependencies (+ desktop launcher + ldroid to PATH) |
| `update.sh` | Update app (git pull + npm install + refresh launcher) |
| `start.sh` | Start llamacpp droid |
| `stop.sh` | Stop the running app |
| `systems/llamacpp-log-viewer/` | Electron app (UI, docker run/create/stop/logs, profiles, swap, monitor) |
| `docs/` | Documentation: **SYSTEMS.md** (functionality), PLANNING.md (scope), GPU_AND_POWER.md |

---

## Developer

**Zerwiz** — [WhyNot Productions](https://whynotproductions.netlify.app/)

Developer. AI Educator. Apps, Cursor courses, and local-first AI tooling (AI Dev Suite, Mimir, RAG, Debugger). Available for coding workshops and AI-for-business integration.

*Movement over ego. Collaboration over competition. Action over perfection.*

---

## License

MIT
