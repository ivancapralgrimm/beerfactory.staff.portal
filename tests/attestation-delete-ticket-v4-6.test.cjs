'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = path.resolve(__dirname,'..');
const ui = fs.readFileSync(path.join(root,'src/features/attestation/AttestationSettingsAdminPanel.tsx'),'utf8');
const api = fs.readFileSync(path.join(root,'src/features/attestation/delete-attestation-ticket.ts'),'utf8');
const sql = fs.readFileSync(path.join(root,'supabase/migrations/20261017080000_r406_delete_attestation_tickets_v4_6.sql'),'utf8');
const transpile = (name,input,jsx) => ts.transpileModule(input, {
  fileName:name,reportDiagnostics:true,compilerOptions:{
    module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
    ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {})
  }
});
test('both TypeScript files transpile with no syntax errors',()=>{
 for(const [name,input,jsx] of [['panel.tsx',ui,true],['api.ts',api,false]]){
  const res=transpile(name,input,jsx);
  assert.equal(res.diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,name);
 }
});
test('all tickets offer Additional actions including permanent deletion',()=>{
 assert.match(ui,/<details className="mt-3 border-t border-\[var\(--bf-line\)\] pt-2"/);
 assert.match(ui,/Удалить билет навсегда/);
 assert.match(ui,/Отключить билет/);
 assert.doesNotMatch(ui,/Скрыть категорию/);
});
test('confirmation is typed, exact name and irreversible warning',()=>{
 assert.match(ui,/deleteConfirmation !== category\.label/);
 assert.match(ui,/Необратимое удаление/);
 assert.match(ui,/Подтвердить удаление/);
 assert.match(ui,/Результаты сотрудников сохранены/);
});
test('question bank protection exists client and server',()=>{
 assert.match(ui,/question\.categoryId === category\.id/);
 assert.match(sql,/EXISTS\s*\(\s*SELECT 1 FROM public\.attestation_questions\s+WHERE category_id=p_category_id/);
 assert.match(sql,/attestation_ticket_delete_questions_exist/);
 assert.doesNotMatch(sql,/DELETE FROM public\.attestation_questions/i);
 assert.doesNotMatch(sql,/DELETE FROM public\.quiz_attempts/i);
});
test('deletion server function is admin-only and has stale-version protection',()=>{
 assert.match(sql,/private\.attestation_is_admin\(\)/);
 assert.match(sql,/v_old\.updated_at IS DISTINCT FROM p_expected_updated_at/);
 assert.match(sql,/attestation_ticket_last_active/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*?FROM PUBLIC, anon, authenticated;/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated;/);
});
test('ticket delete is scoped to one ID; retains history',()=>{
 assert.match(sql,/DELETE FROM public\.attestation_categories WHERE id=p_category_id/);
 assert.match(sql,/FROM public\.quiz_attempts\s+WHERE category_id=p_category_id/);
 assert.match(sql,/UPDATE public\.attestation_settings[\s\S]*?revision=revision\+1/);
});
test('client RPC checks success response and invalidates bank',()=>{
 assert.match(api,/\.rpc\("delete_attestation_category_v3"/);
 assert.match(api,/\.deleted !== true/);
 assert.match(api,/invalidateQuestionBank\(\)/);
 assert.match(ui,/const fresh = await loadAttestationEditorBank\(false\)/);
});
test('legacy v4.4 ticket setup remains intact',()=>{
 assert.match(ui,/Сохранить и включить билет/);
 assert.match(ui,/function availableTopics/);
 assert.match(ui,/async function saveSettings/);
});
