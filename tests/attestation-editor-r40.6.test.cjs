const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("r40.6 uses the online bank and never imports the legacy question payload", () => {
  const data = read("src/features/attestation/attestation-data.ts");
  assert.match(data, /supabase\.rpc\(\s*"get_attestation_bank"/);
  assert.doesNotMatch(data, /question-banks\.json|questions\.txt/);
});

test("attestation sync is post-auth only and cannot bootstrap Supabase Auth", () => {
  const main = read("src/main.tsx");
  const bridge = read("src/features/attestation/AttestationSyncBridge.tsx");
  const shell = read("src/components/layout/AppShell.tsx");

  assert.doesNotMatch(main, /AttestationSync|attestation-sync/);
  assert.match(shell, /AttestationSyncBridge/);
  assert.match(shell, /state\.status === "authenticated"/);
  assert.match(shell, /userId=\{state\.user\.id\}/);
  assert.doesNotMatch(bridge, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(
    bridge,
    /onAuthStateChange|getSession|setSession|refreshSession/
  );
});

test("admin attestation area exposes results, questions and settings", () => {
  const panel = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(panel, /AttestationBankAdminPanel/);
  assert.match(panel, /AttestationSettingsAdminPanel/);
  assert.match(panel, /"results" \| "bank" \| "settings"/);
  assert.match(panel, />Вопросы</);
  assert.match(panel, />Настройки</);
});

test("editor API contains guarded question, settings and category RPCs", () => {
  const api = read("src/features/attestation/attestation-editor-api.ts");
  for (const rpc of [
    "get_attestation_editor_bank",
    "save_attestation_question",
    "set_attestation_question_status",
    "save_attestation_editor_settings",
    "save_attestation_category",
    "set_attestation_category_status"
  ]) {
    assert.match(api, new RegExp(rpc));
  }
});

test("question editor can prepare questions in disabled categories", () => {
  const editor = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(editor, /category\.active \? "" : " · черновик"/);
  assert.doesNotMatch(editor, /categories\.filter\(\(category\) => category\.active\)/);
});

test("settings editor controls threshold, ticket size, categories and topic plan", () => {
  const editor = read("src/features/attestation/AttestationSettingsAdminPanel.tsx");
  for (const token of [
    "Порог прохождения, %",
    "Вопросов в билете",
    "Новая категория",
    "План билета",
    "Сохранить правила и план",
    "setAttestationCategoryStatus",
    "saveAttestationEditorSettings"
  ]) {
    assert.match(editor, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(editor, /available < item\.count/);
  assert.match(editor, /total !== questionsPerTest/);
});

test("editor exposes review metadata and safe UUID fallback", () => {
  const editor = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(editor, /reviewUrl/);
  assert.match(editor, /reviewLabel/);
  assert.match(editor, /globalThis\.crypto/);
  assert.match(editor, /Math\.random/);
});

test("IndexedDB transaction completion listener is created before writes", () => {
  const offline = read("src/features/attestation/attestation-offline.ts");
  for (const token of [
    "const done = transactionDone(transaction);",
    "objectStore(BANK_STORE).put(record)",
    "objectStore(OUTBOX_STORE).put(entry)",
    "objectStore(OUTBOX_STORE).delete(clientAttemptId)"
  ]) {
    assert.match(offline, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.ok(
    offline.indexOf("const done = transactionDone(transaction);") <
      offline.indexOf("objectStore(BANK_STORE).put(record)")
  );
});

test("foundation migration is preserved for reproducibility and RPC-only access", () => {
  const foundation = read(
    "supabase/migrations/20261005130639_attestation_bank_online_editor_foundation.sql"
  );
  assert.match(foundation, /enable row level security/);
  assert.match(foundation, /private\.attestation_is_admin/);
  assert.match(foundation, /get_attestation_editor_bank/);
  assert.match(foundation, /revoke all on table/);
});

test("full editor migration protects draft categories and concurrent settings", () => {
  const sql = read(
    "supabase/migrations/20261006211201_attestation_editor_settings_categories.sql"
  );

  assert.match(sql, /save_attestation_editor_settings/);
  assert.match(sql, /attestation_settings_revision_conflict/);
  assert.match(sql, /save_attestation_category/);
  assert.match(sql, /set_attestation_category_status/);
  assert.match(sql, /v_id, v_label, v_sort, false, v_actor/);
  assert.match(sql, /attestation_category_not_ready/);
  assert.match(sql, /attestation_category_label_duplicate/);
  assert.match(sql, /attestation_last_category/);
  assert.match(sql, /where id = v_category\s*\n\s*\) then/);
  assert.doesNotMatch(
    sql,
    /where id = v_category and is_active is true/
  );
  assert.match(
    sql,
    /revoke all on function public\.save_attestation_category[\s\S]*from public, anon, authenticated/
  );
  assert.match(
    sql,
    /revoke all on function public\.save_attestation_settings\(smallint,smallint,jsonb\) from public, anon, authenticated/
  );
});

test("release notes forbid touching the repaired auth contour", () => {
  const notes = read("docs/R40.6_EDITOR_RELEASE_NOTES.md");
  for (const token of [
    "src/main.tsx",
    "src/features/auth/*",
    "src/lib/supabase.ts",
    "src/lib/config.ts",
    "supabase/functions/staff-login/*"
  ]) {
    assert.match(notes, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
