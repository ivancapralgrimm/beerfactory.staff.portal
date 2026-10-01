const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");

test("Knowledge integrity hardening migration records reviewed invariants", () => {
  const file = path.join(
    root,
    "supabase/migrations/20260930214301_r40_5_knowledge_integrity_hardening.sql",
  );
  const sql = fs.readFileSync(file, "utf8");
  assert.equal(
    crypto.createHash("sha256").update(sql).digest("hex"),
    "25d814a15343657dd0145bff4bace91887cae85d7871c3820fbb36f451f930ea",
  );
  assert.match(sql, /knowledge_utf16_length/);
  assert.match(sql, /article_mark_invalid/);
  assert.match(sql, /knowledge_build_search_text/);
  assert.doesNotMatch(sql, /list_items::text/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /article_revision_conflict/);
});

test("Knowledge media Edge v2 is pinned and structurally validates supported containers", () => {
  const source = fs.readFileSync(
    path.join(root, "supabase/functions/knowledge-media-upload/index.ts"),
    "utf8",
  );
  assert.equal(
    crypto.createHash("sha256").update(source).digest("hex"),
    "054d94aaeea93e79212d65050d85f942a0db93dc5576ee85d4fbb570a3256c25",
  );
  assert.match(source, /npm:@supabase\/supabase-js@2\.116\.0/);
  for (const token of [
    "validatePngStructure",
    "validateGifStructure",
    "validateJpegStructure",
    "webpDimensionsAndValidate",
  ]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /MAX_BYTES = 8 \* 1024 \* 1024/);
  assert.match(source, /get_knowledge_editor_context/);
});
