// Gemini client and research runner. Runs only on the server so the API key never reaches the browser.

import { GoogleGenAI } from '@google/genai';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

let client = null;

export function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file and restart the server.');
  }
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Sends the prompt to Gemini with Google Search grounding.
// Returns { content: markdown string, sources: [{ title, url }] }.
export async function runResearch(prompt) {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const content = (response.text ?? '').trim();
  if (!content) throw new Error('Gemini returned an empty response.');

  return { content, sources: extractSources(response) };
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
