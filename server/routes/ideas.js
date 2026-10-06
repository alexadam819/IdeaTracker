// REST API for ideas.

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import * as db from '../db.js';
import { STAGE_IDS, isResearchStage, buildPrompt } from '../stages.js';
import { runResearch, isConfigured } from '../research.js';

export const PRIORITIES = ['low', 'medium', 'high'];

const LIMITS = {
  title: 200,
  description: 5000,
  targetAudience: 500,
  notes: 10000,
  tag: 40,
  tags: 20,
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---------- Validation ----------

function cleanString(value, field, max, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} is required`);
  if (trimmed.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return trimmed;
}

function cleanTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'tags must be an array of strings');
  const seen = new Set();
  const tags = [];
  for (const tag of value) {
    const clean = cleanString(tag, 'tag', LIMITS.tag);
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      tags.push(clean);
    }
  }
  if (tags.length > LIMITS.tags) throw new HttpError(400, `At most ${LIMITS.tags} tags are allowed`);
  return tags;
}

function cleanPriority(value) {
  if (value === undefined || value === null || value === '') return 'medium';
  if (!PRIORITIES.includes(value)) throw new HttpError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  return value;
}

function cleanStage(value) {
  if (!STAGE_IDS.includes(value)) throw new HttpError(400, `stage must be one of: ${STAGE_IDS.join(', ')}`);
  return value;
}

function cleanOrder(value) {
  if (!Number.isInteger(value) || value < 0) throw new HttpError(400, 'order must be a non-negative integer');
  return value;
}

// Validates only the editable idea fields that are present in `body`.
function cleanFields(body, { partial }) {
  const fields = {};
  const has = (key) => !partial || body[key] !== undefined;
  if (has('title')) fields.title = cleanString(body.title, 'title', LIMITS.title, { required: true });
  if (has('description')) fields.description = cleanString(body.description, 'description', LIMITS.description);
  if (has('targetAudience')) fields.targetAudience = cleanString(body.targetAudience, 'targetAudience', LIMITS.targetAudience);
  if (has('notes')) fields.notes = cleanString(body.notes, 'notes', LIMITS.notes);
  if (has('tags')) fields.tags = cleanTags(body.tags);
  if (has('priority')) fields.priority = cleanPriority(body.priority);
  return fields;
}

// ---------- Helpers ----------

function findIdea(data, id) {
  const idea = data.ideas.find((i) => i.id === id);
  if (!idea) throw new HttpError(404, 'Idea not found');
  return idea;
}

function columnOf(data, stage, excludeId) {
  return data.ideas
    .filter((i) => i.stage === stage && i.id !== excludeId)
    .sort((a, b) => a.order - b.order);
}

function renumber(column) {
  column.forEach((idea, index) => {
    idea.order = index;
  });
}

// Moves `idea` into `stage` at position `order` (or the end), and renumbers the affected columns.
function placeIdea(data, idea, stage, order) {
  const oldStage = idea.stage;
  const target = columnOf(data, stage, idea.id);
  const index = Math.min(order ?? target.length, target.length);
  target.splice(index, 0, idea);
  idea.stage = stage;
  renumber(target);
  if (oldStage && oldStage !== stage) renumber(columnOf(data, oldStage));
}

function shortError(err) {
  const message = err?.message || String(err);
  return message.length > 500 ? message.slice(0, 500) + '…' : message;
}

// ---------- Routes ----------

export const router = Router();

router.get('/', async (req, res) => {
  const data = await db.read();
  res.json(data.ideas);
});

router.post('/', async (req, res) => {
  const fields = cleanFields(req.body ?? {}, { partial: false });
  const idea = await db.update((data) => {
    const now = new Date().toISOString();
    const newIdea = {
      id: randomUUID(),
      ...fields,
      stage: 'idea',
      order: 0,
      research: {},
      createdAt: now,
      updatedAt: now,
    };
    data.ideas.push(newIdea);
    placeIdea(data, newIdea, 'idea', columnOf(data, 'idea', newIdea.id).length);
    return newIdea;
  });
  res.status(201).json(idea);
});

router.patch('/:id', async (req, res) => {
  const body = req.body ?? {};
  const fields = cleanFields(body, { partial: true });
  const stage = body.stage !== undefined ? cleanStage(body.stage) : undefined;
  const order = body.order !== undefined ? cleanOrder(body.order) : undefined;

  const idea = await db.update((data) => {
    const found = findIdea(data, req.params.id);
    Object.assign(found, fields);
    if (stage !== undefined || order !== undefined) {
      placeIdea(data, found, stage ?? found.stage, order);
    }
    found.updatedAt = new Date().toISOString();
    return found;
  });
  res.json(idea);
});

router.delete('/:id', async (req, res) => {
  await db.update((data) => {
    const idea = findIdea(data, req.params.id);
    data.ideas = data.ideas.filter((i) => i.id !== idea.id);
    renumber(columnOf(data, idea.stage));
  });
  res.status(204).end();
});

// Starts research for the card's current stage. Responds right away with 202 and the card
// (stage status "running"); the Gemini call continues in the background and saves its result.
router.post('/:id/research', async (req, res) => {
  if (!isConfigured()) {
    throw new HttpError(503, 'No LLM API key configured. Add GEMINI_API_KEY or ANTHROPIC_API_KEY to your .env file and restart the server.');
  }

  const { idea, stageId, prompt } = await db.update((data) => {
    const found = findIdea(data, req.params.id);
    if (!isResearchStage(found.stage)) {
      throw new HttpError(400, 'This stage has no research step');
    }
    const previous = found.research?.[found.stage];
    if (previous?.status === 'running') {
      throw new HttpError(409, 'Research is already running for this stage');
    }
    const builtPrompt = buildPrompt(found, found.stage);
    found.research ??= {};
    found.research[found.stage] = {
      status: 'running',
      content: previous?.content ?? '',
      sources: previous?.sources ?? [],
      error: null,
      updatedAt: new Date().toISOString(),
    };
    return { idea: structuredClone(found), stageId: found.stage, prompt: builtPrompt };
  });

  res.status(202).json(idea);
  runInBackground(idea.id, stageId, prompt);
});

async function runInBackground(ideaId, stageId, prompt) {
  let result;
  try {
    const { content, sources } = await runResearch(prompt);
    result = { status: 'done', content, sources, error: null };
  } catch (err) {
    console.error(`Research failed for idea ${ideaId} (${stageId}):`, err);
    result = { status: 'failed', error: shortError(err) };
  }

  try {
    await db.update((data) => {
      const idea = data.ideas.find((i) => i.id === ideaId);
      if (!idea) return; // Deleted while research was running.
      const now = new Date().toISOString();
      idea.research ??= {};
      idea.research[stageId] = { ...idea.research[stageId], ...result, updatedAt: now };
      idea.updatedAt = now;
    });
  } catch (err) {
    console.error(`Could not save research result for idea ${ideaId}:`, err);
  }
}
