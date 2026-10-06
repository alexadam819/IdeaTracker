# IdeaTracker: Agent Guide

## What this app is

IdeaTracker is a lightweight, single-user web app for tracking SaaS application ideas on a Kanban board. Each column is a research stage. When the user moves a card into a stage and clicks **Run research**, the server calls Google Gemini (with Google Search grounding) to produce research for that stage. The result is saved on the card.

All data lives in one local JSON file. There is no external database and no authentication.

## Tech stack

- **Backend:** Node.js (LTS, 20+) with Express. Use ES modules (`"type": "module"`).
- **Frontend:** Plain HTML, CSS, and vanilla JavaScript, served statically by Express. **No build step**, no frameworks, no bundlers.
- **LLM:** Google Gemini via `@google/genai` (with Google Search grounding) or Anthropic Claude via `@anthropic-ai/sdk`. Auto-detected based on which API key is configured in `.env`.
- **Database:** A local JSON file at `data/db.json`.
- **Config:** Environment variables loaded from `.env` with Node's built-in `--env-file` flag (no `dotenv`).

### Dependencies

Keep dependencies minimal. The approved runtime dependencies are `express`, `@google/genai`, and `@anthropic-ai/sdk`. **Ask the user before adding any other dependency** (runtime or dev). Prefer built-in Node and browser APIs. For example, use the native HTML5 Drag and Drop API instead of a drag-and-drop library.

## Suggested project layout

```
IdeaTracker/
├── AGENTS.md
├── package.json
├── .env.example          # GEMINI_API_KEY=, GEMINI_MODEL=, PORT=
├── .gitignore            # node_modules, .env, data/db.json
├── server/
│   ├── index.js          # Express app setup, static serving, routes
│   ├── routes/ideas.js   # REST API for ideas
│   ├── db.js             # JSON file read/write layer (the only module that touches db.json)
│   ├── stages.js         # Stage definitions and research prompts
│   └── research.js       # Gemini client and research runner
├── public/
│   ├── index.html
│   ├── styles.css        # Light and dark themes via CSS custom properties
│   └── app.js            # Board rendering, drag and drop, search/filter, modals
└── data/
    └── db.json           # Created automatically on first run if missing
```

## Board stages

Columns, in order. The stage `id` values are fixed. Define them in one place (`server/stages.js`) and have the frontend read them from the API.

| Order | id | Column title | Research step |
|---|---|---|---|
| 1 | `idea` | Idea | None. The user writes the idea here. |
| 2 | `tech-stack` | Tech Stack | Recommended tech stack options with trade-offs, rough cost, and complexity. |
| 3 | `market` | Market & Competitors | Market size signals, target segments, existing competitors with links, gaps. |
| 4 | `marketing` | Marketing Plan | Positioning, channels, launch ideas, early user acquisition. |
| 5 | `monetization` | Monetization | Pricing models, suggested tiers, comparison with competitor pricing. |
| 6 | `ready` | Ready to Build | None. Final holding column. |

## Research workflow rules

- Moving a card **does not** start research on its own. Research only runs when the user clicks **Run research** on a card in a research stage.
- Research runs on the server, never in the browser. The API key must never reach the frontend.
- **Context chaining:** each stage's prompt includes the card's original idea fields (title, description, target audience, tags, notes) **plus the saved output of every earlier stage** that has results.
- Each stage's output is saved on the card under that stage's id, so results from every stage are kept. Running research again for a stage replaces that stage's previous result. Moving a card backwards does not delete any results.
- Track a status for each stage: `idle` → `running` → `done` | `failed`. Save the error message if a run fails. While a stage is `running`, show a loading state and disable its button.
- Save the grounding sources (URLs and titles) that Gemini returns along with the research text, and show them as links in the UI.
- Ask Gemini for Markdown output. Render it safely on the frontend. Escape or sanitize HTML, and never inject raw model output with `innerHTML` without sanitizing it first.
- Keep prompts in `server/stages.js` so they are easy to change.
- Read the model name from `GEMINI_MODEL`, with a sensible default. Don't hardcode it in more than one place.

## Data model

`data/db.json`:

```json
{
  "version": 1,
  "ideas": [
    {
      "id": "uuid",
      "title": "string (required)",
      "description": "string",
      "targetAudience": "string",
      "tags": ["string"],
      "priority": "low | medium | high",
      "notes": "string",
      "stage": "idea | tech-stack | market | marketing | monetization | ready",
      "order": 0,
      "research": {
        "tech-stack": {
          "status": "idle | running | done | failed",
          "content": "markdown string",
          "sources": [{ "title": "string", "url": "string" }],
          "error": null,
          "updatedAt": "ISO 8601"
        }
      },
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601"
    }
  ]
}
```

- Generate ids with `crypto.randomUUID()`.
- `order` is the card's position within its column.
- Include a `version` field so the data format can be migrated later.

## JSON database rules

- `server/db.js` is the **only** module that reads or writes `db.json`.
- **Atomic writes:** write to a temp file in the same folder, then `fs.rename` it over `db.json`.
- **Serialize writes:** send every change through one in-process queue (a promise chain) so two requests at once can't overwrite each other. This matters most when a long research call finishes while the user is editing.
- If `db.json` is missing, create it with `{ "version": 1, "ideas": [] }`.
- Validate input on the server: `title` is required, `stage` and `priority` must be known values, and strings have reasonable length limits.

## API (REST, JSON)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stages` | List stage definitions |
| GET | `/api/config` | Priorities and whether research is enabled (API key set). Never returns the key. |
| GET | `/api/ideas` | List all ideas |
| POST | `/api/ideas` | Create an idea (always starts in `idea`) |
| PATCH | `/api/ideas/:id` | Update fields, including `stage` and `order` (move or reorder) |
| DELETE | `/api/ideas/:id` | Delete an idea |
| POST | `/api/ideas/:id/research` | Run research for the card's current stage |

Return proper HTTP status codes and errors shaped like `{ "error": "message" }`.

## Frontend features

- Kanban board with the six columns. Cards show title, priority, tags, and an icon for each stage's research status.
- **Drag and drop** cards between and within columns using the native HTML5 API. Save the new `stage` and `order` with `PATCH`.
- Create and edit cards in a modal. The card detail view shows the idea fields plus a collapsible section for each stage's research and its sources.
- A **Run research** button appears on cards in research stages.
- **Search** across title, description, and tags, and **filter** by tag and priority. Filtering happens on the client.
- **Dark mode:** a toggle that defaults to `prefers-color-scheme` and saves the choice in `localStorage`.
- Make it responsive and accessible: use semantic HTML, keyboard-reachable controls, and visible focus states.

## Conventions

- Keep code simple and readable. Use small modules and `async`/`await`, and avoid clever abstractions.
- Never commit `.env` or `data/db.json`. Keep `.env.example` up to date.
- npm scripts: `npm start` (`node --env-file=.env server/index.js`) and `npm run dev` (adds `--watch`).
- Explain in plain language what changed, and ask before making structural changes not described here (new dependencies, a different storage approach, new stages).
