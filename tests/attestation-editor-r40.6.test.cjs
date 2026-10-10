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

test("settings editor verifies persistence by reading the bank back from the server", () => {
  const panel = read("src/features/attestation/AttestationSettingsAdminPanel.tsx");
  assert.match(panel, /const confirmed = await loadAttestationEditorBank\(false\)/);
  assert.match(panel, /settingsPersisted\(confirmed, expectedPassPercent, expectedCategories\)/);
  assert.match(panel, /attestation_settings_verify_failed/);
  assert.match(panel, /Сохранено на сервере\./);
});

test("settings editor explains category distribution mismatch before save", () => {
  const panel = read("src/features/attestation/AttestationSettingsAdminPanel.tsx");
  assert.match(panel, /осталось распределить/);
  assert.match(panel, /уберите \$\{Math\.abs\(remaining\)\}/);
  assert.match(panel, /Распределено \$\{total\} из \$\{questionCount\} · готово/);
});

test("admin and owner share the staff management and attestation editor access check", () => {
  const admin = read("src/features/admin/AdminPage.tsx");
  const roles = read("src/types/auth.ts");
  const profile = read("src/pages/ProfilePage.tsx");
  assert.match(roles, /return subject\.is_owner === true \|\| subject\.role === "admin"/);
  assert.match(admin, /import \{ canManageStaffClient \} from "@\/types\/auth"/);
  assert.match(admin, /const canManageStaff = authenticated && canManageStaffClient\(state\.user\)/);
  assert.match(admin, /if \(!accessToken \|\| !canManageStaff\) return/);
  assert.match(admin, /if \(!canManageStaff\) return <Navigate to="\/profile" replace \/>/);
  assert.match(profile, /canManageStaffClient\(user\)/);
  assert.doesNotMatch(admin, /state\.user\.role === "admin"/);
});


test("r40.6 bank filters are native pickers on the same row", () => {
  const bank = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(bank, /grid-cols-2 gap-2" role="group" aria-label="Фильтры вопросов"/);
  assert.match(bank, /aria-label="Категория вопросов"/);
  assert.match(bank, /aria-label="Статус вопросов"/);
  assert.match(bank, /onChange=\{\(event\) => setCategory\(event\.target\.value\)\}/);
  assert.match(bank, /onChange=\{\(event\) => setStatus\(event\.target\.value as "all" \| "active" \| "archive"\)\}/);
  assert.match(bank, /<option value="all">Все категории<\/option>/);
  assert.match(bank, /<option value="archive">Архив<\/option>/);
  assert.doesNotMatch(bank, /overflow-x-auto pb-1 bf-scrollbar-none/);
});

test("r40.6 statistics use compact paper counters", () => {
  const bank = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(bank, /aria-label="Количество вопросов"/);
  assert.match(bank, /min-w-0 rounded-xl border border-\[var\(--bf-line\)\]/);
  assert.match(bank, /text-lg font-black leading-6 tabular-nums/);
  assert.doesNotMatch(bank, /<Surface className="p-3 text-center">/);
});

test("r40.6 ticket plan row is mobile-width-safe and its controls align", () => {
  const settings = read("src/features/attestation/AttestationSettingsAdminPanel.tsx");
  assert.match(settings, /grid-cols-\[minmax\(0,1fr\)_64px_44px\]/);
  assert.match(settings, /sm:grid-cols-\[minmax\(0,1fr\)_76px_44px\]/);
  assert.match(settings, /h-11 min-h-11 w-full min-w-0 max-w-full/);
  assert.match(settings, /className="h-11 min-h-11 w-11 shrink-0 p-0"/);
  assert.match(settings, /flex h-\[14px\] items-center">Раздел/);
  assert.match(settings, /flex h-\[14px\] items-center">Взять/);
});

test("r40.6 results bank settings tabs have equal centered labels", () => {
  const attempts = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(attempts, /grid min-w-0 grid-cols-3 gap-1/);
  assert.match(attempts, /min-h-11 min-w-0 w-full items-center justify-center/);
  assert.match(attempts, /<span className="min-w-0 text-center">\{label\}<\/span>/);
});
