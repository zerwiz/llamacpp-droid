# Documentation

- **SYSTEMS.md** — How the system works: root scripts, Electron app architecture, all tabs (containers, logs, swap, monitor, **models**, RAG), form fields, localStorage, commands, footer. **Models** tab: download GGUF from Hugging Face and pull from Ollama.
- **CONTAINERS_AND_ZED.md** — **Ways to start containers** (app UI, swap presets, manual docker/podman). **Env and config**: no .env in app; we follow **llama.cpp server** CLI (--host, --port, etc.). **Zed**: use the Server URL from the app + `/v1` so Zed uses the same container.
- **ZED_IDE.md** — How to connect llamacpp droid (llama.cpp server) to **Zed IDE** as an OpenAI-compatible LLM provider (Agent, inline assistant).
- **AI_CONTEXT_TIPS.md** — AI context window in Zed/Cursor: what you can’t change (model limit), what eats context, and how to use it more efficiently (fewer @ refs, new chats, leaner rules).
- **GPU_AND_POWER.md** — Why the GPU stays hot when idle (“hugging”), and how to reduce power: **Sleep idle (seconds)** (`--sleep-idle-seconds`) vs manual **Stop container**.
- **PLANNING.md** — High-level scope and integration notes.
- **RAG.md** — RAG as an **optional plugin**: install (`npm run install-rag`), embeddings (`HUGGINGFACEHUB_API_KEY`), ingest documents (Documents card), “Use retrieval for context”, and chat. Plus evaluation of frameworks (LangChain.js, LanceDB, etc.) and integration design.
