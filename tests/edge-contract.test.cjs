// Current hardened handler, executed under Node with mocked Deno and SDK transports.
// This is not a Deno runtime/deployed authorization or RLS test.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");
const crypto = require("node:crypto").webcrypto;
const root = path.resolve(__dirname, "..");
const source = fs
  .readFileSync(
    path.join(root, "supabase/functions/knowledge-media-upload/index.ts"),
    "utf8",
  )
  .replace(/^import .*;\r?\n/gm, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;
function handler(options = {}) {
  let run, row;
  const calls = [];
  const bucket = {
    async upload(storagePath, bytes, config) {
      calls.push({ upload: storagePath, config });
      return { error: options.storageError ? {} : null };
    },
    async remove(paths) {
      calls.push({ remove: paths });
      return { error: null };
    },
    async createSignedUrl(storagePath, ttl) {
      calls.push({ signed: storagePath, ttl });
      return options.signError
        ? { error: {} }
        : {
            data: { signedUrl: "https://fixture.invalid/private.png" },
            error: null,
          };
    },
  };
  const admin = {
    auth: {
      async getUser(token) {
        calls.push({ auth: token });
        return {
          data: { user: options.unauthorized ? null : { id: "fixture-user" } },
          error: null,
        };
      },
    },
    storage: {
      from(name) {
        assert.equal(name, "knowledge-media");
        return bucket;
      },
    },
    from(name) {
      assert.equal(name, "knowledge_article_media");
      return {
        insert(value) {
          row = value;
          return {
            select() {
              return {
                async single() {
                  return {
                    data: options.metadataError ? null : row,
                    error: options.metadataError ? {} : null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  vm.runInNewContext(compiled, {
    Deno: {
      env: {
        get: (name) =>
          ({
            SUPABASE_URL: "https://fixture.invalid",
            SUPABASE_SERVICE_ROLE_KEY: "fixture-service",
            SUPABASE_ANON_KEY: "fixture-anon",
          })[name],
      },
      serve: (fn) => (run = fn),
    },
    createClient: (_url, key) =>
      key === "fixture-service"
        ? admin
        : {
            async rpc(name) {
              assert.equal(name, "get_knowledge_editor_context");
              return {
                error: options.contextError ? {} : null,
                data: options.denied
                  ? { can_create: false, can_edit: false }
                  : { can_create: true, can_edit: false },
              };
            },
          },
    Request,
    Response,
    File,
    FormData,
    Uint8Array,
    crypto,
    console: {
      error(...args) {
        calls.push({ logged: true });
      },
    },
  });
  return {
    run,
    calls,
    get row() {
      return row;
    },
  };
}
function request(
  bytes = fs.readFileSync(path.join(root, "assets/icons/profile-avatar.png")),
) {
  const form = new FormData();
  form.set("file", new File([bytes], "test.svg", { type: "image/svg+xml" }));
  form.set("article_id", "ignored-article");
  return new Request("https://fixture.invalid", {
    method: "POST",
    headers: { Authorization: "Bearer fixture-token" },
    body: form,
  });
}
test("Edge preflight/method, invalid user and denied/context-error have no media writes", async () => {
  for (const [options, req, status] of [
    [{}, new Request("https://fixture.invalid", { method: "OPTIONS" }), 200],
    [{}, new Request("https://fixture.invalid"), 405],
    [{ unauthorized: true }, request(), 401],
    [{ denied: true }, request(), 403],
    [{ contextError: true }, request(), 403],
  ]) {
    const h = handler(options);
    assert.equal((await h.run(req)).status, status);
    assert.ok(!h.calls.some((c) => c.upload));
  }
});
test("Edge validates bytes rather than filename/MIME, creates pending media, and signs for 900s", async () => {
  const h = handler();
  const result = await h.run(request());
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(body.media.mime_type, "image/png");
  assert.equal(h.row.article_id, null);
  assert.equal(h.row.created_by, "fixture-user");
  assert.match(h.row.storage_path, /^pending\/fixture-user\/[a-f0-9-]+\.png$/);
  assert.equal(h.calls.find((c) => c.signed).ttl, 900);
  assert.equal(h.calls.find((c) => c.upload).config.upsert, false);
});
test("Edge rejects unsupported/empty/oversize bytes and impossible dimensions without upload", async () => {
  const dimensions = Buffer.from(
    fs.readFileSync(path.join(root, "assets/icons/profile-avatar.png")),
  );
  dimensions.writeUInt32BE(12001, 16);
  dimensions.writeUInt32BE(1, 20);
  for (const [bytes, error] of [
    [Buffer.from("<svg/>"), "image_format_invalid"],
    [Buffer.alloc(0), "image_size_invalid"],
    [Buffer.alloc(8 * 1024 * 1024 + 1), "image_size_invalid"],
    [dimensions, "image_dimensions_invalid"],
  ]) {
    const h = handler();
    const result = await h.run(request(bytes));
    assert.equal(result.status, 400);
    assert.equal((await result.json()).error, error);
    assert.ok(!h.calls.some((c) => c.upload));
  }
});
test("Edge rejects structurally truncated image containers before Storage", async () => {
  const png = Buffer.from(
    fs.readFileSync(path.join(root, "assets/icons/profile-avatar.png")),
  );
  const malformedPng = png.subarray(0, png.length - 12);
  const malformedGif = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00", "binary");
  const malformedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00]);
  const malformedWebp = Buffer.from("RIFF\x20\x00\x00\x00WEBPVP8 ", "binary");
  for (const bytes of [malformedPng, malformedGif, malformedJpeg, malformedWebp]) {
    const h = handler();
    const result = await h.run(request(bytes));
    assert.equal(result.status, 400);
    assert.ok(
      ["image_decode_failed", "image_format_invalid"].includes(
        (await result.json()).error,
      ),
    );
    assert.ok(!h.calls.some((c) => c.upload));
  }
});
test("Edge metadata failure removes pending object; Storage failure does not report success", async () => {
  const h = handler({ metadataError: true });
  const result = await h.run(request());
  assert.equal(result.status, 500);
  assert.equal((await result.json()).error, "knowledge_media_metadata_failed");
  assert.deepEqual(Array.from(h.calls.find((c) => c.remove).remove), [
    h.row.storage_path,
  ]);
  const failed = handler({ storageError: true });
  assert.equal((await failed.run(request())).status, 500);
  assert.equal(failed.row, undefined);
});
test("Edge signing failure after upload returns successful metadata with empty preview URL", async () => {
  const h = handler({ signError: true });
  const body = await (await h.run(request())).json();
  assert.equal(body.ok, true);
  assert.equal(body.signed_url, "");
  assert.ok(body.media.id);
  assert.ok(!h.calls.some((c) => c.remove));
});
