const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('shared Button exposes size and variant semantics', () => {
  const button = read('src/components/ui/button.tsx');
  assert.match(button, /data-craft-size=\{size \?\? "default"\}/);
  assert.match(button, /data-craft-variant=\{variant \|\| "secondary"\}/);
});

test('icon actions are clean 44px squares with subtle physical depth', () => {
  const css = read('src/components/craft/craft.css');
  assert.match(css, /width:\s*44px\s*!important/);
  assert.match(css, /height:\s*44px\s*!important/);
  assert.match(css, /border-radius:\s*12px\s*!important/);
  assert.match(css, /translateY\(1px\)/);
});

test('temporary image-backed paper/leather icon system is no longer active', () => {
  const css = read('src/components/craft/craft.css');
  const tail = css.slice(css.indexOf('r40.5 utility controls · clean square restoration'));
  assert.doesNotMatch(tail, /tool-paper-sync\.svg|tool-paper-settings\.svg|tool-leather-create\.svg|paper-tag\.svg/);
});
