// Render every Markdown doc through the rulebook theme → styled HTML (then PDF).
// Small purpose-built Markdown subset: headings, bold/italic/code, links, lists,
// tables, blockquotes (→ rulebook sidebars), rules. Run: node tools/md2rulebook.mjs
import fs from "fs";
import path from "path";

const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), "..");
const DOCS = ["GAME-DESIGN", "BALANCE-REPORT", "REAL-WORLD", "DESIGN-IO", "TERRAIN", "BUILD-PLAN"];
const outDir = path.join(root, "docs", "pdf");
fs.mkdirSync(outDir, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
  s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
  return s;
}

function convert(md) {
  const lines = md.split("\n");
  let html = "", i = 0, title = "";
  const flushList = (items, ord) => (items.length ? `<${ord ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ord ? "ol" : "ul"}>` : "");
  while (i < lines.length) {
    let ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    // table
    if (ln.trim().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i++; }
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2); // skip the |---| separator
      html += "<table><thead><tr>" + head.map((h) => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
      for (const r of body) html += "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
      html += "</tbody></table>";
      continue;
    }
    // blockquote → sidebar
    if (ln.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      html += `<div class="sidebar">${buf.map((b) => inline(b)).join("<br>")}</div>`;
      continue;
    }
    // heading
    const h = ln.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length, txt = inline(h[2]);
      if (lvl === 1 && !title) { title = h[2]; i++; continue; } // becomes the <h1>
      html += `<h${Math.min(lvl, 3)}>${txt}</h${Math.min(lvl, 3)}>`; i++; continue;
    }
    // hr
    if (/^(\*\*\*|---)\s*$/.test(ln)) { html += '<p class="flourish">✦ ✦ ✦</p>'; i++; continue; }
    // lists
    if (/^\s*[-*]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      html += flushList(items, false); continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      html += flushList(items, true); continue;
    }
    // paragraph
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*]\s|\s*\d+\.\s|>|\||(\*\*\*|---)\s*$)/.test(lines[i])) { buf.push(lines[i]); i++; }
    html += `<p>${inline(buf.join(" "))}</p>`;
  }
  return { title, html };
}

for (const name of DOCS) {
  const md = fs.readFileSync(path.join(root, "docs", `${name}.md`), "utf8");
  const { title, html } = convert(md);
  const page = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(title)}</title>
<link rel="stylesheet" href="../rulebook.css"></head><body>
<h1>${inline(title)}</h1>
<div class="cols">${html}</div></body></html>`;
  fs.writeFileSync(path.join(outDir, `${name}.html`), page);
  console.log("wrote docs/pdf/" + name + ".html");
}
console.log("done — now print each to PDF");
