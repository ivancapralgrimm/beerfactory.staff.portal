const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Module } = require('node:module');
const ts = require('typescript');
const filename = path.resolve('src/features/staff/staff-avatar.ts');
const moduleInstance = new Module(filename);
moduleInstance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const {staffAvatarSource} = moduleInstance.exports;
const subject = {id:'11111111-1111-4111-8111-111111111111',position_code:'bartender',is_owner:false};
test('staff avatar maps all six working positions to their supplied families', () => {
 for (const [position,family] of [['bartender','bartender'],['bartender_bb','bartender'],['waiter','waiter'],['waiter_bb','waiter'],['manager','manager'],['hostess','hostess']]) {
  const src=staffAvatarSource({...subject,position_code:position});assert.match(src,new RegExp(`/${family}-[12]\\.webp$`));assert.ok(fs.existsSync(path.join('assets/staff-avatars',path.basename(src))));
 }
 assert.equal(staffAvatarSource(subject),staffAvatarSource({...subject,position_code:'bartender_bb'}));
});
test('only owner flag selects exclusive avatar; access role does not replace position',()=>{
 assert.equal(staffAvatarSource({...subject,is_owner:true,position_code:'hostess'}),'/assets/staff-avatars/owner.webp');
 for(const role of ['staff','senior','admin','manager'])assert.equal(staffAvatarSource({...subject,role}),staffAvatarSource(subject));
});
test('choice is repeatable across renders/devices and both variants are distributed',()=>{
 const first=staffAvatarSource(subject);for(let i=0;i<100;i++)assert.equal(staffAvatarSource({...subject}),first);
 const counts=[0,0];for(let i=0;i<512;i++){const id=`11111111-1111-4111-8111-${i.toString(16).padStart(12,'0')}`;counts[Number(staffAvatarSource({...subject,id}).match(/-(\d)\.webp$/)[1])-1]++;}
 assert.ok(counts[0]>150&&counts[1]>150,JSON.stringify(counts));
 assert.equal(staffAvatarSource({...subject,id:subject.id.toUpperCase()}),first);
});
test('missing/unknown position does not invent a working role',()=>{
 for(const position_code of [null,undefined,'cook','toString'])assert.equal(staffAvatarSource({...subject,position_code}),null);
 assert.equal(staffAvatarSource({...subject,id:''}),null);
});
