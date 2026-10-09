# IdeaTracker

A lightweight, single-user Kanban board web application for tracking and researching SaaS application ideas through progressive validation stages with AI.

> [!NOTE]
> **Hackathon Prototype**: This project was built as part of a hackathon session with the **Detroit AI Collective**. It is a standalone prototype and likely won't be maintained or updated again.

---

## Overview

IdeaTracker allows you to organize ideas on a Kanban board where each column represents a research stage. When you move a card to a stage and click **Run research**, the server calls an LLM (with search grounding) to generate detailed research for that step, chaining context from all prior stages.

### Research Pipeline Stages

1. **Idea** – Initial concept, target audience, tags, and initial notes.
2. **Tech Stack** – Recommended architecture, stack options, trade-offs, estimated costs, and complexity.
3. **Market & Competitors** – Market size signals, target segments, existing competitors, and market gaps.
4. **Marketing Plan** – Positioning, acquisition channels, launch strategy, and early user growth.
5. **Monetization** – Pricing models, suggested tiers, and competitor pricing comparisons.
6. **Ready to Build** – Final holding column for validated concepts.

---

## 🔑 Setup & API Keys

To make the AI research features work, you **must configure an API key** in your `.env` file. The app supports both Google Gemini and Anthropic Claude (auto-detected based on configured keys).

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/alexadam819/IdeaTracker.git
   cd IdeaTracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure your environment file:**
   Duplicate the sample environment file:
   ```bash
   cp sampleenv .env
   # or: cp .env.example .env
   ```

4. **Add your API Key to `.env`:**
   Open `.env` in your editor and provide at least one key:

   - **Google Gemini** (supports Google Search grounding):
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     GEMINI_MODEL=gemini-flash-latest # (optional)
     ```
     Get a key at [Google AI Studio](https://aistudio.google.com/apikey).

   - **Anthropic Claude**:
     ```env
     ANTHROPIC_API_KEY=your_anthropic_api_key_here
     ANTHROPIC_MODEL=claude-3-5-sonnet-20241022 # (optional)
     ```
     Get a key at [Anthropic Console](https://console.anthropic.com/).

5. **Start the server:**
   ```bash
   npm start
   ```
   *(For auto-reload during development: `npm run dev`)*

6. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

- **Backend:** Node.js (v20+) with Express (ES modules).
- **Frontend:** Plain HTML5, CSS3, and vanilla JavaScript (no build step, no frameworks, no bundlers). Native HTML5 Drag and Drop API.
- **LLM Integration:** `@google/genai` (with Google Search grounding) and `@anthropic-ai/sdk`.
- **Database:** Local JSON file (`data/db.json`) with atomic, serialized writes.