const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('knowledge header keeps one icon-only utility row without profile action', () => {
  const page = read('src/features/knowledge/KnowledgePage.tsx');
  assert.match(page, /className="knowledge-board-topline"/);
  assert.match(page, /className="knowledge-utility-actions"/);
  assert.match(page, /aria-label="Обновить знания"/);
  assert.match(page, /aria-label="Новая статья"/);
  assert.match(page, /aria-label="Управление статьями"/);
  assert.doesNotMatch(page, /to="\/profile"/);
});

test('knowledge utility controls are clean square buttons, not note images', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.knowledge-image-button[\s\S]*border-radius:\s*12px\s*!important/);
  assert.match(css, /\.knowledge-image-button--create[\s\S]*color:\s*#fffdf8\s*!important/);
  assert.match(css, /\.knowledge-image-button--create svg[\s\S]*stroke:\s*#fffdf8\s*!important/);
});
