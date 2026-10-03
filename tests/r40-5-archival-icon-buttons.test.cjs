const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared square icon buttons keep global size semantics', () => {
  const button = read('src/components/ui/button.tsx');
  assert.match(button, /data-craft-size=\{size \?\? "default"\}/);
});

test('paper utility assets use clean rounded archival cards, not torn silhouettes', () => {
  for (const file of ['tool-paper-sync.svg', 'tool-paper-settings.svg']) {
    const svg = read(`assets/craft/materials/${file}`);
    assert.match(svg, /<rect x="7" y="7" width="50" height="50" rx="9"/);
    assert.match(svg, /feDropShadow/);
    assert.match(svg, /feTurbulence/);
    assert.doesNotMatch(svg, /<path d="M8 10\.5|<path d="M9 8\.5/);
  }
});

test('accent utility asset is clean leather archival card with stitched inset', () => {
  const svg = read('assets/craft/materials/tool-leather-create.svg');
  assert.match(svg, /<rect x="7" y="7" width="50" height="50" rx="9"/);
  assert.match(svg, /stroke-dasharray="2\.6 2\.4"/);
  assert.match(svg, /feTurbulence/);
});

test('global icon buttons still use paper normal, leather primary and white Knowledge pencil', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /data-craft-size="icon"[\s\S]*tool-paper-sync\.svg/);
  assert.match(css, /data-craft-size="icon"[\s\S]*data-craft-variant="primary"[\s\S]*tool-leather-create\.svg/);
  assert.match(css, /knowledge-image-button--create svg[\s\S]*stroke:\s*#fffdf8\s*!important/);
  assert.match(css, /width:\s*48px\s*!important/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*46px\s*!important/);
  assert.match(css, /@media \(max-width: 350px\)[\s\S]*44px\s*!important/);
});
