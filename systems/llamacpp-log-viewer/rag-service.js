/**
 * RAG service: LangChain.js document pipeline + LanceDB vector store.
 * Runs in Electron main process. Embeddings: Hugging Face Inference API
 * (set HUGGINGFACEHUB_API_KEY or pass apiKey in config).
 */

const path = require('path');
const fs = require('fs');

let TextLoader;
let RecursiveCharacterTextSplitter;
let HuggingFaceInferenceEmbeddings;
let LanceDB;
let lancedbConnect;

function loadDeps() {
  if (TextLoader) return null;
  try {
    TextLoader = require('@langchain/community/document_loaders/fs/text').TextLoader;
    RecursiveCharacterTextSplitter = require('@langchain/textsplitters').RecursiveCharacterTextSplitter;
    HuggingFaceInferenceEmbeddings = require('@langchain/community/embeddings/hf').HuggingFaceInferenceEmbeddings;
    const lcLance = require('@langchain/community/vectorstores/lancedb');
    LanceDB = lcLance.LanceDB;
    lancedbConnect = require('@lancedb/lancedb').connect;
    return null;
  } catch (e) {
    return e.message || String(e);
  }
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5';

let embeddings = null;
let storagePath = null;

/**
 * Initialize RAG: storage path and optional embedding API key.
 * @param {Object} config - { storagePath, embeddingApiKey }
 * @returns {{ ok: boolean, error?: string }}
 */
function initRag(config) {
  const err = loadDeps();
  if (err) return { ok: false, error: 'RAG dependencies not installed: ' + err };

  storagePath = (config && config.storagePath) || path.join(require('electron').app.getPath('userData'), 'rag');
  try {
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
  } catch (e) {
    return { ok: false, error: 'Failed to create RAG storage dir: ' + (e.message || e) };
  }

  const apiKey = (config && config.embeddingApiKey) || process.env.HUGGINGFACEHUB_API_KEY || process.env.HUGGINGFACE_API_KEY;
  if (!apiKey || String(apiKey).trim() === '') {
    embeddings = null;
    return { ok: true, error: null, embeddingConfigured: false };
  }

  try {
    embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: String(apiKey).trim(),
      model: (config && config.embeddingModel) || DEFAULT_EMBEDDING_MODEL,
    });
    return { ok: true, error: null, embeddingConfigured: true };
  } catch (e) {
    return { ok: false, error: 'Embeddings init failed: ' + (e.message || e) };
  }
}

/**
 * Ingest documents from file paths into a named collection (table).
 * @param {{ paths: string[], collectionName: string, chunkSize?: number, chunkOverlap?: number }} opts
 * @returns {{ ok: boolean, chunksCreated?: number, error?: string }}
 */
async function ingestDocuments(opts) {
  const err = loadDeps();
  if (err) return { ok: false, error: 'RAG dependencies not installed: ' + err };
  if (!embeddings) return { ok: false, error: 'Embeddings not configured. Set HUGGINGFACEHUB_API_KEY or add API key in Settings.' };

  const paths = Array.isArray(opts.paths) ? opts.paths : [];
  const collectionName = (opts.collectionName && String(opts.collectionName).trim()) || 'default';
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = opts.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (paths.length === 0) return { ok: false, error: 'No file paths provided.' };

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });

  const allDocs = [];
  for (const filePath of paths) {
    const normalized = path.resolve(filePath);
    if (!fs.existsSync(normalized) || !fs.statSync(normalized).isFile()) continue;
    const ext = path.extname(normalized).toLowerCase();
    if (ext !== '.txt' && ext !== '.md' && ext !== '.json') continue;
    try {
      const loader = new TextLoader(normalized);
      const docs = await loader.load();
      allDocs.push(...docs);
    } catch (e) {
      return { ok: false, error: `Failed to load ${filePath}: ${e.message || e}` };
    }
  }

  if (allDocs.length === 0) return { ok: false, error: 'No documents loaded (supported: .txt, .md, .json).' };

  const split = await splitter.splitDocuments(allDocs);
  if (split.length === 0) return { ok: false, error: 'No chunks after splitting.' };

  try {
    const tableName = collectionName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    await LanceDB.fromDocuments(split, embeddings, {
      uri: storagePath,
      tableName,
      mode: 'overwrite',
    });
    return { ok: true, chunksCreated: split.length, error: null };
  } catch (e) {
    return { ok: false, error: 'Ingest failed: ' + (e.message || e) };
  }
}

/**
 * Retrieve top-k chunks for a query from a collection.
 * @param {{ query: string, collectionName: string, topK?: number }} opts
 * @returns {{ ok: boolean, chunks?: { content: string, metadata?: object }[], error?: string }}
 */
async function retrieve(opts) {
  const err = loadDeps();
  if (err) return { ok: false, error: 'RAG dependencies not installed: ' + err };
  if (!embeddings) return { ok: false, error: 'Embeddings not configured.' };

  const query = (opts.query && String(opts.query).trim()) || '';
  const collectionName = (opts.collectionName && String(opts.collectionName).trim()) || 'default';
  const topK = Math.min(Math.max(1, (opts.topK || 5) | 0), 20);

  if (!query) return { ok: false, error: 'Query is empty.' };

  try {
    const tableName = collectionName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
    const db = await lancedbConnect(storagePath);
    let table;
    try {
      table = await db.openTable(tableName);
    } catch (_) {
      return { ok: false, error: `Collection "${collectionName}" not found. Ingest documents first.` };
    }

    const vectorStore = new LanceDB(embeddings, { uri: storagePath, tableName, table });
    const docs = await vectorStore.similaritySearch(query, topK);
    const chunks = docs.map((d) => ({ content: d.pageContent, metadata: d.metadata || {} }));
    return { ok: true, chunks, error: null };
  } catch (e) {
    return { ok: false, error: 'Retrieve failed: ' + (e.message || e) };
  }
}

/**
 * Build a single context string from retrieved chunks for injection into the system prompt.
 */
function buildContextFromChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return '';
  return chunks.map((c) => (typeof c === 'string' ? c : c.content)).filter(Boolean).join('\n\n---\n\n');
}

function isRetrievalAvailable() {
  loadDeps();
  return !!embeddings && !!storagePath;
}

module.exports = {
  initRag,
  ingestDocuments,
  retrieve,
  buildContextFromChunks,
  isRetrievalAvailable,
  loadDeps,
};
