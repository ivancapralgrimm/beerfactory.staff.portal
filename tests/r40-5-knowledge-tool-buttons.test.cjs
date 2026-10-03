const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('knowledge header uses one icon-only utility row without profile action', () => {
  const page = read('src/features/knowledge/KnowledgePage.tsx');
  assert.match(page, /className="knowledge-board-topline"/);
  assert.match(page, /className="knowledge-utility-actions"/);
  assert.match(page, /aria-label="Обновить знания"/);
  assert.match(page, /aria-label="Новая статья"/);
  assert.match(page, /aria-label="Управление статьями"/);
  assert.match(page, /to="\/knowledge\/new"/);
  assert.match(page, /to="\/knowledge\/manage"/);
  assert.match(page, /<Pencil className="size-5"/);
  assert.match(page, /<Settings2 className="size-5"/);
  assert.doesNotMatch(page, /to="\/profile"/);
  assert.doesNotMatch(page, />\s*Новая статья\s*</);
  assert.doesNotMatch(page, />\s*Управление статьями\s*</);
});

test('knowledge utility controls are image-backed torn-paper and leather buttons', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.knowledge-image-button--sync[\s\S]*tool-paper-sync\.svg/);
  assert.match(css, /\.knowledge-image-button--manage[\s\S]*tool-paper-settings\.svg/);
  assert.match(css, /\.knowledge-image-button--create[\s\S]*tool-leather-create\.svg/);
  assert.match(css, /font-size:\s*clamp\(50px,\s*13\.8vw,\s*62px\)/);
  assert.match(css, /min-width:\s*48px/);
});

test('image button assets are packaged', () => {
  for (const file of [
    'assets/craft/materials/tool-paper-sync.svg',
    'assets/craft/materials/tool-paper-settings.svg',
    'assets/craft/materials/tool-leather-create.svg',
  ]) {
    const svg = read(file);
    assert.match(svg, /^<svg[\s\S]*<\/svg>\s*$/);
  }
});
