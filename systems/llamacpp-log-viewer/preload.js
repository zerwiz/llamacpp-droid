const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('logViewer', {
  startStream: (containerName) => ipcRenderer.invoke('log-stream:start', containerName),
  stopStream: () => ipcRenderer.invoke('log-stream:stop'),
  onData: (cb) => {
    const handler = (_, chunk) => cb(chunk);
    ipcRenderer.on('log-stream:data', handler);
    return () => ipcRenderer.removeListener('log-stream:data', handler);
  },
  onError: (cb) => {
    const handler = (_, msg) => cb(msg);
    ipcRenderer.on('log-stream:error', handler);
    return () => ipcRenderer.removeListener('log-stream:error', handler);
  },
  onClosed: (cb) => {
    const handler = (_, info) => cb(info);
    ipcRenderer.on('log-stream:closed', handler);
    return () => ipcRenderer.removeListener('log-stream:closed', handler);
  },
});

contextBridge.exposeInMainWorld('docker', {
  run: (config) => ipcRenderer.invoke('docker:run', config),
  create: (config) => ipcRenderer.invoke('docker:create', config),
  runPreset: (opts) => ipcRenderer.invoke('docker:runPreset', opts),
  stop: (containerName) => ipcRenderer.invoke('docker:stop', containerName),
  status: (containerName) => ipcRenderer.invoke('docker:status', containerName),
  getRuntime: () => ipcRenderer.invoke('container-runtime:get'),
});

contextBridge.exposeInMainWorld('findGguf', () => ipcRenderer.invoke('find-gguf'));

contextBridge.exposeInMainWorld('monitor', {
  nvidiaSmi: () => ipcRenderer.invoke('monitor:nvidia-smi'),
  top: () => ipcRenderer.invoke('monitor:top'),
  memory: () => ipcRenderer.invoke('monitor:memory'),
  disk: () => ipcRenderer.invoke('monitor:disk'),
  containerStats: () => ipcRenderer.invoke('monitor:container-stats'),
  network: () => ipcRenderer.invoke('monitor:network'),
  gpuQuery: () => ipcRenderer.invoke('monitor:gpu-query'),
  health: (url) => ipcRenderer.invoke('monitor:health', url),
  metrics: (url) => ipcRenderer.invoke('monitor:metrics', url),
  sensors: () => ipcRenderer.invoke('monitor:sensors'),
  logsTail: (containerName, tail) => ipcRenderer.invoke('monitor:logs-tail', containerName, tail),
});

contextBridge.exposeInMainWorld('app', {
  openUrl: (url) => ipcRenderer.invoke('app:open-url', url),
  runUpdate: () => ipcRenderer.invoke('app:run-update'),
  openRagDoc: () => ipcRenderer.invoke('app:open-rag-doc'),
});

contextBridge.exposeInMainWorld('rag', {
  query: (serverUrl, query, context) => ipcRenderer.invoke('rag:query', { serverUrl, query, context }),
});
