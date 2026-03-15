# System functionality — what the code does

This document explains **every part of the code**: root scripts, the ldroid CLI, and the Electron app (main process, preload, renderer, and HTML). Use it to understand behaviour, data flow, and where to change things.

---

## 1. Overview

- **llamacpp droid** is a desktop app (Electron) that runs and manages [llama.cpp](https://github.com/ggml-org/llama.cpp) containers (Docker or Podman) and streams their logs from one UI.
- The app does **not** run a web server. The **main process** runs all external commands (Docker or Podman for containers, `nvidia-smi`, `top`, `find`); the **renderer** (front-end) only talks to the main process via IPC and never executes shell commands itself.
- The project is **folder-agnostic**: the root directory can have any name. Every script sets `ROOT="$(cd "$(dirname "$0")" && pwd)"` so paths are resolved at runtime from the script’s location.

---

## 2. Root scripts — what each one does

### 2.1 `ldroid` (CLI entry point)

- **Location:** repo root. After `ldroid install`, also symlinked as `~/.local/bin/ldroid` (or `$XDG_BIN_HOME/ldroid`).
- **What it does:**
  - Sets `ROOT` to the directory containing the script (`dirname "$0"`), so it works no matter what the repo folder is called or where it lives.
  - Reads the first argument (default: `help`). Dispatches to:
    - `install` → `exec "$ROOT/install.sh"`
    - `update` → `exec "$ROOT/update.sh"`
    - `start` or `app` → `exec "$ROOT/start.sh"`
    - `stop` → `exec "$ROOT/stop.sh"`
    - `uninstall` → `exec "$ROOT/uninstall.sh" "$2"` (passes through e.g. `-y`/`--yes`).
    - `help` or `--help` or `-h` → prints the banner (from `banner.txt`) and usage text.
  - Unknown subcommand → prints usage to stderr and exits 1.
- **No subprocess for install/update/start/stop:** it uses `exec` so the target script replaces the ldroid process (saves a shell and keeps exit codes correct).

### 2.2 `install.sh`

- **What it does, in order:**
  1. Sets `ROOT` and **`INSTALL_DIR=/opt/llamacpp-droid`**. Shows banner.
  2. **Detects environment** so the install adapts to the machine:
     - **OS:** `uname -s` and `/etc/os-release` (NAME, VERSION_ID) for display; warns if not Linux.
     - **Architecture:** `uname -m` (e.g. x86_64, aarch64).
     - **Node/npm:** Checks they exist in PATH; exits with a clear message if missing. Records version and path for the summary.
     - **Docker/Podman:** Checks for `docker` then `podman` in PATH; reports which is available (app uses one for containers).
     - **Sudo:** Required for /opt and /usr; exits if sudo is missing; if sudo needs a password, prompts later.
     - **Desktop path:** Uses **`APPS=/usr/share/applications`** (standard on Linux).
  3. Prints a short summary (OS, Arch, Node, npm, Docker, Install path) then continues.
  4. Runs **`npm install`** in `$ROOT/systems/llamacpp-log-viewer` (so the source tree has deps).
  5. **Installs to /opt:** uses **sudo** to create `$INSTALL_DIR`, then copies the repo there with **rsync** (or **cp** if no rsync), excluding `node_modules`; preserves `.git` for updates. Runs **`sudo env PATH="$PATH" npm install`** in the install dir so the same Node/npm as the user are used.
  6. Writes a **system .desktop** file to **`$APPS/llamacpp-droid.desktop`** (via **sudo tee**) with `Exec=...` and `Icon=...`.
  7. Creates **`/usr/local/bin/ldroid`** → symlink to **`/opt/llamacpp-droid/ldroid`** (via **sudo ln -sf**).
  8. Runs **`update-desktop-database`** on `$APPS` when available.
- **Requires sudo** for writing to /opt and /usr. Run once after cloning; the app then runs from /opt and appears in the app menu for all users.

### 2.3 `update.sh`

- **What it does, in order:**
  1. Sets `ROOT` via `cd "$(dirname "$0")" && pwd` (when run as `/opt/llamacpp-droid/update.sh`, `ROOT` is `/opt/llamacpp-droid`).
  2. If `$ROOT/.git` exists: runs **`git pull --rebase`** (or plain `git pull`) to fetch latest code.
  3. `cd`s to the app folder and runs **`npm install`** (or **`sudo npm install`** when `$ROOT` is under `/opt`) to refresh dependencies.
  4. **If `$ROOT` is under /opt:** writes the **.desktop** file to **`/usr/share/applications/llamacpp-droid.desktop`** (sudo), refreshes **`/usr/local/bin/ldroid`** (sudo), and runs **update-desktop-database**.
  5. **Else** (running from a clone): writes **.desktop** to `~/.local/share/applications/` (with quoted paths for spaces) and **ldroid** to `~/.local/bin` (or `$XDG_BIN_HOME`).
  6. Prints a message suggesting `ldroid start` or `./start.sh` to launch.

### 2.4 `start.sh`

- **What it does:**
  1. Sets `ROOT` and `cd`s to `$ROOT/systems/llamacpp-log-viewer`.
  2. Runs **`nohup npm start </dev/null >/dev/null 2>&1 &`** so the Electron app starts in the background with no terminal window. Only the app window is visible.
  3. **`disown`** so the shell does not track the job; the process keeps running after the script exits.
  4. Exits 0 immediately (script does not wait for the app to quit).

### 2.5 `stop.sh`

- **What it does:**
  1. Sets `ROOT` and `APP_DIR="$ROOT/systems/llamacpp-log-viewer"`.
  2. Runs **`pkill -f "electron.*$APP_DIR"`** and **`pkill -f "Electron.*$APP_DIR"`** to kill any Electron process whose command line contains the app path (folder-agnostic: works regardless of repo folder name).
  3. Fallback: **`pkill -f "electron.*llamacpp-log-viewer"`** and **`pkill -f "electron.*llamacpp-droid"`** in case the process string is different.
  4. Prints `Stopped.`
- **Does not** stop Docker containers; only stops the Electron UI process.

### 2.6 `uninstall.sh`

- **What it does, in order:**
  1. Shows the banner from `$ROOT/banner.txt` if present.
  2. Unless **`-y`** or **`--yes`** is passed, prompts: “Uninstall? [y/N]” and exits 0 if the user does not confirm.
  3. **Progress:** Stops the app (pkill Electron by install path and fallbacks), removes **`/usr/share/applications/llamacpp-droid.desktop`**, removes **`/usr/local/bin/ldroid`**, removes **`/opt/llamacpp-droid`** (entire directory), then runs **update-desktop-database** when available. Prints step percentages (0, 15, 20, 40, 45, 60, 65, 90, 95, 100).
  4. Prints “Uninstall complete.” and notes that the clone (if any) is unchanged.
- **Requires sudo** for removing files under /usr and /opt. Safe to run as **`ldroid uninstall`** (from PATH) or **`./uninstall.sh`** from repo or from /opt before it is removed.

---

## 3. Electron app — process and file roles

- **Main process** (`main.js`): Node.js; has access to `require('electron')`, `child_process`, and the file system. Creates the window, registers IPC handlers, and runs all Docker/monitor/find commands.
- **Preload** (`preload.js`): Runs in a context that can use both Node (e.g. `ipcRenderer`) and the page’s JavaScript. It does **not** run in the renderer’s world; it uses `contextBridge` to expose a small, safe API to the renderer so the renderer never touches `require` or raw IPC.
- **Renderer** (`renderer.js` + `index.html`): Browser-like environment; no Node, no direct IPC. All external actions go through the APIs exposed by the preload (`window.logViewer`, `window.docker`, `window.findGguf`, `window.monitor`). UI state and persistence (localStorage) live in the renderer.

---

## 4. Main process (`main.js`) — what each part does

### 4.1 Imports and globals

- `app`, `BrowserWindow`, `ipcMain`, `nativeImage`, `shell` from `electron`; `path`, `child_process.spawn`.
- **`app.commandLine.appendSwitch('no-sandbox')`** — allows running on Linux when the Chromium setuid sandbox is unavailable.
- **`mainWindow`** — reference to the single browser window.
- **`logProcess`** — reference to the child process running `docker logs -f` when the log stream is active; used to kill the stream on stop or window close.

### 4.2 Container runtime (Docker or Podman) and running containers

- **`getContainerRuntime()`** — Returns `'docker'` or `'podman'`. On first call, runs `docker --version` and `podman --version` (sync); if Docker succeeds use `docker`, else if Podman succeeds use `podman`, else default `docker`. Result is cached for the session. All container commands use this runtime (same CLI args for both).
- **`buildDockerContainerArgs(config)`** — Maps the config object (from the renderer) to an array of arguments for `run` / `create`: `--name`, `--restart`, `--gpus all`, `--network`, `-v HOST:/models`, `--memory`, `--memory-swap`, image, then server flags. Optionally appends: `-t`, `-tb`, `-b`, `-np`, `-cb`, `--context-shift`, `--no-cache-prompt`, `--cache-reuse`, `--cache-type-k`, `--cache-type-v`, `-cram`, `--sleep-idle-seconds` when present in config. Returns the args array; **does not** run the runtime.
- **`dockerRun(config)`** — `spawn(getContainerRuntime(), ['run', '-d', ...buildDockerContainerArgs(config)])`. Starts the container in the background.
- **`dockerCreate(config)`** — `spawn(getContainerRuntime(), ['create', ...])`. Creates the container but does not start it.
- **`dockerStop(containerName)`** — `spawn(getContainerRuntime(), ['stop', name])`.
- **`dockerRm(containerName)`** — `spawn(getContainerRuntime(), ['rm', '-f', name])`. Force-removes the container.
- **`dockerInspect(containerName)`** — Runs `runtime inspect --format '{{.State.Running}}' <name>`, parses stdout, and returns a Promise resolving to `{ running: true/false }` or `{ running: false, error }` on failure.

### 4.3 Window and log stream lifecycle

- **`createWindow()`** — Loads `icon.png`, optionally resizes to 256×256, creates a `BrowserWindow` (1000×700, preload: `preload.js`, contextIsolation: true, nodeIntegration: false). Sets `setWindowOpenHandler`: if the URL is http(s), opens it in the system browser via `shell.openExternal` and denies opening in-app. On window `closed`, calls `stopStream()` and sets `mainWindow = null`.
- **`stopStream()`** — If `logProcess` exists, sends SIGTERM to it and sets `logProcess = null` (stops the log stream).

### 4.4 IPC handlers (what the renderer can ask the main process to do)

- **`log-stream:start`** — Stops any existing stream, then spawns `getContainerRuntime() logs -f --tail 500 <containerName>`. Pipes stdout and stderr to the renderer via `mainWindow.webContents.send('log-stream:data', chunk)`. On process error/close, sends `log-stream:error` or `log-stream:closed`. Returns `{ ok: true }`.
- **`log-stream:stop`** — Calls `stopStream()` and returns `{ ok: true }`.
- **`docker:run`** — Runs `runtime rm -f <name>` (ignores errors), then `runtime run -d` with the provided config (runtime = Docker or Podman). Resolves with `{ ok: true, stdout }` or `{ ok: false, error }`. This is “Run container” in the UI.
- **`docker:create`** — Same as run but runs `runtime create` instead of `runtime run -d` (container is created but not started).
- **`docker:stop`** — First runs `runtime update --restart=no <name>`, then `runtime stop <name>`, so the container stays stopped (see §8.1). Resolves with `{ ok: true }` or `{ ok: false, error }`.
- **`docker:status`** — Returns the result of `dockerInspect(containerName)` (running true/false).
- **`docker:runPreset`** — Builds a config from the preset name (`heavy` or `light`) and options (containerName, volumeHost, heavy/light model paths, ctx, ngl, cache type). **`presetConfig()`** in main builds the full Docker config for that preset (default image, host, port 8080, memory, etc.; heavy uses heavy model path, 20k ctx, ngl 42, KV cache q4_0; light uses light model path, 4k ctx, ngl 99). Then does `docker rm -f <name>` and `docker run -d` with that config. Resolves like `docker:run`.
- **`find-gguf`** — Spawns `sh -c 'find "$HOME" -name "*.gguf" 2>/dev/null'`, collects stdout line by line, returns `{ paths: [...] }` (array of absolute paths). Used by “Find models” in the container form.
- **`monitor:nvidia-smi`** and **`monitor:top`** — Use **`runCommand(cmd, args, timeoutMs)`**: spawns the command, collects stdout/stderr, and resolves with `{ stdout, stderr, error }` after exit or after 8s timeout (SIGKILL). So `nvidia-smi` and `top -b -n 1` are run on demand when the renderer calls these handlers; the main process does not poll by itself.

### 4.5 App lifecycle

- **`app.whenReady().then(createWindow)`** — Creates the window when Electron is ready.
- **`app.on('window-all-closed', () => app.quit())`** — Quits the app when the window is closed.

---

## 5. Preload (`preload.js`) — exposed API to the renderer

Preload uses **`contextBridge.exposeInMainWorld`** so the renderer only sees these objects (no raw `ipcRenderer` or `require`).

- **`window.logViewer`**
  - **`startStream(containerName)`** — `ipcRenderer.invoke('log-stream:start', containerName)`.
  - **`stopStream()`** — `ipcRenderer.invoke('log-stream:stop')`.
  - **`onData(cb)`** — Subscribes to `log-stream:data`; returns an unsubscribe function that removes the listener.
  - **`onError(cb)`** — Subscribes to `log-stream:error`.
  - **`onClosed(cb)`** — Subscribes to `log-stream:closed`.

- **`window.docker`**
  - **`run(config)`** — `invoke('docker:run', config)`.
  - **`create(config)`** — `invoke('docker:create', config)`.
  - **`runPreset(opts)`** — `invoke('docker:runPreset', opts)`.
  - **`stop(containerName)`** — `invoke('docker:stop', containerName)`.
  - **`status(containerName)`** — `invoke('docker:status', containerName)`.

- **`window.findGguf()`** — `invoke('find-gguf')`, returns `{ paths }`.

- **`window.monitor`**
  - **`nvidiaSmi()`** — `invoke('monitor:nvidia-smi')`.
  - **`top()`** — `invoke('monitor:top')`.

Links in the renderer that use `target="_blank"` are handled by the main process’s `setWindowOpenHandler`: http(s) URLs are opened with `shell.openExternal` (system browser); in-app window is denied.

---

## 6. Renderer — HTML structure (`index.html`)

- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (scripts and styles from the app only; inline styles allowed).
- **Header:** Logo, title “llamacpp droid”, profile dropdown (`#profileSelect`), “Save current as…”, “Delete”, then tab bar: `#container-tabs` (dynamic container tabs), “+ Add”, “Logs”, “Swap”, “Monitor”.
- **Panels:**
  - **`#container-panels`** — Container panels are appended here by the renderer (one per container, cloned from the template).
  - **`#panel-swap`** — Swap tab: intro text, preset form (container name, volume host, heavy/light model paths, ctx, ngl, Heavy KV cache, context shift, cache reuse, cache RAM), buttons “Heavy …” and “Light …”, message div.
  - **`#panel-monitor`** — Two `<pre>` blocks: `#monitorNvidiaSmi` and `#monitorTop` (filled by renderer with command output).
  - **`#panel-logs`** — Container name input, “Start stream” / “Stop stream”, “Clear”, status line, `#logOutput` (pre) for log text.
- **Template** `#container-panel-template`: one `<section>` with a form containing all container fields (tab name, container name, image, volume host, model path, Find models button, host, port, ctx-size, ngl, memory, restart, network, checkboxes, cache options, sleep idle, Create / Run / Stop / Delete / **Update** buttons). Each new container is a clone of this template with a unique panel id and event listeners attached in the renderer.
- **Footer:** Developer link (Zerwiz), tagline. Links use `target="_blank"` and are opened in the system browser via the main process handler.

---

## 7. Renderer — logic and state (`renderer.js`)

### 7.1 Storage keys and container state

- **`STORAGE_KEY = 'llamacpp-droid-settings'`** — Current UI state: list of containers (all form fields), log container name, swap tab fields. Saved as one JSON object.
- **`PROFILES_KEY = 'llamacpp-droid-profiles'`** — List of named profiles; each has `id`, `name`, `data` (same shape as the settings payload).
- **`containers`** — In-memory array of `{ id, section, tabBtn, form, defaults }` for each container tab/panel. **`nextContainerId`** increments for each new container.

### 7.2 Reading form data and building config

- **`getConfig(form, defaultName, defaultPort)`** — Reads the container form via `FormData` and named inputs/checkboxes. Returns an object matching what `main.js` expects: `containerName`, `image`, `volumeHost`, `modelPath`, `host`, `port`, `ctxSize`, `ngl`, `memory`, `memorySwap`, `restart`, `network`, `gpus: 'all'`, plus optional `threads`, `threadsBatch`, `batchSize`, `parallel`, and booleans/options for `contBatching`, `contextShift`, `cachePrompt`, `cacheReuse`, `cacheTypeK`, `cacheTypeV`, `cacheRam`, `ctxCheckpoints`, `kvUnified`, `sleepIdleSeconds`.
- **`getDefaultConfig(index)`** — Default config for a new container: name `llamacpp` or `llamacpp2`…, port 8080 + index, default image, volume host, model path, ctx 12000, ngl 99, etc.
- **`getContainerSettings(form, defaults)`** — Same shape as saved container entry; used when building the full settings payload.
- **`getCurrentSettings()`** — Builds the object that is saved to localStorage: `version: 1`, `containers` (array of container settings from each form), `logContainerName` (from Logs input), `swap` (container name, volume host, heavy/light paths and options from Swap tab).

### 7.3 Persistence (localStorage)

- **`saveSettings()`** — `getCurrentSettings()` → `JSON.stringify` → `localStorage.setItem(STORAGE_KEY, …)`.
- **`loadSettings()`** — `localStorage.getItem(STORAGE_KEY)` → `JSON.parse`; returns null on missing or parse error.
- **`mergeWithDefaults(saved, index)`** — Merges a saved container object with `getDefaultConfig(index)` so missing fields get defaults (used when restoring saved state or loading a profile).

### 7.4 Monitor tab

The Monitor tab shows live output from system and container commands (only while the tab is active). Toolbar inputs: **Server URL** (for health/metrics, default `http://localhost:8080`), **Container** (for logs tail, default `llamacpp`), **Tail lines** (5–200).

| Block | Command / source | Poll interval |
|-------|------------------|----------------|
| **GPU — nvidia-smi** | `nvidia-smi` | 1 s |
| **GPU — compact** | `nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw --format=csv` | 2 s |
| **Containers — stats** | `docker stats --no-stream` / `podman stats --no-stream` | 2 s |
| **Server health** | `curl -s &lt;Server URL&gt;/health` | 3 s |
| **Server metrics** | `curl -s &lt;Server URL&gt;/metrics` (Prometheus; requires server `--metrics`) | 5 s |
| **Network** | `ss -tuln` | 4 s |
| **Memory — free** | `free -h` | 3 s |
| **Disk — df** | `df -h` | 5 s |
| **Temperature — sensors** | `sensors` (lm-sensors) | 5 s |
| **Logs tail** | `docker logs --tail N &lt;Container&gt;` / `podman logs --tail N &lt;Container&gt;` | 3 s |
| **Processes — top** | `top -b -n 1` | 2 s |

- **`startMonitor()`** — Clears any existing intervals, runs each update once, then sets intervals. Each updater checks `#panel-monitor.active` and reads toolbar inputs where needed (server URL, container name, tail lines).
- **`stopMonitor()`** — Clears all intervals so no commands run when the user leaves the tab.
- **`showPanel(tabId)`** — If `tabId === 'monitor'`, calls `startMonitor()`; otherwise calls `stopMonitor()`.

### 7.5 Container tabs: add, remove, form actions

- **`addContainer(defaults)`** — Clones the template, assigns a new panel id and container id, fills all form fields from `defaults`, creates a tab button. Binds: tab name input → update tab label; “Find models” → `findGguf()`, shows list of paths, on click sets model path (and container path from volume host); form submit → `getConfig()` → `docker.run(config)` → message and status refresh; “Create container” → `docker.create(config)`; “Stop” → `docker.stop(name)`; “Delete” → `removeContainer(id)`. Registers **debounced** `saveSettings` (400 ms) on form input/change. Appends tab and panel, pushes entry to `containers`, refreshes status, shows the new panel, saves settings.
- **`removeContainer(id)`** — Removes the entry from `containers`, removes its tab and panel from the DOM, saves. If the user was on that tab, switches to another container or to Logs.
- **`removeAllContainers()`** — Removes every container tab/panel and clears the `containers` array (used when loading a profile that has a different set of containers).

### 7.6 Profiles (load / save / delete)

- **`loadProfilesList()`** — Reads `PROFILES_KEY` from localStorage, parses JSON, returns `parsed.list` or `[]`.
- **`saveProfilesList(list)`** — Writes `{ list }` to `PROFILES_KEY`.
- **`applySettingsToUI(data)`** — Sets Logs container name and all Swap tab inputs from `data.logContainerName` and `data.swap`.
- **`loadProfile(data)`** — Calls `removeAllContainers()`, then for each container in `data.containers` calls `addContainer(mergeWithDefaults(c, i))`, then `applySettingsToUI(data)`, saves, refreshes profile dropdown, shows first container or Logs.
- **`refreshProfileDropdown()`** — Rebuilds the profile `<select>` from `loadProfilesList()`, with “— Load profile —” plus one option per profile.
- Profile **change** on dropdown: finds the selected profile by id and calls `loadProfile(profile.data)`.
- **Save current as…**: `prompt()` for name, then pushes `{ id (UUID or timestamp), name, data: getCurrentSettings() }` to the list, saves list, refreshes dropdown.
- **Delete**: Removes the selected profile from the list, saves, refreshes dropdown.

### 7.7 Logs tab

- **`streaming`** — Boolean: whether the log stream is currently running.
- **Start stream** click: gets container name from input, calls `logViewer.startStream(name)`, sets `streaming = true`, updates button to “Stop stream”, sets status.
- **Stop stream** click: calls `logViewer.stopStream()`, sets `streaming = false`, resets button and status.
- **Clear** click: clears `#logOutput` text (does not stop the stream).
- **`logViewer.onData(appendLog)`** — Appends each chunk to `#logOutput` and auto-scrolls if `streaming`.
- **`logViewer.onError`** / **`onClosed`** — Update status and reset button/streaming state.

### 7.8 Swap tab

- **`getSwapOpts()`** — Reads container name, volume host, heavy/light model paths, ctx, ngl, Heavy KV cache, context shift, cache reuse, cache RAM from the Swap form.
- **Heavy button** click: `docker.runPreset({ preset: 'heavy', ...getSwapOpts() })`, then shows success or error.
- **Light button** click: same with `preset: 'light'`. Both presets use the same optional context shift, cache reuse, and cache RAM when set.

### 7.9 llama.cpp server swap/context options (coverage)

The app supports the swap- and context-related options from the [llama.cpp HTTP server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md):

- **Container form:** `--context-shift`, `--cache-prompt` / `--no-cache-prompt`, `--cache-reuse`, `--cache-type-k`, `--cache-type-v`, `-cram` (cache RAM), `--ctx-checkpoints`, `--kv-unified` / `--no-kv-unified`, `--sleep-idle-seconds`. KV cache types: f32, f16, bf16, q8_0, q4_0, q4_1, iq4_nl, q5_0, q5_1.
- **Swap presets:** Heavy and Light pass model path, ctx-size, ngl; Heavy also passes KV cache type (K and V). Both presets can use the shared options: context shift, cache reuse, cache RAM. For full control (e.g. different cache types per container, ctx-checkpoints), use the container form and Run/Create there.

### 7.10 Init (on load)

- **`saved = loadSettings()`**. If saved data exists and has at least one container: for each saved container calls `addContainer(mergeWithDefaults(c, i))`, restores log container name and swap fields, binds swap inputs to `saveSettings`, shows first container or Logs. Otherwise: adds two default containers with `getDefaultConfig(0)` and `getDefaultConfig(1)`, shows container 1, binds swap save.
- **`refreshProfileDropdown()`** so the profile list is up to date.
- Log container name and Swap inputs have **change** and debounced **input** listeners that call `saveSettings()` so edits are persisted.

---

## 8. Commands the app runs (summary)

All of these are run in the **main process** via `spawn`:

| Action            | Command / behaviour |
|-------------------|----------------------|
| Run container     | `docker rm -f <name>` then `docker run -d` with args from `buildDockerContainerArgs(config)`. |
| Create container  | `docker rm -f <name>` then `docker create` with same args (container not started). |
| Stop container    | `docker update --restart=no <name>` then `docker stop <name>` (see §8.1). |
| Container status  | `docker inspect --format '{{.State.Running}}' <name>`. |
| Log stream        | `docker logs -f --tail 500 <name>`; stdout/stderr sent to renderer. |
| Swap preset       | Same as run container with config from `presetConfig(..., 'heavy'|'light', ...)`. |
| Find .gguf files  | `find "$HOME" -name "*.gguf" 2>/dev/null`. |
| GPU info          | `nvidia-smi` (on demand, then every 1 s by renderer while Monitor tab active). |
| Processes         | `top -b -n 1` (on demand, then every 2 s by renderer while Monitor tab active). |

The app does not listen on any network port; it only spawns these commands and displays their output in the UI.

### 8.1 Stop container and restart policy

**Cause:** Containers are started with **`--restart always`** (from the form’s Restart field). When you click **Stop container**, the app used to run only `docker stop <name>`. The container stops, but Docker then restarts it because of the restart policy, so it looked like Stop did nothing.

**Change:** Before stopping, the app now turns off the restart policy, then stops:

1. **`docker update --restart=no <containerName>`** (or the same with Podman) — so the container is no longer set to restart.
2. **`docker stop <containerName>`** — so the container stops and stays stopped.

So when you click **Stop container**:

- The container’s restart policy is set to **no**.
- The container is stopped and **stays stopped** until you click **Run container** again (which will recreate it with `--restart always` again if that’s what the form has).

**Code (main.js):**

- Helper **`dockerUpdateRestartNo(containerName)`** runs `update --restart=no`.
- The **`docker:stop`** IPC handler runs that update first, then runs the existing stop logic.

---

## 9. File layout (reference)

| File / path       | Role |
|-------------------|------|
| **Root**          | |
| `ldroid`          | CLI dispatcher: install, update, start, stop, app, uninstall, help; prints banner from banner.txt for help. |
| `banner.txt`      | ASCII banner (LLAMA + DROID + tagline); used by all root scripts and ldroid help. |
| `install.sh`      | Install to /opt, system .desktop, /usr/local/bin/ldroid; progress %. |
| `update.sh`       | Git pull (if repo), npm install, refresh .desktop and ldroid; progress %. |
| `uninstall.sh`    | Remove /opt install, desktop entry, ldroid; confirm prompt unless -y/--yes; progress %. |
| `start.sh`        | nohup npm start in app dir, disown; shows banner. |
| `stop.sh`         | pkill Electron by app path (and fallbacks); shows banner. |
| **App**           | |
| `main.js`         | Window, IPC (log stream, docker run/create/stop/status/preset, find-gguf, monitor, app:open-url, app:open-rag-doc, app:run-update, **rag:query**), Docker arg builder, presetConfig, runCommand; **rag:query** POSTs to llama.cpp server /v1/chat/completions (same server as Web UI). |
| `preload.js`      | contextBridge: logViewer, docker, findGguf, monitor, app (openUrl, openRagDoc, runUpdate), **rag** (query). |
| `index.html`      | Markup: header, profile UI, tabs (containers, Logs, Swap, Monitor, **RAG**), panel-swap, panel-monitor, panel-logs, **panel-rag** (server URL, context, query, Send, response), container template, footer (Runtime, Install llama.cpp options, Update, Open Web UI). |
| `renderer.js`     | Containers array, getConfig/getContainerSettings/getCurrentSettings, save/load/merge settings, add/remove container, profiles load/save/delete, monitor start/stop, showPanel, log stream UI, swap buttons, init from localStorage or defaults. |
| `styles.css`      | Layout and styling for all panels and components. |
| `icon.png`        | App icon (window and .desktop). |

---

## 10. Related docs

- **README.md** (root) — Quick start, prerequisites, high-level usage.
- **docs/PLANNING.md** — Overview and scope.
- **docs/GPU_AND_POWER.md** — GPU power and sleep-idle behaviour.
- **docs/RAG.md** — RAG (Retrieval-Augmented Generation): framework evaluation and integration steps for adding RAG inside the app. The **RAG** footer button opens this doc.
- **systems/llamacpp-log-viewer/README.md** — App-specific setup and run instructions.
