# Connect llamacpp droid to Zed IDE

Use a **llama.cpp** server (started via **llamacpp droid**) as the LLM backend in [Zed](https://zed.dev). The llama.cpp HTTP server exposes an [OpenAI-compatible API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), which Zed can talk to.

---

## 1. Start the server with llamacpp droid

1. Open **llamacpp droid** and go to a **Container** tab.
2. Set **Host**, **Port** (e.g. `8080`), and your **Model path** (and other options if needed).
3. Click **Run container** and wait until the status shows **Container "llamacpp" is running**.
4. Note the **server URL** shown (e.g. `http://localhost:8080`) and use **Open WebUI** if you want to confirm the server is up in the browser.

The server will listen on `http://localhost:8080` (or `http://<host>:<port>` if you changed Host). Zed must be able to reach this URL (same machine = `localhost` is fine).

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
4. Save. No API key is needed for a local server.

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

No API key is required for a local llama.cpp server; you can omit any `*_API_KEY` for this provider.

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

---

## References

- [Zed — LLM providers (OpenAI API Compatible)](https://zed.dev/docs/ai/llm-providers)
- [llama.cpp HTTP server README](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) (API and options)
