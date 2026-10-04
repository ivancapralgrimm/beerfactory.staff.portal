const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const paperAssets = [
  'assets/craft/materials/paper-fibre.svg',
  'assets/craft/materials/paper-sheet-1.svg',
  'assets/craft/materials/paper-sheet-2.svg',
  'assets/craft/materials/paper-sheet-3.svg',
  'assets/craft/materials/paper-tag.svg',
  'assets/craft/materials/paper-crease.svg',
];

test('paper assets remain filter-free for iOS/Safari stability', () => {
  for (const file of paperAssets) {
    const source = read(file);
    assert.doesNotMatch(source, /<filter\b|feTurbulence|feDisplacementMap|feGaussianBlur/i, file);
  }
});


test('material provenance matches runtime asset bytes', () => {
  const provenance = JSON.parse(read('assets/craft/materials/PROVENANCE.json'));
  for (const [name, expected] of Object.entries(provenance.files)) {
    const bytes = fs.readFileSync(path.join(root, 'assets/craft/materials', name));
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(actual, expected, name);
  }
});

test('PWA/browser chrome is paper-first rather than dark', () => {
  const html = read('index.html');
  const vite = read('vite.config.ts');
  assert.match(html, /name="theme-color" content="#f4e5c9"/);
  assert.match(html, /name="color-scheme" content="light"/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
  assert.doesNotMatch(html, /black-translucent/);
  assert.match(vite, /background_color:\s*"#f4e5c9"/);
  assert.match(vite, /theme_color:\s*"#f4e5c9"/);
});

test('shift admin tool is inside the craft page surface', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const craftOpen = shell.indexOf('<CraftPage screen={screen}>');
  const toolUse = shell.indexOf('{shiftTool}', craftOpen);
  const craftClose = shell.indexOf('</CraftPage>', craftOpen);
  assert.ok(craftOpen >= 0 && toolUse > craftOpen && craftClose > toolUse);
  assert.match(shell, /bf-page-tool-link/);
});

test('global decorative stamp cannot collide with page actions', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.craft-page::after\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('dashboard hero does not bleed under iOS safe area', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /\.craft-dashboard \.bf-dashboard-hero\s*\{[\s\S]*?margin:\s*0\s*!important;/);
  assert.match(css, /\.bf-app-shell\s*\{[\s\S]*?var\(--craft-grain\)/);
});

test('shift no longer duplicates feed navigation beneath checklist', () => {
  const shift = read('src/features/shift/ShiftPage.tsx');
  assert.doesNotMatch(shift, /Открыть Ленту/);
  assert.doesNotMatch(shift, /Есть важная информация\?/);
});

test('bottom navigation keeps compact content height', () => {
  const shell = read('src/components/layout/AppShell.tsx');
  const css = read('src/components/craft/craft.css');
  assert.match(shell, /min-h-\[52px\]/);
  assert.match(shell, /min-h-\[50px\]/);
  assert.match(css, /\.bf-bottom-nav > div\s*\{\s*min-height:\s*52px\s*!important;/);
});
