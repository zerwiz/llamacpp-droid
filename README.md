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

Desktop app to **run and manage** [llama.cpp](https://github.com/ggml-org/llama.cpp) containers (Docker or Podman) and **stream their logs** from one UI. No need to type `docker run` in the terminal—configure images, models, ports, and swap presets in the app.

Built with **Electron**. Linux (tested with `--no-sandbox` for environments without setuid sandbox).

---

## Capabilities

- **Containers** — Add and configure multiple llama.cpp server containers: image, model path, host path for models, port, ctx-size, ngl, memory, threads, batch, parallel slots, continuous batching. Create (without starting), run, or stop each container from the form.
- **Logs** — Live stream `docker logs -f` for any container in a scrollable, terminal-style viewer. Start, stop, or clear the stream.
- **Swap** — Context shift, KV cache type (K/V), and model-swap presets: switch the same container between a heavy setup (e.g. 30B, 20k ctx) and a light one (e.g. 7B, 4k ctx). Configurable heavy/light model paths, ctx, ngl, and cache types. Link to official llama.cpp server README.
- **Monitor** — GPU (nvidia-smi) and processes (top) in real time while the Monitor tab is active.
- **Profiles** — Save the full current setup (all containers, Logs name, Swap tab) as a named profile and load different profiles to switch between model/config setups quickly.
- **Settings** — All form and Swap values persist in localStorage; profiles stored separately. Survives app updates and reinstalls.

### Optional features (plugins)

Some features are **optional installs** (plugins). The app runs fully without them; they add extra capability on top of the core container/model workflow.

- **RAG** — Document ingestion (LangChain.js), vector store (LanceDB), and retrieval-augmented chat. The **RAG** tab is always available for chat with your llama.cpp server; to enable **document indexing and retrieval**, install the RAG plugin from the app directory: `npm run install-rag`, then restart. See **[docs/RAG.md](docs/RAG.md)** for install steps, embeddings (Hugging Face API key), and usage.

---

## Prerequisites

- **Node.js** 18+
- **Docker or Podman** (for running and logging containers; the app auto-detects which is available)
- (Optional) NVIDIA GPU + drivers for CUDA-backed llama.cpp images

---

## Quick start

The project is **folder-agnostic**: you can clone it into or rename the root folder to anything. All scripts resolve paths at runtime from the script location.

From the project root, run the installer. It will ask where to install:

- **[1] /opt/llamacpp-droid** — System-wide (requires sudo). App menu and `ldroid` for all users.
- **[2] This folder** — User-only (no sudo). App menu and `ldroid` for you only; app runs from the folder it’s in.

```bash
./ldroid install   # or: ./install.sh — prompts for location, or use: ldroid install 2  or  ldroid install --local
./ldroid start     # launch the app
```

After a **system-wide** install, the app lives in **/opt/llamacpp-droid**, the desktop entry is in **/usr/share/applications/llamacpp-droid.desktop**, and **ldroid** is at **/usr/local/bin/ldroid**. After a **this-folder** install, the app stays in the current directory; the desktop entry and `ldroid` are in `~/.local/share/applications` and `~/.local/bin`. The install path is stored (system: **/etc/llamacpp-droid/install-dir**, user: **~/.config/llamacpp-droid/install-dir**) so **`ldroid`** from PATH always finds the app; if you **move the folder**, run **`./update.sh`** from the new location (or run **`ldroid`** once—it may find the new path and update the config).

To update the installed app, run **`ldroid update`** (or `sudo /opt/llamacpp-droid/update.sh`); it pulls latest code and refreshes the launcher.

**Terminal commands (ldroid):**

| Command | Description |
|---------|-------------|
| `ldroid install [1 or 2 or --local]` | Install app: prompt for location, or pass `2`/`--local` for this folder (no sudo); `1`/`--system` for /opt (sudo) |
| `ldroid update` | Pull latest code (if git) and refresh deps + launcher |
| `ldroid start` | Start the app (background) |
| `ldroid stop` | Stop the running app |
| `ldroid app` | Same as start |
| `ldroid uninstall` | Remove /opt install, desktop entry, and ldroid (use `-y` to skip confirm) |
| `ldroid help` | Show usage |

From the repo root you can run `./ldroid help` or `./ldroid install` etc. After install, `ldroid` is in /usr/local/bin and the app appears in your app menu.

To update the app:

```bash
ldroid update
# or
./update.sh
```

**Icon not showing in the app menu?** Ensure `systems/llamacpp-log-viewer/icon.png` exists, then run **`ldroid update`** again (or `./update.sh`). The desktop entry uses a full path to the icon. If it still doesn’t appear, log out and back in so the launcher refreshes.

To stop the app:

```bash
ldroid stop
# or
./stop.sh
```

To uninstall (remove /opt install, app menu entry, and ldroid command):

```bash
ldroid uninstall
# or
./uninstall.sh
# Skip confirmation: ldroid uninstall -y  or  ./uninstall.sh --yes
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
| `ldroid` | CLI: `install`, `update`, `start`, `stop`, `app`, `uninstall`, `help` (preferred entry point) |
| `install.sh` | Install app: prompts for /opt (system-wide, sudo) or this folder (user-only); or pass `1`, `2`, `--system`, `--local` |
| `update.sh` | Update app (git pull + npm install + refresh launcher) |
| `uninstall.sh` | Remove /opt install, desktop entry, and ldroid (requires sudo) |
| `start.sh` | Start llamacpp droid |
| `stop.sh` | Stop the running app |
| `systems/llamacpp-log-viewer/` | Electron app (UI, docker run/create/stop/logs, profiles, swap, monitor) |
| `docs/` | Documentation: **SYSTEMS.md** (functionality), **ZED_IDE.md** (connect to Zed), **RAG.md** (RAG evaluation & integration), PLANNING.md, GPU_AND_POWER.md |

---

## Developer

**Zerwiz** — [WhyNot Productions](https://whynotproductions.netlify.app/)

Developer. AI Educator. Apps, Cursor courses, and local-first AI tooling (AI Dev Suite, Mimir, RAG, Debugger). Available for coding workshops and AI-for-business integration.

*Movement over ego. Collaboration over competition. Action over perfection.*

---

## License

MIT
