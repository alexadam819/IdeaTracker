// LLM client and research runner supporting Google Gemini and Anthropic Claude.
// Runs only on the server so API keys never reach the browser.

import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest';

let geminiClient = null;
let anthropicClient = null;

export function getProvider() {
  const explicit = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'claude' || explicit === 'anthropic') return 'anthropic';
  if (explicit === 'gemini' || explicit === 'google') return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export function isConfigured() {
  return getProvider() !== null;
}

export function getActiveModel() {
  const provider = getProvider();
  if (provider === 'anthropic') return { provider: 'Anthropic Claude', model: ANTHROPIC_MODEL };
  if (provider === 'gemini') return { provider: 'Google Gemini', model: GEMINI_MODEL };
  return { provider: 'None', model: 'None' };
}

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file and restart the server.');
  }
  geminiClient ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return geminiClient;
}

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file and restart the server.');
  }
  anthropicClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

// Sends the prompt to the active provider (Gemini with Google Search or Anthropic Claude).
// Returns { content: markdown string, sources: [{ title, url }] }.
export async function runResearch(prompt) {
  const provider = getProvider();
  if (!provider) {
    throw new Error('No LLM API key configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env and restart.');
  }

  if (provider === 'anthropic') {
    return runAnthropicResearch(prompt);
  } else {
    return runGeminiResearch(prompt);
  }
}

async function runGeminiResearch(prompt) {
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const content = (response.text ?? '').trim();
  if (!content) throw new Error('Gemini returned an empty response.');

  return { content, sources: extractSources(response) };
}

async function runAnthropicResearch(prompt) {
  const response = await getAnthropicClient().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = (response.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim();

  if (!content) throw new Error('Claude returned an empty response.');

  return { content, sources: [] };
}

function extractSources(response) {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: chunk.web.title || url, url });
  }
  return sources;
}
