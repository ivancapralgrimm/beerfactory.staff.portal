const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared Button exposes size semantics for site-wide material styling', () => {
  const button = read('src/components/ui/button.tsx');
  assert.match(button, /data-craft-size=\{size \?\? "default"\}/);
  assert.match(button, /data-craft-variant=\{variant \|\| "secondary"\}/);
});

test('all shared icon buttons use image-backed paper/leather material controls', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.craft-button\[data-craft-size="icon"\]/);
  assert.match(css, /tool-paper-sync\.svg/);
  assert.match(css, /tool-leather-create\.svg/);
  assert.match(css, /tool-paper-settings\.svg/);
  assert.match(css, /width:\s*48px\s*!important/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*width:\s*46px\s*!important/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*width:\s*44px\s*!important/);
});

test('text navigation actions use an actual torn-paper image surface', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /data-craft-size="default"[\s\S]*paper-tag\.svg/);
  assert.match(css, /data-craft-size="lg"[\s\S]*paper-tag\.svg/);
});

test('non-Button Shift utility link shares the torn-paper surface', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.bf-page-tool-link\s*\{[\s\S]*paper-tag\.svg/);
});

test('Knowledge create pencil is white on leather', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.knowledge-image-button--create\s*\{[\s\S]*color:\s*#fffdf8\s*!important/);
  assert.match(css, /\.knowledge-image-button--create svg\s*\{[\s\S]*stroke:\s*#fffdf8\s*!important/);
});
