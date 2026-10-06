// IdeaTracker frontend: board rendering, drag and drop, search/filter, modals, research, theme.
// All model output goes through renderMarkdown (escapes HTML first). Everything else uses textContent.

import { renderMarkdown } from './markdown.js';

const POLL_MS = 3000;

const STATUS = {
  idle: { icon: '○', label: 'Not run' },
  running: { icon: '◐', label: 'Running' },
  done: { icon: '✓', label: 'Done' },
  failed: { icon: '!', label: 'Failed' },
};

const state = {
  stages: [],
  ideas: [],
  researchEnabled: false,
  filters: { q: '', tag: '', priority: '' },
  editingId: null,
  detailId: null,
  detailSnapshot: '',
  dragId: null,
  pollTimer: null,
};

const $ = (selector) => document.querySelector(selector);

// ---------- Small DOM helper ----------

// el('div', { class: 'x', onclick: fn }, child1, 'text', ...). Strings become text nodes (never HTML).
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// ---------- API ----------

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadIdeas() {
  state.ideas = await api('/ideas');
  render();
}

function replaceIdea(updated) {
  const index = state.ideas.findIndex((i) => i.id === updated.id);
  if (index >= 0) state.ideas[index] = updated;
  else state.ideas.push(updated);
}

// ---------- Helpers ----------

const byOrder = (a, b) => a.order - b.order;
const researchStages = () => state.stages.filter((s) => s.hasResearch);
const stageTitle = (id) => state.stages.find((s) => s.id === id)?.title ?? id;
const statusOf = (idea, stageId) => idea.research?.[stageId]?.status ?? 'idle';
const isRunning = (idea) => Object.values(idea.research ?? {}).some((r) => r.status === 'running');

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
}

function isSafeUrl(url) {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

function matchesFilters(idea) {
  const { q, tag, priority } = state.filters;
  if (priority && idea.priority !== priority) return false;
  if (tag && !idea.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
  if (q) {
    const haystack = [idea.title, idea.description, ...idea.tags].join(' ').toLowerCase();
    if (!haystack.includes(q.toLowerCase())) return false;
  }
  return true;
}

let toastTimer;
function toast(message) {
  let node = $('#toast');
  if (!node) {
    node = el('div', { id: 'toast', class: 'toast', role: 'alert' });
    document.body.append(node);
  }
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 6000);
}

// ---------- Rendering ----------

function render() {
  renderTagFilter();
  renderBoard();
  if (state.detailId) renderDetail();
  schedulePoll();
}

function renderTagFilter() {
  const select = $('#filter-tag');
  const tags = [...new Set(state.ideas.flatMap((i) => i.tags.map((t) => t.toLowerCase())))].sort();
  if (state.filters.tag && !tags.includes(state.filters.tag)) tags.push(state.filters.tag);
  select.replaceChildren(
    el('option', { value: '' }, 'All tags'),
    ...tags.map((t) => el('option', { value: t, selected: t === state.filters.tag }, t)),
  );
}

function renderBoard() {
  const board = $('#board');
  const columns = state.stages.map((stage) => {
    const all = state.ideas.filter((i) => i.stage === stage.id).sort(byOrder);
    const visible = all.filter(matchesFilters);
    const countText = visible.length === all.length ? `${all.length}` : `${visible.length}/${all.length}`;
    const headingId = `col-${stage.id}`;

    const list = el('ol', {
      class: 'card-list',
      dataset: { stage: stage.id },
      'aria-labelledby': headingId,
      ondragover: onDragOver,
      ondragleave: onDragLeave,
      ondrop: onDrop,
    }, visible.length ? visible.map(renderCard) : el('li', { class: 'empty' }, all.length ? 'No matches' : 'Drop ideas here'));

    return el('section', { class: 'column', dataset: { stage: stage.id } },
      el('header', { class: 'column-header' },
        el('h2', { id: headingId }, stage.title),
        el('span', { class: 'count', 'aria-label': `${countText} ideas` }, countText),
      ),
      list,
    );
  });
  board.replaceChildren(...columns);
}

function statusIcons(idea) {
  return el('ul', { class: 'status-icons', 'aria-label': 'Research status' },
    researchStages().map((stage) => {
      const status = statusOf(idea, stage.id);
      const label = `${stage.title}: ${STATUS[status].label}`;
      return el('li', { class: `status status-${status}`, title: label },
        el('span', { 'aria-hidden': 'true' }, STATUS[status].icon),
        el('span', { class: 'visually-hidden' }, label),
      );
    }),
  );
}

function researchButton(idea, { compact = false } = {}) {
  const stage = state.stages.find((s) => s.id === idea.stage);
  if (!stage?.hasResearch) return null;
  const status = statusOf(idea, stage.id);
  const running = status === 'running';
  const label = running ? 'Researching…' : status === 'done' || status === 'failed' ? 'Re-run research' : 'Run research';
  return el('button', {
    type: 'button',
    class: `btn ${compact ? 'btn-small' : ''} ${running ? 'is-running' : 'btn-primary'}`,
    disabled: running || !state.researchEnabled,
    title: state.researchEnabled ? `${label}: ${stage.title}` : 'Set an API key (GEMINI_API_KEY or ANTHROPIC_API_KEY) in .env to enable research',
    'aria-label': `${label} for ${stage.title} on “${idea.title}”`,
    onclick: (event) => {
      event.stopPropagation();
      runResearch(idea.id);
    },
  }, running ? el('span', { class: 'spinner', 'aria-hidden': 'true' }) : null, label);
}

function renderCard(idea) {
  const card = el('li', {
    class: `card priority-${idea.priority}`,
    draggable: 'true',
    dataset: { id: idea.id },
    ondragstart: onDragStart,
    ondragend: onDragEnd,
    onclick: () => openDetail(idea.id),
  },
    el('button', {
      type: 'button',
      class: 'card-title',
      onclick: (event) => { event.stopPropagation(); openDetail(idea.id); },
    }, idea.title),
    el('div', { class: 'card-meta' },
      el('span', { class: `badge badge-${idea.priority}` }, idea.priority),
      idea.tags.map((t) => el('span', { class: 'tag' }, t)),
    ),
    el('div', { class: 'card-footer' }, statusIcons(idea), researchButton(idea, { compact: true })),
  );
  return card;
}

// ---------- Detail modal ----------

function openDetail(id) {
  state.detailId = id;
  state.detailSnapshot = '';
  renderDetail();
  const dialog = $('#detail-dialog');
  if (!dialog.open) dialog.showModal();
}

function renderDetail() {
  const idea = state.ideas.find((i) => i.id === state.detailId);
  const dialog = $('#detail-dialog');
  if (!idea) {
    if (dialog.open) dialog.close();
    return;
  }

  // Skip re-rendering (and losing scroll/expanded state) if nothing changed.
  const snapshot = JSON.stringify(idea) + state.researchEnabled;
  if (snapshot === state.detailSnapshot) return;
  state.detailSnapshot = snapshot;

  const body = $('#detail-body');
  const scrollTop = body.scrollTop;
  const openSections = new Set([...body.querySelectorAll('details[open]')].map((d) => d.dataset.stage));
  const firstRender = !body.dataset.ideaId || body.dataset.ideaId !== idea.id;
  body.dataset.ideaId = idea.id;

  $('#detail-title').textContent = idea.title;

  const stageSelect = el('select', {
    id: 'detail-stage',
    onchange: (event) => moveIdea(idea.id, event.target.value),
  }, state.stages.map((s) => el('option', { value: s.id, selected: s.id === idea.stage }, s.title)));

  const actions = el('div', { class: 'detail-actions' },
    el('label', { for: 'detail-stage' }, 'Stage'),
    stageSelect,
    el('span', { class: 'spacer' }),
    el('button', { type: 'button', class: 'btn', onclick: () => openEdit(idea.id) }, 'Edit'),
    el('button', { type: 'button', class: 'btn btn-danger', onclick: () => deleteIdea(idea.id) }, 'Delete'),
  );

  const field = (label, value, className = '') => value
    ? [el('dt', {}, label), el('dd', { class: className }, value)]
    : [];

  const fields = el('dl', { class: 'fields' },
    field('Priority', el('span', { class: `badge badge-${idea.priority}` }, idea.priority)),
    field('Tags', idea.tags.length ? el('span', { class: 'tags' }, idea.tags.map((t) => el('span', { class: 'tag' }, t))) : null),
    field('Description', idea.description, 'prewrap'),
    field('Target audience', idea.targetAudience, 'prewrap'),
    field('Notes', idea.notes, 'prewrap'),
    field('Created', formatDate(idea.createdAt)),
  );

  const sections = researchStages().map((stage) => {
    const result = idea.research?.[stage.id];
    const status = statusOf(idea, stage.id);
    const isCurrent = stage.id === idea.stage;
    const open = firstRender ? isCurrent || status === 'running' : openSections.has(stage.id) || status === 'running';

    const content = [];
    if (status === 'running') {
      content.push(el('p', { class: 'running-note', role: 'status' },
        el('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Running AI research… this can take a moment.'));
    }
    if (status === 'failed' && result?.error) {
      content.push(el('p', { class: 'form-error' }, `Research failed: ${result.error}`));
    }
    if (result?.content) {
      const markdown = el('div', { class: 'markdown' });
      markdown.innerHTML = renderMarkdown(result.content); // Safe: renderMarkdown escapes all HTML first.
      content.push(markdown);
    }
    const sources = (result?.sources ?? []).filter((s) => isSafeUrl(s.url));
    if (sources.length) {
      content.push(el('div', { class: 'sources' },
        el('h4', {}, 'Sources'),
        el('ol', {}, sources.map((s) => el('li', {},
          el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title || s.url)))),
      ));
    }
    if (!result?.content && status !== 'running' && status !== 'failed') {
      content.push(el('p', { class: 'muted' }, 'No research yet.'));
    }

    const footer = el('div', { class: 'research-footer' },
      result?.updatedAt && status !== 'running' ? el('span', { class: 'muted' }, `Updated ${formatDate(result.updatedAt)}`) : null,
      el('span', { class: 'spacer' }),
      isCurrent ? researchButton(idea) : el('span', { class: 'muted' }, 'Move the card to this stage to run research.'),
    );

    return el('details', { class: 'research', dataset: { stage: stage.id }, open },
      el('summary', {},
        el('span', { class: 'research-title' }, stage.title),
        el('span', { class: `status-pill status-${status}` },
          el('span', { 'aria-hidden': 'true' }, STATUS[status].icon), ' ', STATUS[status].label),
      ),
      el('div', { class: 'research-body' }, content, footer),
    );
  });

  body.replaceChildren(actions, fields, el('h3', { class: 'section-title' }, 'Research'), ...sections);
  if (!firstRender) body.scrollTop = scrollTop;
}

// ---------- Create / edit modal ----------

function openEdit(id = null) {
  state.editingId = id;
  const idea = id ? state.ideas.find((i) => i.id === id) : null;
  const form = $('#edit-form');
  form.reset();
  $('#edit-title').textContent = idea ? 'Edit idea' : 'New idea';
  $('#edit-error').hidden = true;
  form.title.value = idea?.title ?? '';
  form.description.value = idea?.description ?? '';
  form.targetAudience.value = idea?.targetAudience ?? '';
  form.tags.value = idea?.tags.join(', ') ?? '';
  form.priority.value = idea?.priority ?? 'medium';
  form.notes.value = idea?.notes ?? '';
  $('#edit-dialog').showModal();
  form.title.focus();
}

async function saveEdit(event) {
  event.preventDefault();
  const form = event.target;
  const errorBox = $('#edit-error');
  const payload = {
    title: form.title.value.trim(),
    description: form.description.value,
    targetAudience: form.targetAudience.value,
    tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    priority: form.priority.value,
    notes: form.notes.value,
  };
  if (!payload.title) {
    errorBox.textContent = 'Title is required.';
    errorBox.hidden = false;
    form.title.focus();
    return;
  }
  try {
    const saved = state.editingId
      ? await api(`/ideas/${state.editingId}`, { method: 'PATCH', body: payload })
      : await api('/ideas', { method: 'POST', body: payload });
    replaceIdea(saved);
    $('#edit-dialog').close();
    render();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.hidden = false;
  }
}

// ---------- Actions ----------

async function moveIdea(id, stage, order) {
  // Optimistic update so the card moves immediately.
  const idea = state.ideas.find((i) => i.id === id);
  if (!idea) return;
  const fromStage = idea.stage;
  const target = state.ideas.filter((i) => i.stage === stage && i.id !== id).sort(byOrder);
  target.splice(Math.min(order ?? target.length, target.length), 0, idea);
  idea.stage = stage;
  target.forEach((item, index) => { item.order = index; });
  if (fromStage !== stage) {
    state.ideas.filter((i) => i.stage === fromStage).sort(byOrder).forEach((item, index) => { item.order = index; });
  }
  render();

  try {
    await api(`/ideas/${id}`, { method: 'PATCH', body: { stage, ...(order !== undefined && { order }) } });
  } catch (err) {
    toast(`Could not move card: ${err.message}`);
  }
  await loadIdeas(); // Sync the server's ordering of every card.
}

async function deleteIdea(id) {
  const idea = state.ideas.find((i) => i.id === id);
  if (!idea || !confirm(`Delete “${idea.title}”? This also deletes its research.`)) return;
  try {
    await api(`/ideas/${id}`, { method: 'DELETE' });
    $('#detail-dialog').close();
    await loadIdeas();
  } catch (err) {
    toast(`Could not delete: ${err.message}`);
  }
}

async function runResearch(id) {
  try {
    replaceIdea(await api(`/ideas/${id}/research`, { method: 'POST' }));
    render();
  } catch (err) {
    toast(`Could not start research: ${err.message}`);
    await loadIdeas();
  }
}

// While any research is running, refresh the board every few seconds to pick up results.
function schedulePoll() {
  clearTimeout(state.pollTimer);
  if (!state.ideas.some(isRunning)) return;
  state.pollTimer = setTimeout(async () => {
    try {
      await loadIdeas();
    } catch {
      schedulePoll();
    }
  }, POLL_MS);
}

// ---------- Drag and drop (native HTML5) ----------

function onDragStart(event) {
  const card = event.currentTarget;
  state.dragId = card.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', state.dragId);
  requestAnimationFrame(() => card.classList.add('dragging'));
}

function onDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  state.dragId = null;
  clearDropIndicators();
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach((n) => n.remove());
  document.querySelectorAll('.card-list.drag-over').forEach((n) => n.classList.remove('drag-over'));
}

// The card the dragged card should be inserted before, based on pointer Y (null = end of list).
function cardAfterPointer(list, y) {
  const cards = [...list.querySelectorAll('.card:not(.dragging)')];
  return cards.find((card) => {
    const box = card.getBoundingClientRect();
    return y < box.top + box.height / 2;
  }) ?? null;
}

function onDragOver(event) {
  if (!state.dragId) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const list = event.currentTarget;
  if (!list.classList.contains('drag-over')) {
    clearDropIndicators();
    list.classList.add('drag-over');
  }
  const before = cardAfterPointer(list, event.clientY);
  let indicator = list.querySelector('.drop-indicator');
  if (!indicator) indicator = el('li', { class: 'drop-indicator', 'aria-hidden': 'true' });
  if (before) {
    if (indicator.nextSibling !== before) list.insertBefore(indicator, before);
  } else if (list.lastElementChild !== indicator) {
    list.append(indicator);
  }
}

function onDragLeave(event) {
  const list = event.currentTarget;
  if (!list.contains(event.relatedTarget)) {
    list.classList.remove('drag-over');
    list.querySelector('.drop-indicator')?.remove();
  }
}

function onDrop(event) {
  event.preventDefault();
  const list = event.currentTarget;
  const id = state.dragId || event.dataTransfer.getData('text/plain');
  const stage = list.dataset.stage;
  const before = cardAfterPointer(list, event.clientY);
  clearDropIndicators();
  if (!id) return;

  // Convert the visible position into a position within the full column (filters may hide cards).
  const column = state.ideas.filter((i) => i.stage === stage && i.id !== id).sort(byOrder);
  const order = before ? column.findIndex((i) => i.id === before.dataset.id) : column.length;

  // Dropped back in the same spot: nothing to save.
  const idea = state.ideas.find((i) => i.id === id);
  if (idea?.stage === stage && column.filter((i) => i.order < idea.order).length === order) return;

  moveIdea(id, stage, Math.max(order, 0));
}

// ---------- Theme ----------

function applyThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  const button = $('#theme-toggle');
  button.setAttribute('aria-pressed', String(dark));
  button.querySelector('.theme-icon').textContent = dark ? '☀️' : '🌙';
  button.querySelector('.theme-label').textContent = dark ? 'Light mode' : 'Dark mode';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  applyThemeButton();
}

// ---------- Setup ----------

function bindEvents() {
  $('#new-idea').addEventListener('click', () => openEdit());
  $('#edit-form').addEventListener('submit', saveEdit);
  $('#theme-toggle').addEventListener('click', toggleTheme);

  $('#search').addEventListener('input', (e) => { state.filters.q = e.target.value.trim(); renderBoard(); });
  $('#filter-tag').addEventListener('change', (e) => { state.filters.tag = e.target.value; renderBoard(); });
  $('#filter-priority').addEventListener('change', (e) => { state.filters.priority = e.target.value; renderBoard(); });

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog').close());
  });
  $('#detail-dialog').addEventListener('close', () => {
    state.detailId = null;
    state.detailSnapshot = '';
    delete $('#detail-body').dataset.ideaId;
  });
  // Close a modal when clicking its backdrop.
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function init() {
  applyThemeButton();
  bindEvents();
  try {
    const [stages, config, ideas] = await Promise.all([api('/stages'), api('/config'), api('/ideas')]);
    state.stages = stages;
    state.researchEnabled = config.researchEnabled;
    state.ideas = ideas;
    if (!config.researchEnabled) {
      const banner = $('#banner');
      banner.textContent = 'Research is disabled: set GEMINI_API_KEY or ANTHROPIC_API_KEY in your .env file and restart the server.';
      banner.hidden = false;
    }
    render();
  } catch (err) {
    $('#board').replaceChildren(el('p', { class: 'form-error' }, `Could not load the board: ${err.message}`));
  }
}

init();
