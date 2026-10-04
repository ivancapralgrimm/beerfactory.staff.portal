#!/usr/bin/env node
// Initial local conversion/parity utility only. The authoritative live-history
// seed generator is tools/build-knowledge-legacy-seed.mjs; do not import this JSON
// into live Supabase or use it instead of the supplied migration history.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const input = process.argv[2] || "assets/training-data.txt";
const output = process.argv[3] || "knowledge-legacy-seed.generated.json";
const write = process.argv.includes("--write");

const IMAGE_RX = /^!\[([^\]]*)\]\(([^)\s]+)\)$/u;
const LIST_RX = /^(?:[-•]\s+|\d+[.)]\s+)(.*)$/u;
const INLINE_RX = /(\*\*.+?\*\*|==.+?==|\*.+?\*)/gu;

function normalizeCategory(raw, title = "") {
  const category = raw
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/^[\s:·-]+|[\s:·-]+$/g, "")
    .trim();
  if (/как появилось пиво/iu.test(title)) return "Пиво";
  if (/крепкий алкоголь/iu.test(category)) return "Алкоголь";
  if (/винная карта/iu.test(category) || /^вино$/iu.test(category)) return "Вино";
  if (/сервис/iu.test(category)) return "Сервис";
  if (/пиво/iu.test(category)) return "Пиво";
  if (/бар/iu.test(category)) return "Бар";
  if (/кухн/iu.test(category)) return "Кухня";
  if (/sop|инструкц/iu.test(category)) return "SOP";
  return category || "Обучение";
}

function inline(source) {
  let text = "";
  const marks = [];
  let cursor = 0;
  for (const match of source.matchAll(INLINE_RX)) {
    const index = match.index ?? 0;
    text += source.slice(cursor, index);
    const token = match[0];
    let type;
    let content;
    if (token.startsWith("**")) { type = "bold"; content = token.slice(2, -2); }
    else if (token.startsWith("==")) { type = "highlight"; content = token.slice(2, -2); }
    else { type = "italic"; content = token.slice(1, -1); }
    const from = text.length;
    text += content;
    if (content.length) marks.push({ type, from, to: text.length });
    cursor = index + token.length;
  }
  text += source.slice(cursor);
  return { text, marks };
}

function topic(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function blocks(articleId, title, body) {
  const result = [];
  let paragraph = [];
  let list = null;
  const topics = new Set(title.split(/\s*,\s*/u).map(topic).filter(Boolean));
  const push = block => result.push({ id: `${articleId}_block_${result.length + 1}`, ...block });

  const flushParagraph = () => {
    if (!paragraph.length) return;
    if (paragraph.length === 1) {
      const match = paragraph[0].match(/^\*\*([^*]+)\*\*$/u);
      if (match && topics.has(topic(match[1]))) {
        push({ type: "heading", level: 2, content: inline(match[1]) });
        paragraph = [];
        return;
      }
    }
    push({ type: "paragraph", content: inline(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flush = () => { flushParagraph(); flushList(); };

  for (const raw of body.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const image = line.match(IMAGE_RX);
    if (image) {
      flush();
      push({ type: "image", mediaId: null, legacySrc: image[2].replace(/^\//, ""), alt: image[1], caption: image[1], name: image[2].split("/").pop() || "", width: null, height: null });
      continue;
    }
    if (/^(?:-{3,}|_{3,})$/u.test(line)) { flush(); push({ type: "separator" }); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/u);
    if (heading) { flush(); push({ type: "heading", level: heading[1].length >= 3 ? 3 : 2, content: inline(heading[2]) }); continue; }
    if (/^>\s?/u.test(line)) { flush(); push({ type: "quote", content: inline(line.replace(/^>\s?/u, "")) }); continue; }
    const item = line.match(LIST_RX);
    if (item) {
      const ordered = /^\d/u.test(line);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(inline(item[1]));
      continue;
    }
    if (list) flushList();
    paragraph.push(line);
  }
  flush();
  return result;
}

function parse(text) {
  const rawArticles = [];
  let category = "Обучение";
  let active = null;
  for (const rawLine of text.replace(/\r/g, "").split("\n")) {
    if (rawLine.startsWith("### ")) { category = rawLine.slice(4).trim().replace(/:$/u, ""); active = null; continue; }
    if (rawLine.startsWith("## ")) {
      active = { id: `lesson-${rawArticles.length + 1}`, rawCategory: category, title: rawLine.slice(3).trim(), body: "" };
      rawArticles.push(active);
      continue;
    }
    if (active) active.body += `${rawLine}\n`;
  }
  return rawArticles
    .filter(a => !/^Раздел в разработке$/iu.test(a.title))
    .map(a => ({
      schemaVersion: 2,
      id: a.id,
      category: normalizeCategory(a.rawCategory, a.title),
      title: a.title,
      description: "",
      status: "published",
      sort_order: Number(a.id.slice('lesson-'.length)),
      blocks: blocks(a.id, a.title, a.body.trim()),
      revision: 1
    }));
}

const source = await fs.readFile(input, "utf8");
const articles = parse(source);
const ids = new Set(articles.map(a => a.id));
if (ids.size !== articles.length) throw new Error("duplicate article ids");
if (!articles.length) throw new Error("no articles parsed");

const stats = {
  source: path.normalize(input),
  sha256: crypto.createHash("sha256").update(source).digest("hex"),
  articles: articles.length,
  blocks: articles.reduce((sum, a) => sum + a.blocks.length, 0),
  images: articles.reduce((sum, a) => sum + a.blocks.filter(b => b.type === "image").length, 0),
  separators: articles.reduce((sum, a) => sum + a.blocks.filter(b => b.type === "separator").length, 0),
  orderedLists: articles.reduce((sum, a) => sum + a.blocks.filter(b => b.type === "list" && b.ordered).length, 0),
  categories: Object.fromEntries([...new Set(articles.map(a => a.category))].sort().map(category => [category, articles.filter(a => a.category === category).length]))
};

if (write) {
  await fs.writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), stats, articles }, null, 2)}\n`);
  console.log(`written ${output}`);
}
console.log(JSON.stringify(stats, null, 2));
