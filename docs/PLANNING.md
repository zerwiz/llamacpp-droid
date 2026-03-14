# PLANNING

## Overview

- **llama.cpp** runs in Docker (e.g. container name `llamacpp`), serving on port 8080.
- **llamacpp droid** is an Electron app that runs containers and streams `docker logs -f <container>` into a desktop UI.

## Current scope

1. llamacpp droid: connect to Docker, run/stop containers, run `docker logs -f <container>`, display output in a scrollable, follow-mode UI.
2. Optional: configurable container name and “clear” / “pause” in the UI.

## Integration

- Viewer assumes Docker is available and the user can run `docker logs`.
- No change to llama.cpp server or API; viewer is read-only (logs only).
