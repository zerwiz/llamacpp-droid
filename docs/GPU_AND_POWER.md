# GPU “hugging” and how to reduce power use

llama.cpp (and most local AI servers) are built for **high performance, low latency**. By default they keep the GPU ready all the time, so it can feel like the GPU is “hugging” or “hogging” power even when idle.

---

## Why the GPU stays hot when idle

### 1. Always-on memory pipeline

When the server starts, it sets up the **CUDA compute context**, not just file loading:

- **P0 / high power state** — To avoid wake-up delay on every request, the driver often keeps the GPU in a high-performance power state (e.g. P0/P2). That keeps clocks and power up even when utilization is 0%.
- **VRAM refresh** — Keeping large model + KV cache in VRAM means the memory controller keeps that data “live.” That costs power even if the compute units are idle.

### 2. Static VRAM reservation

At startup the server reserves a **fixed** amount of VRAM:

- **Model weights** — e.g. ~12.5 GB, loaded once and left in VRAM.
- **KV cache** — Size depends on context (e.g. 8k); reserved up front.
- **Compute buffers** — Space for the next forward pass.

The GPU treats this as a committed allocation. It doesn’t know you’re idle; it just keeps that VRAM reserved and the memory subsystem active.

### 3. Driver / Docker behavior

In Docker, the NVIDIA driver sometimes doesn’t get a clear “idle” signal from the container. The GPU can stay in a “ready for heavy compute” state, so clocks and power stay higher than true idle.

---

## How to reduce power when you’re not using it

### A. Sleep idle (automatic unload)

Recent llama.cpp server builds support **`--sleep-idle-seconds`**.

- After **no requests** for that many seconds, the server **unloads the model from VRAM**.
- The GPU can then drop to normal idle power (often ~10–15 W instead of 50 W+).
- The next request reloads the model (adds a short delay, similar to a cold start).

**In the app:** On each container form, set **Sleep idle (seconds)**. Example: `600` = unload after 10 minutes of no traffic. Leave empty for “always on.”

**Example:** Add `--sleep-idle-seconds 600` to your run so the server unloads after 10 minutes of silence.

### B. Manual stop (greenest option)

If you don’t need the server running when you’re not coding:

- **Stop:** In the app use **Stop container**, or run `docker stop llamacpp`. Power drops immediately.
- **Start:** **Run container** again (or `docker start llamacpp`). Model reloads in roughly 10–30 seconds depending on size.

No extra flags; you control when the container runs.

---

## Checking actual power use

Use **Monitor → GPU (nvidia-smi)** or in a terminal:

```bash
nvidia-smi -l 1
```

- **Memory-Usage** — Will stay high (e.g. ~14,000 MiB) while the model is loaded; drops after unload or container stop.
- **GPU-Util** — Should be 0% when idle (no active inference).
- **Power Draw** — If this stays well above ~15–20 W when you’re not sending requests, the GPU is still in a high-power state (always-on or driver not idling). After sleep-idle unload or container stop, it should fall toward true idle.

---

## Summary

| Goal | What to do |
|------|------------|
| Lower power when idle without stopping the container | Set **Sleep idle (seconds)** on the container (e.g. 600 for 10 min). Uses `--sleep-idle-seconds`. |
| Lowest power when you’re done | **Stop container** (or `docker stop`). Start again when you need it. |
| See if GPU is really idling | Use **Monitor** tab or `nvidia-smi -l 1` and watch Power Draw and GPU-Util. |
