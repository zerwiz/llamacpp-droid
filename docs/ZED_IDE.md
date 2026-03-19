# Connect llamacpp droid to Zed IDE

Use a **llama.cpp** server (started via **llamacpp droid**) as the LLM backend in [Zed](https://zed.dev). The llama.cpp HTTP server exposes an [OpenAI-compatible API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), which Zed can talk to.

---

## 1. Start the server with llamacpp droid

1. Open **llamacpp droid** and go to a **Container** tab.
2. Set **Host**, **Port** (e.g. `8080`), and your **Model path** (and other options if needed).
3. Click **Run container** and wait until the status shows **Container "llamacpp" is running**.
4. Note the **Server URL** shown on the container card (e.g. `http://localhost:8080`). Use **Open WebUI** if you want to confirm the server is up in the browser.

The server will listen on that URL (e.g. `http://localhost:8080`). Zed must use this **exact** base URL + **`/v1`** so it talks to the same container. See **docs/CONTAINERS_AND_ZED.md** for other ways to start containers and how the app follows llama.cpp server options.

---

## 2. Configure Zed to use the llama.cpp server

Zed supports **OpenAI API Compatible** providers. Point it at your local llama.cpp server base URL.

### Option A: Zed settings UI

1. In Zed, open the **Agent** settings: run **`agent: open settings`** from the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Under **LLM Providers**, click **Add Provider**.
3. Choose an **OpenAI-compatible** provider and set:
   - **API URL:** `http://localhost:8080/v1`  
     (Replace `8080` with your container **Port** if different.)
   - **Model:** Use the model ID your server reports (e.g. from the server’s `/v1/models` or Web UI). For a single-model server, it is often the model path or a short id like `default` / `llama`.
   - **API key:** Zed may require a value. For a local llama.cpp server, use any placeholder (e.g. `ollama`, `llama`, or `local`). The server ignores it; no real key is needed.
4. Save.

### Option B: Edit Zed `settings.json`

1. Open Zed’s settings file: **`zed: open settings file`** from the command palette.
2. Under `language_models`, add an **OpenAI-compatible** entry with your server URL and at least one model.

Example for a server on **port 8080**:

```json
{
  "language_models": {
    "openai_compatible": {
      "llamacpp droid": {
        "api_url": "http://localhost:8080/v1",
        "api_key": "ollama",
        "available_models": [
          {
            "name": "default",
            "display_name": "llama.cpp (droid)",
            "max_tokens": 8192,
            "capabilities": {
              "tools": true,
              "images": false,
              "parallel_tool_calls": false,
              "prompt_cache_key": false
            }
          }
        ]
      }
    }
  }
}
```

- **`api_url`** must be the **base URL** of the server plus **`/v1`** (e.g. `http://localhost:8080/v1`).
- **`name`**: For a single-model llama.cpp server, `"default"` or the model id returned by the server (e.g. from **Open WebUI** or `GET http://localhost:8080/v1/models`) usually works.
- **`display_name`**: Shown in Zed’s model list; you can set it to e.g. `llama.cpp (droid)`.
- **`max_tokens`**: Match your model/context (e.g. 8192, 16384, 32768).
- **Port:** If your container uses another port (e.g. 8081), use `http://localhost:8081/v1`.

If Zed asks for an API key, use a placeholder such as `ollama`, `llama`, or `local` — the local server does not validate it. In `settings.json` you can set `"api_key": "ollama"` in the provider if your Zed version requires it.

---

## 3. Select the model in Zed

1. Open the **Agent** panel (or **`agent: open`**).
2. In the model dropdown, choose the model you added (e.g. **llama.cpp (droid)**).
3. Use chat, inline edits, or other AI features as usual; they will go to your local server.

---

## 4. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Zed can’t reach the model | Container is **running** in llamacpp droid; status shows the server URL. Try **Open WebUI** in the app to confirm the server responds. |
| Wrong URL | In Zed, `api_url` must end with **`/v1`** (e.g. `http://localhost:8080/v1`). Host/port must match the container (Host `0.0.0.0` → use `localhost` in Zed). |
| Model not found | Use the model id the server actually returns (e.g. from the Web UI or `GET http://localhost:8080/v1/models`). For a single-model server, `"default"` or the path/id shown there is usually correct. |
| Different port | If you run multiple containers on different ports (e.g. 8080, 8081), add a separate `openai_compatible` entry (or provider) in Zed for each, with the matching `api_url` and model. |
| **Missing Llama.cpp API key** | Zed may require an API key field. For local llama.cpp, enter a **placeholder** (e.g. `ollama`, `llama`, or `local`). The server does not use it. In settings UI, fill the API key with `ollama`; in JSON, add `"api_key": "ollama"` to the provider if needed. |
| **Invalid URI character** | Usually caused by a **space, newline, or special character** in the API URL or API key. Use exactly `http://localhost:8080/v1` with **no trailing space**. API key: type `ollama` with no extra characters. If you use a provider name with spaces (e.g. `llamacpp droid`), try one without spaces (e.g. `llamacpp-droid`) in Zed settings or `settings.json`. |

---

## References

- **docs/CONTAINERS_AND_ZED.md** — Ways to start containers, env/config, and making Zed use the same container URL.
- [Zed — LLM providers (OpenAI API Compatible)](https://zed.dev/docs/ai/llm-providers)
- [llama.cpp HTTP server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) (API and options)
