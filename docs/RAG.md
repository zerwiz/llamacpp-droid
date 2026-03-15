# RAG (Retrieval-Augmented Generation) — Evaluation & Integration

This document reviews options for adding **Retrieval-Augmented Generation** to **llamacpp droid**: embedding your own documents, retrieving relevant chunks, and sending augmented prompts to the local llama.cpp server running in Docker/Podman.

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

**Conclusion (Node/JS):** Use **LangChain.js** or **LlamaIndex.TS** in the main process for document parsing, retrieval, and prompt building. Use **LanceDB** (via `vectordb`) for vector storage so no separate database server is required.

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
2. **Document pipeline**: Use **LangChain.js** or **LlamaIndex.TS** for loaders, chunking, and retrieval logic.
3. **Vector store**: Use **LanceDB** (`vectordb`) embedded in the main process.
4. **Embeddings**: Either:
   - Run a small embedding model in-process (e.g. via a separate llama.cpp build or a lightweight JS embedding model), or
   - Call an external embedding API (e.g. Hugging Face) if you accept a network dependency.
5. **Generation**: From main process, send the augmented prompt to the **already running** llama.cpp container via HTTP (e.g. `http://localhost:8080/v1/chat/completions` or `/completion`).
6. **UI**: Add an IPC handler for “RAG query”; renderer sends query and optional doc selection; main runs the pipeline and returns the model response.

This matches the integration steps you were given: main process owns parsing, storage, retrieval, prompt building, and HTTP call to the container; renderer only sends the query and displays the result.

---

## 4. Integration steps (summary)

1. **IPC** — In `main.js`, add an IPC handler (e.g. `rag:query`) that accepts a query string and optional options (which index, which collection).
2. **UI** — In `index.html` add an input (and optionally a “RAG” panel or modal); in `renderer.js` send the query via preload to the new IPC.
3. **Libraries** — In the main process: install and use **LangChain.js** or **LlamaIndex.TS** plus **LanceDB** (`vectordb`) for indexing and retrieval.
4. **Embeddings** — Decide on an embedding source (in-process model vs API) and wire it into the chosen framework.
5. **Retrieval** — On each query, retrieve top-k chunks from LanceDB, build the augmented prompt in main.
6. **HTTP** — From main, `POST` the prompt to the llama.cpp server URL (e.g. from the container form: host + port); use `fetch` or `axios` inside Node.
7. **Response** — Return the completion text (or stream) back to the renderer via IPC.

The **RAG** button in the app opens this document so you can refer to the evaluation and these steps when implementing.

---

## 5. Connecting RAG to the Web UI

RAG in llamacpp droid is **connected to the same interface** as the Web UI:

- **Same server** — The RAG tab uses the **same llama.cpp server URL** (e.g. `http://localhost:8080`) as the "Open Web UI" button. There is no separate RAG server.
- **Same model** — Queries sent from the RAG panel go to the same running container and model that the Web UI uses. Start your container from the app, then either open the Web UI in the browser for normal chat or use the **RAG** tab in the app for document-backed queries.
- **RAG tab** — In the app, open the **RAG** tab. Set the **Server URL** to your server (default `http://localhost:8080`). Optionally paste **Additional context** (e.g. retrieved chunks; once retrieval is implemented this will be filled automatically). Type your **question** and click **Send (RAG)**. The app POSTs to the server’s `/v1/chat/completions` endpoint and shows the reply. The **Open Web UI** button in the RAG panel opens that same URL in your browser so you can use both the in-app RAG panel and the browser Web UI with one server.

So: **one server, two ways to use it** — Web UI in the browser for chat, RAG tab in the app for queries (with optional context). When you add document indexing and retrieval, the RAG panel will inject the retrieved context automatically before sending to the same server.

---

## 6. References

- [LangChain.js](https://js.langchain.com/) — `npm install langchain @langchain/community`
- [LlamaIndex.TS](https://ts.llamaindex.ai/) — `npm install llamaindex`
- [LanceDB](https://lancedb.github.io/lancedb/) — `npm install vectordb` (embedded vector DB)
- [llama.cpp server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) — HTTP endpoints for completion/chat
- [AnythingLLM](https://anythingllm.com/) — Standalone RAG UI
- [Open WebUI](https://docs.openwebui.com/) — UI for Ollama / local models
