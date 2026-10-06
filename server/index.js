// Express app setup: static frontend, JSON API, and error handling.

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { publicStages } from './stages.js';
import { router as ideasRouter, PRIORITIES } from './routes/ideas.js';
import { MODEL, isConfigured } from './research.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const PORT = Number(process.env.PORT) || 3000;

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

app.get('/api/stages', (req, res) => {
  res.json(publicStages());
});

app.get('/api/config', (req, res) => {
  res.json({ priorities: PRIORITIES, researchEnabled: isConfigured() });
});

app.use('/api/ideas', ideasRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.status ? err.message : 'Internal server error' });
});

await db.init();

app.listen(PORT, () => {
  console.log(`IdeaTracker running at http://localhost:${PORT}`);
  if (isConfigured()) {
    console.log(`Research model: ${MODEL}`);
  } else {
    console.warn('GEMINI_API_KEY is not set. The board works, but research is disabled.');
  }
});
