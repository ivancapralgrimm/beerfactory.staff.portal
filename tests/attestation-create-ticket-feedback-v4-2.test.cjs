const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../src/features/attestation/AttestationSettingsAdminPanel.tsx'), 'utf8');

test('new ticket explicitly saves a server-side draft', () => {
  assert.match(source, /created = await saveAttestationCategory\(\{ label \}\)/);
  assert.match(source, /fresh\.categories\.some\(\(ticket\) => ticket\.id === created\?\.id\)/);
});

test('creation and refresh failures have distinct messages, preventing duplicates', () => {
  assert.match(source, /setCreateMessage\(created\s*\?/);
  assert.match(source, /Не добавляйте тот же билет повторно/);
  assert.match(source, /editorErrorText\(error\)/);
});

test('mobile feedback is next to Add, with a visible fresh ticket first', () => {
  assert.match(source, /\{createMessage \? \(/);
  assert.match(source, /visibleCategories\.map\(\(category\)/);
  assert.match(source, /newTicketRef\.current\?\.scrollIntoView/);
  assert.match(source, /Новый билет · сохранён как черновик/);
});

test('UI-only reorder does not flag settings as unsaved', () => {
  assert.match(source, /settingsSignature\(passPercent, categories\)/);
  assert.doesNotMatch(source, /settingsSignature\(passPercent, visibleCategories\)/);
});

test('backend write names and activation semantics remain unchanged', () => {
  assert.match(source, /saveAttestationEditorSettings\(/);
  assert.match(source, /setAttestationCategoryStatus\(/);
  assert.match(source, /Сохранить настройки/);
});
