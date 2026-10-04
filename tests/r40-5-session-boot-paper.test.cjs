const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');
const boot = app.slice(app.indexOf('function BootScreen()'), app.indexOf('function RouteLoader()'));

test('session boot screen uses the current cream paper visual language', () => {
  assert.match(boot, /className="craft-context/);
  assert.match(boot, /paper-fibre\.svg/);
  assert.match(boot, /backgroundColor:\s*"#f4e5c9"/);
  assert.match(boot, /bg-\[#fff4df\]/);
  assert.doesNotMatch(boot, /bg-\[var\(--bf-bg\)\]/);
});

test('session status text is explicitly dark and readable', () => {
  assert.match(boot, /Проверяем сессию…/);
  assert.match(boot, /text-\[#5a4736\]/);
  assert.doesNotMatch(boot, /text-\[var\(--bf-muted\)\]/);
});

test('boot status remains accessible', () => {
  assert.match(boot, /role="status"/);
  assert.match(boot, /aria-live="polite"/);
});
