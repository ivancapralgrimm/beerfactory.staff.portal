import { KNOWLEDGE_LIMITS, KnowledgeArticleError } from "./article-model";

const MIME_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
] as const);

export type PreparedKnowledgeImage = {
  file: File;
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  width: number;
  height: number;
  previewUrl: string;
};

function fail(code: string, message: string): never {
  throw new KnowledgeArticleError(code, message, "image");
}

function ascii(bytes: Uint8Array, from: number, length: number) {
  return String.fromCharCode(...bytes.slice(from, from + length));
}

export function sniffKnowledgeImage(
  bytes: Uint8Array,
): PreparedKnowledgeImage["mime"] {
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return "image/png";

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (bytes.length >= 10 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "image/gif";
  }

  if (
    bytes.length >= 20 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  fail(
    "IMAGE_FORMAT",
    "Выберите настоящее изображение PNG, JPEG, WebP или GIF.",
  );
}

async function decodeDimensions(previewUrl: string) {
  const image = new Image();
  const loaded = new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () =>
        reject(
          new KnowledgeArticleError(
            "IMAGE_DECODE",
            "Картинка повреждена или не поддерживается браузером.",
            "image",
          ),
        );
    },
  );

  image.src = previewUrl;
  let timeout: number | undefined;
  try {
    return await Promise.race([
      loaded,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () =>
            reject(
              new KnowledgeArticleError(
                "IMAGE_DECODE",
                "Не удалось прочитать картинку за 15 секунд.",
                "image",
              ),
            ),
          15_000,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
    image.onload = null;
    image.onerror = null;
    image.src = "";
  }
}

export async function prepareKnowledgeImage(
  file: File,
): Promise<PreparedKnowledgeImage> {
  if (!file || file.size < 1 || file.size > KNOWLEDGE_LIMITS.imageBytes) {
    fail("IMAGE_SIZE", "Выберите непустую картинку размером до 8 МБ.");
  }

  const mime = sniffKnowledgeImage(
    new Uint8Array(await file.slice(0, 32).arrayBuffer()),
  );
  if (file.type && file.type !== mime) {
    fail("IMAGE_FORMAT", "Формат картинки не соответствует её содержимому.");
  }

  const previewUrl = URL.createObjectURL(file);
  try {
    const { width, height } = await decodeDimensions(previewUrl);
    if (
      width < 1 ||
      height < 1 ||
      width > KNOWLEDGE_LIMITS.imageDimension ||
      height > KNOWLEDGE_LIMITS.imageDimension ||
      width * height > KNOWLEDGE_LIMITS.imagePixels
    ) {
      fail(
        "IMAGE_DIMENSIONS",
        "Картинка слишком большая: до 12 000 px по стороне и до 40 мегапикселей.",
      );
    }

    return { file, mime, width, height, previewUrl };
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    throw error;
  }
}

export function knowledgeImageExtension(mime: PreparedKnowledgeImage["mime"]) {
  return MIME_EXTENSIONS.get(mime) || "bin";
}
