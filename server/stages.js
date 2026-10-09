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
      heading: 'Tech Stack & Architecture Specification',
      instructions: `Recommend 2-3 realistic tech stack options for building this SaaS product, then provide a detailed architecture specification for the recommended option.
1. Options & Trade-offs: Compare 2-3 realistic stacks covering frontend, backend, database, auth, payments, hosting, and key services. Include build complexity (low/medium/high), estimated solo MVP build time, and estimated monthly costs (~100 vs ~10,000 users).
2. Recommended Stack: State the chosen stack and the rationale.
3. Agent Implementation Blueprint: Provide a concrete, agent-ready specification for the recommended stack that an AI coding agent can directly follow:
   - Recommended repository layout / directory structure.
   - Core libraries and packages to install.
   - Database schema & entity models (tables/collections, fields, relationships).
   - Key API routes / endpoints and data flow.
   - Authentication & third-party service integration plan.`,
    },
  },
  {
    id: 'market',
    title: 'Market & Competitors',
    research: {
      heading: 'Market Analysis & Competitive Differentiation Spec',
      instructions: `Research the market and competitors for this SaaS product using current web sources, and synthesize it into clear product requirements.
1. Market Landscape: Target segments, primary user personas, and demand signals.
2. Competitor Breakdown: List direct and indirect competitors with links, core offerings, pricing anchors, and key weaknesses. Use a Markdown table for comparison.
3. Market Gaps & Strategic Opportunities: Clear opportunities and differentiators to exploit.
4. Agent Feature Specification: A prioritized list of must-have MVP features and UX differentiators that an AI developer agent should implement to win against competitors, formatted as actionable requirements.`,
    },
  },
  {
    id: 'marketing',
    title: 'Marketing Plan',
    research: {
      heading: 'Marketing Strategy & Landing Page Blueprint',
      instructions: `Create a practical marketing plan and landing page implementation guide.
1. Positioning & Core Value Proposition: A crisp positioning statement and primary value pillars.
2. Go-to-Market & Acquisition Channels: Top channels ranked with rationale, SEO/keyword focus areas, and tactics to acquire the first 100 users.
3. Launch Roadmap: Step-by-step milestones (pre-launch, launch week, first 90 days).
4. Agent Landing Page Blueprint: Provide exact copy and section-by-section structure (Hero headline & subhead, primary CTA, feature highlights, social proof placeholders, FAQ) so an AI coding agent can directly build the marketing/landing page.`,
    },
  },
  {
    id: 'monetization',
    title: 'Monetization',
    research: {
      heading: 'Monetization Strategy & Billing Logic Spec',
      instructions: `Design a monetization model and billing implementation spec based on current market and competitor pricing.
1. Pricing Model & Competitor Pricing: Suitable model (subscription, usage-based, freemium, seats) and a comparison table with competitor pricing links.
2. Tier Structure & Revenue Projections: Recommended tiers (Free, Pro, Team/Enterprise, etc.) with price points and projected revenue at 100 / 1,000 paying users.
3. Agent Billing & Paywall Specification: Concrete specifications for an AI coding agent to implement:
   - Feature gating rules (which exact features/limits are allowed per tier).
   - Stripe / billing integration schema (subscription states, webhook events to handle, usage counters).
   - Trial, upgrade, and downgrade lifecycle logic.`,
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

// Builds the research prompt for a stage: the idea's fields, earlier stage research, plus any stage-specific feedback.
export function buildPrompt(idea, stageId, feedback) {
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

  const activeFeedback = (feedback ?? idea.research?.[stageId]?.feedback ?? '').trim();
  const feedbackBlock = activeFeedback
    ? [
        '# User Feedback & Specific Guidance for this Stage',
        'The user has provided the following specific feedback/instructions to guide this research output. Prioritize and incorporate these requests directly:',
        activeFeedback,
        '',
      ].join('\n')
    : '';

  return [
    'You are an expert SaaS technical architect and product strategist.',
    'Your goal is to produce comprehensive, high-quality research that doubles as an actionable, agent-ready specification.',
    'When the user is ready to build this product, they will pass your output directly to an AI coding agent (e.g. Claude, Gemini, Cursor, Copilot).',
    'Therefore, your output must be precise, concrete, well-structured, and immediately actionable for both a human founder and an AI coding agent.',
    '',
    '# The idea',
    ideaLines.join('\n'),
    '',
    earlier.length ? '# Research from earlier stages\n\n' + earlier.join('\n\n') + '\n' : '',
    feedbackBlock,
    `# Your task: ${stage.research.heading}`,
    stage.research.instructions,
    '',
    '# Output Guidelines',
    '- Format your answer in clean Markdown with clear headings, bullet points, tables, and code/schema blocks where applicable.',
    '- Be specific, technical, and concrete. Avoid generic filler, fluff, or vague generalities.',
    '- Include clear, unambiguous instructions, architectural decisions, and specifications that an AI agent can execute during implementation.',
    activeFeedback ? '- Explicitly address and incorporate all points in the user feedback section above.' : '',
    '- Do not repeat the raw idea description back. Do not include raw HTML.',
  ].filter(Boolean).join('\n');
}

