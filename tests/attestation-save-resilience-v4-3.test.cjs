const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const source=fs.readFileSync('src/features/attestation/AttestationBankAdminPanel.tsx','utf8');
test('question writes use returned server record, not just a reload',()=>{
 assert.match(source,/const savedQuestion = await saveAttestationQuestion\(/);
 assert.match(source,/await onSaved\(savedQuestion\)/);
 assert.match(source,/setBank\(\(current\) => current \? \{/);
 assert.match(source,/current\.questions\.some\(\(item\) => item\.id === savedQuestion\.id\)/);
});
test('status writes update locally and deleted questions leave visible bank',()=>{
 assert.match(source,/const savedQuestion = await setAttestationQuestionStatus\(/);
 assert.match(source,/nextStatus === "deleted"[\s\S]*?current\.questions\.filter/);
 assert.match(source,/current\.questions\.map\(\(item\) => item\.id === savedQuestion\.id \? savedQuestion : item\)/);
});
test('refresh error is visible without hiding confirmed saved record',()=>{
 assert.match(source,/error && bank \?/);
 assert.match(source,/Вопрос сохранён на сервере/);
});
