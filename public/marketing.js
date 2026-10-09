// Interactive scripts for IdeaTracker Marketing / Showcase Page (Claude Code Meetup edition)

import { renderMarkdown } from './markdown.js';

// Stage Showcase Data & Blueprints for the interactive explorer
const STAGE_SHOWCASES = {
  idea: {
    number: '01',
    title: 'Idea Definition',
    subtitle: 'Capture the core problem, target audience, and initial hypotheses before building.',
    features: [
      '<strong>Focused Problem Statement:</strong> Clear boundary around what you are solving and for whom.',
      '<strong>Audience & Tag Categorization:</strong> Filterable by market segment (B2B, Mobile, AI, Solo).',
      '<strong>Priority Flags:</strong> Triage high vs low priority ideas effortlessly.',
    ],
    previewTitle: 'Sample Idea Card: Photography Client Sales SaaS',
    previewContent: `### Idea Overview
**Title:** Photography Studio Client Sales Portal
**Target Audience:** Family, senior, and professional headshot photographers
**Problem:** Photographers struggle to share high-res galleries with clients, collect orders for digital downloads, and get paid without platform fees eating 15% of revenue on mobile.
**Priority:** Medium | **Tags:** #photography, #b2b, #stripe-connect, #pwa`,
  },
  'tech-stack': {
    number: '02',
    title: 'Tech Stack & Architecture Blueprint',
    subtitle: 'Compares 3 realistic stacks with trade-offs, solo MVP build time, monthly costs, and directory layout.',
    features: [
      '<strong>Trade-Off Comparison:</strong> Analyzes serverless vs Supabase vs React Native/AWS with real cost models at 100 vs 10,000 users.',
      '<strong>Agent Repository Layout:</strong> Generates ready-to-scaffold monorepo directory trees.',
      '<strong>SQL Database Schema:</strong> Full Drizzle/Postgres tables, enums, relations, and indexes.',
      '<strong>API Endpoint Mapping:</strong> Concrete REST / Server Actions and third-party webhook handlers.',
    ],
    previewTitle: 'Generated Architecture Specification for Claude Code',
    previewContent: `## Recommended Architecture: Next.js + Postgres + Cloudflare R2 + Stripe Connect

### Directory Layout for AI Coding Agent:
\`\`\`
studio-app/
├── app/
│   ├── (dashboard)/galleries/[id]/page.tsx
│   ├── g/[slug]/page.tsx          # Public client gallery
│   └── api/webhooks/stripe/route.ts
├── lib/
│   ├── db/schema.ts               # Drizzle Postgres schema
│   ├── r2.ts                      # Zero-egress Cloudflare S3 client
│   └── stripe.ts                  # Stripe Connect Express
└── trigger/
    └── process-photo.ts           # Sharp watermark pipeline
\`\`\`

### Key Database Entities:
- \`studios\` (id, owner_id, plan, platform_fee_bps)
- \`galleries\` (id, studio_id, slug, expires_at, passcode_hash)
- \`photos\` (id, gallery_id, preview_url, original_r2_key, status)
- \`orders\` (id, gallery_id, total_amount, stripe_intent_id, status)`,
  },
  market: {
    number: '03',
    title: 'Market & Competitor Intelligence',
    subtitle: 'Live web-grounded competitor breakdown, pricing anchors, market gaps, and prioritized MVP features.',
    features: [
      '<strong>Competitor Matrix:</strong> Direct comparison table (e.g. Pixieset, ShootProof, SmugMug) with real pricing.',
      '<strong>Exploitable Gaps:</strong> Identifies unserved niches (e.g. "Senior chooses, parent pays" or batch corporate headshot days).',
      '<strong>P0 / P1 / P2 Agent Feature Spec:</strong> Actionable user stories with strict acceptance criteria.',
    ],
    previewTitle: 'Competitor Matrix & MVP Feature Differentiation',
    previewContent: `## Competitor Breakdown & Gap Analysis

| Competitor | Core Offering | Pricing Anchor | Weakness to Exploit |
|---|---|---|---|
| **Pixieset** | Galleries & Store | Free + 15% fee, $8–$50/mo | High commission on free tier; heavy wedding focus |
| **ShootProof** | Galleries & Invoicing | $10–$50/mo by photo count | Dated mobile UI; photo count caps cause anxiety |
| **Dropbox / Drive**| Raw file sharing | $0–$12/mo | No watermarking, no paywall, no client favorites |

### Key Differentiator for MVP:
1. **"Ask a Parent" mobile checkout flow:** Senior picks favorites on iPhone -> taps "Send to Dad" -> Dad receives prefilled SMS checkout link with Apple Pay.
2. **Zero-egress infrastructure:** Cloudflare R2 allows unlimited full-res photo views at 90% lower hosting cost.`,
  },
  marketing: {
    number: '04',
    title: 'Marketing Plan & Landing Page Copy',
    subtitle: 'Positioning statement, first 100 users acquisition playbook, and complete landing page copy blocks.',
    features: [
      '<strong>Value Pillars:</strong> Core emotional & functional benefits for the target persona.',
      '<strong>First 100 Users Strategy:</strong> Niche acquisition channels (Lightroom presets communities, local photography clubs).',
      '<strong>Agent-Ready Landing Copy:</strong> Hero headline, subhead, bullet points, CTA triggers, and FAQ.',
    ],
    previewTitle: 'Landing Page Blueprint & Copy Spec',
    previewContent: `## Landing Page Copy Specification

**Hero Headline:** Deliver Stunning Client Galleries in Seconds. Keep 100% of Your Sales.
**Subhead:** The text-friendly gallery and mobile checkout tool built for family, senior, and headshot photographers.

### Value Pillars:
1. **Mobile-First Sharing:** Clients open a single link via text with zero logins or passwords required.
2. **Instant Wallet Payments:** Apple Pay and Google Pay let parents buy downloads in 2 taps.
3. **No Per-Sale Ransom:** Keep your hard-earned revenue without 15% platform commissions.

### First 100 Users Acquisition Tactics:
- Offer free portfolio migration from Pixieset in Facebook photography groups.
- Partner with local camera shops and senior portrait photography workshops.`,
  },
  monetization: {
    number: '05',
    title: 'Monetization & Billing Logic',
    subtitle: 'Pricing tiers, revenue projections, Stripe Connect billing schema, and feature-gating logic.',
    features: [
      '<strong>Tiered Pricing Matrix:</strong> Free vs Pro ($12/mo) vs Studio ($29/mo) with platform fee trade-offs.',
      '<strong>Billing Implementation Spec:</strong> Complete Stripe webhook lifecycle events for an AI coding agent.',
      '<strong>Feature Gate Rules:</strong> Explicit permissions, storage quotas, and client limits per tier.',
    ],
    previewTitle: 'Stripe Billing Logic & Paywall Specification',
    previewContent: `## Monetization Model & Feature Gating

| Plan | Price | Platform Fee | Storage Quota | Extra Features |
|---|---|---|---|---|
| **Free** | $0/mo | 8% per sale | 5 GB (3 galleries) | Basic watermarking |
| **Pro** | $12/mo | 0% fee | 100 GB (Unlimited) | Custom branding, SMS alerts |
| **Studio** | $29/mo | 0% fee | 500 GB | Batch sessions, team seats |

### Stripe Webhook Handlers Required:
- \`checkout.session.completed\`: Grant photo download entitlements & trigger receipt email.
- \`customer.subscription.updated\`: Recalculate storage limits and platform fee basis points.
- \`charge.refunded\`: Revoke tokenized download access URLs.`,
  },
  ready: {
    number: '06',
    title: 'Ready to Build (Claude Code Handoff)',
    subtitle: 'Exports all accumulated context into a single structured prompt ready to launch in Claude Code.',
    features: [
      '<strong>Context Chaining:</strong> Combines Tech Stack, Competitor Specs, Landing Copy, and Billing Logic.',
      '<strong>Zero Prompt Drift:</strong> Claude Code receives precise constraints, schemas, and routes upfront.',
      '<strong>Immediate CLI Execution:</strong> Run `claude` and build the entire MVP in hours.',
    ],
    previewTitle: 'Master Prompt Export for `claude` CLI',
    previewContent: `\`\`\`markdown
# PROJECT SPECIFICATION: Photography Client Gallery & Sales SaaS

You are an expert full-stack engineer using TypeScript, Next.js 15, Drizzle ORM, and Tailwind CSS.
We are building a mobile-first photography client gallery app based on the following verified specifications:

1. ARCHITECTURE & TECH STACK:
   - Framework: Next.js 15 (App Router) + Drizzle ORM (Postgres)
   - Storage: Cloudflare R2 (S3 API) with private originals & public CDN previews
   - Payments: Stripe Connect Express destination charges

2. DATABASE SCHEMA:
   [Full SQL Schema from Stage 2]

3. MVP FEATURES (P0):
   [Prioritized Acceptance Criteria from Stage 3]

4. BILLING & GATING LOGIC:
   [Tier rules and Stripe webhook handlers from Stage 5]

Please start by scaffolding the project directory layout and setting up the database models in lib/db/schema.ts.
\`\`\``,
  },
};

// State
let activeStage = 'idea';
let timerInterval = null;
let timerSeconds = 0;

// DOM Elements
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupPipelineTabs();
  setupPitchModal();
  setupCopyButtons();
  setupDemoLauncher();
});

// Theme Management
function setupTheme() {
  const toggleBtn = $('#theme-toggle');
  if (!toggleBtn) return;

  const getTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    const isDark = theme === 'dark';
    toggleBtn.setAttribute('aria-pressed', isDark);
    const icon = toggleBtn.querySelector('.theme-icon');
    const label = toggleBtn.querySelector('.theme-label');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (label) label.textContent = isDark ? 'Light mode' : 'Dark mode';
  };

  applyTheme(getTheme());

  toggleBtn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

// Interactive Pipeline Tabs
function setupPipelineTabs() {
  const tabs = $$('.m-tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const stage = tab.dataset.stage;
      if (!stage || stage === activeStage) return;
      activeStage = stage;
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.stage === stage));
      renderActiveStage();
    });
  });

  renderActiveStage();
}

function renderActiveStage() {
  const data = STAGE_SHOWCASES[activeStage];
  if (!data) return;

  const infoContainer = $('#pipeline-info');
  const previewContainer = $('#pipeline-preview-body');
  const previewTitle = $('#pipeline-preview-title');

  if (infoContainer) {
    infoContainer.innerHTML = `
      <span class="m-section-tag">Stage ${data.number}</span>
      <h3>${data.title}</h3>
      <p>${data.subtitle}</p>
      <ul class="m-pipeline-features">
        ${data.features.map((f) => `<li><span class="m-compare-icon">⚡</span> <div>${f}</div></li>`).join('')}
      </ul>
      <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem;">
        <a href="/" class="btn btn-primary btn-small">Open Stage in Board ↗</a>
        <button type="button" class="btn btn-ghost btn-small copy-preview-btn">📋 Copy Section Spec</button>
      </div>
    `;

    const copyBtn = infoContainer.querySelector('.copy-preview-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        copyToClipboard(data.previewContent, 'Stage spec copied!');
      });
    }
  }

  if (previewTitle) {
    previewTitle.textContent = data.previewTitle;
  }

  if (previewContainer) {
    previewContainer.innerHTML = renderMarkdown(data.previewContent, { headingOffset: 0 });
  }
}

// Presenter Pitch Modal & Timer (Detroit Claude Build Day: 2-Minute Demo)
function setupPitchModal() {
  const modal = $('#pitch-dialog');
  const openBtns = $$('[data-open-pitch]');
  const closeBtns = $$('[data-close-pitch]');
  const timerDisplay = $('#pitch-timer-display');
  const timerToggle = $('#pitch-timer-toggle');
  const timerReset = $('#pitch-timer-reset');

  if (!modal) return;

  const openModal = () => {
    modal.showModal();
  };

  const closeModal = () => {
    modal.close();
  };

  openBtns.forEach((btn) => btn.addEventListener('click', openModal));
  closeBtns.forEach((btn) => btn.addEventListener('click', closeModal));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Keyboard shortcut 'P' for Presenter Mode
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p' && !['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) {
      e.preventDefault();
      if (modal.open) closeModal();
      else openModal();
    }
  });

  // Timer controls
  const updateTimerDisplay = () => {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    if (timerDisplay) {
      timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 02:00`;
      if (timerSeconds >= 120) {
        timerDisplay.style.color = 'var(--danger)';
      } else {
        timerDisplay.style.color = 'inherit';
      }
    }
  };

  if (timerToggle) {
    timerToggle.addEventListener('click', () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerToggle.textContent = '▶ Start Timer';
      } else {
        timerInterval = setInterval(() => {
          timerSeconds++;
          updateTimerDisplay();
        }, 1000);
        timerToggle.textContent = '⏸ Pause';
      }
    });
  }

  if (timerReset) {
    timerReset.addEventListener('click', () => {
      clearInterval(timerInterval);
      timerInterval = null;
      timerSeconds = 0;
      if (timerToggle) timerToggle.textContent = '▶ Start Timer';
      updateTimerDisplay();
    });
  }
}

// Copy Utilities & Toast
function setupCopyButtons() {
  $$('[data-copy-text]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copyText;
      const label = btn.dataset.copyLabel || 'Copied to clipboard!';
      copyToClipboard(text, label);
    });
  });
}

function copyToClipboard(text, successMsg = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`✅ ${successMsg}`);
  }).catch(() => {
    showToast('❌ Failed to copy to clipboard');
  });
}

function showToast(message) {
  let toast = $('#marketing-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'marketing-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  toast.style.display = 'block';

  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = 'none';
    toast.hidden = true;
  }, 2600);
}

// Interactive Demo Launcher helper
function setupDemoLauncher() {
  const launcher = $('#load-sample-idea-btn');
  if (launcher) {
    launcher.addEventListener('click', () => {
      window.location.href = '/';
    });
  }
}
