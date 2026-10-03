const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("existing checklist items edit inline while new items keep the top form", () => {
  const page = read("src/features/shift/ChecklistEditorPage.tsx");
  assert.match(page, /draft\?\.itemKey === null/);
  assert.match(page, /const editing = draft\?\.itemKey === row\.item_key/);
  assert.match(page, /className="bf-checklist-inline-editor"/);
  assert.match(page, /aria-expanded=\{editing\}/);
  assert.match(page, /message=\{message\}/);
  assert.doesNotMatch(page, /\{draft \? \(\s*<Surface className="mt-3 p-4">/s);
});

test("portal shell exposes an accessible safe-area-aware scroll-to-top control", () => {
  const shell = read("src/components/layout/AppShell.tsx");
  const css = read("src/components/craft/craft.css");
  assert.match(shell, /function ScrollToTopButton/);
  assert.match(shell, /aria-label="Вернуться наверх"/);
  assert.match(shell, /window\.scrollTo\(\{/);
  assert.match(shell, /prefers-reduced-motion: reduce/);
  assert.match(shell, /<ScrollToTopButton withBottomNav=\{!isDashboard\} \/>/);
  assert.match(css, /\.bf-scroll-top\s*\{/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.bf-scroll-top\[data-with-bottom-nav="true"\]/);
});

test("recipe ingredients render as a labelled paper sticker", () => {
  const page = read("src/features/recipes/RecipeDetailPage.tsx");
  const css = read("src/components/craft/craft.css");
  assert.match(page, /className="recipe-ingredients-sticker"/);
  assert.match(page, /className="recipe-ingredients-title"[\s\S]*?Состав/);
  assert.match(page, /className="recipe-ingredients-list"/);
  assert.match(css, /\.craft-page--recipe \.recipe-ingredients-sticker\s*\{/);
  assert.match(css, /\.recipe-ingredients-sticker::before/);
  assert.match(css, /\.recipe-ingredients-sticker::after/);
});
