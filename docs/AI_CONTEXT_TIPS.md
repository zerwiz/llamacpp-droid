# AI context window — Zed, Cursor, and similar editors

When using Zed, Cursor, or other AI-assisted editors, the **context window** (how much text can be sent to the model at once) can get used up quickly. This doc explains what you can and can’t change, and how to use context more efficiently.

---

## Can we give the model “extra memory” or change the models?

- The **context limit** is set by the **model and the product** (Zed, Cursor, etc.). You generally **cannot** increase that limit from your side; it’s fixed per model/plan.
- So you **cannot** “give the model extra memory” in the sense of raising that hard limit by changing settings in this project.

---

## Why the context gets used up quickly

- Every **@-mentioned file**, **long chat history**, and **included rules/docs** is sent in that context and consumes it.
- More @ refs and a longer conversation = context fills faster.

---

## What you can do (no code changes)

1. **Use fewer @ references** — Only add the files or folders that are really needed for the current question.
2. **Start a new chat** when the thread gets long — New chat = fresh context, so the model isn’t carrying the whole history.
3. **Shorten or trim rules** — If you have large `.cursorrules` or project rules, smaller rules = less context used every time.
4. **Check editor settings** — In Cursor there are options that affect what gets sent (e.g. codebase indexing). In Zed, check AI/context-related settings. Turning off or narrowing “send whole codebase” type behavior can slow how fast context is used.
5. **Pick a model with a larger context** — If your plan or setup allows switching models, choose one with a larger context window. That’s the only way to actually get more context, and it’s still a product/model limit, not something you can add by changing code in this repo.

---

## Best models to use

*This section is kept up to date from recent web sources; re-check periodically for newer models and VRAM guidance.*

“Best” depends on your **hardware** (GPU VRAM, CPU RAM), **use case** (coding, chat, long docs), and whether you run **locally** (e.g. via llamacpp droid + Zed) or use a **hosted** provider (Cursor, etc.).

### When running locally (llamacpp droid + Zed / OpenAI-compatible client)

- **Prioritize context size** if the context window fills up: choose models that support **32K–128K+** context. Check the model card or `llama.cpp` / server docs for `n_ctx`.
- **GGUF quantization (2025–2026):**
  - **Q4_K_M** — Best overall balance of quality, speed, and VRAM (~75% size vs FP16). Default choice for most setups.
  - **Q5_K_M** — Better quality when you have extra VRAM (~65% size).
  - **Q6_K** — Near-lossless, more VRAM. Use **_M** (medium) for balance; **_S** = smaller/faster, **_L** = higher quality.
- **Model families that work well with llama.cpp (coding / long context):**
  - **Qwen3** (0.6B–32B dense, MoE) — 128K context, Apache 2.0. Qwen3-4B in ~3GB; Qwen3-8B / 30B-A3B for 8GB+. **Qwen2.5-coder** is widely used for code (32K–128K); set `max_tokens` in Zed if needed.
  - **Llama 4** (Meta) — MoE, 10M-token context on Scout; Scout needs ~55GB VRAM at Q4. Good ecosystem support.
  - **DeepSeek R1 / V3.2** — Strong for reasoning and code; R1-Distill 14B/70B runs on consumer hardware. MIT licensed.
  - **Llama 3.1 / 3.2** — 128K context, good all-round.
  - **Mistral / Mixtral** — Good quality/speed; Mixtral needs more VRAM.
- **Rough VRAM tiers:** **4GB** → Qwen3-4B (Q4_K_M); **8GB** → Qwen3-8B or 30B-A3B; **16GB** → DeepSeek Coder V2, 7B–13B at Q5; **24GB+** → R1-70B, Llama 4 Scout, or 70B-class dense. Add 1–2GB for context and overhead.

### Hugging Face links (good models, GGUF when available)

| Model / family | Hugging Face |
|----------------|--------------|
| **Qwen** (Qwen2.5-Coder, Qwen3) | [Qwen](https://huggingface.co/Qwen) — [Qwen2.5-Coder](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct) (search “Qwen2.5-Coder GGUF” or check [Models](https://huggingface.co/models?search=qwen2.5+coder+gguf) for GGUF). |
| **Llama** (3.x, 4) | [Meta Llama](https://huggingface.co/meta-llama) — [Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct). Search “[model name] GGUF” for quantized. |
| **DeepSeek** (R1, Coder) | [DeepSeek](https://huggingface.co/deepseek-ai) — [DeepSeek R1 GGUF](https://huggingface.co/models?search=deepseek+r1+gguf); e.g. [lmstudio-community/DeepSeek-R1-GGUF](https://huggingface.co/lmstudio-community/DeepSeek-R1-GGUF). [DeepSeek Coder](https://huggingface.co/deepseek-ai/DeepSeek-Coder-V2-Instruct). |
| **Mistral / Mixtral** | [Mistral AI](https://huggingface.co/mistralai) — [Mistral 7B](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3). Search “Mistral GGUF” or “Mixtral GGUF” for quantized. |
| **Unsloth** (Qwen3-Coder, Llama, etc.) | [Unsloth](https://huggingface.co/unsloth) — GGUF repos e.g. [Qwen3-Coder-30B-A3B-Instruct-GGUF](https://huggingface.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF), [Models search](https://huggingface.co/models?search=unsloth+gguf). |

- **Tip:** On Hugging Face, filter by **GGUF** or search “&lt;model name&gt; GGUF” to find ready-to-run quantized models for llama.cpp. Collections like **Unsloth**, **TheBloke**, and **lmstudio-community** often publish multiple quant sizes (Q4_K_M, Q5_K_M, etc.).

### Zed-specific (context and models)

- Zed often **clamps** context to **16,384 tokens** by default to avoid OOM on limited GPUs. You can override in settings (e.g. `max_tokens`: 32768 for qwen2.5-coder). See [Zed AI configuration](https://zed.dev/docs/ai/configuration).
- LM Studio and other OpenAI-compatible backends can expose `max_context_length`; Zed may use it when available.

### When using a hosted provider (Cursor, etc.)

- Pick a **model/plan with a large context window** (e.g. 128K, 200K) if you often hit the limit; provider docs list which models and tiers support this.
- You can’t change the model’s “memory” or context limit from this repo; you can only choose a different model or plan that offers a larger window.

### Summary

- **Local:** Prefer Q4_K_M (or Q5_K_M) GGUF; Qwen3 / Qwen2.5-coder, DeepSeek R1, Llama 4, Llama 3.x for coding and long context; match size/quant to your VRAM (see tiers above).
- **Zed:** Set `max_tokens` in `language_models` if you need more than the default clamp.
- **Hosted:** Choose a model/plan with a larger context window when available.

---

## Summary

- You **cannot** change the models to give them extra memory beyond what the product/model allow.
- You **can** use context more carefully: fewer refs, shorter chats, leaner rules.
- Or use a model/plan with a **larger context window** when available.

