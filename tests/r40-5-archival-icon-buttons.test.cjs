const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared icon buttons keep explicit size semantics', () => {
  const button = read('src/components/ui/button.tsx');
  assert.match(button, /data-craft-size=\{size \?\? "default"\}/);
});

test('square action buttons use clean CSS cards rather than paper image tiles', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.craft-button\[data-craft-size="icon"\]\s*\{/);
  assert.match(css, /border-radius:\s*12px\s*!important/);
  assert.match(css, /box-shadow:[\s\S]*0 7px 14px/);
  assert.doesNotMatch(css, /data-craft-size="icon"[\s\S]{0,900}tool-paper-sync\.svg/);
  assert.doesNotMatch(css, /knowledge-image-button--sync[\s\S]{0,700}tool-paper-sync\.svg/);
});

test('primary square actions use copper depth and white ink', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /data-craft-variant="primary"[\s\S]*color:\s*#fffdf8/);
  assert.match(css, /background-image:\s*linear-gradient\(180deg, #9f623c 0%, #724027 100%\)/);
});
