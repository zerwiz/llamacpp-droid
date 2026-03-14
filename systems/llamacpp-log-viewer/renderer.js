// ---- Containers state ----
const STORAGE_KEY = 'llamacpp-droid-settings';
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
    ctxSize: parseInt(get('ctxSize') || '12000', 10),
    ngl: parseInt(get('ngl') || '99', 10),
    memory: get('memory') || '24g',
    memorySwap: get('memorySwap') || '32g',
    restart: get('restart') || 'always',
    network: get('network') || 'host',
    gpus: 'all',
    threads: threadVal === '' ? undefined : threadVal,
    threadsBatch: tbVal === '' ? undefined : tbVal,
    batchSize: batchVal === '' ? undefined : batchVal,
    parallel: parallelVal === '' ? undefined : parallelVal,
    contBatching: form.querySelector('[name="contBatching"]').checked,
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
    ctxSize: 12000,
    ngl: 99,
    memory: '24g',
    memorySwap: '32g',
    restart: 'always',
    network: 'host',
    threads: '',
    threadsBatch: '',
    batchSize: '',
    parallel: '',
    contBatching: false,
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
    ctxSize: parseInt(get('ctxSize') || '12000', 10),
    ngl: parseInt(get('ngl') || '99', 10),
    memory: get('memory') || defaults.memory,
    memorySwap: get('memorySwap') || defaults.memorySwap,
    restart: get('restart') || defaults.restart,
    network: get('network') || defaults.network,
    threads: get('threads'),
    threadsBatch: get('threadsBatch'),
    batchSize: get('batchSize'),
    parallel: get('parallel'),
    contBatching: cb ? cb.checked : false,
  };
}

function saveSettings() {
  try {
    const list = containers.map((entry) => getContainerSettings(entry.form, entry.defaults));
    const logName = document.getElementById('logContainerName');
    const payload = {
      version: 1,
      containers: list,
      logContainerName: logName ? logName.value.trim() || 'llamacpp' : 'llamacpp',
    };
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
  };
}

let monitorIntervalNvidia = null;
let monitorIntervalTop = null;

function startMonitor() {
  stopMonitor();
  const nvidiaEl = document.getElementById('monitorNvidiaSmi');
  const topEl = document.getElementById('monitorTop');
  function updateNvidia() {
    if (!nvidiaEl || !document.getElementById('panel-monitor').classList.contains('active')) return;
    window.monitor.nvidiaSmi().then((r) => {
      if (r.error) nvidiaEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else nvidiaEl.textContent = r.stdout || '(no output)';
    });
  }
  function updateTop() {
    if (!topEl || !document.getElementById('panel-monitor').classList.contains('active')) return;
    window.monitor.top().then((r) => {
      if (r.error) topEl.textContent = 'Error: ' + r.error + (r.stderr ? '\n' + r.stderr : '');
      else topEl.textContent = (r.stdout || '(no output)').slice(0, 8000);
    });
  }
  updateNvidia();
  updateTop();
  monitorIntervalNvidia = setInterval(updateNvidia, 1000);
  monitorIntervalTop = setInterval(updateTop, 2000);
}

function stopMonitor() {
  if (monitorIntervalNvidia) clearInterval(monitorIntervalNvidia);
  if (monitorIntervalTop) clearInterval(monitorIntervalTop);
  monitorIntervalNvidia = null;
  monitorIntervalTop = null;
}

function showPanel(tabId) {
  const panelId = tabId === 'logs' ? 'panel-logs' : tabId === 'monitor' ? 'panel-monitor' : 'panel-' + tabId;
  document.querySelectorAll('#container-panels .panel, #panel-logs, #panel-monitor').forEach((p) => {
    p.classList.toggle('active', p.id === panelId);
  });
  document.querySelectorAll('#nav .tab[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  if (tabId === 'monitor') startMonitor();
  else stopMonitor();
}

function addContainer(defaults) {
  const id = nextContainerId++;
  const panel = template.content.cloneNode(true);
  const section = panel.querySelector('section');
  const card = section.querySelector('.runner-card');
  const statusEl = card.querySelector('.runner-status');
  const form = card.querySelector('form');
  const messageEl = card.querySelector('.runner-message');
  const btnStop = card.querySelector('.btn-stop');
  const btnDelete = card.querySelector('.btn-delete');

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
  if (defaults.threads !== undefined && defaults.threads !== '') form.querySelector('[name="threads"]').value = defaults.threads;
  if (defaults.threadsBatch !== undefined && defaults.threadsBatch !== '') form.querySelector('[name="threadsBatch"]').value = defaults.threadsBatch;
  if (defaults.batchSize !== undefined && defaults.batchSize !== '') form.querySelector('[name="batchSize"]').value = defaults.batchSize;
  if (defaults.parallel !== undefined && defaults.parallel !== '') form.querySelector('[name="parallel"]').value = defaults.parallel;
  const cbInput = form.querySelector('[name="contBatching"]');
  if (cbInput) cbInput.checked = !!defaults.contBatching;

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
    modelListStatus.textContent = 'Searching $HOME for *.gguf…';
    modelList.innerHTML = '';
    try {
      const { paths, error } = await window.findGguf();
      if (error) {
        modelListStatus.textContent = 'Error: ' + error;
        return;
      }
      if (!paths.length) {
        modelListStatus.textContent = 'No .gguf files found under $HOME.';
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

  async function refreshStatus() {
    const name = form.querySelector('[name="containerName"]').value.trim() || defaults.containerName;
    try {
      const r = await window.docker.status(name);
      if (r.running) {
        statusEl.textContent = 'Container “‘ + name +’” is running';
        statusEl.className = 'runner-status running';
      } else {
        statusEl.textContent = 'Container “‘ + name +’” is stopped';
        statusEl.className = 'runner-status stopped';
      }
    } catch (_) {
      statusEl.textContent = 'Container “‘ + name +’” not found or error';
      statusEl.className = 'runner-status stopped';
    }
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
        setMessage('Container started. Server on http://' + config.host + ':' + config.port, 'success');
        refreshStatus();
        updateTabLabel();
      } else {
        setMessage(result.error || 'Run failed', 'error');
      }
    } catch (err) {
      setMessage(err && err.message ? err.message : String(err), 'error');
    }
    runBtn.disabled = false;
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

  btnDelete.addEventListener('click', () => {
    removeContainer(id);
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
  saveSettings();
  if (wasViewingThis) {
    if (containers.length > 0) {
      showPanel('container-' + containers[0].id);
    } else {
      showPanel('logs');
    }
  }
}

btnAddContainer.addEventListener('click', () => {
  const index = containers.length;
  const defaults = getDefaultConfig(index);
  addContainer(defaults);
});

nav.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab[data-tab]');
  if (!tab) return;
  const tabId = tab.dataset.tab;
  if (tabId === 'logs' || tabId === 'monitor' || (tabId && tabId.startsWith('container-'))) {
    showPanel(tabId);
  }
});

// ---- Logs ----
const logOutput = document.getElementById('logOutput');
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
  if (streaming) {
    logOutput.scrollTop = logOutput.scrollHeight;
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
    setStatus('Streaming logs from container “‘ + name +’”…', 'live');
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
  setStatus('Stream ended.', '');
});

// ---- Log container name: persist ----
logContainerName.addEventListener('change', saveSettings);
logContainerName.addEventListener('input', () => { clearTimeout(logContainerName._saveT); logContainerName._saveT = setTimeout(saveSettings, 400); });

// ---- Init: restore from localStorage or defaults ----
const saved = loadSettings();
if (saved && saved.containers && Array.isArray(saved.containers) && saved.containers.length > 0) {
  saved.containers.forEach((c, i) => addContainer(mergeWithDefaults(c, i)));
  if (saved.logContainerName) logContainerName.value = saved.logContainerName;
  saveSettings();
  showPanel(containers.length > 0 ? 'container-' + containers[0].id : 'logs');
} else {
  addContainer(getDefaultConfig(0));
  addContainer(getDefaultConfig(1));
  showPanel('container-1');
}
