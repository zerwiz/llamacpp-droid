# llamacpp droid

Electron desktop app (**llamacpp droid**) to **run** llama.cpp Docker containers and **stream their logs** in a UI.

## Purpose

- **Container tab**: Configure and run the same `docker run` you use for llama.cpp (image, volume, model path, port, ctx-size, ngl, memory, etc.). Start or stop the container from the UI; status is shown.
- **Logs tab**: Stream `docker logs -f <container>` into a scrollable, follow-mode log viewer. Change container name, clear log, or stop/start stream.

## Dependencies

- **Node.js** (v18+)
- **Docker** (so `docker logs` works)
- **llama.cpp** (or any container) running, e.g. container name `llamacpp`

**Optional plugins** (not required for containers/logs):

- **RAG plugin** — Document indexing (LangChain.js + LanceDB) and retrieval-augmented chat. Install: `npm run install-rag` in this directory, then restart the app. Set `HUGGINGFACEHUB_API_KEY` for embeddings. In the app: RAG tab → Documents card (collection name, “Add documents…”), then check “Use retrieval for context” when sending. See **`docs/RAG.md`** for full usage and architecture.

## Setup

```bash
cd systems/llamacpp-log-viewer
npm install
```

## Run

```bash
npm start
```

In the app:

1. **Container tab**: Adjust options if needed (defaults match the standard llama.cpp server-cuda run). **Create container** creates the container from the form but does not start it. **Run container** removes any existing container with the same name and starts a new one. **Stop container** stops the running container. Status shows whether the container is running.
2. **Profiles** (header): Use the **Profile** dropdown to **load** a saved settings profile (all containers, Logs name, Swap tab). Use **Save current as…** to save the current setup under a name (e.g. “Heavy 30B”, “Light 7B”). Use **Delete** to remove the selected profile from the list. Profiles let you switch between different model/config setups quickly.
3. **Logs tab**: Set the container name (default `llamacpp`), click **Start stream** to follow logs, **Clear** to clear the panel, **Stop stream** to stop following.
4. **RAG tab (plugin)**: Chat with your llama.cpp server (choose container or Server URL). With the RAG plugin installed: ingest .txt/.md/.json files into a collection, then check “Use retrieval for context” to inject relevant chunks when sending. See `docs/RAG.md`.
5. **Settings tab**: **Update app** runs the app update script (git pull, npm install, launcher/icon refresh). **Install llama.cpp options** opens the llama.cpp server README. These affect the app itself, not Docker containers.

## Ports / APIs

- No network server; the app runs `docker logs -f <container>` locally.
- llama.cpp server (e.g. port 8080) is unchanged; this app only reads logs.

## Structure

- `main.js` — Electron main process; Docker/Podman, logs, IPC; optional RAG plugin (rag-service.js).
- `rag-service.js` — Optional: LangChain.js + LanceDB for document ingest and retrieval (loaded only when plugin is installed).
- `preload.js` — Exposes `logViewer`, `docker`, `rag`, `dialog`, etc. to renderer.
- `index.html` / `styles.css` / `renderer.js` — Tabs (containers, logs, swap, monitor, RAG, models, settings), container form, log viewer, RAG panel.
