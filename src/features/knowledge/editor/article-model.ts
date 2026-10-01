export const KNOWLEDGE_ARTICLE_SCHEMA_VERSION = 2 as const;

export const KNOWLEDGE_LIMITS = Object.freeze({
  blocks: 200,
  title: 240,
  description: 1000,
  category: 80,
  textPerBlock: 100_000,
  totalText: 500_000,
  imageBytes: 8 * 1024 * 1024,
  imageDimension: 12_000,
  imagePixels: 40_000_000,
});

export type KnowledgeArticleStatus = "draft" | "published" | "archived";
export type InlineMarkType = "bold" | "italic" | "highlight";

export type InlineMark = {
  type: InlineMarkType;
  from: number;
  to: number;
};

export type RichText = {
  text: string;
  marks: InlineMark[];
};

export type KnowledgeTextBlock = {
  id: string;
  type: "paragraph" | "heading" | "quote";
  content: RichText;
  level?: 2 | 3;
};

export type KnowledgeListBlock = {
  id: string;
  type: "list";
  ordered: boolean;
  items: RichText[];
};

export type KnowledgeSeparatorBlock = {
  id: string;
  type: "separator";
};

export type KnowledgeImageBlock = {
  id: string;
  type: "image";
  mediaId: string | null;
  /** Server path in the private knowledge-media bucket. Not a public URL. */
  storagePath: string | null;
  /** Temporary compatibility field for r40.4 bundled images during migration. */
  legacySrc: string | null;
  alt: string;
  caption: string;
  name: string;
  width: number | null;
  height: number | null;
};

export type KnowledgeBlock =
  | KnowledgeTextBlock
  | KnowledgeListBlock
  | KnowledgeSeparatorBlock
  | KnowledgeImageBlock;

export type KnowledgeArticleDocument = {
  schemaVersion: typeof KNOWLEDGE_ARTICLE_SCHEMA_VERSION;
  id: string;
  category: string;
  title: string;
  description: string;
  status: KnowledgeArticleStatus;
  blocks: KnowledgeBlock[];
  revision: number;
  sort_order?: number;
  dashboard_featured?: boolean;
};

export class KnowledgeArticleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field = "",
  ) {
    super(message);
    this.name = "KnowledgeArticleError";
  }
}

function fail(code: string, message: string, field = ""): never {
  throw new KnowledgeArticleError(code, message, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedString(value: unknown, max: number, field: string) {
  if (typeof value !== "string")
    fail("SCHEMA", "Некорректный текст в статье.", field);
  const normalized = value.replace(/\r\n?/g, "\n");
  if (normalized.length > max)
    fail("LIMIT", `Поле превышает лимит ${max} символов.`, field);
  return normalized;
}

function validId(value: unknown, field: string) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9:_-]{1,100}$/.test(value)) {
    fail("SCHEMA", "Некорректный идентификатор.", field);
  }
  return value;
}

function validateMarks(
  value: unknown,
  textLength: number,
  field: string,
): InlineMark[] {
  if (!Array.isArray(value))
    fail("SCHEMA", "Некорректное форматирование текста.", field);

  return value.map((item, index) => {
    if (!isRecord(item))
      fail("SCHEMA", "Некорректное форматирование текста.", field);
    if (
      !(["bold", "italic", "highlight"] as const).includes(
        item.type as InlineMarkType,
      )
    ) {
      fail(
        "SCHEMA",
        "Неизвестный тип форматирования.",
        `${field}.marks.${index}`,
      );
    }
    if (!Number.isInteger(item.from) || !Number.isInteger(item.to)) {
      fail(
        "SCHEMA",
        "Некорректный диапазон форматирования.",
        `${field}.marks.${index}`,
      );
    }
    const from = item.from as number;
    const to = item.to as number;
    if (from < 0 || to <= from || to > textLength) {
      fail(
        "SCHEMA",
        "Диапазон форматирования выходит за границы текста.",
        `${field}.marks.${index}`,
      );
    }
    return { type: item.type as InlineMarkType, from, to };
  });
}

function validateRichText(value: unknown, field: string): RichText {
  if (!isRecord(value)) fail("SCHEMA", "Некорректный текстовый блок.", field);
  const text = normalizedString(
    value.text,
    KNOWLEDGE_LIMITS.textPerBlock,
    `${field}.text`,
  );
  const marks = validateMarks(value.marks, text.length, field);
  return { text, marks };
}

export function createRichText(text = ""): RichText {
  return { text, marks: [] };
}

export function createKnowledgeBlock(
  type: KnowledgeBlock["type"] = "paragraph",
): KnowledgeBlock {
  const id = crypto.randomUUID();
  if (type === "list")
    return { id, type, ordered: false, items: [createRichText()] };
  if (type === "separator") return { id, type };
  if (type === "image") {
    return {
      id,
      type,
      mediaId: null,
      storagePath: null,
      legacySrc: null,
      alt: "",
      caption: "",
      name: "",
      width: null,
      height: null,
    };
  }
  if (type === "heading")
    return { id, type, level: 2, content: createRichText() };
  return { id, type, content: createRichText() };
}

export function createKnowledgeArticle(): KnowledgeArticleDocument {
  return {
    schemaVersion: KNOWLEDGE_ARTICLE_SCHEMA_VERSION,
    id: `article:${crypto.randomUUID()}`,
    category: "Обучение",
    title: "",
    description: "",
    status: "draft",
    blocks: [createKnowledgeBlock("paragraph")],
    revision: 0,
  };
}

export function validateKnowledgeArticle(
  input: unknown,
  options: { requireTitle?: boolean } = {},
): KnowledgeArticleDocument {
  const requireTitle = options.requireTitle !== false;
  if (
    !isRecord(input) ||
    input.schemaVersion !== KNOWLEDGE_ARTICLE_SCHEMA_VERSION ||
    !Array.isArray(input.blocks)
  ) {
    fail(
      "SCHEMA",
      "Неподдерживаемый формат статьи (нужна версия 2).",
      "schemaVersion",
    );
  }
  if (
    input.blocks.length < 1 ||
    input.blocks.length > KNOWLEDGE_LIMITS.blocks
  ) {
    fail(
      "LIMIT",
      `В статье должно быть от 1 до ${KNOWLEDGE_LIMITS.blocks} блоков.`,
      "blocks",
    );
  }

  const id = validId(input.id, "id");
  const category = normalizedString(
    input.category,
    KNOWLEDGE_LIMITS.category,
    "category",
  ).trim();
  const title = normalizedString(
    input.title,
    KNOWLEDGE_LIMITS.title,
    "title",
  ).trim();
  const description = normalizedString(
    input.description,
    KNOWLEDGE_LIMITS.description,
    "description",
  );
  if (!category) fail("CATEGORY", "Выберите категорию.", "category");
  if (requireTitle && !title.trim())
    fail("TITLE", "Добавьте заголовок перед сохранением.", "title");
  if (
    !(["draft", "published", "archived"] as const).includes(
      input.status as KnowledgeArticleStatus,
    )
  ) {
    fail("STATUS", "Некорректный статус статьи.", "status");
  }
  if (!Number.isInteger(input.revision) || (input.revision as number) < 0) {
    fail("SCHEMA", "Некорректная ревизия статьи.", "revision");
  }

  const ids = new Set<string>();
  let totalText = title.length + description.length;

  const blocks = input.blocks.map((raw, index): KnowledgeBlock => {
    if (!isRecord(raw)) fail("SCHEMA", "Некорректный блок.", `blocks.${index}`);
    const blockId = validId(raw.id, `blocks.${index}.id`);
    if (ids.has(blockId))
      fail(
        "SCHEMA",
        "В статье повторяются идентификаторы блоков.",
        `blocks.${index}.id`,
      );
    ids.add(blockId);

    if (
      raw.type === "paragraph" ||
      raw.type === "quote" ||
      raw.type === "heading"
    ) {
      const content = validateRichText(raw.content, `blocks.${index}.content`);
      totalText += content.text.length;
      const base: KnowledgeTextBlock = { id: blockId, type: raw.type, content };
      if (raw.type === "heading") {
        if (raw.level !== 2 && raw.level !== 3)
          fail(
            "SCHEMA",
            "Некорректный уровень заголовка.",
            `blocks.${index}.level`,
          );
        base.level = raw.level;
      }
      return base;
    }

    if (raw.type === "list") {
      if (
        !Array.isArray(raw.items) ||
        raw.items.length < 1 ||
        raw.items.length > 100
      ) {
        fail("SCHEMA", "Некорректный список.", `blocks.${index}.items`);
      }
      const items = raw.items.map((item, itemIndex) => {
        const rich = validateRichText(
          item,
          `blocks.${index}.items.${itemIndex}`,
        );
        totalText += rich.text.length;
        return rich;
      });
      return {
        id: blockId,
        type: "list",
        ordered: raw.ordered === true,
        items,
      };
    }

    if (raw.type === "separator") return { id: blockId, type: "separator" };

    if (raw.type === "image") {
      const mediaId =
        raw.mediaId === null
          ? null
          : validId(raw.mediaId, `blocks.${index}.mediaId`);
      const storagePath =
        raw.storagePath === null || raw.storagePath === undefined
          ? null
          : normalizedString(
              raw.storagePath,
              500,
              `blocks.${index}.storagePath`,
            ).trim();
      if (
        storagePath &&
        (!/^[a-zA-Z0-9_./-]{1,500}$/.test(storagePath) ||
          storagePath
            .split("/")
            .some((part) => !part || part === "." || part === ".."))
      ) {
        fail(
          "IMAGE",
          "Некорректный путь медиахранилища.",
          `blocks.${index}.storagePath`,
        );
      }
      const legacySrc =
        raw.legacySrc === null
          ? null
          : normalizedString(
              raw.legacySrc,
              1000,
              `blocks.${index}.legacySrc`,
            ).trim();
      if (mediaId && !storagePath)
        fail(
          "IMAGE",
          "В серверном документе отсутствует путь изображения.",
          `blocks.${index}.storagePath`,
        );
      if (!mediaId && !legacySrc)
        fail(
          "IMAGE",
          "Изображение не связано с медиахранилищем.",
          `blocks.${index}`,
        );
      if (
        legacySrc &&
        (!/^(?:\/)?assets\/[a-zA-Z0-9_./-]+$/.test(legacySrc) ||
          legacySrc.split("/").some((part) => part === "." || part === ".."))
      ) {
        fail(
          "IMAGE",
          "Некорректный legacy-путь изображения.",
          `blocks.${index}.legacySrc`,
        );
      }
      const alt = normalizedString(raw.alt, 1000, `blocks.${index}.alt`);
      const caption = normalizedString(
        raw.caption,
        1000,
        `blocks.${index}.caption`,
      );
      const name = normalizedString(raw.name, 240, `blocks.${index}.name`);
      const width = raw.width === null ? null : raw.width;
      const height = raw.height === null ? null : raw.height;
      if (
        width !== null &&
        (!Number.isInteger(width) ||
          (width as number) < 1 ||
          (width as number) > KNOWLEDGE_LIMITS.imageDimension)
      ) {
        fail(
          "IMAGE_DIMENSIONS",
          "Некорректная ширина изображения.",
          `blocks.${index}.width`,
        );
      }
      if (
        height !== null &&
        (!Number.isInteger(height) ||
          (height as number) < 1 ||
          (height as number) > KNOWLEDGE_LIMITS.imageDimension)
      ) {
        fail(
          "IMAGE_DIMENSIONS",
          "Некорректная высота изображения.",
          `blocks.${index}.height`,
        );
      }
      if (
        width !== null &&
        height !== null &&
        (width as number) * (height as number) > KNOWLEDGE_LIMITS.imagePixels
      ) {
        fail(
          "IMAGE_DIMENSIONS",
          "Изображение превышает 40 мегапикселей.",
          `blocks.${index}`,
        );
      }
      return {
        id: blockId,
        type: "image",
        mediaId,
        storagePath,
        legacySrc,
        alt,
        caption,
        name,
        width: width as number | null,
        height: height as number | null,
      };
    }

    fail("SCHEMA", "Неизвестный тип блока.", `blocks.${index}.type`);
  });

  if (totalText > KNOWLEDGE_LIMITS.totalText) {
    fail(
      "LIMIT",
      `Суммарный объём текста превышает ${KNOWLEDGE_LIMITS.totalText} символов.`,
      "blocks",
    );
  }

  return {
    schemaVersion: KNOWLEDGE_ARTICLE_SCHEMA_VERSION,
    id,
    category,
    title,
    description,
    status: input.status as KnowledgeArticleStatus,
    blocks,
    revision: input.revision as number,
    ...(Number.isInteger(input.sort_order)
      ? { sort_order: input.sort_order as number }
      : {}),
    ...(typeof input.dashboard_featured === "boolean"
      ? { dashboard_featured: input.dashboard_featured }
      : {}),
  };
}

export function insertKnowledgeBlock(
  article: KnowledgeArticleDocument,
  block: KnowledgeBlock,
  afterId: string | null = null,
) {
  if (article.blocks.length >= KNOWLEDGE_LIMITS.blocks) {
    fail(
      "LIMIT",
      `В статье может быть не больше ${KNOWLEDGE_LIMITS.blocks} блоков.`,
      "blocks",
    );
  }
  if (article.blocks.some((item) => item.id === block.id)) {
    fail("SCHEMA", "Этот блок уже есть в статье.", "blocks");
  }
  const index =
    afterId === null
      ? -1
      : article.blocks.findIndex((item) => item.id === afterId);
  if (afterId !== null && index < 0)
    fail("STALE", "Место вставки больше не существует.", "blocks");
  return {
    ...article,
    blocks: [
      ...article.blocks.slice(0, index + 1),
      block,
      ...article.blocks.slice(index + 1),
    ],
  };
}

export function moveKnowledgeBlock(
  article: KnowledgeArticleDocument,
  blockId: string,
  delta: -1 | 1,
) {
  const from = article.blocks.findIndex((item) => item.id === blockId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= article.blocks.length) return article;
  const blocks = [...article.blocks];
  [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
  return { ...article, blocks };
}
