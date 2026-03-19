# Containers: how they’re started and how Zed uses them

This doc explains how **llamacpp droid** starts llama.cpp server containers, how that aligns with **llama.cpp server** behaviour, and how to make **Zed** (and other OpenAI-compatible clients) use the same container.

---

## 1. How containers are started

You can run the llama.cpp server in three ways that work with this app.

### 1.1 From the app (recommended)

1. Open **llamacpp droid** → a **Container** tab.
2. Set **Host** (e.g. `0.0.0.0`), **Port** (e.g. `8080`), **Model path**, and other options.
3. Click **Run container** (or **Create container** then **Run container**).

The app builds a `docker run` (or `podman run`) command using the same flags the [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) expects: `--host`, `--port`, `-m` (model), `--ctx-size`, `-ngl`, etc. So we **follow llama.cpp’s CLI rules**; the server inside the container is started with those arguments.

- **Swap tab**: Use **Heavy** / **Light** presets to stop and restart the **same container name** with different model/context (same host/port unless you change them).
- The **Server URL** shown on the container card (e.g. `http://localhost:8080`) is the base URL clients (Zed, Web UI, RAG tab) should use.

**Container buttons (what each does):**

| Button | What it does |
|--------|----------------|
| **Create container** | `docker create`: creates the container from the current form but **does not start** it. Use **Run container** afterwards to start it. |
| **Run container** | Removes any existing container with the same name (if present), then `docker run -d` with the current form. The container **starts** and the llama.cpp server runs. Usual way to start. |
| **Stop container** | Stops the container and sets restart policy so it stays stopped. Server no longer reachable. |
| **Restart container** | Stops the container, then starts it again with the **current form** options (same name, port). Use after changing options. |
| **Delete container** | Stops (if running) and **removes** the container. Name is freed; you can create/run again. |

**Error: “could not select device driver with capabilities [[gpu]]”** — Docker is trying to use a GPU but the NVIDIA Container Toolkit is not installed (or you have no NVIDIA GPU). On the container form, set **GPU access** to **None (CPU only)**. The container will run without `--gpus`; use a small model and lower **n_gpu_layers (-ngl)** (e.g. 0) for CPU-only. To use GPU later, install [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) and set GPU access back to **All GPUs**.

### 1.2 Manual docker/podman run

You can start a container yourself with the same image and flags. The app can still **stream logs** and show **status** if the container name matches the one set in the **Logs** tab. For Zed and the RAG tab to use it, use the same **host** and **port** (e.g. `http://localhost:8080`).

Example (adjust image, volume, model, port as needed):

```bash
docker run -d --name llamacpp --restart always --gpus all --network host \
  -v /path/to/models:/models --memory 24g --memory-swap 32g \
  ghcr.io/ggml-org/llama.cpp:server-cuda \
  --host 0.0.0.0 --port 8080 -m /models/your-model.gguf \
  --ctx-size 32768 -ngl 99
```

The app’s **Settings → Container config & docker command** shows the exact command it would run for the selected container, so you can copy or compare.

### 1.3 Multiple containers (different ports)

Create **multiple container tabs** in the app (e.g. first on port **8080**, second on **8081**). Each has its own **Run container** and **Server URL**. Zed (and the RAG tab) can use one at a time by choosing the matching **api_url** (e.g. `http://localhost:8080/v1` or `http://localhost:8081/v1`).

---

## 2. Env and config: what the app uses

- **App config** (containers, swap, RAG selection, etc.) is stored in **localStorage** in the Electron app, not in an env file. There is **no `.env` in the repo** today.
- **RAG plugin**: For embeddings, set **`HUGGINGFACEHUB_API_KEY`** (or **`HUGGINGFACE_API_KEY`**) in your **environment** before starting the app (or in a `.env` if you ever load it before launch). The app does not load a `.env` file itself.
- **llama.cpp server inside the container**: The server is started with **CLI arguments** (`--host`, `--port`, `-m`, etc.) passed by the app. The [llama.cpp server](https://github.com/ggml-org/llama.cpp) also supports **environment variables** (e.g. `LLAMA_ARG_HOST`, `LLAMA_ARG_PORT`) for the same options. We currently pass everything via CLI; that matches llama.cpp’s documented interface. If you run the container manually, you can use either CLI or env vars as per the server README.

So: **we follow llama.cpp’s rules** by building the correct CLI invocation; no env file is required for the app or for the container to behave correctly.

---

## 3. Making sure Zed can use the container

Zed does not read the app’s config. You point Zed at the **same server** by using the **URL the app uses** for that container.

### 3.1 Get the URL from the app

- On each **Container** tab, the card shows the **Server URL** (e.g. `http://localhost:8080`). That is the base URL of the llama.cpp server.
- In the **RAG** tab, when you select a container, the **Server URL** field is set to that container’s URL. You can also open **Open Web UI** to confirm the server responds.

Use this **exact** base URL (host + port) in Zed.

### 3.2 Configure Zed

1. In Zed: **Agent** settings → add an **OpenAI-compatible** provider (or edit `settings.json` under `language_models.openai_compatible`).
2. Set **API URL** to the base URL from the app **plus** **`/v1`**:
   - App shows `http://localhost:8080` → in Zed use **`http://localhost:8080/v1`**.
   - App shows `http://localhost:8081` → in Zed use **`http://localhost:8081/v1`**.
3. **API key**: Use a placeholder (e.g. `ollama`). The local server ignores it.
4. **Model**: Use the id your server reports (e.g. from the Web UI or `GET http://localhost:8080/v1/models`). Often `default` or the model path id works for a single-model server.

Then Zed and the app are using the **same container** (same host and port). No env file is needed for Zed; the single source of truth for the URL is the app (or your manual docker run with a known port).

Full Zed setup details: **docs/ZED_IDE.md**.

---

## 4. Summary

| Topic | Behaviour |
|-------|-----------|
| **Ways to start** | (1) App UI: Run container / Swap presets. (2) Manual docker/podman run. (3) Multiple containers on different ports. |
| **llama.cpp rules** | We pass server options via **CLI** (`--host`, `--port`, `-m`, etc.) as in the server README. Optional env vars in the container are not required. |
| **Env file** | App does not load a `.env`. RAG needs `HUGGINGFACEHUB_API_KEY` in the **process environment**. |
| **Zed “reading” the container** | Use the **Server URL** from the app (container card or RAG tab) and set Zed’s **api_url** to that base URL + **`/v1`**. Same URL = same container. |

---

## 5. Testing: create, run, and verify AI

From the repo root you can run a script that **creates** a container, **starts** it, waits for the server, and **tests** that the AI responds to a chat request:

```bash
CONTAINER_TEST_MODEL=/models/path/to/your.gguf node scripts/test-container-and-ai.js
```

- Use a path **inside** the container (e.g. `/models/your.gguf`); the script mounts `CONTAINER_TEST_VOLUME` (default: `~/.lmstudio/models`) as `/models`.
- Optional: `CONTAINER_TEST_PORT=8081`, `CONTAINER_TEST_NAME=my-test`, `CONTAINER_TEST_CLEANUP=0` (leave container running).
- The script uses **Create** then **Start** (like the app’s Create container + Run), then GET `/health`, then POST `/v1/chat/completions`; on success it stops and removes the container unless `CONTAINER_TEST_CLEANUP=0`.

---

## 6. Related docs

- **docs/ZED_IDE.md** — Step-by-step Zed setup (API URL, api_key, model).
- **docs/SYSTEMS.md** — How the app builds the docker run command and IPC.
- [llama.cpp server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) — Server options and env vars.
