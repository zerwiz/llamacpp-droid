# Documentation

- **SYSTEMS.md** — How the system works: root scripts, Electron app architecture, all tabs (containers, logs, swap, monitor, **models**, RAG), form fields, localStorage, commands, footer. **Models** tab: download GGUF from Hugging Face and pull from Ollama.
- **ZED_IDE.md** — How to connect llamacpp droid (llama.cpp server) to **Zed IDE** as an OpenAI-compatible LLM provider (Agent, inline assistant).
- **AI_CONTEXT_TIPS.md** — AI context window in Zed/Cursor: what you can’t change (model limit), what eats context, and how to use it more efficiently (fewer @ refs, new chats, leaner rules).
- **GPU_AND_POWER.md** — Why the GPU stays hot when idle (“hugging”), and how to reduce power: **Sleep idle (seconds)** (`--sleep-idle-seconds`) vs manual **Stop container**.
- **PLANNING.md** — High-level scope and integration notes.
- **RAG.md** — RAG (Retrieval-Augmented Generation): evaluation of frameworks (LangChain.js, LlamaIndex.TS, LanceDB, Python options, out-of-the-box UIs) and integration steps for adding RAG inside the Electron app.
