# System functionality

Documentation of how **llamacpp droid** and its scripts work.

---

## 1. Overview

- **llamacpp droid** is a desktop app (Electron) that lets you run and manage [llama.cpp](https://github.com/ggml-org/llama.cpp) Docker containers and view their logs from one UI.
- The app does **not** run a web server; it talks to Docker and runs local commands (e.g. `nvidia-smi`, `top`) from the main process and shows the results in the renderer.

---

## 2. Root scripts

| Script        | Purpose |
|---------------|---------|
| **install.sh** | `npm install` in `systems/llamacpp-log-viewer` and install/refresh the `.desktop` entry (icon and launcher). Run once after clone or when adding the app to a new machine. |
| **update.sh**  | If the project is a git repo: `git pull`. Then `npm install` in the app folder and refresh the `.desktop` file. Use after pulling updates. |
| **start.sh**   | Starts the Electron app in the background (no terminal window). Runs `npm start` with `nohup` and exits so only the app window is visible. |
| **stop.sh**    | Stops the running app by killing the Electron process (`pkill` on the app). Does not stop Docker containers. |

The `.desktop` file is written to `~/.local/share/applications/llamacpp-droid.desktop` (or `$XDG_DATA_HOME/applications`). It points `Exec` at `start.sh` and `Icon` at the app’s `icon.png`.

---

## 3. Electron app architecture

- **Main process** (`main.js`): Creates the window, handles IPC, and runs all external commands (Docker, `nvidia-smi`, `top`, `find`). No UI logic.
- **Preload** (`preload.js`): Exposes a small, safe API to the renderer via `contextBridge` (`logViewer`, `docker`, `findGguf`, `monitor`, and `setWindowOpenHandler` for opening links in the system browser).
- **Renderer** (`index.html`, `styles.css`, `renderer.js`): All UI: tabs, forms, log viewer, monitor panels, footer. Reads/writes **localStorage** for user settings.

---

## 4. Pages and tabs

### 4.1 Container pages (dynamic)

- Each **container** has its own tab and panel. Tabs are created from the container’s **tab name** (or container name if tab name is empty).
- **+ Add** creates a new container (new tab + form) with default settings (name `llamacpp` / `llamacpp2` / …, port 8080 / 8081 / …).
- **Delete container** (red button on the form) removes that container’s tab and panel. If you were on that page, the app switches to another container or to Logs.

**Form fields (per container):**

| Field | Maps to | Description |
|-------|---------|-------------|
| Tab name | (UI only) | Label on the tab. Can differ from Docker container name. |
| Container name | `--name` | Docker container name. Must be unique. |
| Image | image | e.g. `ghcr.io/ggml-org/llama.cpp:server-cuda`. |
| Host path (models) | `-v HOST:/models` | Host directory mounted at `/models` in the container. |
| Model path (in container) | `-m` | Path inside the container, e.g. `/models/.../model.gguf`. |
| **Find models** | — | Runs `find "$HOME" -name "*.gguf"` and lets you pick a file; fills model path using the current host path. |
| Host | `--host` | Bind address (e.g. `0.0.0.0`). |
| Port | `--port` | Server port (e.g. 8080). Must be unique if using `host` network. |
| ctx-size | `--ctx-size` | Context size (e.g. 12000). |
| n_gpu_layers (-ngl) | `-ngl` | Number of layers on GPU (e.g. 99). |
| Memory | `--memory` | Container memory limit (e.g. `24g`). |
| Memory swap | `--memory-swap` | Container swap limit (e.g. `32g`). |
| Threads (-t) | `-t` | Generation threads (optional). |
| Threads batch (-tb) | `-tb` | Batch/prompt threads (optional). |
| Batch size (-b) | `-b` | Prompt batch size (optional). |
| Parallel slots (-np) | `-np` | Number of parallel slots (optional). |
| Continuous batching (-cb) | `-cb` | Checkbox; enables continuous batching. |
| Context shift (--context-shift) | `--context-shift` | Checkbox; slide context when limit hit (keep generating without restart). |
| Cache prompt (--cache-prompt) | `--cache-prompt` / `--no-cache-prompt` | Checkbox; reuse KV cache from previous request (default on). Uncheck to disable. |
| Cache reuse (--cache-reuse) | `--cache-reuse N` | Min chunk size (tokens) to reuse from cache via KV shifting; 0 = off. Requires prompt caching. |
| KV cache K (--cache-type-k) | `--cache-type-k` | Optional: f32, f16, bf16, q8_0, q4_0, q4_1, iq4_nl, q5_0, q5_1. Fits more context in VRAM. |
| KV cache V (--cache-type-v) | `--cache-type-v` | Optional: same values. K/V default f16 if unset. |
| Cache RAM (MiB) (-cram) | `-cram N` | Max KV cache size in MiB; -1 = no limit, 0 = disable. Empty = server default. |
| Sleep idle (seconds) | `--sleep-idle-seconds` | After N seconds with no requests, unload model from VRAM so GPU can drop to low power. Empty = always-on. See **docs/GPU_AND_POWER.md**. |
| Restart | `--restart` | `always` / `unless-stopped` / `no`. |
| Network | `--network` | `host` or `bridge`. |

**Actions:**

- **Create container**: Runs `docker rm -f <name>` then `docker create` with the form options. The container is created but **not started**. Use this to prepare a container from the current form; start it later with **Run container** (which will replace it and start) or with `docker start <name>` outside the app.
- **Run container**: Runs `docker rm -f <name>` then `docker run -d` with the form options (including `--gpus all`). Recreates and starts the container. Status line shows “running” or “stopped” via `docker inspect`.
- **Stop container**: Runs `docker stop <name>`.

### 4.2 Logs tab

- **Container** input: Name of the container to tail (e.g. `llamacpp`).
- **Start stream**: Runs `docker logs -f --tail 500 <name>` in the main process and streams stdout/stderr into the log panel. Auto-scrolls while streaming.
- **Stop stream**: Stops the log stream.
- **Clear**: Clears the log panel only (does not stop the stream).

The log viewer is independent of which container tab you have open; you choose the container by name on this page.

### 4.3 Monitor tab

- **GPU — nvidia-smi**: Runs `nvidia-smi` every **1 second** and shows the output. Only runs while the Monitor tab is active.
- **Processes — top**: Runs `top -b -n 1` every **2 seconds** and shows the output (truncated). Only runs while the Monitor tab is active.

When you leave the Monitor tab, both intervals are cleared.

### 4.4 Swap tab

Explains **local AI “swapping”** and provides quick presets. A **Read online** link points to the [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) for flags and defaults for your server version.

- **Context shift** — KV cache (conversation memory) can be shifted so the model keeps going past the context limit; oldest tokens are dropped. Enable per container with the **Context shift** checkbox on container forms.
- **KV cache type** — Quantized cache (e.g. `q4_0`) uses less VRAM so you can fit more context. Set **KV cache K** / **KV cache V** (and optionally **Cache RAM**) on container forms.
- **Model swap** — Switch the same container between a heavy setup (e.g. 30B coder, 20k context) and a light one (e.g. 7B chat, 4k context) so the GPU isn’t tied to one model.

**Quick swap (presets):** All preset fields are configurable and persisted in localStorage.

- **Container name** — Target container (e.g. `llamacpp`). It will be removed and recreated with the preset.
- **Models volume** — Host path mounted as `/models`.
- **Heavy model path** — Path inside the container for the heavy preset (e.g. Qwen3-Coder-30B).
- **Heavy ctx-size / Heavy ngl / Heavy KV cache** — Override heavy preset (default 20000, 42, q4_0).
- **Light model path** — Path inside the container for the light preset.
- **Light ctx-size / Light ngl** — Override light preset (default 4096, 99).
- **Heavy — 30B Coder (20k ctx, KV q4_0)** — Runs the heavy preset with the values above.
- **Light — 7B Chat (4k ctx)** — Runs the light preset with the values above.

Presets do `docker rm -f <name>` then `docker run` with the chosen options. Use when you want to quickly swap one container between heavy and light without editing the full container form.

---

## 5. User settings (localStorage)

- **Key:** `llamacpp-droid-settings` — **current** settings (what you see in the UI).
- **Stored:**  
  - For each container: all form fields above (tab name, container name, image, paths, host, port, ctx-size, ngl, memory, threads, batch, parallel, cont-batching, context-shift, cache-prompt, cache-reuse, cache-type-k/v, cache-ram, sleep-idle, restart, network).  
  - The **Logs** tab container name.  
  - The **Swap** tab: container name, volume host, heavy model path, heavy ctx/ngl/cache, light model path, light ctx/ngl.
- **When saved:** After add/delete container, and on form input/change (debounced). Log container name and Swap tab fields are saved on change.
- **On load:** If valid saved data exists, containers and log name are restored; otherwise two default containers are created. This way **updates and reinstalls do not overwrite the user’s settings**; they stay in the browser’s localStorage for the app origin.

### 5.1 Profiles (named saved settings)

- **Key:** `llamacpp-droid-profiles`
- **Stored:** A list of named profiles. Each profile has an `id`, `name`, and `data` (same shape as the payload above: containers, logContainerName, swap).
- **UI (header):**
  - **Profile** dropdown — Choose “— Load profile —” or a saved profile name. Selecting a profile **loads** it: replaces all containers and restores Logs + Swap fields, then saves as current settings.
  - **Save current as…** — Prompts for a name, then saves the current settings (all containers, log name, swap) as a new profile and adds it to the dropdown.
  - **Delete** — Deletes the profile currently selected in the dropdown from the list (does not change current settings).
- Use profiles to switch between different model setups (e.g. “Heavy 30B”, “Light 7B”, “Dev”) without re-entering everything.

---

## 6. Commands run by the app

All of these are run from the **main process** (Node), not from the renderer:

| What | Command |
|------|---------|
| Create container | `docker rm -f <name>` then `docker create --name …` (same options as run; container not started). |
| Run container | `docker rm -f <name>` then `docker run -d --name … --restart … --gpus all --network host -v HOST:/models --memory … --memory-swap … IMAGE --host … --port … --ctx-size … -ngl … [-m MODEL] …` |
| Stop container | `docker stop <name>` |
| Remove container | `docker rm -f <name>` |
| Container status | `docker inspect --format '{{.State.Running}}' <name>` |
| Log stream | `docker logs -f --tail 500 <name>` |
| Run preset (Swap) | Same as run container with fixed preset args (heavy or light). |
| Find .gguf files | `find "$HOME" -name "*.gguf" 2>/dev/null` |
| GPU info | `nvidia-smi` |
| Processes | `top -b -n 1` |

The app does not listen on any port; it only spawns these commands and shows their output in the UI.

---

## 7. Footer

- **Developer:** Zerwiz, with a link to [https://whynotproductions.netlify.app/](https://whynotproductions.netlify.app/). The link opens in the system default browser (via Electron `shell.openExternal`).
- **Tagline:** *Movement over ego. Collaboration over competition. Action over perfection.*

---

## 8. File layout (app)

| Path | Role |
|------|------|
| `main.js` | Window, IPC handlers, Docker + find + monitor commands, external link handling. |
| `preload.js` | `logViewer`, `docker`, `findGguf`, `monitor` APIs. |
| `index.html` | Markup: header, tabs, container panels (from template), Monitor panel, Logs panel, footer, template. |
| `renderer.js` | Tab switching, container add/delete, form handling, getConfig/getContainerSettings, save/load localStorage, log stream UI, monitor polling. |
| `styles.css` | Theming and layout for all pages and components. |
| `icon.png` | App icon (window and .desktop). |

---

## 9. Related docs

- **README.md** (root) — Quick start, prerequisites, high-level usage.
- **docs/PLANNING.md** — Overview and scope.
- **systems/llamacpp-log-viewer/README.md** — App-specific setup and run instructions.
