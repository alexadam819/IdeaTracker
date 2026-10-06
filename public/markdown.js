// Minimal, safe Markdown renderer for research output.
//
// Safety model: every piece of text is HTML-escaped FIRST, then a small set of known Markdown
// patterns is turned into a fixed list of tags. Links are only allowed for http(s) URLs.
// Raw HTML from the model is therefore always shown as text, never executed.
//
// Supported: headings, paragraphs, bold, italic, inline code, code fences, links,
// ordered/unordered (nested) lists, blockquotes, tables, and horizontal rules.

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function inline(text) {
  // Pull out inline code first so its contents aren't formatted.
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  s = escapeHtml(s);

  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[Number(i)])}</code>`);
}

const RE = {
  fence: /^\s*```/,
  heading: /^(#{1,6})\s+(.*?)\s*#*\s*$/,
  hr: /^\s*([-*_])(\s*\1){2,}\s*$/,
  tableRow: /^\s*\|/,
  tableSep: /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/,
  quote: /^\s*>/,
  listItem: /^(\s*)([-*+]|\d+[.)])\s+(.*)$/,
};

function startsBlock(line, next) {
  return RE.fence.test(line) || RE.heading.test(line) || RE.hr.test(line) || RE.quote.test(line)
    || RE.listItem.test(line) || (RE.tableRow.test(line) && next !== undefined && RE.tableSep.test(next));
}

function splitRow(row) {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function renderList(items) {
  let html = '';
  const stack = []; // { indent, tag }
  for (const item of items) {
    while (stack.length && item.indent < stack.at(-1).indent) {
      html += `</li></${stack.pop().tag}>`;
    }
    const top = stack.at(-1);
    if (!top || item.indent > top.indent) {
      const tag = item.ordered ? 'ol' : 'ul';
      stack.push({ indent: item.indent, tag });
      html += `<${tag}><li>`;
    } else {
      html += '</li><li>';
    }
    html += inline(item.text);
  }
  while (stack.length) html += `</li></${stack.pop().tag}>`;
  return html;
}

// Heading levels are shifted down (# -> h3) because research is shown inside a modal section.
export function renderMarkdown(markdown, { headingOffset = 2 } = {}) {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    if (RE.fence.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !RE.fence.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(RE.heading);
    if (heading) {
      const level = Math.min(heading[1].length + headingOffset, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

    if (RE.tableRow.test(line) && i + 1 < lines.length && RE.tableSep.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && RE.tableRow.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push(
        '<div class="table-wrap"><table><thead><tr>'
        + header.map((c) => `<th>${inline(c)}</th>`).join('')
        + '</tr></thead><tbody>'
        + rows.map((r) => '<tr>' + header.map((_, n) => `<td>${inline(r[n] ?? '')}</td>`).join('') + '</tr>').join('')
        + '</tbody></table></div>',
      );
      continue;
    }

    if (RE.quote.test(line)) {
      const quoted = [];
      while (i < lines.length && RE.quote.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(quoted.join('\n'), { headingOffset })}</blockquote>`);
      continue;
    }

    if (RE.listItem.test(line)) {
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const match = current.match(RE.listItem);
        if (match) {
          const indent = match[1].replace(/\t/g, '    ').length;
          const ordered = /\d/.test(match[2]);
          // A top-level item of the other kind (bullets vs numbers) starts a new list.
          if (items.length && indent <= items[0].indent && ordered !== items[0].ordered) break;
          items.push({ indent, ordered, text: match[3] });
          i++;
        } else if (current.trim() && /^\s+/.test(current) && items.length) {
          items.at(-1).text += ' ' + current.trim(); // continuation line
          i++;
        } else if (!current.trim() && i + 1 < lines.length && RE.listItem.test(lines[i + 1])) {
          i++; // blank line inside a loose list
        } else {
          break;
        }
      }
      out.push(renderList(items));
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i], lines[i + 1]))) {
      para.push(lines[i++].trim());
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}
