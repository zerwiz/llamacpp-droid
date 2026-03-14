# llamacpp droid

Desktop app to **run** [llama.cpp](https://github.com/ggml-org/llama.cpp) Docker containers and **stream their logs** from one UI.

- **Container tab** — Configure and start/stop one or two llama.cpp server containers (image, model path, port, ctx-size, GPU layers, memory). No need to type `docker run` in the terminal.
- **Logs tab** — Live stream `docker logs -f` for any container in a scrollable viewer.

Built with **Electron**. Linux (tested with `--no-sandbox` for environments without setuid sandbox).

---

## Prerequisites

- **Node.js** 18+
- **Docker** (for running and logging containers)
- (Optional) NVIDIA GPU + drivers for CUDA-backed llama.cpp images

---

## Quick start

```bash
# Clone the repo, then from the project root:
./install.sh    # install dependencies (once)
./start.sh      # launch the app
```

To update the app (pull latest code and refresh dependencies):

```bash
./update.sh
```

To stop the app from the command line:

```bash
./stop.sh
```

---

## Using the app

### Container tab

1. **Container 1** — Set container name (e.g. `llamacpp`), image, host path for models, model path inside container, port (e.g. `8080`), and other options. Click **Run container** to start. The app runs `docker run` with your settings (and removes an existing container with the same name first).
2. **Container 2** — Same for a second instance (default name `llamacpp2`, port `8081` so both can run with `--network host`).
3. Use **Stop container** to stop a running container. Status shows whether each container is running or stopped.

### Logs tab

1. Enter the container name (e.g. `llamacpp` or `llamacpp2`).
2. Click **Start stream** to follow logs; **Stop stream** to stop; **Clear** to clear the log panel.

---

## Project structure

| Path | Description |
|------|-------------|
| `install.sh` | Install app dependencies |
| `update.sh` | Update app (git pull + npm install) |
| `start.sh` | Start llamacpp droid |
| `stop.sh` | Stop the running app |
| `systems/llamacpp-log-viewer/` | Electron app (UI, docker run/stop/logs) |
| `docs/` | Planning and architecture |

---

## License

MIT
