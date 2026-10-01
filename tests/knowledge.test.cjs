require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");
const model = require("../src/features/knowledge/editor/article-model.ts");
const legacy = require("../src/features/knowledge/editor/legacy-markdown.ts");
const rich = require("../src/features/knowledge/editor/rich-text.ts");
const {
  canEditKnowledgeClient,
} = require("../src/features/knowledge/editor/permissions.ts");
const {
  sniffKnowledgeImage,
} = require("../src/features/knowledge/editor/image-validation.ts");
const baseline = require("./fixtures/r40.5-knowledge-data.baseline.ts");
const baselineMarkdown = require("./fixtures/r40.5-knowledge-markdown.baseline.tsx");
const current = require("../src/features/knowledge/knowledge-data.ts");
const { supabase } = require("../src/lib/supabase.ts");
const api = require("../src/features/knowledge/editor/knowledge-editor-api.ts");
const {
  loadServerKnowledgeArticles,
} = require("../src/features/knowledge/knowledge-server.ts");
const {
  KnowledgeRichText,
} = require("../src/features/knowledge/editor/KnowledgeDocumentView.tsx");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "assets/training-data.txt"),
  "utf8",
);
const originals = baseline.parseArticles(source);
const converted = legacy.parseLegacyKnowledgeFile(source);
const valid = () => ({ ...model.createKnowledgeArticle(), title: "Статья" });

test("protected access hotfix and senior migration remain byte-identical", () => {
  const verification = JSON.parse(
    fs.readFileSync(
      path.join(root, "R40_5_BASELINE_VERIFICATION.json"),
      "utf8",
    ),
  );
  for (const [filename, expected] of Object.entries(
    verification.protected_sha256,
  )) {
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, filename)))
        .digest("hex"),
      expected,
      filename,
    );
  }
});
test("actual legacy parser: all summaries, lesson IDs, body and ordering match baseline", () => {
  assert.equal(originals.length, 26);
  assert.deepEqual(converted.map(d=>d.sort_order),originals.map(d=>Number(d.id.slice('lesson-'.length))));
  assert.deepEqual(current.parseArticles(source), originals);
  assert.deepEqual(
    converted.map(({ id, title, category }) => ({ id, title, category })),
    originals.map(({ id, title, category }) => ({ id, title, category })),
  );
});
test("legacy migration: every block, inline mark and image matches old rendered semantics", () => {
  let imageCount = 0,
    blockCount = 0;
  const html = (value) =>
    renderToStaticMarkup(createElement(KnowledgeRichText, { value }));
  // RichText wraps plain spans with whitespace-pre-wrap; ignore presentation attributes.
  const clean = (markup) => markup.replace(/<\/?span(?: [^>]*)?>/g, "");
  const inline = (value) =>
    clean(
      renderToStaticMarkup(
        createElement(
          "div",
          null,
          baselineMarkdown.renderKnowledgeInline(value),
        ),
      ).slice(5, -6),
    );
  for (const original of originals) {
    const document = converted.find((d) => d.id === original.id);
    const oldBlocks = baselineMarkdown.parseKnowledgeMarkdown(original.body);
    assert.equal(document.blocks.length, oldBlocks.length, original.id);
    blockCount += oldBlocks.length;
    oldBlocks.forEach((old, index) => {
      const next = document.blocks[index];
      if (old.type === "image") {
        imageCount++;
        assert.equal(next.type, "image");
        assert.equal("/" + next.legacySrc, new URL(old.src).pathname);
        assert.equal(next.alt, old.alt);
        assert.equal(next.caption, old.alt);
        assert.ok(
          fs.existsSync(path.join(root, next.legacySrc)),
          next.legacySrc,
        );
      } else if (old.type === "list") {
        assert.equal(next.type, "list");
        assert.equal(next.ordered, old.ordered);
        assert.deepEqual(
          next.items.map((item) => clean(html(item))),
          old.items.map(inline),
        );
      } else if (old.type === "separator") assert.equal(next.type, "separator");
      else {
        const text = old.type === "paragraph" ? old.lines.join("\n") : old.text;
        const promoted =
          old.type === "paragraph" &&
          old.lines.length === 1 &&
          /^\*\*([^*]+)\*\*$/.test(text) &&
          next.type === "heading";
        assert.equal(
          next.type,
          promoted ? "heading" : old.type === "callout" ? "quote" : old.type,
        );
        const oldHtml =
          old.type === "paragraph"
            ? old.lines.map(inline).join("\n")
            : inline(text);
        assert.equal(
          clean(html(next.content)),
          promoted ? inline(text.slice(2, -2)) : oldHtml,
          `${original.id}/${index}`,
        );
      }
    });
  }
  assert.equal(imageCount, 12);
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports/legacy-parity.json"),
    JSON.stringify(
      {
        articles: 26,
        blocks: blockCount,
        images: imageCount,
        ids: converted.map((d) => d.id),
        scope: "local source and conversion; server seed parity NOT checked",
      },
      null,
      2,
    ) + "\n",
  );
});
test("seed CLI dry-run and explicit local JSON output agree with TypeScript conversion", () => {
  const out = path.join(require("node:os").tmpdir(), "bfstaff-seed-test.json");
  const run = spawnSync(
    process.execPath,
    [
      "scripts/build-knowledge-legacy-seed.mjs",
      "assets/training-data.txt",
      out,
      "--write",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(fs.readFileSync(out, "utf8"));
  const docs = payload.articles || payload.documents || payload;
  assert.deepEqual(
    docs.map((d) => model.validateKnowledgeArticle(d)),
    converted,
  );
  fs.unlinkSync(out);
});
test("role is distinct from position; only active Owner/Admin can request the editor", () => {
  for (const role of ["staff", "senior", "manager"])
    for (const position_code of ["manager", "waiter", "bartender", "hostess"])
      assert.equal(
        canEditKnowledgeClient({ role, position_code, is_active: true }),
        false,
      );
  assert.equal(
    canEditKnowledgeClient({ role: "admin", is_active: true }),
    true,
  );
  assert.equal(
    canEditKnowledgeClient({ role: "staff", is_owner: true, is_active: true }),
    true,
  );
  assert.equal(
    canEditKnowledgeClient({ role: "admin", is_active: false }),
    false,
  );
});
test("schema rejects invalid IDs, marks, duplicate blocks, status, and limits", () => {
  assert.throws(() =>
    model.validateKnowledgeArticle({ ...valid(), title: " " }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({ ...valid(), id: "../x" }),
  );
  const document = valid();
  assert.throws(() =>
    model.validateKnowledgeArticle({
      ...document,
      blocks: [document.blocks[0], document.blocks[0]],
    }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({ ...valid(), status: "hidden" }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({ ...valid(), title: "x".repeat(241) }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({
      ...valid(),
      blocks: Array.from({ length: 201 }, () => model.createKnowledgeBlock()),
    }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({
      ...valid(),
      blocks: [
        {
          id: "p",
          type: "paragraph",
          content: { text: "short", marks: [{ type: "bold", from: 0, to: 6 }] },
        },
      ],
    }),
  );
  assert.throws(() =>
    model.validateKnowledgeArticle({
      ...valid(),
      blocks: Array.from({ length: 6 }, () => ({
        ...model.createKnowledgeBlock(),
        content: { text: "x".repeat(100000), marks: [] },
      })),
    }),
  );
});
test("model preserves server ordering and Dashboard metadata", () => {
  const d = model.validateKnowledgeArticle({
    ...valid(),
    sort_order: 8,
    dashboard_featured: true,
  });
  assert.equal(d.sort_order, 8);
  assert.equal(d.dashboard_featured, true);
});
test("untrusted media cannot inject HTML, protocol URLs or path traversal", () => {
  const image = {
    ...model.createKnowledgeBlock("image"),
    mediaId: null,
    legacySrc: "assets/test.png",
  };
  assert.doesNotThrow(() =>
    model.validateKnowledgeArticle({ ...valid(), blocks: [image] }),
  );
  for (const legacySrc of [
    "javascript:alert(1)",
    "https://bad.test/a.png",
    "assets/../a.png",
    "assets/./a.png",
  ])
    assert.throws(() =>
      model.validateKnowledgeArticle({
        ...valid(),
        blocks: [{ ...image, legacySrc }],
      }),
    );
  assert.throws(() =>
    model.validateKnowledgeArticle({
      ...valid(),
      blocks: [
        {
          ...image,
          mediaId: "media",
          legacySrc: null,
          storagePath: "a/../secret",
        },
      ],
    }),
  );
  assert.ok(
    renderToStaticMarkup(
      createElement(KnowledgeRichText, {
        value: { text: "<script>alert(1)</script>", marks: [] },
      }),
    ).includes("&lt;script&gt;"),
  );
});
test("block insertion, stale target, movement boundaries, and 200-block guard", () => {
  let document = valid();
  const a = document.blocks[0],
    b = model.createKnowledgeBlock("separator");
  document = model.insertKnowledgeBlock(document, b, a.id);
  assert.deepEqual(model.moveKnowledgeBlock(document, b.id, -1).blocks, [b, a]);
  assert.equal(model.moveKnowledgeBlock(document, a.id, -1), document);
  assert.throws(() => model.insertKnowledgeBlock(document, b));
  assert.throws(() =>
    model.insertKnowledgeBlock(
      document,
      model.createKnowledgeBlock(),
      "missing",
    ),
  );
  assert.throws(() =>
    model.insertKnowledgeBlock(
      {
        ...document,
        blocks: Array.from({ length: 200 }, () => model.createKnowledgeBlock()),
      },
      model.createKnowledgeBlock(),
    ),
  );
});
test("overlapping formatting toggles, edits and surrogate pairs retain valid UTF-16 ranges", () => {
  let value = { text: "Пиво 🍺 и вино", marks: [] };
  value = rich.toggleRichMark(value, "bold", 0, 7);
  value = rich.toggleRichMark(value, "italic", 5, 14);
  assert.equal(
    rich
      .richTextSegments(value)
      .map((x) => x.text)
      .join(""),
    value.text,
  );
  value = rich.editRichText(value, "Крафтовое " + value.text);
  for (const mark of value.marks) {
    assert.ok(
      mark.from >= 0 && mark.to <= value.text.length && mark.to > mark.from,
    );
  }
  value = rich.toggleRichMark(value, "bold", 10, 14);
  assert.ok(value.marks.some((m) => m.type === "bold" && m.from === 14));
  for (let index = 0; index <= value.text.length; index++) {
    const edit = rich.editRichText(
      value,
      value.text.slice(0, index) + "x" + value.text.slice(index),
    );
    for (const m of edit.marks)
      assert.ok(m.from >= 0 && m.to <= edit.text.length && m.to > m.from);
  }
});
test("image signature inspection rejects SVG, empty bytes, and disguised text", () => {
  assert.throws(() => sniffKnowledgeImage(new Uint8Array()));
  assert.throws(() => sniffKnowledgeImage(Buffer.from("<svg>malicious</svg>")));
  assert.equal(
    sniffKnowledgeImage(
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.alloc(24),
      ]),
    ),
    "image/png",
  );
  assert.equal(
    sniffKnowledgeImage(Buffer.from([255, 216, 255, 224])),
    "image/jpeg",
  );
  assert.equal(sniffKnowledgeImage(Buffer.from("GIF89a0000")), "image/gif");
  assert.equal(
    sniffKnowledgeImage(Buffer.from("RIFF0000WEBP00000000")),
    "image/webp",
  );
});

test("RPC adapter validates context and maps missing backend without granting editing", async () => {
  const original = supabase.rpc;
  try {
    supabase.rpc = async () => ({ data: { can_edit: "true" }, error: null });
    await assert.rejects(
      api.loadKnowledgeEditorContext(),
      (e) => e.code === "knowledge_editor_context_failed",
    );
    supabase.rpc = async () => ({
      data: null,
      error: { code: "PGRST202", message: "function missing" },
    });
    await assert.rejects(
      api.loadKnowledgeEditorContext(),
      (e) => e.code === "knowledge_backend_unavailable",
    );
    supabase.rpc = async () => ({ data: { can_read: true, can_create: false, can_edit: false, can_publish: false, can_manage_permissions: false }, error: null });
    assert.deepEqual(await api.loadKnowledgeEditorContext(), {
      can_read: true, can_create: false, can_edit: false, can_publish: false, can_manage_permissions: false,
    });
  } finally {
    supabase.rpc = original;
  }
});
test("RPC adapter rejects wrong article ID and checks optimistic revision request/response", async () => {
  const original = supabase.rpc,
    document = valid();
  try {
    supabase.rpc = async () => ({
      data: { ...document, id: "different" },
      error: null,
    });
    await assert.rejects(
      api.loadKnowledgeArticleForEditor(document.id),
      (e) => e.code === "knowledge_article_load_failed",
    );
    let captured;
    supabase.rpc = async (name, args) => {
      captured = { name, args };
      return {
        data: { id: document.id, revision: 1, status: document.status },
        error: null,
      };
    };
    const result = await api.saveKnowledgeArticle(document, 0);
    assert.equal(result.revision, 1);
    assert.equal(captured.name, "save_knowledge_article");
    assert.equal(captured.args.p_expected_revision, 0);
    assert.equal(captured.args.p_document.id, document.id);
    supabase.rpc = async () => ({
      data: { id: document.id, revision: 0, status: document.status },
      error: null,
    });
    await assert.rejects(
      api.saveKnowledgeArticle(document, 0),
      (e) => e.code === "knowledge_article_save_response_invalid",
    );
    supabase.rpc = async () => ({
      data: null,
      error: { message: "article_revision_conflict" },
    });
    await assert.rejects(
      api.saveKnowledgeArticle(document, 0),
      (e) => e.code === "article_revision_conflict",
    );
  } finally {
    supabase.rpc = original;
  }
});
test("server reader rejects malformed descriptions/images and reads only published summaries", async () => {
  const original = supabase.rpc;
  const row = {
    id: "lesson-1",
    title: "Test",
    category: "Обучение",
    status: "published",
    revision: 1,
    search_text: "Readable text",
    first_image: null,
  };
  try {
    for (const patch of [
      { status: "draft" },
      { description: {} },
      { first_image: {} },
      { revision: -1 },
    ]) {
      supabase.rpc = async () => ({
        data: [{ ...row, ...patch }],
        error: null,
      });
      await assert.rejects(loadServerKnowledgeArticles());
    }
    supabase.rpc = async () => ({ data: [row], error: null });
    const [article] = await loadServerKnowledgeArticles();
    assert.equal(article.searchText, "Readable text");
    assert.equal(article.source, "supabase");
  } finally {
    supabase.rpc = original;
  }
});
