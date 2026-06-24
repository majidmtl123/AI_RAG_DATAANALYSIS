/**
 * Minimal, dependency-free Markdown -> HTML for analyst reports.
 * Supports: ## headings, bullet lists, GitHub-style tables, **bold**, `code`.
 * All raw input is HTML-escaped first, so output is safe to inject.
 */
export function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md);
  const lines = escaped.split(/\r?\n/);
  const html: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Table block: a header row followed by a |---| separator.
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const block: string[] = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        block.push(lines[i]);
        i += 1;
      }
      html.push(renderTable(block));
      continue;
    }

    // Heading.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Bullet list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Blank line.
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph (collect consecutive non-special lines).
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !isTableRow(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return html.join("\n");
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}
function isTableDivider(line: string): boolean {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}

function renderTable(block: string[]): string {
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const header = cells(block[0]);
  const bodyRows = block.slice(2).map(cells);

  const thead = `<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${bodyRows
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody>`;
  return `<table>${thead}${tbody}</table>`;
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
