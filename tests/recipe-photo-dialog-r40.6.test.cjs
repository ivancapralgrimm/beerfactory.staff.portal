const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("recipe photo viewer has no visible close button and closes from backdrop", () => {
  const source = read("src/features/recipes/recipe-photo-dialog.tsx");
  assert.doesNotMatch(source, /lucide-react|<X\b|aria-label="Закрыть фото"/);
  assert.match(source, /onClick=\{onClose\}/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /onCancel=\{\(event\) =>/);
});

test("recipe photo viewer locks the document while open and restores scroll position", () => {
  const source = read("src/features/recipes/recipe-photo-dialog.tsx");
  assert.match(source, /body\.style\.position = "fixed"/);
  assert.match(source, /root\.style\.overflow = "hidden"/);
  assert.match(source, /root\.style\.overscrollBehavior = "none"/);
  assert.match(source, /window\.scrollTo\(\{/);
  assert.match(source, /top: snapshot\.scrollY/);
});

test("recipe photo viewer is viewport-sized without the old framed surface", () => {
  const source = read("src/features/recipes/recipe-photo-dialog.tsx");
  assert.match(source, /fixed inset-0/);
  assert.match(source, /h-dvh w-screen/);
  assert.match(source, /border-0 bg-transparent p-0/);
  assert.doesNotMatch(source, /rounded-2xl border border-\[var\(--bf-line\)\]/);
  assert.doesNotMatch(source, /bg-\[var\(--bf-bg\)\]/);
});
