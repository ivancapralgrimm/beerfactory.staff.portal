const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("r40.6 attestation uses the server bank without legacy question assets", () => {
  const data = read("src/features/attestation/attestation-data.ts");
  assert.match(data, /supabase\.rpc\(\s*"get_attestation_bank"/);
  assert.doesNotMatch(data, /question-banks\.json|questions\.txt/);
});

test("admin exposes the question bank and category settings editors", () => {
  const panel = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(panel, /AttestationBankAdminPanel/);
  assert.match(panel, /AttestationSettingsAdminPanel/);
  assert.match(panel, /"results" \| "bank" \| "settings"/);
});

test("editor API persists questions, categories and per-category ticket sizes", () => {
  const api = read("src/features/attestation/attestation-editor-api.ts");
  assert.match(api, /save_attestation_question/);
  assert.match(api, /save_attestation_editor_settings_v2/);
  assert.match(api, /save_attestation_category/);
  assert.match(api, /set_attestation_category_status/);
  assert.match(api, /p_category_settings/);
});

test("runtime builds tickets using the selected category size", () => {
  const page = read("src/features/attestation/AttestationPage.tsx");
  assert.match(page, /questions\.length !== selectedCategory\.questionsPerTest/);
  assert.match(page, /\{category\.questionsPerTest\} вопросов/);
});

test("category ticket-size migration remains in schema history", () => {
  const file = "supabase/migrations/20261007082211_attestation_category_ticket_sizes.sql";
  const sql = read(file);
  assert.match(sql, /questions_per_test/);
  assert.match(sql, /save_attestation_editor_settings_v2/);
  assert.match(sql, /p_category_settings/);
  assert.match(sql, /revoke all on function public\.save_attestation_editor_settings_v2/);
});
