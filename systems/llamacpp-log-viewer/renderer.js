// ---- Containers state ----
const STORAGE_KEY = 'llamacpp-droid-settings';
const PROFILES_KEY = 'llamacpp-droid-profiles';
const SYSTEM_PROMPTS_KEY = 'llamacpp-droid-system-prompts';

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant';

function getSystemPromptPresets() {
  try {
    const raw = localStorage.getItem(SYSTEM_PROMPTS_KEY);
    if (!raw) return { presets: [{ id: 'default', name: 'Default', content: DEFAULT_SYSTEM_PROMPT }] };
    const data = JSON.parse(raw);
    const presets = Array.isArray(data.presets) && data.presets.length ? data.presets : [{ id: 'default', name: 'Default', content: DEFAULT_SYSTEM_PROMPT }];
    if (!presets.find((p) => p.id === 'default')) presets.unshift({ id: 'default', name: 'Default', content: DEFAULT_SYSTEM_PROMPT });
    return { presets };
  } catch (_) {
    return { presets: [{ id: 'default', name: 'Default', content: DEFAULT_SYSTEM_PROMPT }] };
  }
}

function saveSystemPromptPresets(presets) {
  try {
    localStorage.setItem(SYSTEM_PROMPTS_KEY, JSON.stringify({ presets }));
  } catch (_) {}
}
let nextContainerId = 1;
const containers = [];

const nav = document.getElementById('nav');
const containerTabsEl = document.getElementById('container-tabs');
const containerPanelsEl = document.getElementById('container-panels');
const btnAddContainer = document.getElementById('btnAddContainer');
const panelLogs = document.getElementById('panel-logs');
const template = document.getElementById('container-panel-template');

function getConfig(form, defaultName = 'llamacpp', defaultPort = 8080) {
  const fd = new FormData(form);
  const get = (name) => (fd.get(name) ?? form.querySelector('[name="' + name + '"]')?.value ?? '').trim();
  const threadVal = get('threads');
  const tbVal = get('threadsBatch');
  const batchVal = get('batchSize');
  const parallelVal = get('parallel');
  return {
    containerName: get('containerName') || defaultName,
    image: get('image') || 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    volumeHost: get('volumeHost') || '/home/zerwiz/.lmstudio/models',
    modelPath: get('modelPath') || '',
    host: get('host') || '0.0.0.0',
    port: parseInt(get('port') || String(defaultPort), 10),
    ctxSize: parseInt(get('ctxSize') || '32768', 10),
    ngl: parseInt(get('ngl') || '99', 10),
    memory: get('memory') || '24g',
    memorySwap: get('memorySwap') || '32g',
    restart: get('restart') || 'always',
    network: get('network') || 'host',
    gpus: (() => { const v = (get('gpus') || form.querySelector('[name="gpus"]')?.value || 'all').toLowerCase().trim(); return v === 'none' ? 'none' : 'all'; })(),
    threads: threadVal === '' ? undefined : threadVal,
    threadsBatch: tbVal === '' ? undefined : tbVal,
    batchSize: batchVal === '' ? undefined : batchVal,
    parallel: parallelVal === '' ? undefined : parallelVal,
    contBatching: form.querySelector('[name="contBatching"]').checked,
    contextShift: form.querySelector('[name="contextShift"]')?.checked || false,
    cachePrompt: form.querySelector('[name="cachePrompt"]')?.checked !== false,
    cacheReuse: get('cacheReuse') || undefined,
    cacheTypeK: get('cacheTypeK') || undefined,
    cacheTypeV: get('cacheTypeV') || undefined,
    cacheRam: get('cacheRam') || undefined,
    ctxCheckpoints: get('ctxCheckpoints') || undefined,
    kvUnified: form.querySelector('[name="kvUnified"]')?.checked !== false,
    sleepIdleSeconds: get('sleepIdleSeconds') || undefined,
  };
}

function getDefaultConfig(index) {
  const basePort = 8080 + index;
  const name = index === 0 ? 'llamacpp' : 'llamacpp' + (index + 1);
  return {
    tabName: name,
    containerName: name,
    image: 'ghcr.io/ggml-org/llama.cpp:server-cuda',
    volumeHost: '/home/zerwiz/.lmstudio/models',
    modelPath: '/models/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q3_K_S.gguf',
    host: '0.0.0.0',
    port: basePort,
    ctxSize: 32768,
    ngl: 99,
    memory: '24g',
    memorySwap: '32g',
    restart: 'always',
    network: 'host',
    gpus: 'all',
    threads: '',
    threadsBatch: '',
    batchSize: '',
    parallel: '',
    contBatching: false,
    contextShift: false,
    cachePrompt: true,
    cacheReuse: '',
    cacheTypeK: '',
    cacheTypeV: '',
    cacheRam: '',
    ctxCheckpoints: '',
    kvUnified: true,
    sleepIdleSeconds: '',
    systemPromptPresetId: 'default',
    systemPromptContent: DEFAULT_SYSTEM_PROMPT,
  };
}

function getContainerSettings(form, defaults) {
  const fd = new FormData(form);
  const get = (name) => (fd.get(name) ?? form.querySelector('[name="' + name + '"]')?.value ?? '').trim();
  const cb = form.querySelector('[name="contBatching"]');
  return {
    tabName: get('tabName') || defaults.containerName,
    containerName: get('containerName') || defaults.containerName,
    image: get('image') || defaults.image,
    volumeHost: get('volumeHost') || defaults.volumeHost,
    modelPath: get('modelPath') || '',
    host: get('host') || defaults.host,
    port: parseInt(get('port') || String(defaults.port), 10),
    ctxSize: parseInt(get('ctxSize') || '32768', 10),
    ngl: parseInt(get('ngl') || '99', 10),
    memory: get('memory') || defaults.memory,
    memorySwap: get('memorySwap') || defaults.memorySwap,
    restart: get('restart') || defaults.restart,
    network: get('network') || defaults.network,
    gpus: (() => { const v = (get('gpus') || form.querySelector('[name="gpus"]')?.value || defaults.gpus || 'all').toLowerCase().trim(); return v === 'none' ? 'none' : 'all'; })(),
    threads: get('threads'),
    threadsBatch: get('threadsBatch'),
    batchSize: get('batchSize'),
    parallel: get('parallel'),
    contBatching: cb ? cb.checked : false,
    contextShift: form.querySelector('[name="contextShift"]')?.checked || false,
    cachePrompt: form.querySelector('[name="cachePrompt"]')?.checked !== false,
    cacheReuse: get('cacheReuse') || '',
    cacheTypeK: get('cacheTypeK') || '',
    cacheTypeV: get('cacheTypeV') || '',
    cacheRam: get('cacheRam') || '',
    ctxCheckpoints: get('ctxCheckpoints') || '',
    kvUnified: form.querySelector('[name="kvUnified"]')?.checked !== false,
    sleepIdleSeconds: get('sleepIdleSeconds') || '',
    systemPromptPresetId: get('systemPromptPresetId') || 'default',
    systemPromptContent: get('systemPromptContent') || defaults.systemPromptContent || DEFAULT_SYSTEM_PROMPT,
  };
}

function getCurrentSettings() {
  const list = containers.map((entry) => getContainerSettings(entry.form, entry.defaults));
  const logName = document.getElementById('logContainerName');
  const ragSelect = document.getElementById('ragContainerSelect');
  return {
    version: 1,
    containers: list,
    logContainerName: logName ? logName.value.trim() || 'llamacpp' : 'llamacpp',
    ragContainerId: ragSelect ? (ragSelect.value || '') : '',
    swap: {
      containerName: swapContainerName ? swapContainerName.value.trim() : 'llamacpp',
      volumeHost: swapVolumeHost ? swapVolumeHost.value.trim() : '',
      heavyModelPath: swapHeavyModel ? swapHeavyModel.value.trim() : '',
      heavyCtx: swapHeavyCtx ? swapHeavyCtx.value : '',
      heavyNgl: swapHeavyNgl ? swapHeavyNgl.value : '',
      heavyCache: swapHeavyCache ? swapHeavyCache.value : '',
      contextShift: swapContextShift ? swapContextShift.checked : false,
      cacheReuse: swapCacheReuse ? swapCacheReuse.value.trim() : '',
      cacheRam: swapCacheRam ? swapCacheRam.value.trim() : '',
      lightModelPath: swapLightModel ? swapLightModel.value.trim() : '',
      lightCtx: swapLightCtx ? swapLightCtx.value : '',
      lightNgl: swapLightNgl ? swapLightNgl.value : '',
    },
  };
}

function saveSettings() {
  try {
    const payload = getCurrentSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function mergeWithDefaults(saved, index) {
  const def = getDefaultConfig(index);
  return {
    ...def,
    ...saved,
    port: saved.port != null ? saved.port : def.port,
    ctxSize: saved.ctxSize != null ? saved.ctxSize : def.ctxSize,
    ngl: saved.ngl != null ? saved.ngl : def.ngl,
    contBatching: !!saved.contBatching,
    contextShift: !!saved.contextShift,
    cachePrompt: saved.cachePrompt !== undefined ? !!saved.cachePrompt : def.cachePrompt,
    cacheReuse: saved.cacheReuse != null ? saved.cacheReuse : def.cacheReuse,
    cacheTypeK: saved.cacheTypeK != null ? saved.cacheTypeK : def.cacheTypeK,
    cacheTypeV: saved.cacheTypeV != null ? saved.cacheTypeV : def.cacheTypeV,
    cacheRam: saved.cacheRam != null ? saved.cacheRam : def.cacheRam,
    ctxCheckpoints: saved.ctxCheckpoints != null ? saved.ctxCheckpoints : def.ctxCheckpoints,
    kvUnified: saved.kvUnified !== undefined ? !!saved.kvUnified : def.kvUnified,
    sleepIdleSeconds: saved.sleepIdleSeconds != null ? saved.sleepIdleSeconds : def.sleepIdleSeconds,
    systemPromptPresetId: saved.systemPromptPresetId != null ? saved.systemPromptPresetId : def.systemPromptPresetId,
    systemPromptContent: saved.systemPromptContent != null ? saved.systemPromptContent : def.systemPromptContent,
  };
}

let monitorIntervalNvidia = null;
let monitorIntervalTop = null;
let monitorIntervalMemory = null;
let monitorIntervalDisk = null;
let monitorIntervalContainerStats = null;
let monitorIntervalNetwork = null;
let monitorIntervalGpuQuery = null;
let monitorIntervalHealth = null;
let monitorIntervalMetrics = null;
let monitorIntervalSensors = null;
let monitorIntervalLogsTail = null;

async function startMonitor() {
  stopMonitor();
  const nvidiaEl = document.getElementById('monitorNvidiaSmi');
  const topEl = document.getElementById('monitorTop');
  const memoryEl = document.getElementById('monitorMemory');
  const diskEl = document.getElementById('monitorDisk');
  const containerStatsEl = document.getElementById('monitorContainerStats');
  const networkEl = document.getElementById('monitorNetwork');
  const gpuQueryEl = document.getElementById('monitorGpuQuery');
  const healthEl = document.getElementById('monitorHealth');
  const metricsEl = document.getElementById('monitorMetrics');
  const sensorsEl = document.getElementById('monitorSensors');
  const logsTailEl = document.getElementById('monitorLogsTailOutput');

  // Show only monitor blocks supported on this system
  let caps = { nvidiaSmi: false, sensors: false };
  try {
    caps = await window.monitor.getCapabilities();
  } catch (_) {}
  document.querySelectorAll('.monitor-block[data-monitor-requires]').forEach((block) => {
    const req = block.getAttribute('data-monitor-requires');
    block.classList.toggle('monitor-unsupported', !caps[req]);
  });

  function isMonitorActive() {
    return document.getElementById('panel-monitor').classList.contains('active');
  }
  function getMonitorServerUrl() {
    const el = document.getElementById('monitorServerUrl');
    return (el && el.value.trim()) || 'http://localhost:8080';
  }
  function getMonitorLogsContainer() {
    const el = document.getElementById('monitorLogsContainer');
    return (el && el.value.trim()) || 'llamacpp';
  }
  function getMonitorLogsTailLines() {
    const el = document.getElementById('monitorLogsTailLines');
    const n = parseInt(el && el.value ? el.value : 30, 10);
    return isNaN(n) ? 30 : Math.min(200, Math.max(5, n));
  }

  function updateNvidia() {
    if (!nvidiaEl || !isMonitorActive()) return;
    window.monitor.nvidiaSmi().then((r) => {
      if (r.error) nvidiaEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else nvidiaEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateTop() {
    if (!topEl || !isMonitorActive()) return;
    window.monitor.top().then((r) => {
      if (r.error) topEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else topEl.textContent = (r.stdout || '(no output)').slice(0, 8000);
    });
  }
  function updateMemory() {
    if (!memoryEl || !isMonitorActive()) return;
    window.monitor.memory().then((r) => {
      if (r.error) memoryEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else memoryEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateDisk() {
    if (!diskEl || !isMonitorActive()) return;
    window.monitor.disk().then((r) => {
      if (r.error) diskEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else diskEl.textContent = (r.stdout || '(no output)').slice(0, 4000);
    });
  }
  function updateContainerStats() {
    if (!containerStatsEl || !isMonitorActive()) return;
    window.monitor.containerStats().then((r) => {
      if (r.error) containerStatsEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else containerStatsEl.textContent = r.stdout || '(no containers or runtime not available)';
    });
  }
  function updateNetwork() {
    if (!networkEl || !isMonitorActive()) return;
    window.monitor.network().then((r) => {
      if (r.error) networkEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else networkEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateGpuQuery() {
    if (!gpuQueryEl || !isMonitorActive()) return;
    window.monitor.gpuQuery().then((r) => {
      if (r.error) gpuQueryEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else gpuQueryEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateHealth() {
    if (!healthEl || !isMonitorActive()) return;
    window.monitor.health(getMonitorServerUrl()).then((r) => {
      if (r.error) healthEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else healthEl.textContent = r.stdout || '(no response)';
    });
  }
  function updateMetrics() {
    if (!metricsEl || !isMonitorActive()) return;
    window.monitor.metrics(getMonitorServerUrl()).then((r) => {
      if (r.error) metricsEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else metricsEl.textContent = (r.stdout || '(no response)').slice(0, 6000);
    });
  }
  function updateSensors() {
    if (!sensorsEl || !isMonitorActive()) return;
    window.monitor.sensors().then((r) => {
      if (r.error) sensorsEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '') + '\n(Install lm-sensors if needed.)';
      else sensorsEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateLogsTail() {
    if (!logsTailEl || !isMonitorActive()) return;
    window.monitor.logsTail(getMonitorLogsContainer(), getMonitorLogsTailLines()).then((r) => {
      if (r.error) logsTailEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else logsTailEl.textContent = r.stdout || '(no output)';
    });
  }

  if (caps.nvidiaSmi) {
    updateNvidia();
    updateGpuQuery();
    monitorIntervalNvidia = setInterval(updateNvidia, 1000);
    monitorIntervalGpuQuery = setInterval(updateGpuQuery, 2000);
  }
  if (caps.sensors) {
    updateSensors();
    monitorIntervalSensors = setInterval(updateSensors, 5000);
  }
  updateTop();
  updateMemory();
  updateDisk();
  updateContainerStats();
  updateNetwork();
  updateHealth();
  updateMetrics();
  updateLogsTail();
  monitorIntervalTop = setInterval(updateTop, 2000);
  monitorIntervalMemory = setInterval(updateMemory, 3000);
  monitorIntervalDisk = setInterval(updateDisk, 5000);
  monitorIntervalContainerStats = setInterval(updateContainerStats, 2000);
  monitorIntervalNetwork = setInterval(updateNetwork, 4000);
  monitorIntervalHealth = setInterval(updateHealth, 3000);
  monitorIntervalMetrics = setInterval(updateMetrics, 5000);
  monitorIntervalLogsTail = setInterval(updateLogsTail, 3000);
}

function stopMonitor() {
  if (monitorIntervalNvidia) clearInterval(monitorIntervalNvidia);
  if (monitorIntervalTop) clearInterval(monitorIntervalTop);
  if (monitorIntervalMemory) clearInterval(monitorIntervalMemory);
  if (monitorIntervalDisk) clearInterval(monitorIntervalDisk);
  if (monitorIntervalContainerStats) clearInterval(monitorIntervalContainerStats);
  if (monitorIntervalNetwork) clearInterval(monitorIntervalNetwork);
  if (monitorIntervalGpuQuery) clearInterval(monitorIntervalGpuQuery);
  if (monitorIntervalHealth) clearInterval(monitorIntervalHealth);
  if (monitorIntervalMetrics) clearInterval(monitorIntervalMetrics);
  if (monitorIntervalSensors) clearInterval(monitorIntervalSensors);
  if (monitorIntervalLogsTail) clearInterval(monitorIntervalLogsTail);
  monitorIntervalNvidia = null;
  monitorIntervalTop = null;
  monitorIntervalMemory = null;
  monitorIntervalDisk = null;
  monitorIntervalContainerStats = null;
  monitorIntervalNetwork = null;
  monitorIntervalGpuQuery = null;
  monitorIntervalHealth = null;
  monitorIntervalMetrics = null;
  monitorIntervalSensors = null;
  monitorIntervalLogsTail = null;
}

function showPanel(tabId) {
  const panelId = tabId === 'logs' ? 'panel-logs' : tabId === 'monitor' ? 'panel-monitor' : tabId === 'swap' ? 'panel-swap' : tabId === 'rag' ? 'panel-rag' : tabId === 'models' ? 'panel-models' : tabId === 'settings' ? 'panel-settings' : 'panel-' + tabId;
  document.querySelectorAll('#container-panels .panel, #panel-logs, #panel-swap, #panel-monitor, #panel-rag, #panel-models, #panel-settings').forEach((p) => {
    p.classList.toggle('active', p.id === panelId);
  });
  document.querySelectorAll('#nav .tab[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  if (tabId === 'monitor') startMonitor();
  else stopMonitor();
  if (tabId === 'settings') refreshSettingsConfigUI();
}

function addContainer(defaults) {
  const id = nextContainerId++;
  const panel = template.content.cloneNode(true);
  const section = panel.querySelector('section');
  const card = section.querySelector('.runner-card');
  const statusEl = card.querySelector('.runner-status');
  const serverRowEl = card.querySelector('.runner-server-row');
  const serverUrlEl = card.querySelector('.runner-server-url');
  const btnOpenWebui = card.querySelector('.btn-open-webui');
  const form = card.querySelector('form');
  const messageEl = card.querySelector('.runner-message');
  const btnCreate = card.querySelector('.btn-create');
  const btnStop = card.querySelector('.btn-stop');
  const btnDelete = card.querySelector('.btn-delete');
  const btnRestartContainer = card.querySelector('.btn-restart-container');

  section.id = 'panel-container-' + id;
  section.dataset.containerId = String(id);
  section.classList.add('panel');

  form.querySelector('[name="tabName"]').value = defaults.tabName || defaults.containerName;
  form.querySelector('[name="containerName"]').value = defaults.containerName;
  form.querySelector('[name="image"]').value = defaults.image;
  form.querySelector('[name="volumeHost"]').value = defaults.volumeHost;
  form.querySelector('[name="modelPath"]').value = defaults.modelPath;
  form.querySelector('[name="host"]').value = defaults.host;
  form.querySelector('[name="port"]').value = defaults.port;
  form.querySelector('[name="ctxSize"]').value = defaults.ctxSize;
  form.querySelector('[name="ngl"]').value = defaults.ngl;
  form.querySelector('[name="memory"]').value = defaults.memory;
  form.querySelector('[name="memorySwap"]').value = defaults.memorySwap;
  form.querySelector('[name="restart"]').value = defaults.restart;
  form.querySelector('[name="network"]').value = defaults.network;
  const gpusEl = form.querySelector('[name="gpus"]');
  if (gpusEl) gpusEl.value = (defaults.gpus === 'none') ? 'none' : 'all';
  if (defaults.threads !== undefined && defaults.threads !== '') form.querySelector('[name="threads"]').value = defaults.threads;
  if (defaults.threadsBatch !== undefined && defaults.threadsBatch !== '') form.querySelector('[name="threadsBatch"]').value = defaults.threadsBatch;
  if (defaults.batchSize !== undefined && defaults.batchSize !== '') form.querySelector('[name="batchSize"]').value = defaults.batchSize;
  if (defaults.parallel !== undefined && defaults.parallel !== '') form.querySelector('[name="parallel"]').value = defaults.parallel;
  const cbInput = form.querySelector('[name="contBatching"]');
  if (cbInput) cbInput.checked = !!defaults.contBatching;
  const ctxShiftInput = form.querySelector('[name="contextShift"]');
  if (ctxShiftInput) ctxShiftInput.checked = !!defaults.contextShift;
  if (defaults.cacheTypeK) form.querySelector('[name="cacheTypeK"]').value = defaults.cacheTypeK;
  if (defaults.cacheTypeV) form.querySelector('[name="cacheTypeV"]').value = defaults.cacheTypeV;
  const cachePromptInput = form.querySelector('[name="cachePrompt"]');
  if (cachePromptInput) cachePromptInput.checked = defaults.cachePrompt !== false;
  if (defaults.cacheReuse !== undefined && defaults.cacheReuse !== '') form.querySelector('[name="cacheReuse"]').value = defaults.cacheReuse;
  if (defaults.cacheRam !== undefined && defaults.cacheRam !== '') form.querySelector('[name="cacheRam"]').value = defaults.cacheRam;
  if (defaults.ctxCheckpoints !== undefined && defaults.ctxCheckpoints !== '') form.querySelector('[name="ctxCheckpoints"]').value = defaults.ctxCheckpoints;
  const kvUnifiedInput = form.querySelector('[name="kvUnified"]');
  if (kvUnifiedInput) kvUnifiedInput.checked = defaults.kvUnified !== false;
  if (defaults.sleepIdleSeconds) form.querySelector('[name="sleepIdleSeconds"]').value = defaults.sleepIdleSeconds;
  const systemPromptPresetSelect = form.querySelector('[name="systemPromptPresetId"]');
  const systemPromptContentTa = form.querySelector('[name="systemPromptContent"]');
  if (systemPromptPresetSelect) systemPromptPresetSelect.value = defaults.systemPromptPresetId || 'default';
  if (systemPromptContentTa) systemPromptContentTa.value = defaults.systemPromptContent || DEFAULT_SYSTEM_PROMPT;

  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  tabBtn.className = 'tab';
  tabBtn.dataset.tab = 'container-' + id;
  tabBtn.textContent = defaults.tabName || defaults.containerName;

  const tabNameInput = form.querySelector('[name="tabName"]');
  function updateTabLabel() {
    const v = tabNameInput.value.trim();
    tabBtn.textContent = v || form.querySelector('[name="containerName"]').value.trim() || defaults.containerName;
  }
  tabNameInput.addEventListener('input', updateTabLabel);
  tabNameInput.addEventListener('change', updateTabLabel);

  const btnFindModels = form.querySelector('.btn-find-models');
  const modelListWrap = form.querySelector('.model-list-wrap');
  const modelListStatus = form.querySelector('.model-list-status');
  const modelList = form.querySelector('.model-list');
  const modelPathInput = form.querySelector('[name="modelPath"]');

  btnFindModels.addEventListener('click', async () => {
    modelListWrap.classList.remove('hidden');
    modelListStatus.textContent = 'Searching $HOME, /data, /mnt, /media, ~/.cache, ~/models for *.gguf…';
    modelList.innerHTML = '';
    try {
      const { paths, error } = await window.findGguf();
      if (error) {
        modelListStatus.textContent = 'Error: ' + error;
        return;
      }
      if (!paths.length) {
        modelListStatus.textContent = 'No .gguf files found in search locations.';
        return;
      }
      modelListStatus.textContent = paths.length + ' model(s) found. Click one to use:';
      const volumeHost = (form.querySelector('[name="volumeHost"]').value.trim() || defaults.volumeHost || '').replace(/\/+$/, '');
      paths.forEach((hostPath) => {
        const li = document.createElement('li');
        li.className = 'model-list-item';
        li.textContent = hostPath;
        li.title = hostPath;
        li.addEventListener('click', () => {
          const vol = volumeHost || hostPath.split('/').slice(0, -1).join('/');
          const containerPath = hostPath.startsWith(vol) ? '/models' + hostPath.slice(vol.length).replace(/^\/+/, '/') : '/models/' + hostPath.split('/').pop();
          modelPathInput.value = containerPath;
          modelListWrap.classList.add('hidden');
        });
        modelList.appendChild(li);
      });
    } catch (err) {
      modelListStatus.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    }
  });

  function setMessage(msg, type = '') {
    messageEl.textContent = msg || '';
    messageEl.className = 'runner-message ' + type;
  }

  function getServerUrl() {
    const host = (form.querySelector('[name="host"]').value || '0.0.0.0').trim();
    const port = form.querySelector('[name="port"]').value || String(defaults.port || 8080);
    const useHost = (host === '0.0.0.0' || host === '') ? 'localhost' : host;
    return 'http://' + useHost + ':' + port;
  }

  async function refreshStatus() {
    const name = form.querySelector('[name="containerName"]').value.trim() || defaults.containerName;
    try {
      const r = await window.docker.status(name);
      if (r.running) {
        statusEl.textContent = 'Container “‘ + name +’” is running';
        statusEl.className = 'runner-status running';
        if (serverUrlEl) serverUrlEl.textContent = getServerUrl();
        if (serverRowEl) serverRowEl.classList.remove('hidden');
      } else {
        statusEl.textContent = 'Container “‘ + name +’” is stopped';
        statusEl.className = 'runner-status stopped';
        if (serverRowEl) serverRowEl.classList.add('hidden');
      }
    } catch (_) {
      statusEl.textContent = 'Container “‘ + name +’” not found or error';
      statusEl.className = 'runner-status stopped';
      if (serverRowEl) serverRowEl.classList.add('hidden');
    }
  }

  if (btnOpenWebui && window.app && typeof window.app.openUrl === 'function') {
    btnOpenWebui.addEventListener('click', () => {
      window.app.openUrl(getServerUrl());
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const config = getConfig(form, defaults.containerName, defaults.port);
    const runBtn = form.querySelector('button[type="submit"]');
    runBtn.disabled = true;
    setMessage('Starting…');
    try {
      const result = await window.docker.run(config);
      if (result.ok) {
        setMessage('Container started successfully.\nServer at http://localhost:' + config.port + ' once the model has loaded. If it doesn’t connect, the server inside may have failed (e.g. out of memory) — check the Logs tab.', 'success');
        refreshStatus();
        updateTabLabel();
        if (window.app && typeof window.app.getLocalAddresses === 'function') {
          window.app.getLocalAddresses().then((r) => {
            window._cachedLanIp = r.lanIp || null;
            updateZedUrl();
          });
        }
      } else {
        setMessage(result.error || 'Run failed', 'error');
      }
    } catch (err) {
      setMessage(err && err.message ? err.message : String(err), 'error');
    }
    runBtn.disabled = false;
  });

  btnCreate.addEventListener('click', async () => {
    const config = getConfig(form, defaults.containerName, defaults.port);
    btnCreate.disabled = true;
    setMessage('Creating…');
    try {
      const result = await window.docker.create(config);
      if (result.ok) {
        setMessage('Container created successfully (not started). Use Run container to start.', 'success');
        refreshStatus();
        updateTabLabel();
        if (window.app && typeof window.app.getLocalAddresses === 'function') {
          window.app.getLocalAddresses().then((r) => {
            window._cachedLanIp = r.lanIp || null;
            updateZedUrl();
          });
        }
      } else {
        setMessage(result.error || 'Create failed', 'error');
      }
    } catch (err) {
      setMessage(err && err.message ? err.message : String(err), 'error');
    }
    btnCreate.disabled = false;
  });

  btnStop.addEventListener('click', async () => {
    const name = form.querySelector('[name="containerName"]').value.trim() || defaults.containerName;
    btnStop.disabled = true;
    setMessage('Stopping…');
    try {
      const result = await window.docker.stop(name);
      if (result.ok) {
        setMessage('Container stopped.', 'success');
        refreshStatus();
      } else {
        setMessage(result.error || 'Stop failed', 'error');
      }
    } catch (err) {
      setMessage(err && err.message ? err.message : String(err), 'error');
    }
    btnStop.disabled = false;
  });

  if (btnRestartContainer) {
    btnRestartContainer.addEventListener('click', async () => {
      const name = form.querySelector('[name="containerName"]').value.trim() || defaults.containerName;
      const config = getConfig(form, defaults.containerName, defaults.port);
      btnRestartContainer.disabled = true;
      setMessage('Stopping…');
      try {
        const stopResult = await window.docker.stop(name);
        if (!stopResult.ok) {
          setMessage(stopResult.error || 'Stop failed', 'error');
          btnRestartContainer.disabled = false;
          return;
        }
        setMessage('Starting with current settings…');
        const runResult = await window.docker.run(config);
        if (runResult.ok) {
          setMessage('Container restarted successfully.\nServer at http://localhost:' + config.port + ' once the model has loaded. If it doesn’t connect, the server inside may have failed (e.g. out of memory) — check the Logs tab.', 'success');
          refreshStatus();
          updateTabLabel();
          if (window.app && typeof window.app.getLocalAddresses === 'function') {
            window.app.getLocalAddresses().then((r) => {
              window._cachedLanIp = r.lanIp || null;
              updateZedUrl();
            });
          }
        } else {
          setMessage(runResult.error || 'Run failed', 'error');
        }
      } catch (err) {
        setMessage(err && err.message ? err.message : String(err), 'error');
      }
      btnRestartContainer.disabled = false;
    });
  }

  btnDelete.addEventListener('click', () => {
    removeContainer(id);
  });

  refreshContainerSystemPromptPresetDropdown(form, defaults);
  const sysPromptSelect = form.querySelector('[name="systemPromptPresetId"]');
  const sysPromptTextarea = form.querySelector('[name="systemPromptContent"]');
  const btnSysPromptSave = card.querySelector('.btn-container-system-prompt-save');
  const btnSysPromptDelete = card.querySelector('.btn-container-system-prompt-delete');
  if (sysPromptSelect) {
    sysPromptSelect.addEventListener('change', () => {
      const { presets } = getSystemPromptPresets();
      const p = presets.find((x) => x.id === sysPromptSelect.value);
      if (sysPromptTextarea && p) sysPromptTextarea.value = p.content || '';
      defaults.systemPromptPresetId = sysPromptSelect.value;
      defaults.systemPromptContent = sysPromptTextarea ? sysPromptTextarea.value : DEFAULT_SYSTEM_PROMPT;
      saveSettings();
    });
  }
  if (btnSysPromptSave) {
    btnSysPromptSave.addEventListener('click', () => {
      const name = window.prompt('Preset name', 'My preset');
      if (!name || !name.trim()) return;
      const content = (sysPromptTextarea && sysPromptTextarea.value) ? sysPromptTextarea.value.trim() : '';
      const { presets } = getSystemPromptPresets();
      const newId = 'p' + Date.now();
      presets.push({ id: newId, name: name.trim(), content: content || DEFAULT_SYSTEM_PROMPT });
      saveSystemPromptPresets(presets);
      defaults.systemPromptPresetId = newId;
      defaults.systemPromptContent = content || DEFAULT_SYSTEM_PROMPT;
      refreshContainerSystemPromptPresetDropdown(form, defaults);
      refreshAllContainerSystemPromptPresetDropdowns();
      if (sysPromptSelect) sysPromptSelect.value = newId;
      saveSettings();
    });
  }
  if (btnSysPromptDelete) {
    btnSysPromptDelete.addEventListener('click', () => {
      const id = sysPromptSelect && sysPromptSelect.value ? sysPromptSelect.value : '';
      if (id === 'default') return;
      const { presets } = getSystemPromptPresets();
      const next = presets.filter((p) => p.id !== id);
      saveSystemPromptPresets(next);
      if (defaults.systemPromptPresetId === id) {
        defaults.systemPromptPresetId = 'default';
        defaults.systemPromptContent = DEFAULT_SYSTEM_PROMPT;
        if (sysPromptTextarea) sysPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
      }
      refreshContainerSystemPromptPresetDropdown(form, defaults);
      refreshAllContainerSystemPromptPresetDropdowns();
      saveSettings();
    });
  }

  const zedUrlEl = card.querySelector('.container-zed-url');
  const zedLanRow = card.querySelector('.container-zed-lan-row');
  const zedLanUrlEl = card.querySelector('.container-zed-lan-url');
  function updateZedUrl() {
    const host = (form.querySelector('[name="host"]') && form.querySelector('[name="host"]').value) ? form.querySelector('[name="host"]').value.trim() : (defaults.host || '0.0.0.0');
    const port = (form.querySelector('[name="port"]') && form.querySelector('[name="port"]').value) ? form.querySelector('[name="port"]').value : (defaults.port || 8080);
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    if (zedUrlEl) zedUrlEl.textContent = 'http://' + displayHost + ':' + port + '/v1';
    const lanIp = window._cachedLanIp;
    if (zedLanRow && zedLanUrlEl) {
      if (lanIp && (host === '0.0.0.0' || host === '')) {
        zedLanUrlEl.textContent = 'http://' + lanIp + ':' + port + '/v1';
        zedLanRow.classList.remove('hidden');
      } else {
        zedLanRow.classList.add('hidden');
      }
    }
  }
  updateZedUrl();
  if (window.app && typeof window.app.getLocalAddresses === 'function' && !window._lanAddressesRequested) {
    window._lanAddressesRequested = true;
    window.app.getLocalAddresses().then((r) => {
      window._cachedLanIp = r.lanIp || null;
      containers.forEach((c) => {
        const form = c.form;
        const card = form && form.closest ? form.closest('.runner-card') : null;
        if (!card) return;
        const row = card.querySelector('.container-zed-lan-row');
        const urlEl = card.querySelector('.container-zed-lan-url');
        if (!row || !urlEl) return;
        const host = (form.querySelector('[name="host"]') && form.querySelector('[name="host"]').value) ? form.querySelector('[name="host"]').value.trim() : (c.defaults.host || '0.0.0.0');
        const port = (form.querySelector('[name="port"]') && form.querySelector('[name="port"]').value) ? form.querySelector('[name="port"]').value : (c.defaults.port || 8080);
        if (window._cachedLanIp && (host === '0.0.0.0' || host === '')) {
          urlEl.textContent = 'http://' + window._cachedLanIp + ':' + port + '/v1';
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    });
  }
  const hostInput = form.querySelector('[name="host"]');
  const portInput = form.querySelector('[name="port"]');
  if (hostInput) hostInput.addEventListener('input', updateZedUrl);
  if (hostInput) hostInput.addEventListener('change', updateZedUrl);
  if (portInput) portInput.addEventListener('input', updateZedUrl);
  if (portInput) portInput.addEventListener('change', updateZedUrl);
  card.querySelectorAll('.btn-copy-zed-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const which = btn.getAttribute('data-copy');
      let text = '';
      if (which === 'url') {
        updateZedUrl();
        text = zedUrlEl ? zedUrlEl.textContent.trim() : 'http://localhost:8080/v1';
      } else if (which === 'lan-url') {
        updateZedUrl();
        text = zedLanUrlEl ? zedLanUrlEl.textContent.trim() : '';
      } else if (which === 'key') {
        const el = card.querySelector('.container-zed-key');
        text = el ? el.textContent.trim() : 'ollama';
      } else if (which === 'model') {
        const el = card.querySelector('.container-zed-model');
        text = el ? el.textContent.trim() : 'default';
      }
      if (which === 'lan-url' && !text) return;
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      } catch (_) {
        btn.textContent = 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }
    });
  });

  tabBtn.addEventListener('click', () => showPanel('container-' + id));

  let saveTimeout = null;
  function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveSettings, 400);
  }
  form.addEventListener('input', debouncedSave);
  form.addEventListener('change', debouncedSave);

  containerTabsEl.appendChild(tabBtn);
  containerPanelsEl.appendChild(panel);
  containers.push({ id, section, tabBtn, form, defaults });
  refreshStatus();
  showPanel('container-' + id);
  refreshRagContainerDropdown();
  saveSettings();
}

function removeContainer(id) {
  const idx = containers.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const currentTab = document.querySelector('#nav .tab.active');
  const wasViewingThis = currentTab && currentTab.dataset.tab === 'container-' + id;
  const [entry] = containers.splice(idx, 1);
  entry.tabBtn.remove();
  entry.section.remove();
  refreshRagContainerDropdown();
  saveSettings();
  if (wasViewingThis) {
    if (containers.length > 0) {
      showPanel('container-' + containers[0].id);
    } else {
      showPanel('logs');
    }
  }
}

function removeAllContainers() {
  while (containers.length > 0) {
    const [entry] = containers.splice(0, 1);
    entry.tabBtn.remove();
    entry.section.remove();
  }
}

// ---- Profiles (named saved settings) ----
function loadProfilesList() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.list) ? parsed.list : [];
  } catch (_) {
    return [];
  }
}

function saveProfilesList(list) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ list }));
  } catch (_) {}
}

function applySettingsToUI(data) {
  if (!data) return;
  if (data.logContainerName != null && logContainerName) logContainerName.value = data.logContainerName;
  if (data.swap) {
    if (swapContainerName && data.swap.containerName != null) swapContainerName.value = data.swap.containerName;
    if (swapVolumeHost && data.swap.volumeHost != null) swapVolumeHost.value = data.swap.volumeHost;
    if (swapHeavyModel && data.swap.heavyModelPath != null) swapHeavyModel.value = data.swap.heavyModelPath;
    if (swapHeavyCtx && data.swap.heavyCtx != null) swapHeavyCtx.value = data.swap.heavyCtx;
    if (swapHeavyNgl && data.swap.heavyNgl != null) swapHeavyNgl.value = data.swap.heavyNgl;
    if (swapHeavyCache && data.swap.heavyCache != null) swapHeavyCache.value = data.swap.heavyCache;
    if (swapContextShift && data.swap.contextShift != null) swapContextShift.checked = !!data.swap.contextShift;
    if (swapCacheReuse && data.swap.cacheReuse != null) swapCacheReuse.value = data.swap.cacheReuse;
    if (swapCacheRam && data.swap.cacheRam != null) swapCacheRam.value = data.swap.cacheRam;
    if (swapLightModel && data.swap.lightModelPath != null) swapLightModel.value = data.swap.lightModelPath;
    if (swapLightCtx && data.swap.lightCtx != null) swapLightCtx.value = data.swap.lightCtx;
    if (swapLightNgl && data.swap.lightNgl != null) swapLightNgl.value = data.swap.lightNgl;
  }
  if (data.ragContainerId != null && data.ragContainerId !== '') {
    const ragSel = document.getElementById('ragContainerSelect');
    if (ragSel && containers.some((c) => String(c.id) === String(data.ragContainerId))) {
      ragSel.value = String(data.ragContainerId);
      const ragUrlEl = document.getElementById('ragServerUrl');
      if (ragUrlEl) {
        const entry = containers.find((c) => String(c.id) === String(data.ragContainerId));
        if (entry) ragUrlEl.value = getContainerUrl(entry);
      }
    }
  }
}

function loadProfile(data) {
  if (!data || !Array.isArray(data.containers)) return;
  removeAllContainers();
  data.containers.forEach((c, i) => addContainer(mergeWithDefaults(c, i)));
  applySettingsToUI(data);
  saveSettings();
  refreshProfileDropdown();
  showPanel(containers.length > 0 ? 'container-' + containers[0].id : 'logs');
}

function refreshContainerSystemPromptPresetDropdown(form, containerDefaults) {
  const select = form && form.querySelector('[name="systemPromptPresetId"]');
  if (!select) return;
  const { presets } = getSystemPromptPresets();
  const selectedId = (containerDefaults && containerDefaults.systemPromptPresetId) || select.value || 'default';
  select.innerHTML = '';
  presets.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  const hasSelected = presets.some((p) => p.id === selectedId);
  select.value = hasSelected ? selectedId : 'default';
}

function refreshAllContainerSystemPromptPresetDropdowns() {
  containers.forEach((c) => refreshContainerSystemPromptPresetDropdown(c.form, c.defaults));
}

function refreshProfileDropdown() {
  const selects = document.querySelectorAll('.container-profile-select');
  if (!selects.length) return;
  const list = loadProfilesList();
  const selected = selects[0].value;
  selects.forEach((sel) => {
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— Load profile —';
    sel.appendChild(opt0);
    list.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name || 'Unnamed';
      sel.appendChild(opt);
    });
    if (selected && list.some((p) => p.id === selected)) sel.value = selected;
  });
}

btnAddContainer.addEventListener('click', () => {
  const index = containers.length;
  const defaults = getDefaultConfig(index);
  addContainer(defaults);
  refreshProfileDropdown();
});

nav.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab[data-tab]');
  if (!tab) return;
  const tabId = tab.dataset.tab;
  if (tabId === 'logs' || tabId === 'monitor' || tabId === 'swap' || tabId === 'rag' || tabId === 'models' || tabId === 'settings' || (tabId && tabId.startsWith('container-'))) {
    showPanel(tabId);
  }
});

// ---- Logs ----
const logOutput = document.getElementById('logOutput');
const logContainer = document.querySelector('.log-container');
const btnToggle = document.getElementById('btnToggle');
const btnClear = document.getElementById('btnClear');
const logContainerName = document.getElementById('logContainerName');
const statusEl = document.getElementById('status');

let streaming = false;

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + type;
}

function appendLog(chunk) {
  const text = typeof chunk === 'string' ? chunk : String(chunk);
  logOutput.textContent += text;
  if (streaming && logContainer) {
    logContainer.scrollTop = logContainer.scrollHeight;
  }
}

btnToggle.addEventListener('click', async () => {
  if (streaming) {
    await window.logViewer.stopStream();
    streaming = false;
    btnToggle.textContent = 'Start stream';
    btnToggle.classList.remove('streaming');
    setStatus('Stream stopped.', '');
    return;
  }
  const name = logContainerName.value.trim() || 'llamacpp';
  try {
    await window.logViewer.startStream(name);
    streaming = true;
    btnToggle.textContent = 'Stop stream';
    btnToggle.classList.add('streaming');
    setStatus(`Streaming logs from container "${name}"…`, 'live');
  } catch (err) {
    setStatus('Error: ' + (err && err.message ? err.message : String(err)), 'error');
  }
});

btnClear.addEventListener('click', () => {
  logOutput.textContent = '';
  if (!streaming) setStatus('Log cleared.');
});

window.logViewer.onData(appendLog);
window.logViewer.onError((msg) => setStatus('Error: ' + msg, 'error'));
window.logViewer.onClosed(() => {
  streaming = false;
  btnToggle.textContent = 'Start stream';
  btnToggle.classList.remove('streaming');
  if (!statusEl.classList.contains('error')) setStatus('Stream ended.', '');
});

// ---- Swap (presets) ----
const swapContainerName = document.getElementById('swapContainerName');
const swapVolumeHost = document.getElementById('swapVolumeHost');
const swapHeavyModel = document.getElementById('swapHeavyModel');
const swapHeavyCtx = document.getElementById('swapHeavyCtx');
const swapHeavyNgl = document.getElementById('swapHeavyNgl');
const swapHeavyCache = document.getElementById('swapHeavyCache');
const swapContextShift = document.getElementById('swapContextShift');
const swapCacheReuse = document.getElementById('swapCacheReuse');
const swapCacheRam = document.getElementById('swapCacheRam');
const swapLightModel = document.getElementById('swapLightModel');
const swapLightCtx = document.getElementById('swapLightCtx');
const swapLightNgl = document.getElementById('swapLightNgl');
const swapHeavyBtn = document.getElementById('swapHeavy');
const swapLightBtn = document.getElementById('swapLight');
const swapMessage = document.getElementById('swapMessage');

function getSwapOpts() {
  return {
    containerName: swapContainerName.value.trim() || 'llamacpp',
    volumeHost: swapVolumeHost.value.trim() || '/home/zerwiz/.lmstudio/models',
    heavyModelPath: swapHeavyModel ? swapHeavyModel.value.trim() : '',
    heavyCtx: swapHeavyCtx ? swapHeavyCtx.value : '',
    heavyNgl: swapHeavyNgl ? swapHeavyNgl.value : '',
    heavyCache: swapHeavyCache ? swapHeavyCache.value.trim() : '',
    contextShift: swapContextShift ? swapContextShift.checked : false,
    cacheReuse: swapCacheReuse ? swapCacheReuse.value.trim() : '',
    cacheRam: swapCacheRam ? swapCacheRam.value.trim() : '',
    lightModelPath: swapLightModel ? swapLightModel.value.trim() : '',
    lightCtx: swapLightCtx ? swapLightCtx.value : '',
    lightNgl: swapLightNgl ? swapLightNgl.value : '',
  };
}

function setSwapMessage(msg, type = '') {
  swapMessage.textContent = msg || '';
  swapMessage.className = 'runner-message ' + type;
}

swapHeavyBtn.addEventListener('click', async () => {
  swapHeavyBtn.disabled = true;
  setSwapMessage('Swapping to Heavy (30B, 20k ctx)…');
  try {
    const opts = getSwapOpts();
    const result = await window.docker.runPreset({
      containerName: opts.containerName,
      preset: 'heavy',
      volumeHost: opts.volumeHost,
      heavyModelPath: opts.heavyModelPath,
      heavyCtx: opts.heavyCtx,
      heavyNgl: opts.heavyNgl,
      heavyCache: opts.heavyCache,
      contextShift: opts.contextShift,
      cacheReuse: opts.cacheReuse,
      cacheRam: opts.cacheRam,
    });
    if (result.ok) setSwapMessage('Heavy preset running.', 'success');
    else setSwapMessage(result.error || 'Failed', 'error');
  } catch (err) {
    setSwapMessage(err && err.message ? err.message : String(err), 'error');
  }
  swapHeavyBtn.disabled = false;
});

swapLightBtn.addEventListener('click', async () => {
  swapLightBtn.disabled = true;
  setSwapMessage('Swapping to Light (7B, 4k ctx)…');
  try {
    const opts = getSwapOpts();
    const result = await window.docker.runPreset({
      containerName: opts.containerName,
      preset: 'light',
      volumeHost: opts.volumeHost,
      lightModelPath: opts.lightModelPath,
      lightCtx: opts.lightCtx,
      lightNgl: opts.lightNgl,
      contextShift: opts.contextShift,
      cacheReuse: opts.cacheReuse,
      cacheRam: opts.cacheRam,
    });
    if (result.ok) setSwapMessage('Light preset running.', 'success');
    else setSwapMessage(result.error || 'Failed', 'error');
  } catch (err) {
    setSwapMessage(err && err.message ? err.message : String(err), 'error');
  }
  swapLightBtn.disabled = false;
});

// ---- Profile: Load / Save / Delete (per container — same global profile list) ----
const profileSaveModal = document.getElementById('profileSaveModal');
const profileSaveModalInput = document.getElementById('profileSaveModalInput');
const profileSaveModalOk = document.getElementById('profileSaveModalOk');
const profileSaveModalCancel = document.getElementById('profileSaveModalCancel');
const profileSaveModalBackdrop = document.getElementById('profileSaveModalBackdrop');

document.body.addEventListener('change', (e) => {
  const sel = e.target.closest('.container-profile-select');
  if (!sel) return;
  const id = sel.value;
  if (!id) return;
  const list = loadProfilesList();
  const profile = list.find((p) => p.id === id);
  if (profile && profile.data) loadProfile(profile.data);
});

document.body.addEventListener('click', (e) => {
  if (e.target.closest('.container-profile-save')) openProfileSaveModal();
  if (e.target.closest('.container-profile-delete')) {
    const sel = document.querySelector('.container-profile-select');
    const id = sel ? sel.value : '';
    if (!id) return;
    let list = loadProfilesList();
    list = list.filter((p) => p.id !== id);
    saveProfilesList(list);
    refreshProfileDropdown();
    document.querySelectorAll('.container-profile-select').forEach((s) => { s.value = ''; });
  }
});

function openProfileSaveModal() {
  if (!profileSaveModal || !profileSaveModalInput) return;
  profileSaveModalInput.value = '';
  profileSaveModal.classList.remove('hidden');
  profileSaveModalInput.focus();
}

function closeProfileSaveModal() {
  if (profileSaveModal) profileSaveModal.classList.add('hidden');
}

function confirmProfileSave() {
  const trimmed = profileSaveModalInput ? profileSaveModalInput.value.trim() : '';
  closeProfileSaveModal();
  if (!trimmed) return;
  const list = loadProfilesList();
  const data = getCurrentSettings();
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now();
  list.push({ id, name: trimmed, data });
  saveProfilesList(list);
  refreshProfileDropdown();
  document.querySelectorAll('.container-profile-select').forEach((s) => { s.value = id; });
}

if (profileSaveModalOk) profileSaveModalOk.addEventListener('click', confirmProfileSave);
if (profileSaveModalCancel) profileSaveModalCancel.addEventListener('click', closeProfileSaveModal);
if (profileSaveModalBackdrop) profileSaveModalBackdrop.addEventListener('click', closeProfileSaveModal);
if (profileSaveModalInput) {
  profileSaveModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmProfileSave();
    if (e.key === 'Escape') closeProfileSaveModal();
  });
}

// ---- Log container name: persist ----
logContainerName.addEventListener('change', saveSettings);
logContainerName.addEventListener('input', () => { clearTimeout(logContainerName._saveT); logContainerName._saveT = setTimeout(saveSettings, 400); });

// ---- Swap tab: persist ----
function bindSwapSave() {
  [swapContainerName, swapVolumeHost, swapHeavyModel, swapHeavyCtx, swapHeavyNgl, swapHeavyCache, swapContextShift, swapCacheReuse, swapCacheRam, swapLightModel, swapLightCtx, swapLightNgl].forEach((el) => {
    if (!el) return;
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', () => { clearTimeout(el._swapT); el._swapT = setTimeout(saveSettings, 400); });
  });
}

// ---- Init: restore from localStorage or defaults ----
const saved = loadSettings();
if (saved && saved.containers && Array.isArray(saved.containers) && saved.containers.length > 0) {
  saved.containers.forEach((c, i) => addContainer(mergeWithDefaults(c, i)));
  if (saved.logContainerName) logContainerName.value = saved.logContainerName;
  if (saved.swap) {
    if (swapContainerName && saved.swap.containerName != null) swapContainerName.value = saved.swap.containerName;
    if (swapVolumeHost && saved.swap.volumeHost != null) swapVolumeHost.value = saved.swap.volumeHost;
    if (swapHeavyModel && saved.swap.heavyModelPath != null) swapHeavyModel.value = saved.swap.heavyModelPath;
    if (swapHeavyCtx && saved.swap.heavyCtx != null) swapHeavyCtx.value = saved.swap.heavyCtx;
    if (swapHeavyNgl && saved.swap.heavyNgl != null) swapHeavyNgl.value = saved.swap.heavyNgl;
    if (swapHeavyCache && saved.swap.heavyCache != null) swapHeavyCache.value = saved.swap.heavyCache;
    if (swapContextShift && saved.swap.contextShift != null) swapContextShift.checked = !!saved.swap.contextShift;
    if (swapCacheReuse && saved.swap.cacheReuse != null) swapCacheReuse.value = saved.swap.cacheReuse;
    if (swapCacheRam && saved.swap.cacheRam != null) swapCacheRam.value = saved.swap.cacheRam;
    if (swapLightModel && saved.swap.lightModelPath != null) swapLightModel.value = saved.swap.lightModelPath;
    if (swapLightCtx && saved.swap.lightCtx != null) swapLightCtx.value = saved.swap.lightCtx;
    if (swapLightNgl && saved.swap.lightNgl != null) swapLightNgl.value = saved.swap.lightNgl;
  }
  bindSwapSave();
  saveSettings();
  showPanel(containers.length > 0 ? 'container-' + containers[0].id : 'logs');
  refreshRagContainerDropdown();
  const ragSel = document.getElementById('ragContainerSelect');
  if (saved.ragContainerId != null && saved.ragContainerId !== '' && ragSel && containers.some((c) => String(c.id) === String(saved.ragContainerId))) {
    ragSel.value = String(saved.ragContainerId);
    if (ragServerUrl) {
      const entry = containers.find((c) => String(c.id) === String(saved.ragContainerId));
      if (entry) ragServerUrl.value = getContainerUrl(entry);
    }
  }
} else {
  addContainer(getDefaultConfig(0));
  addContainer(getDefaultConfig(1));
  showPanel('container-1');
  bindSwapSave();
  refreshRagContainerDropdown();
}
refreshProfileDropdown();

// Show container runtime (Docker or Podman) in footer
if (window.docker && typeof window.docker.getRuntime === 'function') {
  window.docker.getRuntime().then((r) => {
    const el = document.getElementById('footerRuntime');
    if (el) el.textContent = 'Runtime: ' + (r && r.runtime ? r.runtime : 'docker');
  }).catch(() => {});
}

// Install llama.cpp options: open server README
const btnInstallLlamacpp = document.getElementById('btnInstallLlamacpp');
if (btnInstallLlamacpp && window.app && typeof window.app.openUrl === 'function') {
  btnInstallLlamacpp.addEventListener('click', () => {
    window.app.openUrl('https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md');
  });
}

// Update: run update script and show result
const btnHelp = document.getElementById('btnHelp');
if (btnHelp && window.app && typeof window.app.openHelpDoc === 'function') {
  btnHelp.addEventListener('click', () => {
    window.app.openHelpDoc();
  });
}

const btnZedSetup = document.getElementById('btnZedSetup');
if (btnZedSetup && window.app && typeof window.app.openZedDoc === 'function') {
  btnZedSetup.addEventListener('click', () => {
    window.app.openZedDoc();
  });
}

// RAG panel — use only the container the user selects (URL + system prompt from that container)
function getContainerUrl(entry) {
  const host = (entry.form.querySelector('[name="host"]') && entry.form.querySelector('[name="host"]').value) ? entry.form.querySelector('[name="host"]').value.trim() : (entry.defaults.host || '0.0.0.0');
  const port = (entry.form.querySelector('[name="port"]') && entry.form.querySelector('[name="port"]').value) ? entry.form.querySelector('[name="port"]').value : (entry.defaults.port || 8080);
  return 'http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port;
}
function getSystemPromptForContainer(entry) {
  const content = (entry.form.querySelector('[name="systemPromptContent"]') && entry.form.querySelector('[name="systemPromptContent"]').value) ? entry.form.querySelector('[name="systemPromptContent"]').value.trim() : (entry.defaults.systemPromptContent || DEFAULT_SYSTEM_PROMPT);
  return content || DEFAULT_SYSTEM_PROMPT;
}
function getSystemPromptForServerUrl(serverUrl) {
  const base = (serverUrl || '').trim().replace(/\/+$/, '');
  for (const c of containers) {
    const url = getContainerUrl(c);
    if (base === url || base === 'http://localhost:' + (c.form.querySelector('[name="port"]') && c.form.querySelector('[name="port"]').value ? c.form.querySelector('[name="port"]').value : c.defaults.port || 8080)) {
      return getSystemPromptForContainer(c);
    }
  }
  return DEFAULT_SYSTEM_PROMPT;
}

function refreshRagContainerDropdown() {
  const sel = document.getElementById('ragContainerSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— None (use URL below) —</option>';
  containers.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = String(c.id);
    opt.textContent = (c.tabBtn && c.tabBtn.textContent) || (c.form.querySelector('[name="tabName"]') && c.form.querySelector('[name="tabName"]').value) || c.defaults.tabName || c.defaults.containerName || ('Container ' + c.id);
    sel.appendChild(opt);
  });
  if (current && containers.some((c) => String(c.id) === current)) sel.value = current;
  else if (current) sel.value = '';
}

const ragServerUrl = document.getElementById('ragServerUrl');
const ragContainerSelect = document.getElementById('ragContainerSelect');
const ragCollectionName = document.getElementById('ragCollectionName');
const ragUseRetrieval = document.getElementById('ragUseRetrieval');
const ragContext = document.getElementById('ragContext');
const ragQuery = document.getElementById('ragQuery');
const btnRagSend = document.getElementById('btnRagSend');
const ragStatus = document.getElementById('ragStatus');
const ragResponse = document.getElementById('ragResponse');
const ragIngestStatus = document.getElementById('ragIngestStatus');
const btnRagOpenWebui = document.querySelector('.btn-rag-open-webui');
const btnRagAddDocs = document.getElementById('btnRagAddDocs');

// RAG is an optional plugin; show install message when not installed
async function refreshRagPluginUI() {
  const requiredEl = document.getElementById('ragPluginRequired');
  const contentEl = document.getElementById('ragContent');
  if (!requiredEl || !contentEl) return;
  if (!window.rag || typeof window.rag.pluginAvailable !== 'function') {
    requiredEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  try {
    const { available } = await window.rag.pluginAvailable();
    if (available) {
      requiredEl.classList.add('hidden');
      contentEl.classList.remove('hidden');
    } else {
      requiredEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
    }
  } catch (_) {
    requiredEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
  }
}
refreshRagPluginUI();
const btnRagCheckPlugin = document.getElementById('btnRagCheckPlugin');
if (btnRagCheckPlugin) btnRagCheckPlugin.addEventListener('click', () => refreshRagPluginUI());

if (ragContainerSelect) {
  ragContainerSelect.addEventListener('change', () => {
    const selectedId = ragContainerSelect.value ? ragContainerSelect.value.trim() : '';
    if (selectedId && ragServerUrl) {
      const entry = containers.find((c) => String(c.id) === selectedId);
      if (entry) ragServerUrl.value = getContainerUrl(entry);
    }
    saveSettings();
  });
}

if (btnRagOpenWebui && ragServerUrl && window.app && typeof window.app.openUrl === 'function') {
  btnRagOpenWebui.addEventListener('click', () => {
    const url = (ragServerUrl.value || 'http://localhost:8080').trim();
    if (url) window.app.openUrl(url);
  });
}

if (btnRagAddDocs && window.rag && typeof window.rag.ingest === 'function' && window.dialog && typeof window.dialog.showOpenFiles === 'function') {
  btnRagAddDocs.addEventListener('click', async () => {
    const collection = (ragCollectionName && ragCollectionName.value) ? ragCollectionName.value.trim() : 'default';
    if (ragIngestStatus) ragIngestStatus.textContent = 'Opening file picker…';
    const { paths, error: dialogErr } = await window.dialog.showOpenFiles();
    if (dialogErr || !paths || paths.length === 0) {
      if (ragIngestStatus) ragIngestStatus.textContent = dialogErr || 'No files selected.';
      return;
    }
    if (ragIngestStatus) ragIngestStatus.textContent = 'Ingesting…';
    btnRagAddDocs.disabled = true;
    try {
      const result = await window.rag.ingest({ paths, collectionName: collection || 'default' });
      if (result.ok) {
        if (ragIngestStatus) ragIngestStatus.textContent = `Done. ${result.chunksCreated || 0} chunks created in "${collection || 'default'}".`;
      } else {
        if (ragIngestStatus) ragIngestStatus.textContent = 'Error: ' + (result.error || 'Unknown');
      }
    } catch (err) {
      if (ragIngestStatus) ragIngestStatus.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    }
    btnRagAddDocs.disabled = false;
    setTimeout(() => { if (ragIngestStatus) ragIngestStatus.textContent = ''; }, 8000);
  });
}

if (btnRagSend && window.rag && typeof window.rag.query === 'function') {
  btnRagSend.addEventListener('click', async () => {
    let serverUrl = 'http://localhost:8080';
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const selectedId = ragContainerSelect && ragContainerSelect.value ? ragContainerSelect.value.trim() : '';
    if (selectedId) {
      const entry = containers.find((c) => String(c.id) === selectedId);
      if (entry) {
        serverUrl = getContainerUrl(entry);
        systemPrompt = getSystemPromptForContainer(entry);
      } else {
        serverUrl = (ragServerUrl && ragServerUrl.value) ? ragServerUrl.value.trim() : serverUrl;
        systemPrompt = getSystemPromptForServerUrl(serverUrl);
      }
    } else {
      serverUrl = (ragServerUrl && ragServerUrl.value) ? ragServerUrl.value.trim() : serverUrl;
      systemPrompt = getSystemPromptForServerUrl(serverUrl);
    }
    const query = (ragQuery && ragQuery.value) ? ragQuery.value.trim() : '';
    let extraContext = (ragContext && ragContext.value) ? ragContext.value.trim() : '';
    if (ragUseRetrieval && ragUseRetrieval.checked && query && window.rag && typeof window.rag.retrieve === 'function') {
      const collection = (ragCollectionName && ragCollectionName.value) ? ragCollectionName.value.trim() : 'default';
      try {
        const ret = await window.rag.retrieve({ query, collectionName: collection || 'default', topK: 5 });
        if (ret.ok && ret.chunks && ret.chunks.length > 0) {
          const retrievedText = ret.chunks.map((c) => c.content).filter(Boolean).join('\n\n---\n\n');
          if (retrievedText) extraContext = (extraContext ? retrievedText + '\n\n' + extraContext : retrievedText);
        }
      } catch (_) {}
    }
    const context = extraContext ? systemPrompt + '\n\n' + extraContext : systemPrompt;
    if (ragStatus) ragStatus.textContent = 'Sending…';
    if (ragResponse) ragResponse.textContent = '';
    btnRagSend.disabled = true;
    try {
      const result = await window.rag.query(serverUrl, context, [], query || 'Hello');
      if (result.ok) {
        if (ragResponse) ragResponse.textContent = result.content || '(no content)';
        if (ragStatus) ragStatus.textContent = 'Done.';
      } else {
        if (ragResponse) ragResponse.textContent = 'Error: ' + (result.error || 'Unknown error');
        if (ragStatus) ragStatus.textContent = '';
      }
    } catch (err) {
      if (ragResponse) ragResponse.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
      if (ragStatus) ragStatus.textContent = '';
    }
    btnRagSend.disabled = false;
    if (ragStatus) setTimeout(() => { ragStatus.textContent = ''; }, 4000);
  });
}

// ---- Models tab (Hugging Face + Ollama) ----
const hfRepo = document.getElementById('hfRepo');
const btnHfList = document.getElementById('btnHfList');
const hfListStatus = document.getElementById('hfListStatus');
const hfFileList = document.getElementById('hfFileList');
const hfDestDir = document.getElementById('hfDestDir');
const btnHfBrowse = document.getElementById('btnHfBrowse');
const btnHfDownload = document.getElementById('btnHfDownload');
const hfDownloadProgress = document.getElementById('hfDownloadProgress');
const hfProgressBar = document.getElementById('hfProgressBar');
const hfProgressText = document.getElementById('hfProgressText');
const ollamaModel = document.getElementById('ollamaModel');
const btnOllamaPull = document.getElementById('btnOllamaPull');
const ollamaOutput = document.getElementById('ollamaOutput');

let selectedHfFilePath = null;

if (btnHfList && window.models && typeof window.models.listHfFiles === 'function') {
  btnHfList.addEventListener('click', async () => {
    const repo = (hfRepo && hfRepo.value) ? hfRepo.value.trim() : '';
    if (!repo) {
      if (hfListStatus) hfListStatus.textContent = 'Enter a repo (e.g. owner/repo).';
      return;
    }
    if (hfListStatus) hfListStatus.textContent = 'Listing…';
    if (hfFileList) hfFileList.innerHTML = '';
    selectedHfFilePath = null;
    if (btnHfDownload) btnHfDownload.disabled = true;
    try {
      const { files, error } = await window.models.listHfFiles(repo);
      if (error) {
        if (hfListStatus) hfListStatus.textContent = 'Error: ' + error;
        return;
      }
      if (hfListStatus) hfListStatus.textContent = files.length ? `${files.length} GGUF file(s). Click one to select.` : 'No GGUF files in repo root.';
      if (hfFileList && files.length) {
        const fmt = (n) => n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' KB' : n + ' B';
        files.forEach((f) => {
          const li = document.createElement('li');
          li.textContent = f.path + (f.size != null ? ' (' + fmt(f.size) + ')' : '');
          li.dataset.path = f.path;
          li.addEventListener('click', () => {
            hfFileList.querySelectorAll('li').forEach((x) => x.classList.remove('selected'));
            li.classList.add('selected');
            selectedHfFilePath = f.path;
            if (btnHfDownload) btnHfDownload.disabled = !hfDestDir || !hfDestDir.value.trim();
          });
          hfFileList.appendChild(li);
        });
      }
    } catch (err) {
      if (hfListStatus) hfListStatus.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    }
  });
}

if (btnHfBrowse && window.dialog && typeof window.dialog.showOpenDirectory === 'function') {
  btnHfBrowse.addEventListener('click', async () => {
    const { path: dir, error } = await window.dialog.showOpenDirectory();
    if (!error && dir && hfDestDir) {
      hfDestDir.value = dir;
      if (btnHfDownload) btnHfDownload.disabled = !selectedHfFilePath;
    }
  });
}
if (hfDestDir && btnHfDownload) {
  hfDestDir.addEventListener('input', () => {
    btnHfDownload.disabled = !selectedHfFilePath || !hfDestDir.value.trim();
  });
}

if (btnHfDownload && window.models && typeof window.models.downloadHfFile === 'function') {
  btnHfDownload.addEventListener('click', async () => {
    const repo = (hfRepo && hfRepo.value) ? hfRepo.value.trim() : '';
    const dest = (hfDestDir && hfDestDir.value) ? hfDestDir.value.trim() : '';
    if (!repo || !selectedHfFilePath || !dest) return;
    btnHfDownload.disabled = true;
    if (hfDownloadProgress) hfDownloadProgress.classList.remove('hidden');
    if (hfProgressBar) hfProgressBar.value = 0;
    if (hfProgressText) hfProgressText.textContent = 'Starting…';
    const unsub = window.models.onHfDownloadProgress((p) => {
      if (p.done) {
        if (hfProgressText) hfProgressText.textContent = 'Done: ' + (p.path || '');
        if (hfProgressBar) hfProgressBar.value = 100;
      } else {
        if (hfProgressBar && p.percent != null) hfProgressBar.value = p.percent;
        if (hfProgressText) hfProgressText.textContent = p.total ? `${p.loaded} / ${p.total} (${p.percent}%)` : `${p.loaded} B`;
      }
    });
    try {
      const result = await window.models.downloadHfFile(repo, selectedHfFilePath, dest);
      unsub();
      if (result.ok) {
        if (hfProgressText) hfProgressText.textContent = 'Saved: ' + result.path;
      } else {
        if (hfProgressText) hfProgressText.textContent = 'Error: ' + (result.error || 'Unknown');
      }
    } catch (err) {
      unsub();
      if (hfProgressText) hfProgressText.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    }
    btnHfDownload.disabled = false;
    setTimeout(() => { if (hfDownloadProgress) hfDownloadProgress.classList.add('hidden'); }, 5000);
  });
}

if (btnOllamaPull && ollamaOutput && window.models && typeof window.models.ollamaPull === 'function') {
  btnOllamaPull.addEventListener('click', async () => {
    const name = (ollamaModel && ollamaModel.value) ? ollamaModel.value.trim() : '';
    if (!name) {
      ollamaOutput.textContent = 'Enter a model name (e.g. qwen2.5-coder:7b).';
      return;
    }
    ollamaOutput.textContent = 'Pulling ' + name + '…\n';
    btnOllamaPull.disabled = true;
    const unsub = window.models.onOllamaPullOutput((chunk) => {
      ollamaOutput.textContent += chunk;
      ollamaOutput.scrollTop = ollamaOutput.scrollHeight;
    });
    try {
      const result = await window.models.ollamaPull(name);
      unsub();
      ollamaOutput.textContent += (result.ok ? '\nDone.' : '\nError: ' + (result.error || 'Unknown')) + '\n';
    } catch (err) {
      unsub();
      ollamaOutput.textContent += '\nError: ' + (err && err.message ? err.message : String(err)) + '\n';
    }
    btnOllamaPull.disabled = false;
  });
}

const btnUpdate = document.getElementById('btnUpdate');
const footerUpdateStatus = document.getElementById('footerUpdateStatus');
if (btnUpdate && window.app && typeof window.app.runUpdate === 'function') {
  btnUpdate.addEventListener('click', async () => {
    if (footerUpdateStatus) footerUpdateStatus.textContent = 'Updating…';
    btnUpdate.disabled = true;
    try {
      const result = await window.app.runUpdate();
      if (result.ok) {
        if (footerUpdateStatus) footerUpdateStatus.textContent = 'Update finished.';
      } else {
        const msg = result.error || 'Update failed.';
        if (footerUpdateStatus) footerUpdateStatus.textContent = msg + ' (Run ldroid update in a terminal if needed.)';
      }
    } catch (err) {
      if (footerUpdateStatus) footerUpdateStatus.textContent = 'Update error: ' + (err && err.message ? err.message : String(err));
    }
    btnUpdate.disabled = false;
    if (footerUpdateStatus) setTimeout(() => { footerUpdateStatus.textContent = ''; }, 8000);
  });
}

// ---- Settings: Config / env view ----
const settingsConfigPreview = document.getElementById('settingsConfigPreview');
const btnRefreshConfig = document.getElementById('btnRefreshConfig');
const settingsContainerSelect = document.getElementById('settingsContainerSelect');
const settingsContainerConfigPreview = document.getElementById('settingsContainerConfigPreview');

function refreshSettingsConfigUI() {
  if (settingsConfigPreview) {
    try {
      const payload = getCurrentSettings();
      settingsConfigPreview.textContent = JSON.stringify(payload, null, 2);
    } catch (e) {
      settingsConfigPreview.textContent = 'Error: ' + (e && e.message ? e.message : String(e));
    }
  }
  if (settingsContainerSelect) {
    const sel = settingsContainerSelect;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select container —</option>';
    containers.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = (c.tabBtn && c.tabBtn.textContent) || c.defaults.tabName || c.defaults.containerName || ('Container ' + c.id);
      sel.appendChild(opt);
    });
    if (current && containers.some((c) => String(c.id) === current)) sel.value = current;
    else if (settingsContainerConfigPreview) settingsContainerConfigPreview.textContent = 'Select a container above.';
  }
}

if (btnRefreshConfig) btnRefreshConfig.addEventListener('click', refreshSettingsConfigUI);

if (settingsContainerSelect && settingsContainerConfigPreview && window.app && typeof window.app.getDockerRunPreview === 'function') {
  settingsContainerSelect.addEventListener('change', async () => {
    const id = settingsContainerSelect.value;
    if (!id) {
      settingsContainerConfigPreview.textContent = 'Select a container above.';
      return;
    }
    const entry = containers.find((c) => String(c.id) === id);
    if (!entry) {
      settingsContainerConfigPreview.textContent = 'Container not found.';
      return;
    }
    const config = getConfig(entry.form, entry.defaults.containerName, entry.defaults.port);
    settingsContainerConfigPreview.textContent = 'Loading…';
    try {
      const result = await window.app.getDockerRunPreview(config);
      if (result.ok) {
        const configJson = JSON.stringify(result.config, null, 2);
        settingsContainerConfigPreview.textContent = '// Config (JSON)\n' + configJson + '\n\n// Docker command\n' + result.command;
      } else {
        settingsContainerConfigPreview.textContent = 'Error: ' + (result.error || 'Failed to build command');
      }
    } catch (err) {
      settingsContainerConfigPreview.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    }
  });
}
