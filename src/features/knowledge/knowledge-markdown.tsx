import type { ReactNode } from "react";

export type KnowledgeBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; text: string }
  | { type: "callout"; text: string }
  | { type: "separator" }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; alt: string; src: string };

const IMAGE_RX = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const LIST_RX = /^(?:[-•]\s+|\d+[.)]\s+)(.*)$/;

export function resolveKnowledgeImage(raw: string) {
  try {
    const url = new URL(raw, window.location.origin + "/");

    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password) return "";

    return url.href;
  } catch {
    return "";
  }
}

export function parseKnowledgeMarkdown(body: string): KnowledgeBlock[] {
  const output: KnowledgeBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) {
      output.push({ type: "paragraph", lines: paragraph });
      paragraph = [];
    }

    if (list) {
      output.push({ type: "list", ...list });
      list = null;
    }
  };

  for (const raw of String(body ?? "").replace(/\r/g, "").split("\n")) {
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const image = line.match(IMAGE_RX);
    if (image) {
      flush();
      const src = resolveKnowledgeImage(image[2]);
      if (src) output.push({ type: "image", alt: image[1], src });
      continue;
    }

    if (/^(?:-{3,}|_{3,})$/.test(line)) {
      flush();
      output.push({ type: "separator" });
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flush();
      output.push({
        type: "heading",
        text: line.replace(/^#+\s/, "")
      });
      continue;
    }

    if (/^>\s?/.test(line)) {
      flush();
      output.push({
        type: "callout",
        text: line.replace(/^>\s?/, "")
      });
      continue;
    }

    const listItem = line.match(LIST_RX);
    if (listItem) {
      const ordered = /^\d/.test(line);

      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      if (!list) list = { ordered, items: [] };

      list.items.push(listItem[1]);
      continue;
    }

    if (list) flush();
    paragraph.push(line);
  }

  flush();
  return output;
}

export function renderKnowledgeInline(text: string): ReactNode[] {
  return String(text ?? "")
    .split(/(\*\*.+?\*\*|==.+?==|\*.+?\*)/g)
    .filter(Boolean)
    .map((token, index) => {
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={index}>{token.slice(2, -2)}</strong>;
      }

      if (token.startsWith("==") && token.endsWith("==")) {
        return <mark key={index}>{token.slice(2, -2)}</mark>;
      }

      if (
        token.startsWith("*") &&
        token.endsWith("*") &&
        token.length > 2
      ) {
        return <em key={index}>{token.slice(1, -1)}</em>;
      }

      return <span key={index}>{token}</span>;
    });
}
