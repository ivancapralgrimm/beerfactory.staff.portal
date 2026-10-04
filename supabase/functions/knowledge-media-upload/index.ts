import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 12_000;
const MAX_PIXELS = 40_000_000;
const MAX_CONTAINER_STEPS = 100_000;

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: H });

class MediaError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "MediaError";
  }
}

type ImageMeta = {
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  width: number;
  height: number;
  extension: "png" | "jpg" | "webp" | "gif";
};

function u16be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function u16le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}
function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function u32be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  ) >>> 0;
}
function u32le(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}
function ascii(bytes: Uint8Array, from: number, length: number) {
  return String.fromCharCode(...bytes.slice(from, from + length));
}
function validateDimensions(width: number, height: number) {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  ) {
    throw new MediaError("image_dimensions_invalid");
  }
}
function validatePngStructure(bytes: Uint8Array) {
  let offset = 8;
  let first = true;
  let sawIend = false;
  let steps = 0;

  while (offset + 12 <= bytes.length && steps++ < MAX_CONTAINER_STEPS) {
    const size = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const end = offset + 12 + size;

    if (size > MAX_BYTES || end > bytes.length) {
      throw new MediaError("image_decode_failed");
    }
    if (first && (type !== "IHDR" || size !== 13)) {
      throw new MediaError("image_decode_failed");
    }
    first = false;

    if (type === "IEND") {
      if (size !== 0 || end !== bytes.length) {
        throw new MediaError("image_decode_failed");
      }
      sawIend = true;
      break;
    }

    offset = end;
  }

  if (!sawIend) throw new MediaError("image_decode_failed");
}
function skipGifSubBlocks(bytes: Uint8Array, start: number) {
  let offset = start;
  let steps = 0;
  while (offset < bytes.length && steps++ < MAX_CONTAINER_STEPS) {
    const size = bytes[offset++];
    if (size === 0) return offset;
    if (offset + size > bytes.length) {
      throw new MediaError("image_decode_failed");
    }
    offset += size;
  }
  throw new MediaError("image_decode_failed");
}
function validateGifStructure(bytes: Uint8Array) {
  if (bytes.length < 14) throw new MediaError("image_decode_failed");

  const packed = bytes[10];
  let offset = 13;
  if (packed & 0x80) {
    const tableSize = 3 * (1 << ((packed & 0x07) + 1));
    if (offset + tableSize > bytes.length) {
      throw new MediaError("image_decode_failed");
    }
    offset += tableSize;
  }

  let steps = 0;
  while (offset < bytes.length && steps++ < MAX_CONTAINER_STEPS) {
    const introducer = bytes[offset++];

    if (introducer === 0x3b) {
      if (offset !== bytes.length) throw new MediaError("image_decode_failed");
      return;
    }

    if (introducer === 0x21) {
      if (offset >= bytes.length) throw new MediaError("image_decode_failed");
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      continue;
    }

    if (introducer === 0x2c) {
      if (offset + 9 > bytes.length) throw new MediaError("image_decode_failed");
      const imagePacked = bytes[offset + 8];
      offset += 9;
      if (imagePacked & 0x80) {
        const localTableSize = 3 * (1 << ((imagePacked & 0x07) + 1));
        if (offset + localTableSize > bytes.length) {
          throw new MediaError("image_decode_failed");
        }
        offset += localTableSize;
      }
      if (offset >= bytes.length) throw new MediaError("image_decode_failed");
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      continue;
    }

    throw new MediaError("image_decode_failed");
  }

  throw new MediaError("image_decode_failed");
}
function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  const sof = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);

  while (offset + 4 <= bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;

    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;

    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;

    if (sof.has(marker)) {
      if (length < 7) break;
      return {
        height: u16be(bytes, offset + 3),
        width: u16be(bytes, offset + 5)
      };
    }
    offset += length;
  }

  throw new MediaError("image_decode_failed");
}
function validateJpegStructure(bytes: Uint8Array) {
  if (
    bytes.length < 4 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    throw new MediaError("image_decode_failed");
  }
}
function webpDimensionsAndValidate(bytes: Uint8Array) {
  if (bytes.length < 20 || u32le(bytes, 4) + 8 !== bytes.length) {
    throw new MediaError("image_decode_failed");
  }

  let offset = 12;
  let width = 0;
  let height = 0;
  let steps = 0;

  while (offset + 8 <= bytes.length && steps++ < MAX_CONTAINER_STEPS) {
    const type = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const data = offset + 8;
    const end = data + size;
    const next = end + (size & 1);

    if (size > MAX_BYTES || end > bytes.length || next > bytes.length) {
      throw new MediaError("image_decode_failed");
    }

    if (type === "VP8X") {
      if (size < 10) throw new MediaError("image_decode_failed");
      width = u24le(bytes, data + 4) + 1;
      height = u24le(bytes, data + 7) + 1;
    } else if (type === "VP8 ") {
      if (
        size < 10 ||
        bytes[data + 3] !== 0x9d ||
        bytes[data + 4] !== 0x01 ||
        bytes[data + 5] !== 0x2a
      ) {
        throw new MediaError("image_decode_failed");
      }
      width = u16le(bytes, data + 6) & 0x3fff;
      height = u16le(bytes, data + 8) & 0x3fff;
    } else if (type === "VP8L") {
      if (size < 5 || bytes[data] !== 0x2f) {
        throw new MediaError("image_decode_failed");
      }
      const b1 = bytes[data + 1];
      const b2 = bytes[data + 2];
      const b3 = bytes[data + 3];
      const b4 = bytes[data + 4];
      width = 1 + ((b1 | (b2 << 8)) & 0x3fff);
      height = 1 + (((b2 >> 6) | (b3 << 2) | (b4 << 10)) & 0x3fff);
    }

    offset = next;
  }

  if (offset !== bytes.length || width < 1 || height < 1) {
    throw new MediaError("image_decode_failed");
  }
  return { width, height };
}
function inspectImage(bytes: Uint8Array): ImageMeta {
  if (
    bytes.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value
    )
  ) {
    validatePngStructure(bytes);
    const width = u32be(bytes, 16);
    const height = u32be(bytes, 20);
    validateDimensions(width, height);
    return { mime: "image/png", width, height, extension: "png" };
  }

  if (
    bytes.length >= 14 &&
    (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")
  ) {
    validateGifStructure(bytes);
    const width = u16le(bytes, 6);
    const height = u16le(bytes, 8);
    validateDimensions(width, height);
    return { mime: "image/gif", width, height, extension: "gif" };
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    validateJpegStructure(bytes);
    const { width, height } = jpegDimensions(bytes);
    validateDimensions(width, height);
    return { mime: "image/jpeg", width, height, extension: "jpg" };
  }

  if (
    bytes.length >= 20 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    const { width, height } = webpDimensionsAndValidate(bytes);
    validateDimensions(width, height);
    return { mime: "image/webp", width, height, extension: "webp" };
  }

  throw new MediaError("image_format_invalid");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: H });
  }
  if (req.method !== "POST") {
    return J({ error: "method_not_allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";

  if (!url || !serviceKey || !anonKey) {
    return J({ error: "server_configuration_error" }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const token = authorization.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
    error: userError
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return J({ error: "unauthorized" }, 401);
  }

  const userDb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data: context, error: contextError } =
    await userDb.rpc("get_knowledge_editor_context");

  if (
    contextError ||
    !context ||
    (!context.can_create && !context.can_edit)
  ) {
    return J({ error: "forbidden" }, 403);
  }

  try {
    const form = await req.formData();
    const value = form.get("file");

    if (!(value instanceof File)) {
      throw new MediaError("image_required");
    }
    if (value.size < 1 || value.size > MAX_BYTES) {
      throw new MediaError("image_size_invalid");
    }

    const bytes = new Uint8Array(await value.arrayBuffer());
    if (bytes.byteLength !== value.size) {
      throw new MediaError("image_read_failed");
    }

    const meta = inspectImage(bytes);
    const mediaId = crypto.randomUUID();
    const storagePath =
      `pending/${user.id}/${mediaId}.${meta.extension}`;
    const originalName =
      String(value.name || "image").slice(0, 240);

    const upload = await admin.storage
      .from("knowledge-media")
      .upload(storagePath, bytes, {
        cacheControl: "3600",
        contentType: meta.mime,
        upsert: false
      });

    if (upload.error) {
      console.error("BFStaff knowledge media upload:", upload.error);
      return J({ error: "knowledge_media_storage_failed" }, 500);
    }

    const inserted = await admin
      .from("knowledge_article_media")
      .insert({
        id: mediaId,
        article_id: null,
        storage_path: storagePath,
        original_name: originalName,
        mime_type: meta.mime,
        byte_size: value.size,
        width: meta.width,
        height: meta.height,
        created_by: user.id
      })
      .select(
        "id,storage_path,original_name,mime_type,byte_size,width,height"
      )
      .single();

    if (inserted.error || !inserted.data) {
      await admin.storage
        .from("knowledge-media")
        .remove([storagePath]);
      console.error(
        "BFStaff knowledge media metadata:",
        inserted.error
      );
      return J({ error: "knowledge_media_metadata_failed" }, 500);
    }

    const signed = await admin.storage
      .from("knowledge-media")
      .createSignedUrl(storagePath, 15 * 60);

    return J({
      ok: true,
      media: inserted.data,
      signed_url:
        signed.error || !signed.data?.signedUrl
          ? ""
          : signed.data.signedUrl
    });
  } catch (error) {
    if (error instanceof MediaError) {
      return J({ error: error.code }, 400);
    }
    console.error("BFStaff knowledge media:", error);
    return J({ error: "invalid_request" }, 400);
  }
});
