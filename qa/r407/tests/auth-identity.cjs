const fs=require('fs'),assert=require('assert/strict'),ts=require('../app/node_modules/typescript'),vm=require('vm');
const source=fs.readFileSync('app/supabase/functions/staff-login/name-identity.ts','utf8');const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod});
const {identityCandidates:c,identityFingerprint:f,identityFilter:q,identityLiteral:l}=mod.exports;
assert.equal(c('  ИВАН   Иванов ').length,2);assert.equal(f('Иван Иванов'),f('Иванов Иван'));assert.equal(c('Иван')[0],undefined);assert.equal(c('x '.repeat(9)).length,0);
assert.ok(c('Иван Сергей Иванов').some(v=>v.first==='иван сергей'&&v.last==='иванов'));assert.ok(c('Иванов Иван Сергей').some(v=>v.first==='иван сергей'&&v.last==='иванов'));
assert.equal(l('a%_"\\'), '"a\\%\\_\\"\\\\"');assert.match(q(c('Иван Иванов')), /first_name\.ilike\."иван"/);assert.equal(c('Иван Иван').length,1);
console.log('PASS actual Edge identity helper: reverse order, whitespace/case, multiword partitions, bounded input, same rate-limit identity and quoted literal filters. No hosted auth/SQL called.');
