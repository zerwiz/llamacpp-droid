# RAG (Retrieval-Augmented Generation) — Optional Plugin

RAG is an **optional plugin** for **llamacpp droid**. The app’s main purpose is to **start and manage containers and models**; RAG (document ingestion, vector search, retrieval-augmented chat) is a separate, optional install.

---

## Core vs optional features (plugins)

- **Core features** (always available): **Containers** (add, configure, run, stop llama.cpp server containers), **Logs** (stream container logs), **Swap** (context shift, KV cache, model presets), **Monitor**, **Profiles**, **Settings**. These are the main reason the app exists: run containers and models from one UI.
- **Optional features (plugins)**: Extra capabilities that are **not** installed by default. They are additive and do not affect core behaviour if missing. **RAG** is the first such plugin: document ingestion (LangChain.js), vector store (LanceDB), and retrieval-augmented chat. The RAG tab is always visible, but full document/retrieval support is only active after you run the optional install (see below). Other plugins may be added in the same way (optional npm install, feature detection in the app).

---

## Plugin behaviour

- **Without the plugin**: The RAG tab still lets you **chat** with your llama.cpp server (choose container, type a message, send). No document indexing or retrieval.
- **With the plugin**: You get **LangChain.js** (document loaders, chunking, retrieval) and **LanceDB** (embedded vector store). Ingest documents, run similarity search, and have retrieved chunks injected into context when chatting.

## Installing the RAG plugin

From the **app directory** (`systems/llamacpp-log-viewer`):

```bash
npm run install-rag
```

Then restart the app. The RAG tab will detect the plugin and show the full UI (Documents card, retrieval option, chat). If the plugin is not installed, the RAG tab shows install instructions and a **Check again** button.

---

## Using the RAG plugin

### Embeddings (required for ingest and retrieval)

Document ingestion and retrieval need **embeddings**. The plugin uses the **Hugging Face Inference API**:

- Set **`HUGGINGFACEHUB_API_KEY`** or **`HUGGINGFACE_API_KEY`** in your environment (or in a `.env` file if you load it before starting the app). Get a free API key from [Hugging Face](https://huggingface.co/settings/tokens).
- Without a key, ingest and “Use retrieval” will report that embeddings are not configured. Chat (without retrieval) still works.

### Documents card

- **Collection** — Name of the collection (table) in the vector store. Default is `default`. Use different names to separate document sets (e.g. `docs`, `notes`).
- **Add documents…** — Opens a file picker. Select one or more **.txt**, **.md**, or **.json** files. The plugin loads them, splits them into chunks (LangChain `RecursiveCharacterTextSplitter`), embeds with Hugging Face, and stores vectors in **LanceDB** (under the app’s user data directory). Status shows “Ingesting…” then “Done. N chunks created in ‘collection’.”

### Retrieval when sending

- **Use retrieval for context** — When checked, each time you click **Send**, the app runs a **similarity search** on the selected collection using your question as the query, retrieves the top 5 chunks, and **prepends** them to the system/context sent to the llama.cpp server. The model sees: system prompt + retrieved chunks + any extra context you pasted + your question.
- Use the **same collection name** as when you ingested (e.g. `default`). If the collection doesn’t exist, you’ll get an error that the collection was not found.

### Chat (no retrieval)

- You can leave “Use retrieval” **unchecked** and still use the RAG tab to chat with your llama.cpp server: choose **Use container** (or leave “None” and set Server URL), optionally paste **Additional context**, type your question, and click **Send**. No vector search is run.

### Summary

| Step | What you do |
|------|-------------|
| 1. Install plugin | `npm run install-rag` in `systems/llamacpp-log-viewer`, restart app |
| 2. Set API key | `HUGGINGFACEHUB_API_KEY` or `HUGGINGFACE_API_KEY` in env |
| 3. Ingest | Pick a collection name, click “Add documents…”, select .txt/.md/.json files |
| 4. Chat with retrieval | Check “Use retrieval for context”, same collection, type question, Send |
| 5. Chat without retrieval | Uncheck “Use retrieval”, type question, Send (optional: paste context) |

---

This document also reviews the design and integration approach for RAG in this app.

---

## 1. Current architecture

- **llamacpp droid** is an **Electron** desktop app.
- **Main process**: Node.js — runs Docker/Podman, spawns and manages llama.cpp **containers**.
- **Renderer**: UI only — no direct shell or Node; all external work goes through **IPC** to main.
- **llama.cpp server**: Exposed inside a container (e.g. `http://localhost:8080`), with OpenAI-compatible endpoints (`/v1/chat/completions`, `/completion`, etc.).

To add RAG **inside this app** (no extra background services), the pipeline must run in the **Node.js main process**:

1. **Ingest** — Parse local documents (PDF, text, etc.) and build embeddings.
2. **Store** — Keep vectors in an embedded store (no separate DB server).
3. **Retrieve** — On user query, find relevant chunks.
4. **Augment** — Build a prompt with context + query.
5. **Generate** — Send the prompt via **HTTP** to the running llama.cpp container and return the response to the renderer.

---

## 2. Evaluation of frameworks and tools

### 2.1 Node.js / JavaScript (fit for Electron main process)

| Option | Pros | Cons | Fit for this app |
|--------|------|------|-------------------|
| **LangChain.js** | Mature JS ecosystem, runs in Node, integrates with local APIs; document loaders, chains, context window handling. | Heavier dependency set; more generic than “RAG-only”. | ✅ Good — main process can use it for parsing, retrieval, and calling the container HTTP API. |
| **LlamaIndex.TS** | Built for ingestion, indexing, and retrieval; TypeScript/JS; can talk to local LLM endpoints. | Smaller community than LangChain. | ✅ Good — strong fit for “documents → index → query → prompt”. |
| **LanceDB** | **Embedded** vector DB inside the Node process; no separate server; works with LangChain.js and LlamaIndex.TS. | You still need an embedding model (e.g. run a small model in-process or call an API). | ✅ Best fit — keeps everything in-process, matches “no extra services” architecture. |

**Conclusion (Node/JS):** Use **LangChain.js** in the main process for the **document pipeline** (loaders, chunking, retrieval, prompt building). Use **LanceDB** (via `vectordb`) for vector storage so no separate database server is required. LlamaIndex.TS is a valid alternative if preferred.

---

### 2.2 Python-based frameworks (separate process or service)

These are powerful but run in **Python**, not inside the Electron main process:

| Option | Pros | Cons | Fit for this app |
|--------|------|------|-------------------|
| **LlamaIndex (Python)** | Excellent for RAG; llama-cpp-python integration. | Requires a Python runtime and a separate process or service; not inside Electron. | ⚠️ Use only if you add a **sidecar** Python service that the app talks to via HTTP/sockets. |
| **LangChain (Python)** | Flexible pipelines, native llama.cpp support. | Same as above — Python, not Node. | ⚠️ Same as above. |
| **llama-cpp-agent** | Lightweight, built for llama.cpp; ColBERT reranking, structured output. | Python-only. | ⚠️ Same as above. |

**Conclusion (Python):** Best for a **separate** RAG service that the Electron app calls (e.g. over HTTP). Not for “all logic inside the existing Electron main process”.

---

### 2.3 Out-of-the-box user interfaces

These are **standalone apps** that already do RAG and can talk to local models:

| Option | Pros | Cons | Relation to llamacpp droid |
|--------|------|------|-----------------------------|
| **AnythingLLM** | Full GUI: documents, chat, local models. | Separate app; not integrated into this codebase. | User can run it **alongside** llamacpp droid and point it at the same llama.cpp server (e.g. `http://localhost:8080`). |
| **Open WebUI** | UI for Ollama (which uses llama.cpp); document parsing and vector storage. | Tied to Ollama; different deployment model. | Alternative front-end; not a drop-in for this app. |

**Conclusion:** Use these if you want a **ready-made RAG UI** without coding. They do not replace adding RAG *inside* llamacpp droid; they are alternatives to building it here.

---

## 3. Recommended approach for llamacpp droid

To keep **one app** and **no extra servers**:

1. **Implement RAG in the Node.js main process** of the Electron app.
2. **Document pipeline**: Use **LangChain.js** for loaders, chunking, retrieval, and prompt building (document loaders, text splitters, chains, context-window handling). LangChain.js integrates with local LLM endpoints and with LanceDB.
3. **Vector store**: Use **LanceDB** (`vectordb`) embedded in the main process.
4. **Embeddings**: Either:
   - Run a small embedding model in-process (e.g. via a separate llama.cpp build or a lightweight JS embedding model), or
   - Call an external embedding API (e.g. Hugging Face) if you accept a network dependency.
5. **Generation**: From main process, send the augmented prompt to the **already running** llama.cpp container via HTTP (e.g. `http://localhost:8080/v1/chat/completions` or `/completion`).
6. **UI**: Add an IPC handler for “RAG query”; renderer sends query and optional doc selection; main runs the pipeline and returns the model response.

This matches the integration steps you were given: main process owns parsing, storage, retrieval, prompt building, and HTTP call to the container; renderer only sends the query and displays the result.

---

**RAG stack (implemented):** Document pipeline **LangChain.js**; vector store **LanceDB**; embeddings **Hugging Face Inference API** (`HUGGINGFACEHUB_API_KEY`); generation via existing llama.cpp container HTTP API.

---

## 4. Integration steps (summary)

1. **IPC** — In `main.js`, add an IPC handler (e.g. `rag:query`) that accepts a query string and optional options (which index, which collection).
2. **UI** — In `index.html` add an input (and optionally a “RAG” panel or modal); in `renderer.js` send the query via preload to the new IPC.
3. **Libraries** — In the main process: install **LangChain.js** for the document pipeline and **LanceDB** (`vectordb`) for vector storage and retrieval.
4. **Embeddings** — Decide on an embedding source (in-process model vs API) and wire it into the chosen framework.
5. **Retrieval** — On each query, retrieve top-k chunks from LanceDB, build the augmented prompt in main.
6. **HTTP** — From main, `POST` the prompt to the llama.cpp server URL (e.g. from the container form: host + port); use `fetch` or `axios` inside Node.
7. **Response** — Return the completion text (or stream) back to the renderer via IPC.

The **RAG** button in the app opens this document so you can refer to the evaluation and these steps when implementing.

---

## 5. Connecting RAG to the Web UI

RAG in llamacpp droid uses the **same llama.cpp server** as the Web UI:

- **Same server** — The RAG tab uses the **same llama.cpp server URL** (e.g. `http://localhost:8080`) as the “Open Web UI” button. Choose **Use container** or set **Server URL** manually.
- **Same model** — Messages sent from the RAG panel go to the same running container and model. Start your container from the app, then use the **RAG** tab for chat and/or document-backed queries.
- **RAG tab** — Open the **RAG** tab. (If the plugin is not installed, you’ll see install instructions; chat still works once you select a container/URL.) With the plugin: ingest documents (Documents card), optionally check **Use retrieval for context**, add **Additional context** if you like, type your question, and click **Send**. The app builds context (system prompt + retrieved chunks when enabled + pasted context), POSTs to the server’s `/v1/chat/completions` endpoint, and shows the reply. **Open Web UI** opens that URL in your browser.

**One server, two UIs** — Web UI in the browser for chat; RAG tab in the app for chat with optional document retrieval.

---

## 6. References

- [LangChain.js](https://js.langchain.com/) — `npm install langchain @langchain/community`
- [LlamaIndex.TS](https://ts.llamaindex.ai/) — `npm install llamaindex`
- [LanceDB](https://lancedb.github.io/lancedb/) — `npm install vectordb` (embedded vector DB)
- [llama.cpp server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) — HTTP endpoints for completion/chat
- [AnythingLLM](https://anythingllm.com/) — Standalone RAG UI
- [Open WebUI](https://docs.openwebui.com/) — UI for Ollama / local models
