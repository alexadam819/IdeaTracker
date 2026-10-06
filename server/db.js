// JSON file database. This is the ONLY module that reads or writes data/db.json.
//
// - Writes are atomic: we write a temp file in the same folder, then rename it over db.json.
// - Writes are serialized: every change goes through one promise chain, so concurrent
//   requests (e.g. a research call finishing while the user edits) can't clobber each other.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const CURRENT_VERSION = 1;

let writeQueue = Promise.resolve();

function emptyDb() {
  return { version: CURRENT_VERSION, ideas: [] };
}

async function load() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    if (!Array.isArray(db.ideas)) db.ideas = [];
    if (!db.version) db.version = CURRENT_VERSION;
    return db;
  } catch (err) {
    if (err.code === 'ENOENT') return emptyDb();
    throw new Error(`Could not read ${DB_PATH}: ${err.message}`);
  }
}

async function save(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = path.join(DATA_DIR, `db.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmpPath, JSON.stringify(db, null, 2) + '\n', 'utf8');
  await fs.rename(tmpPath, DB_PATH);
}

// Read the current data. Safe to call any time because writes replace the file atomically.
export async function read() {
  return load();
}

// Run `mutator(db)` inside the write queue, then save. Whatever the mutator returns is returned here.
// The mutator should change `db` in place and must not do slow work (like calling Gemini).
export function update(mutator) {
  const run = writeQueue.then(async () => {
    const db = await load();
    const result = await mutator(db);
    await save(db);
    return result;
  });
  // Keep the queue going even if this change fails.
  writeQueue = run.catch(() => {});
  return run;
}

// Create db.json if missing, and mark any research left "running" by a previous crash/restart as failed.
export async function init() {
  await update((db) => {
    const now = new Date().toISOString();
    for (const idea of db.ideas) {
      for (const result of Object.values(idea.research ?? {})) {
        if (result.status === 'running') {
          result.status = 'failed';
          result.error = 'Interrupted because the server restarted. Please run it again.';
          result.updatedAt = now;
        }
      }
    }
  });
}
