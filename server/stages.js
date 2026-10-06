// Stage definitions and research prompts.
// This is the single source of truth for board columns. The frontend reads it from GET /api/stages.

export const STAGES = [
  {
    id: 'idea',
    title: 'Idea',
    research: null,
  },
  {
    id: 'tech-stack',
    title: 'Tech Stack',
    research: {
      heading: 'Tech Stack Research',
      instructions: `Recommend 2-3 realistic tech stack options for building this SaaS product.
For each option cover: frontend, backend, database, hosting/infrastructure, auth, payments, and any notable third-party services.
Explain the trade-offs of each option (speed to MVP, scalability, developer experience, vendor lock-in).
Give a rough monthly cost estimate at MVP scale (~100 users) and at growth scale (~10,000 users).
Rate the build complexity of each option (low / medium / high) and estimate MVP build time for a solo developer.
Finish with a clear recommendation and why.`,
    },
  },
  {
    id: 'market',
    title: 'Market & Competitors',
    research: {
      heading: 'Market & Competitor Research',
      instructions: `Research the market for this SaaS product using current web sources.
Cover: market size signals (reports, search interest, funding activity), the most promising target segments, and buyer personas.
List existing competitors (direct and indirect). For each include the name, website link, what they offer, who they target, and their apparent weaknesses.
Summarize the gaps and opportunities a new entrant could exploit, and the main risks.
Use a Markdown table for the competitor comparison.`,
    },
  },
  {
    id: 'marketing',
    title: 'Marketing Plan',
    research: {
      heading: 'Marketing Plan',
      instructions: `Create a practical marketing plan for launching this SaaS product with a small budget.
Cover: a one-sentence positioning statement, key messaging and value propositions, the best acquisition channels (ranked, with why),
content and SEO ideas, community and partnership ideas, a launch plan (pre-launch, launch week, first 90 days),
and concrete tactics to win the first 100 users. Use the market and competitor findings if available.`,
    },
  },
  {
    id: 'monetization',
    title: 'Monetization',
    research: {
      heading: 'Monetization Strategy',
      instructions: `Recommend a monetization strategy for this SaaS product using current competitor pricing from the web.
Cover: suitable pricing models (subscription, usage-based, freemium, per-seat, etc.) with pros and cons,
a suggested set of pricing tiers with prices and included features, and a comparison table against competitor pricing (with links).
Include ideas for free trials or free plans, upsells, and annual discounts, plus a rough revenue projection for 100 / 1,000 paying customers.`,
    },
  },
  {
    id: 'ready',
    title: 'Ready to Build',
    research: null,
  },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

export function getStage(id) {
  return STAGES.find((s) => s.id === id);
}

export function isResearchStage(id) {
  return Boolean(getStage(id)?.research);
}

// Public stage info for the frontend (no prompts).
export function publicStages() {
  return STAGES.map(({ id, title, research }) => ({ id, title, hasResearch: Boolean(research) }));
}

// Builds the research prompt for a stage: the idea's fields plus the saved output of every earlier stage.
export function buildPrompt(idea, stageId) {
  const stage = getStage(stageId);
  if (!stage?.research) throw new Error(`Stage "${stageId}" has no research step`);

  const ideaLines = [
    `Title: ${idea.title}`,
    idea.description && `Description: ${idea.description}`,
    idea.targetAudience && `Target audience: ${idea.targetAudience}`,
    idea.tags?.length && `Tags: ${idea.tags.join(', ')}`,
    idea.notes && `Notes: ${idea.notes}`,
  ].filter(Boolean);

  const stageIndex = STAGES.indexOf(stage);
  const earlier = STAGES.slice(0, stageIndex)
    .filter((s) => s.research && idea.research?.[s.id]?.status === 'done' && idea.research[s.id].content)
    .map((s) => `## ${s.research.heading}\n\n${idea.research[s.id].content}`);

  return [
    'You are a pragmatic SaaS strategist helping an indie founder evaluate a product idea.',
    '',
    '# The idea',
    ideaLines.join('\n'),
    '',
    earlier.length ? '# Research from earlier stages\n\n' + earlier.join('\n\n') + '\n' : '',
    `# Your task: ${stage.research.heading}`,
    stage.research.instructions,
    '',
    'Format your answer in Markdown with clear headings, bullet points, and tables where helpful.',
    'Be specific and concise. Do not repeat the idea description back. Do not include raw HTML.',
  ].join('\n');
}
