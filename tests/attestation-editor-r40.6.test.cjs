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
  assert.doesNotMatch(bridge, /from "@\/lib\/supabase"/);
  assert.doesNotMatch(bridge, /onAuthStateChange|getSession|setSession|refreshSession/);
});

test("admin attestation area exposes results, questions and settings", () => {
  const panel = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(panel, /AttestationBankAdminPanel/);
  assert.match(panel, /AttestationSettingsAdminPanel/);
  assert.match(panel, /"results" \| "bank" \| "settings"/);
});

test("editor API uses v2 settings RPC with category-specific ticket sizes", () => {
  const api = read("src/features/attestation/attestation-editor-api.ts");
  assert.match(api, /save_attestation_editor_settings_v2/);
  assert.match(api, /questionsPerTest: number/);
  assert.match(api, /p_category_settings/);
  assert.match(api, /save_attestation_category/);
  assert.match(api, /set_attestation_category_status/);
});

test("question editor hides technical IDs and group/source internals", () => {
  const editor = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(editor, /Раздел вопросов/);
  assert.match(editor, /Что повторить после ошибки/);
  assert.doesNotMatch(editor, />Группа вопроса</);
  assert.doesNotMatch(editor, />Ссылка \/ ID источника</);
  assert.doesNotMatch(editor, /rev\. \{question\.revision\}/);
});

test("settings editor has per-category counts and blank-safe numeric drafts", () => {
  const editor = read("src/features/attestation/AttestationSettingsAdminPanel.tsx");
  assert.match(editor, /Вопросов в этой аттестации/);
  assert.match(editor, /category\.questionsPerTest/);
  assert.match(editor, /numericDraft/);
  assert.match(editor, /inputMode="numeric"/);
  assert.match(editor, /Разделы вопросов/);
  assert.doesNotMatch(editor, />Вопросов в билете</);
  assert.doesNotMatch(editor, /type="number"/);
});

test("runtime starts tickets using the selected category size", () => {
  const page = read("src/features/attestation/AttestationPage.tsx");
  assert.match(page, /questions\.length !== selectedCategory\.questionsPerTest/);
  assert.match(page, /\{category\.questionsPerTest\} вопросов/);
  assert.doesNotMatch(page, /15 вопросов\. Зачёт/);
});

test("admin journal is compressed into two human-facing blocks", () => {
  const audit = read("src/features/admin/AdminAuditPanel.tsx");
  assert.match(audit, /Персонал и доступ/);
  assert.match(audit, /Портал и смены/);
  assert.match(audit, /slice\(0, 8\)/);
  assert.match(audit, /Технические коды и внутренние ID скрыты/);
  assert.doesNotMatch(audit, /ACTION_LABELS/);
});

test("mobile form controls prevent iOS focus auto-zoom without disabling user zoom", () => {
  const css = read("src/styles/mobile-form-stability.css");
  assert.match(css, /font-size: 16px !important/);
  assert.doesNotMatch(css, /user-scalable\s*:\s*no|maximum-scale\s*=\s*1/);
  const shell = read("src/components/layout/AppShell.tsx");
  assert.match(shell, /mobile-form-stability\.css/);
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
});

test("category ticket-size migration is present and protected", () => {
  const dir = path.join(root, "supabase/migrations");
  const file = fs.readdirSync(dir).find((name) => name.endsWith("_attestation_category_ticket_sizes.sql"));
  assert.ok(file, "category ticket-size migration missing");
  const sql = read(`supabase/migrations/${file}`);
  assert.match(sql, /questions_per_test/);
  assert.match(sql, /save_attestation_editor_settings_v2/);
  assert.match(sql, /p_category_settings/);
  assert.match(sql, /v_old\.questions_per_test/);
  assert.match(sql, /revoke all on function public\.save_attestation_editor_settings_v2/);
});

test("release notes still forbid touching the repaired auth contour", () => {
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

test("mistake review links open exact material pages, never recipe search", () => {
  const data = read("src/features/attestation/attestation-data.ts");
  assert.doesNotMatch(data, /\/menu\?q=/);
  assert.match(data, /directRecipeReviewRoute/);
  assert.match(data, /bar/);
  assert.match(data, /kitchen/);
  assert.match(data, /encodeURIComponent\(recipeId\)/);
  assert.match(data, /\/knowledge\/\$\{legacyArticle\[1\]\}/);
});

