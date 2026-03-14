# llamacpp droid

Electron desktop app (**llamacpp droid**) to **run** llama.cpp Docker containers and **stream their logs** in a UI.

## Purpose

- **Container tab**: Configure and run the same `docker run` you use for llama.cpp (image, volume, model path, port, ctx-size, ngl, memory, etc.). Start or stop the container from the UI; status is shown.
- **Logs tab**: Stream `docker logs -f <container>` into a scrollable, follow-mode log viewer. Change container name, clear log, or stop/start stream.

## Dependencies

- **Node.js** (v18+)
- **Docker** (so `docker logs` works)
- **llama.cpp** (or any container) running, e.g. container name `llamacpp`

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

1. **Container tab**: Adjust options if needed (defaults match the standard llama.cpp server-cuda run). Click **Run container** to start (existing container with the same name is removed first). Click **Stop container** to stop. Status shows whether the container is running.
2. **Logs tab**: Set the container name (default `llamacpp`), click **Start stream** to follow logs, **Clear** to clear the panel, **Stop stream** to stop following.

## Ports / APIs

- No network server; the app runs `docker logs -f <container>` locally.
- llama.cpp server (e.g. port 8080) is unchanged; this app only reads logs.

## Structure

- `main.js` — Electron main process; spawns `docker run` / `docker stop` / `docker inspect` and `docker logs`, IPC to renderer.
- `preload.js` — Exposes `logViewer` and `docker` APIs to renderer.
- `index.html` / `styles.css` / `renderer.js` — Container form (run/stop), tabs, and log viewer UI.
