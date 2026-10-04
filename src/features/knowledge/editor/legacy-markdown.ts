import type {
  InlineMark,
  InlineMarkType,
  KnowledgeArticleDocument,
  KnowledgeBlock,
  KnowledgeListBlock,
  RichText,
} from "./article-model";
import { validateKnowledgeArticle } from "./article-model";

const IMAGE_RX = /^!\[([^\]]*)\]\(([^)\s]+)\)$/u;
const LIST_RX = /^(?:[-•]\s+|\d+[.)]\s+)(.*)$/u;
const INLINE_RX = /(\*\*.+?\*\*|==.+?==|\*.+?\*)/gu;

type BlockWithoutId = KnowledgeBlock extends infer Block
  ? Block extends KnowledgeBlock
    ? Omit<Block, "id">
    : never
  : never;

function deterministicBlockId(articleId: string, index: number) {
  return `${articleId.replace(/[^a-zA-Z0-9_-]/g, "_")}_block_${index + 1}`;
}

export function normalizeLegacyKnowledgeCategory(raw: string, title = "") {
  const category = raw
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/^[\s:·-]+|[\s:·-]+$/g, "")
    .trim();

  if (/как появилось пиво/iu.test(title)) return "Пиво";
  if (/крепкий алкоголь/iu.test(category)) return "Алкоголь";
  if (/винная карта/iu.test(category) || /^вино$/iu.test(category))
    return "Вино";
  if (/сервис/iu.test(category)) return "Сервис";
  if (/пиво/iu.test(category)) return "Пиво";
  if (/бар/iu.test(category)) return "Бар";
  if (/кухн/iu.test(category)) return "Кухня";
  if (/sop|инструкц/iu.test(category)) return "SOP";
  return category || "Обучение";
}

export function parseLegacyInline(source: string): RichText {
  let text = "";
  const marks: InlineMark[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_RX)) {
    const index = match.index ?? 0;
    text += source.slice(cursor, index);
    const token = match[0];
    let type: InlineMarkType;
    let content: string;

    if (token.startsWith("**")) {
      type = "bold";
      content = token.slice(2, -2);
    } else if (token.startsWith("==")) {
      type = "highlight";
      content = token.slice(2, -2);
    } else {
      type = "italic";
      content = token.slice(1, -1);
    }

    const from = text.length;
    text += content;
    if (content.length) marks.push({ type, from, to: text.length });
    cursor = index + token.length;
  }

  text += source.slice(cursor);
  return { text, marks };
}

function normalizedTopic(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function parseLegacyArticleBody(
  articleId: string,
  title: string,
  body: string,
): KnowledgeBlock[] {
  const blocks: KnowledgeBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: RichText[] } | null = null;
  const titleTopics = new Set(
    title
      .split(/\s*,\s*/u)
      .map(normalizedTopic)
      .filter(Boolean),
  );

  const push = (block: BlockWithoutId) => {
    blocks.push({
      ...block,
      id: deterministicBlockId(articleId, blocks.length),
    } as KnowledgeBlock);
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    if (paragraph.length === 1) {
      const match = paragraph[0].match(/^\*\*([^*]+)\*\*$/u);
      if (match && titleTopics.has(normalizedTopic(match[1]))) {
        push({
          type: "heading",
          level: 2,
          content: parseLegacyInline(match[1]),
        });
        paragraph = [];
        return;
      }
    }
    push({
      type: "paragraph",
      content: parseLegacyInline(paragraph.join("\n")),
    });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of String(body ?? "")
    .replace(/\r/g, "")
    .split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    const image = line.match(IMAGE_RX);
    if (image) {
      flush();
      push({
        type: "image",
        mediaId: null,
        storagePath: null,
        legacySrc: image[2].replace(/^\//, ""),
        alt: image[1],
        caption: image[1],
        name: image[2].split("/").pop() || "",
        width: null,
        height: null,
      });
      continue;
    }

    if (/^(?:-{3,}|_{3,})$/u.test(line)) {
      flush();
      push({ type: "separator" });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/u);
    if (heading) {
      flush();
      push({
        type: "heading",
        level: heading[1].length >= 3 ? 3 : 2,
        content: parseLegacyInline(heading[2]),
      });
      continue;
    }

    if (/^>\s?/u.test(line)) {
      flush();
      push({
        type: "quote",
        content: parseLegacyInline(line.replace(/^>\s?/u, "")),
      });
      continue;
    }

    const listItem = line.match(LIST_RX);
    if (listItem) {
      const ordered = /^\d/u.test(line);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(parseLegacyInline(listItem[1]));
      continue;
    }

    if (list) flushList();
    paragraph.push(line);
  }

  flush();
  return blocks;
}

export function parseLegacyKnowledgeFile(
  text: string,
): KnowledgeArticleDocument[] {
  const rawArticles: Array<{
    id: string;
    rawCategory: string;
    title: string;
    body: string;
  }> = [];
  let category = "Обучение";
  let active: (typeof rawArticles)[number] | null = null;

  for (const rawLine of String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")) {
    if (rawLine.startsWith("### ")) {
      category = rawLine.slice(4).trim().replace(/:$/u, "");
      active = null;
      continue;
    }

    if (rawLine.startsWith("## ")) {
      const title = rawLine.slice(3).trim();
      active = {
        id: `lesson-${rawArticles.length + 1}`,
        rawCategory: category,
        title,
        body: "",
      };
      rawArticles.push(active);
      continue;
    }

    if (active) active.body += `${rawLine}\n`;
  }

  return rawArticles
    .filter((article) => !/^Раздел в разработке$/iu.test(article.title))
    .map((article) =>
      validateKnowledgeArticle({
        schemaVersion: 2,
        id: article.id,
        category: normalizeLegacyKnowledgeCategory(
          article.rawCategory,
          article.title,
        ),
        title: article.title,
        description: "",
        status: "published",
        sort_order: Number(article.id.slice('lesson-'.length)),
        blocks: parseLegacyArticleBody(
          article.id,
          article.title,
          article.body.trim(),
        ),
        revision: 1,
      }),
    );
}

export function knowledgeDocumentPlainText(article: KnowledgeArticleDocument) {
  const pieces = [article.title, article.category, article.description];
  for (const block of article.blocks) {
    if (
      block.type === "paragraph" ||
      block.type === "heading" ||
      block.type === "quote"
    ) {
      pieces.push(block.content.text);
    } else if (block.type === "list") {
      pieces.push(...block.items.map((item) => item.text));
    } else if (block.type === "image") {
      pieces.push(block.alt, block.caption);
    }
  }
  return pieces.join(" ").replace(/\s+/gu, " ").trim();
}
