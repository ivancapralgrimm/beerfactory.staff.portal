require("./register-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { supabase } = require("../src/lib/supabase.ts");
const api = require("../src/features/knowledge/editor/knowledge-editor-api.ts");
const model = require("../src/features/knowledge/editor/article-model.ts");
const {
  loadServerKnowledgeArticles,
} = require("../src/features/knowledge/knowledge-server.ts");
const {
  resolveKnowledgeSource,
} = require("../src/features/knowledge/knowledge-source.ts");
const { articles, documents, sql } = require("./live-seed.cjs");
const root = path.resolve(__dirname, "..");
test("supplied seed retains every legacy text/mark/list/heading semantic", () => {
  const {parseLegacyKnowledgeFile}=require("../src/features/knowledge/editor/legacy-markdown.ts");
  const original=parseLegacyKnowledgeFile(fs.readFileSync(path.join(root,"assets/training-data.txt"),"utf8"));
  for(const document of documents) {
    const before=original.find(d=>d.id===document.id);
    assert.equal(document.blocks.length,before.blocks.length);
    document.blocks.forEach((block,i)=>{
      if(block.type!=="image") assert.deepEqual(block,before.blocks[i]);
      else {assert.equal(block.legacySrc,before.blocks[i].legacySrc);assert.equal(block.alt,before.blocks[i].alt);}
    });
  }
  const blockTypes={},marks={};
  for(const b of documents.flatMap(d=>d.blocks)) {
    blockTypes[b.type]=(blockTypes[b.type]||0)+1;
    for(const value of b.content?[b.content]:b.items||[]) for(const mark of value.marks) marks[mark.type]=(marks[mark.type]||0)+1;
  }
  assert.deepEqual(blockTypes,{paragraph:169,separator:63,list:59,image:12,heading:44,quote:4});
  assert.deepEqual(marks,{bold:188,italic:101,highlight:1});
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  fs.writeFileSync(path.join(root,"reports/live-seed-parity.json"),JSON.stringify({scope:"exact supplied generator and unchanged local legacy source; not a live DB query",articles:documents.length,blocks:351,images:12,blockTypes,marks,ids:documents.map(d=>d.id)},null,2)+"\n");
});
test("provided foundation migrations/generator remain byte-identical; reviewed hardening is recorded separately", () => {
  const checks = JSON.parse(
    fs.readFileSync(
      path.join(root, "docs/r40.5-live-sync/CHECKSUMS.json"),
      "utf8",
    ),
  );
  const entries = checks.files || checks;
  for (const [name, value] of Object.entries(entries)) {
    if (!name.startsWith("supabase/") && !name.startsWith("tools/")) continue;
    if (name === "supabase/functions/knowledge-media-upload/index.ts") continue;
    const hash = typeof value === "string" ? value : value.sha256;
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, name)))
        .digest("hex"),
      hash,
      name,
    );
  }
  assert.equal(
    fs.readFileSync(
      path.join(
        root,
        "supabase/migrations/20260930152047_r40_5_knowledge_legacy_seed_v1.sql",
      ),
      "utf8",
    ),
    sql,
  );
  assert.equal(
    crypto.createHash("sha256").update(sql).digest("hex"),
    "a0227b46597d5e543d3a562826b938b3ea1367756ae1b4508ec373225725d40c",
  );
  const hardening = path.join(
    root,
    "supabase/migrations/20260930214301_r40_5_knowledge_integrity_hardening.sql",
  );
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(hardening)).digest("hex"),
    "25d814a15343657dd0145bff4bace91887cae85d7871c3820fbb36f451f930ea",
  );
  const edge = fs.readFileSync(
    path.join(root, "supabase/functions/knowledge-media-upload/index.ts"),
    "utf8",
  );
  assert.match(edge, /npm:@supabase\/supabase-js@2\.116\.0/);
  assert.match(edge, /validatePngStructure/);
  assert.match(edge, /validateGifStructure/);
  assert.match(edge, /validateJpegStructure/);
  assert.match(edge, /webpDimensionsAndValidate/);
});
test("all 26 supplied seed documents decode: 351 blocks, 12 legacy images, stable IDs/ordering", () => {
  assert.equal(documents.length, 26);
  assert.equal(
    documents.reduce((n, d) => n + d.blocks.length, 0),
    351,
  );
  assert.equal(
    documents.flatMap((d) => d.blocks).filter((b) => b.type === "image").length,
    12,
  );
  assert.equal(documents.at(-1).id, "lesson-27");
  assert.ok(!documents.some((d) => d.id === "lesson-7"));
  for (const d of documents) {
    assert.deepEqual(model.validateKnowledgeArticle(d), d);
    assert.equal(d.sort_order, Number(d.id.slice(7)) * 10);
    for (const b of d.blocks.filter((b) => b.type === "image")) {
      assert.equal(b.caption, "");
      assert.ok(fs.existsSync(path.join(root, b.legacySrc)));
    }
  }
  assert.throws(() =>
    model.validateKnowledgeArticle({ ...documents[0], blocks: [] }),
  );
});
test("preview policy enables r40.5 while production stays legacy, with preview rollback", () => {
  assert.equal(resolveKnowledgeSource({}), "legacy");
  assert.equal(resolveKnowledgeSource({ mode: "r40.5-preview" }), "supabase");
  assert.equal(
    resolveKnowledgeSource({ deploymentEnv: "preview", branch: "r40.5" }),
    "supabase",
  );
  assert.equal(
    resolveKnowledgeSource({ deploymentEnv: "preview", branch: "main" }),
    "legacy",
  );
  assert.equal(
    resolveKnowledgeSource({ requested: "legacy", mode: "r40.5-preview" }),
    "legacy",
  );
  assert.equal(
    resolveKnowledgeSource({
      requested: "supabase",
      mode: "r40.5-preview",
      deploymentEnv: "production",
      branch: "main",
    }),
    "legacy",
  );
});
test("five capabilities are independent; incomplete context fails closed", async () => {
  const rpc = supabase.rpc;
  try {
    const context = {
      can_read: true,
      can_create: true,
      can_edit: false,
      can_publish: false,
      can_manage_permissions: false,
    };
    supabase.rpc = async () => ({ data: context, error: null });
    assert.deepEqual(await api.loadKnowledgeEditorContext(), context);
    for (const key of Object.keys(context)) {
      const incomplete = { ...context };
      delete incomplete[key];
      supabase.rpc = async () => ({ data: incomplete, error: null });
      await assert.rejects(api.loadKnowledgeEditorContext());
    }
  } finally {
    supabase.rpc = rpc;
  }
});
test("published summaries consume actual first_image object, including all legacy images", async () => {
  const rpc = supabase.rpc;
  try {
    supabase.rpc = async (name) => {
      assert.equal(name, "get_knowledge_articles");
      return {
        error: null,
        data: articles.map((a) => {
          const image = a.blocks.find((b) => b.type === "image");
          return {
            ...a,
            status: "published",
            revision: 1,
            first_image: image
              ? {
                  mediaId: null,
                  storagePath: null,
                  legacySrc: image.legacySrc,
                  alt: image.alt,
                }
              : null,
          };
        }),
      };
    };
    const rows = await loadServerKnowledgeArticles();
    assert.equal(rows.length, 26);
    assert.equal(rows.filter((a) => a.firstImage).length, 8);
    assert.ok(
      rows
        .filter((a) => a.firstImage)
        .every((a) => a.firstImage.startsWith("/assets/")),
    );
  } finally {
    supabase.rpc = rpc;
  }
});
test("successful Edge upload with empty signed_url retains media; only multipart file sent", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(supabase, "functions");
  const functions = supabase.functions;
  Object.defineProperty(supabase, "functions", {
    value: functions,
    configurable: true,
  });
  const invoke = functions.invoke;
  try {
    supabase.functions.invoke = async (name, { body }) => {
      assert.equal(name, "knowledge-media-upload");
      assert.deepEqual([...body.keys()], ["file"]);
      return {
        error: null,
        data: {
          ok: true,
          media: {
            id: "00000000-0000-4000-8000-000000000001",
            storage_path: "pending/user/image.png",
            original_name: "x.png",
            width: 1,
            height: 1,
            mime_type: "image/png",
            byte_size: 1,
          },
          signed_url: "",
        },
      };
    };
    const upload = await api.uploadKnowledgeImage(
      new File([new Uint8Array([1])], "x.png"),
    );
    assert.equal(upload.signed_url, "");
    assert.equal(upload.media.storage_path, "pending/user/image.png");
  } finally {
    functions.invoke = invoke;
    if (descriptor) Object.defineProperty(supabase, "functions", descriptor);
    else delete supabase.functions;
  }
});
