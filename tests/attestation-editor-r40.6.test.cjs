const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("r40.6 attestation uses the server bank without legacy question assets", () => {
  const data = read("src/features/attestation/attestation-data.ts");
  assert.match(data, /supabase\.rpc\(\s*"get_attestation_bank_v3"/);
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
  assert.match(api, /save_attestation_editor_settings_v3/);
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
  assert.match(admin, /import \{[^}]*\bcanManageStaffClient\b[^}]*\} from "@\/types\/auth"/);
  assert.match(admin, /const canManageStaff = authenticated && canManageStaffClient\(state\.user\)/);
  assert.match(admin, /if \(!accessToken \|\| !canManageStaff\) return/);
  assert.match(admin, /if \(!canManageStaff\) return <Navigate to="\/profile" replace \/>/);
  assert.match(profile, /canManageStaffClient\(user\)/);
  assert.doesNotMatch(admin, /state\.user\.role === "admin"/);
});


test("r40.6 bank filters are native pickers on the same row", () => {
  const bank = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  assert.match(bank, /grid-cols-2 gap-2" role="group" aria-label="Фильтры вопросов"/);
  assert.match(bank, /aria-label="Тип знаний вопросов"/);
  assert.match(bank, /aria-label="Статус вопросов"/);
  assert.match(bank, /onChange=\{\(event\) => setCategory\(event\.target\.value\)\}/);
  assert.match(bank, /onChange=\{\(event\) => setStatus\(event\.target\.value as "all" \| "active" \| "archive"\)\}/);
  assert.match(bank, /<option value="all">Все типы знаний<\/option>/);
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


test("r40.6 results statistics match compact bank counters", () => {
  const results = read("src/features/admin/AdminAttemptsPanel.tsx");
  const bank = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  const compactCounter = /min-w-0 rounded-xl border border-\[var\(--bf-line\)\] bg-\[var\(--bf-surface\)\] px-1\.5 py-2 text-center shadow-sm/;
  assert.match(results, /aria-label="Статистика результатов аттестации"/);
  assert.match(results, compactCounter);
  assert.match(bank, compactCounter);
  assert.match(results, /text-lg font-black leading-6 tabular-nums/);
  assert.doesNotMatch(results, /<Surface className="p-3 text-center">/);
});

test("r40.6 results categories are selected with one native mobile picker", () => {
  const results = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(results, /aria-label="Категория результатов аттестации"/);
  assert.match(results, /value=\{filter\}/);
  assert.match(results, /onChange=\{\(event\) => setFilter\(event\.target\.value\)\}/);
  assert.match(results, /<option value="all">Все категории<\/option>/);
  assert.match(results, /categories\.map\(\(category\) => \(\s*<option/);
  assert.doesNotMatch(results, /overflow-x-auto pb-1 bf-scrollbar-none/);
});

test("r40.6 results header has no duplicate eyebrow", () => {
  const results = read("src/features/admin/AdminAttemptsPanel.tsx");
  assert.match(results, /<h3 className="min-w-0 text-2xl font-black">Результаты команды<\/h3>/);
  assert.doesNotMatch(results, /<p className="eyebrow">РЕЗУЛЬТАТЫ<\/p>/);
});

test("r40.6 attestation landing page uses back navigation and a single topic picker", () => {
  const page = read("src/features/attestation/AttestationPage.tsx");
  assert.match(page, /<Link to="\/knowledge"><ArrowLeft className="size-4" aria-hidden \/>Назад<\/Link>/);
  assert.doesNotMatch(page, /<p className="eyebrow">ПРОВЕРКА ЗНАНИЙ<\/p>/);
  assert.match(page, /Тестирование по теме: \{selectedCategory \? selectedCategory\.label : "…"\}/);
  assert.match(page, /<span>Выбери тему<\/span>/);
  assert.match(page, /aria-label="Выбери тему"/);
  assert.match(page, /<option value="" disabled>…<\/option>/);
  assert.match(page, /state\.bank\.categories\.map\(\(category\) => <option key=\{category\.id\} value=\{category\.id\}>\{category\.label\}/);
});

test("r40.6 attestation start button stays disabled until a topic is chosen", () => {
  const page = read("src/features/attestation/AttestationPage.tsx");
  assert.match(page, /<Button type="button" variant="primary" size="lg" disabled=\{!selectedCategory\} onClick=\{startQuiz\}>Начать<\/Button>/);
  // The approved picker is compact and must not restore SVG category animation.
  assert.doesNotMatch(page, /CategoryMotionIcon/);
  assert.doesNotMatch(page, /Выбери блок вопросов/);
  assert.doesNotMatch(page, /КАТЕГОРИЯ/);
});


test("r40.6 knowledge topics use one native selector and preserve the URL filter", () => {
  const knowledge = read("src/features/knowledge/KnowledgePage.tsx");
  assert.match(knowledge, /htmlFor="knowledge-topic-select"/);
  assert.match(knowledge, /Выбери тему статьи/);
  assert.match(knowledge, /<select\s+id="knowledge-topic-select"/);
  assert.match(knowledge, /value=\{category\}/);
  assert.match(knowledge, /onChange=\{\(event\) => updateParam\("cat", event\.target\.value\)\}/);
  assert.match(knowledge, /item === "Все" \? "Все темы" : item/);
  assert.doesNotMatch(knowledge, /knowledge-board-categories bf-scrollbar-none/);
  assert.match(knowledge, /const requestedCategory = params\.get\("cat"\) \|\| "Все"/);
});

test("r40.6 knowledge attestation link is an elevated accessible button", () => {
  const knowledge = read("src/features/knowledge/KnowledgePage.tsx");
  const styles = read("src/features/knowledge/knowledge-topic-selector.css");
  assert.match(knowledge, /to="\/attestation" className="knowledge-attestation-action"/);
  assert.match(knowledge, /<span>Аттестация<\/span>/);
  assert.match(styles, /knowledge-board-summary \.knowledge-attestation-action/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /box-shadow:/);
  assert.match(styles, /text-decoration: none/);
});

test("r40.6 back button is more compact without negative page offset", () => {
  const page = read("src/features/attestation/AttestationPage.tsx");
  assert.match(page, /variant="ghost" className="gap-1 px-2 text-\[13px\] leading-none"/);
  assert.match(page, /<Link to="\/knowledge"><ArrowLeft/);
  assert.doesNotMatch(page, /className="-ml-3 px-3"/);
});


test("r40.6 knowledge summary row has bottom spacing above articles", () => {
  const styles = read("src/features/knowledge/knowledge-topic-selector.css");
  assert.match(styles, /\.bf-knowledge-page \.knowledge-board-summary \{[\s\S]*margin-bottom: 14px/);
});


test("r40.6 employee statistics use compact counters matching attestation", () => {
  const admin = read("src/features/admin/AdminPage.tsx");
  const bank = read("src/features/attestation/AttestationBankAdminPanel.tsx");
  const compactCounter = /min-w-0 rounded-xl border border-\[var\(--bf-line\)\] bg-\[var\(--bf-surface\)\] px-1\.5 py-2 text-center shadow-sm/;
  assert.match(admin, /aria-label="Статистика сотрудников"/);
  assert.match(admin, /grid min-w-0 grid-cols-4 gap-1\.5/);
  assert.match(admin, compactCounter);
  assert.match(bank, compactCounter);
  assert.match(admin, /mt-0\.5 block text-lg font-black leading-6 tabular-nums/);
  assert.doesNotMatch(admin, /<Surface key=\{String\(label\)\} className="min-w-0 p-2 text-center"/);
});

test("r40.6 compact team counters keep labels aligned and search nearby", () => {
  const admin = read("src/features/admin/AdminPage.tsx");
  assert.match(admin, /flex h-6 items-center justify-center text-\[9px\]/);
  assert.match(admin, /\["Без должности", stats\.noPosition\]/);
  assert.match(admin, /<label className="relative mt-3 block">/);
  assert.match(admin, /aria-label="Поиск сотрудника"/);
});
