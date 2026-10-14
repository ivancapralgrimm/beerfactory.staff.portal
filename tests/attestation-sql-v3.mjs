#!/usr/bin/env node
// Local-only integration audit. Writes only to an in-memory WASM PostgreSQL.
// Usage: node tests/attestation-sql-v3.mjs [--probe-after-parameter-workaround]
//        [--migration /absolute/local/path.sql]
// Default tests use actual checkout migrations; no SQL or source file is modified.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { resolve, isAbsolute } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const legacySource = execFileSync('git', ['show', '2a21ea6a486c2aeaba144bcb6325583ccb370b85:src/features/attestation/attestation-data.ts'], { cwd: root, encoding: 'utf8' });
const legacyExports = {};
runInNewContext(ts.transpileModule(legacySource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: legacyExports, require: id => {
    if (id === '@/lib/supabase') return {supabase:{}};
    if (id === '@/features/attestation/attestation-offline') return {};
    throw new Error('Unexpected legacy import '+id);
  }, Math, Map, Set, Number, String, Error, JSON, Date, Promise
});
const args = process.argv.slice(2);
const pathIndex = args.indexOf("--migration");
const candidatePath = pathIndex < 0
  ? resolve(root, "supabase/migrations/20261012120000_attestation_independent_tickets_v3.sql")
  : resolve(root, args[pathIndex + 1]);
assert.ok(isAbsolute(candidatePath), "Only local SQL files are accepted");
const allowProbe = args.includes("--probe-after-parameter-workaround");
const sha = (s) => createHash("sha256").update(s).digest("hex");
const original = readFileSync(candidatePath, "utf8");
const baselineNames = [
  "20261005130639_attestation_bank_online_editor_foundation.sql",
  "20261005130711_seed_attestation_bank_from_legacy_json.sql",
  "20261005153815_attestation_attempt_snapshot_threshold.sql",
  "20261005174308_attestation_question_subcategories.sql",
  "20261006211201_attestation_editor_settings_categories.sql",
  "20261007082211_attestation_category_ticket_sizes.sql"
];
const ids = {
  admin: "10000000-0000-4000-8000-000000000001",
  owner: "10000000-0000-4000-8000-000000000002",
  staff: "10000000-0000-4000-8000-000000000003",
  inactive: "10000000-0000-4000-8000-000000000004",
  missing: "10000000-0000-4000-8000-000000000005"
};
const db = new PGlite();
let pass = 0, fail = 0, savepointIndex = 0, overlay = false;
let appliedSql = original;
const output = (x) => console.log(JSON.stringify(x));
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const scalar = async (sql, params = []) => (await query(sql, params))[0]?.value;
const rpc = async (expression, params = []) => scalar("select " + expression + " as value", params);
const identity = async (user, role = "authenticated") => {
  assert.ok(["authenticated", "anon", "service_role", "postgres"].includes(role));
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? ""]);
  if (role !== "postgres") await db.exec("set local role " + role);
};
const expectError = async (fn, pattern) => {
  const name = "qa_sp_" + (++savepointIndex);
  await db.exec("savepoint " + name);
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  await db.exec("rollback to savepoint " + name);
  await db.exec("release savepoint " + name);
  assert.ok(caught, "Expected rejection " + pattern);
  assert.match(caught.message, pattern);
  return { code: caught.code, message: caught.message };
};
const test = async (name, fn) => {
  await db.exec("begin");
  try {
    await identity(ids.admin);
    await fn();
    pass++;
    output({ test: name, status: "PASS", overlay });
  } catch (error) {
    fail++;
    output({ test: name, status: "FAIL", code: error.code ?? null, message: error.message, overlay });
  } finally {
    await db.exec("rollback");
    await db.exec("reset role");
  }
};
const answers = [
  { text: "QA correct", correct: true },
  { text: "QA wrong 1", correct: false },
  { text: "QA wrong 2", correct: false },
  { text: "QA wrong 3", correct: false }
];
const baseDocument = (patch = {}) => ({
  categoryId: "bar", knowledgeType: "bar", venue: "bf",
  q: "QA synthetic question", topic: "QA pool", group: "qa-new-group", answers, ...patch
});
const createQuestion = (patch = {}) =>
  rpc("public.save_attestation_question_v3($1::jsonb,null)", [JSON.stringify(baseDocument(patch))]);
const category = (id) => rpc(
  "(select to_jsonb(c) from public.attestation_categories c where id=$1)", [id]);
const asSuper = async (fn) => {
  await db.exec("reset role");
  try {
    const result = await fn();
    await identity(ids.admin);
    return result;
  } catch (error) {
    try { await identity(ids.admin); } catch {}
    throw error;
  }
};
const addTicket = async (id, venue, quota = null, count = 2, topic = "QA pool", type = "bar", active = true) => {
  await asSuper(async () => {
    await query("insert into public.attestation_categories(id,label,is_active,questions_per_test,knowledge_type,venue,specific_question_count) values($1,$1,$2,$3,$4,$5,$6)",
      [id, active, count, type, venue, quota]);
    await query("insert into public.attestation_ticket_plan(category_id,topic,question_count) values($1,$2,$3)", [id, topic, count]);
  });
};
const addPoolQuestion = async (id, venue, group = id, topic = "QA pool", type = "bar") => {
  await asSuper(async () => {
    await query("insert into public.attestation_questions(id,category_id,knowledge_type,venue,question_text,answers,topic,group_key) values($1,$2,$3,$4,$1,$5::jsonb,$6,$7)",
      [id, type, type, venue, JSON.stringify(answers), topic, group]);
  });
};
const sharedFixture = async () => {
  await addPoolQuestion("qa-common-1", "common");
  await addPoolQuestion("qa-common-2", "common");
  await addPoolQuestion("qa-bf-1", "bf");
  await addPoolQuestion("qa-bb-1", "bb");
  await addTicket("qa-bf-ticket", "bf", 1);
  await addTicket("qa-bb-ticket", "bb", 1);
  await addTicket("qa-common-ticket", "common", 0);
  await asSuper(() => db.exec("set constraints all immediate; set constraints all deferred"));
};
// Contract used by cached legacy clients: IDs are unique across the whole bank.
// Check source ownership and per-plan capacity as well as the old global ID rule.
const assertLegacyBank = (bank) => {
  legacyExports.validateQuestionBank(bank);
  assert.equal(bank.schemaVersion,2);
  assert.ok(bank.categories.length>0,"legacy bank must retain ready BF tickets");
  const ids=new Set();
  for (const c of bank.categories) {
    assert.equal(c.venue,"bf");
    assert.equal(c.specificQuestionCount,null);
    assert.equal(c.ticketPlan.reduce((sum,p)=>sum+p.count,0),c.questionsPerTest);
    for (const q of c.questions) {
      assert.ok(!ids.has(q.id),"legacy global duplicate question ID: "+q.id);
      ids.add(q.id);
      assert.equal(q.categoryId,c.id,"legacy question must belong to its ticket");
      assert.equal(q.knowledgeType,c.knowledgeType);
      assert.ok(["bf","common"].includes(q.venue));
    }
    for (const part of c.ticketPlan) {
      const groups=new Set(c.questions.filter(q=>q.topic===part.topic).map(q=>q.group));
      assert.ok(groups.size>=part.count,"legacy source capacity: "+c.id+":"+part.topic);
    }
  }
};
const settingsDocument = async () => {
  const bank = await rpc("public.get_attestation_editor_bank_v3(false)");
  return {
    revision: bank.settings.revision,
    categories: bank.categories.map(c => ({
      categoryId: c.id, label: c.label, questionsPerTest: c.questionsPerTest,
      knowledgeType: c.knowledgeType, venue: c.venue,
      specificQuestionCount: c.specificQuestionCount
    })),
    plan: bank.categories.flatMap(c => c.ticketPlan.map(p => ({
      categoryId: c.id, topic: p.topic, count: p.count, sortOrder: p.sortOrder
    })))
  };
};
const saveSettings = (document) => rpc(
  "public.save_attestation_editor_settings_v3(80::smallint,$1::jsonb,$2::jsonb,$3::bigint)",
  [document.categories === null ? null : JSON.stringify(document.categories),
    document.plan === null ? null : JSON.stringify(document.plan), document.revision]);

try {
  output({ mode: "local in-memory PGlite", candidatePath, candidateSha256: sha(original) });
  const bootstrap = [
    "create role anon nologin;",
    "create role authenticated nologin;",
    "create role service_role nologin bypassrls;",
    "create schema auth; create schema private;",
    "create type public.staff_role as enum ('staff','manager','admin');",
    "create table public.profiles(id uuid primary key, role public.staff_role not null default 'staff',is_owner boolean not null default false,is_active boolean not null default true);",
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    "grant usage on schema public,auth to anon,authenticated,service_role;",
    "grant execute on function auth.uid() to anon,authenticated,service_role;",
    "create table public.quiz_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),category text,category_id text,score smallint not null,passed boolean not null,total_questions smallint not null,correct_answers smallint not null,category_results jsonb,started_at timestamptz,finished_at timestamptz,created_at timestamptz not null default now());"
  ].join("\n");
  await db.exec(bootstrap);
  // quiz_attempts/profiles are synthetic prerequisites: their original CREATE TABLE
  // migrations are absent from this checkout. All attestation SQL is actual baseline.
  for (const [name, id] of Object.entries(ids)) {
    if (name === "missing") continue;
    await query("insert into public.profiles(id,role,is_owner,is_active) values($1,$2::public.staff_role,$3,$4)",
      [id, name === "admin" || name === "inactive" ? "admin" : "staff", name === "owner", name !== "inactive"]);
  }
  for (const name of baselineNames) {
    const sql = readFileSync(root + "/supabase/migrations/" + name, "utf8");
    await db.exec("begin");
    try { await db.exec(sql); await db.exec("commit"); }
    catch (error) { await db.exec("rollback"); throw new Error("Baseline " + name + ": " + error.message); }
    output({ baseline: name, status: "APPLIED", sha256: sha(sql) });
  }
  const plans = await query("select category_id,topic,question_count from public.attestation_ticket_plan order by category_id,sort_order");
  let questionNumber = 0;
  for (const part of plans) {
    for (let n = 0; n < part.question_count + 2; n++) {
      questionNumber++;
      const id = "qa-seed-" + part.category_id + "-" + questionNumber;
      await query("insert into public.attestation_questions(id,category_id,question_text,answers,topic,group_key) values($1,$2,$1,$3::jsonb,$4,$1)",
        [id, part.category_id, JSON.stringify(answers), part.topic]);
    }
  }
  await db.exec("insert into public.attestation_categories(id,label,is_active,questions_per_test) values ('bistro','Бистро',false,2),('qa-ambiguous','QA ambiguous legacy',true,1)");
  await db.exec("insert into public.attestation_ticket_plan(category_id,topic,question_count) values('qa-ambiguous','QA legacy',1)");
  for (const id of ["bistro", "qa-ambiguous"]) {
    await query("insert into public.attestation_questions(id,category_id,question_text,answers,topic,group_key) values($1,$2,$1,$3::jsonb,'QA legacy',$1)",
      ["qa-preexisting-" + id, id, JSON.stringify(answers)]);
  }
  await db.exec("update public.attestation_questions set revision=2,question_text='QA revised before v3' where id=(select id from public.attestation_questions where category_id='bar' order by id limit 1)");
  await query("insert into public.quiz_attempts(user_id,category,category_id,score,passed,total_questions,correct_answers,client_attempt_id) values($1,'QA historic','bar',100,true,1,1,'20000000-0000-4000-8000-000000000001')", [ids.staff]);
  const beforeCounts = await query("select (select count(*) from public.attestation_questions)::int as questions,(select count(*) from public.attestation_question_versions)::int as versions,(select count(*) from public.quiz_attempts)::int as attempts");
  output({ fixture: beforeCounts[0], engine: await scalar("select version() as value") });
  await db.exec("begin");
  let candidateError;
  try { await db.exec(original); await db.exec("commit"); }
  catch (error) { candidateError = error; await db.exec("rollback"); }
  if (candidateError) {
    output({ test: "actual candidate migration applies to baseline", status: "FAIL", code: candidateError.code, message: candidateError.message, overlay: false });
    fail++;
    if (!allowProbe || candidateError.code !== "42P13" || !candidateError.message.includes("p_question")) {
      output({ summary: { pass, fail, blocked: true }, candidateSha256After: sha(readFileSync(candidatePath,"utf8")) });
      process.exitCode = 1;
    } else {
      const patched = original.replace(
        /create or replace function private\.attestation_question_snapshot\(q public\.attestation_questions\)([\s\S]*?)\$\$;/,
        (match) => match.replace("(q public.", "(p_question public.").replace(/\bq\./g, "p_question."));
      assert.notEqual(patched, original);
      await db.exec("begin");
      try { await db.exec(patched); await db.exec("commit"); }
      catch (error) { await db.exec("rollback"); throw error; }
      overlay = true;
      appliedSql = patched;
      output({ warning: "PROBE ONLY: parameter-name workaround applied in memory; candidate file unchanged", overlay });
    }
  } else {
    pass++;
    output({ test: "actual candidate migration applies to baseline", status: "PASS", overlay: false });
  }
  if (!candidateError || overlay) {
    await test("backfill preserves IDs/counts/history/Bistro draft and classifies canonical types", async () => {
      const counts = await asSuper(() => query("select (select count(*) from public.attestation_questions)::int as questions,(select count(*) from public.attestation_question_versions)::int as versions,(select count(*) from public.quiz_attempts)::int as attempts"));
      assert.deepEqual(counts, beforeCounts);
      const bank = await rpc("public.get_attestation_editor_bank_v3(true)");
      for (const id of ["bar","kitchen","wine","service"]) assert.equal(bank.categories.find(c => c.id === id).knowledgeType, id);
      const bistro = bank.categories.find(c => c.id === "bistro");
      assert.equal(bistro.active, false);
      assert.equal(bistro.knowledgeType, null);
      assert.equal(bistro.label, "Бистро");
      assert.equal(bistro.questionsPerTest, 2);
      assert.equal(bank.questions.find(q => q.id === "qa-preexisting-bistro").knowledgeType, null);
      assert.equal(bank.categories.find(c => c.id === "qa-ambiguous").active, false);
    });
    await test("anon cannot execute v3 readers/writers", async () => {
      await identity(null,"anon");
      for (const expr of [
        "public.get_attestation_bank_v3()",
        "public.get_attestation_editor_bank_v3(false)",
        "public.save_attestation_question_v3('{}'::jsonb,null)",
        "public.set_attestation_question_status_v3('x','archive',1)",
        "public.save_attestation_category_v3('{}'::jsonb,null)",
        "public.set_attestation_category_status_v3('x',true,null)",
        "public.save_attestation_editor_settings_v3(80::smallint,'[]'::jsonb,'[]'::jsonb,1)"
      ]) await expectError(() => rpc(expr), /permission denied/);
    });
    await test("active staff reads but all admin RPCs reject", async () => {
      await identity(ids.staff);
      assert.equal((await rpc("public.get_attestation_bank_v3()")).schemaVersion, 3);
      for (const expr of [
        "public.get_attestation_editor_bank_v3(false)",
        "public.save_attestation_question_v3('{}'::jsonb,null)",
        "public.set_attestation_question_status_v3('x','archive',1)",
        "public.save_attestation_category_v3('{}'::jsonb,null)",
        "public.set_attestation_category_status_v3('x',true,null)",
        "public.save_attestation_editor_settings_v3(80::smallint,'[]'::jsonb,'[]'::jsonb,1)"
      ]) await expectError(() => rpc(expr), /forbidden/);
    });
    await test("inactive/missing profiles reject; owner and admin can edit", async () => {
      for (const id of [ids.inactive, ids.missing, null]) {
        await identity(id);
        await expectError(() => rpc("public.get_attestation_bank_v3()"), /forbidden/);
        await expectError(() => createQuestion(), /forbidden/);
      }
      for (const id of [ids.owner, ids.admin]) {
        await identity(id);
        assert.equal((await createQuestion({group:"qa-role-" + id})).knowledgeType,"bar");
      }
    });
    await test("BF/BB/common tickets use independent plans and one shared question ID", async () => {
      await sharedFixture();
      const bank = await rpc("public.get_attestation_bank_v3()");
      const bf = bank.categories.find(c => c.id === "qa-bf-ticket");
      const bb = bank.categories.find(c => c.id === "qa-bb-ticket");
      const common = bank.categories.find(c => c.id === "qa-common-ticket");
      assert.equal(bf.specificQuestionCount,1);
      assert.equal(bb.specificQuestionCount,1);
      assert.equal(common.specificQuestionCount,0);
      assert.ok(bf.questions.some(q => q.id === "qa-common-1"));
      assert.ok(bb.questions.some(q => q.id === "qa-common-1"));
      assert.ok(!bf.questions.some(q => q.venue === "bb"));
      assert.ok(!bb.questions.some(q => q.venue === "bf"));
      assert.ok(common.questions.every(q => q.venue === "common"));
      assert.ok(bf.questions.every(q => q.knowledgeType === "bar"));
      assert.equal((await asSuper(() => scalar("select count(*)::int as value from public.attestation_questions where id='qa-common-1'"))),1);
    });
    await test("question optimistic revision and historical venue/type snapshots", async () => {
      const q = await createQuestion({group:"qa-history"});
      const updated = await rpc("public.save_attestation_question_v3($1::jsonb,$2::bigint)",
        [JSON.stringify(baseDocument({id:q.id,group:q.group,venue:"common",q:"QA updated"})), q.revision]);
      assert.equal(updated.revision,q.revision+1);
      const historic = await asSuper(() => scalar("select snapshot as value from public.attestation_question_versions where question_id=$1 and revision=$2",[q.id,q.revision]));
      assert.equal(historic.venue,"bf");
      assert.equal(historic.knowledgeType,"bar");
      await expectError(() => rpc("public.save_attestation_question_v3($1::jsonb,$2::bigint)",
        [JSON.stringify(baseDocument({id:q.id})),q.revision]), /attestation_revision_conflict/);
    });
    await test("shared question archive cannot break exact quotas and rollback is atomic", async () => {
      await sharedFixture();
      await addPoolQuestion("qa-common-3","common");
      await rpc("public.set_attestation_question_status_v3('qa-common-1','archive',1)");
      const oldRevision = (await rpc("public.get_attestation_editor_bank_v3(false)")).settings.revision;
      await expectError(() => rpc("public.set_attestation_question_status_v3('qa-common-2','archive',1)"), /attestation_ticket_capacity|attestation_ticket_quota_capacity/);
      const q = (await rpc("public.get_attestation_editor_bank_v3(false)")).questions.find(q => q.id === "qa-common-2");
      assert.equal(q.status,"active");
      assert.equal(q.revision,1);
      assert.equal((await rpc("public.get_attestation_editor_bank_v3(false)")).settings.revision,oldRevision);
      assert.equal(await asSuper(() => scalar("select count(*)::int as value from public.attestation_question_versions where question_id='qa-common-2'")),0);
    });
    await test("infeasible per-topic quota is rejected despite global totals", async () => {
      await sharedFixture();
      await addPoolQuestion("qa-topic2-specific1","bf","qa-topic2-specific1","QA only specific");
      await addPoolQuestion("qa-topic2-specific2","bf","qa-topic2-specific2","QA only specific");
      const doc = await settingsDocument();
      const c = doc.categories.find(c => c.categoryId === "qa-bf-ticket");
      c.questionsPerTest = 3; c.specificQuestionCount = 1;
      doc.plan = doc.plan.filter(p => p.categoryId !== c.categoryId);
      doc.plan.push({categoryId:c.categoryId,topic:"QA pool",count:1,sortOrder:0},{categoryId:c.categoryId,topic:"QA only specific",count:2,sortOrder:1});
      await expectError(() => saveSettings(doc), /attestation_ticket_quota_capacity/);
    });
    await test("group duplicated across planned topics is rejected", async () => {
      await addPoolQuestion("qa-cross-a","bf","qa-cross-group","QA cross A");
      await addPoolQuestion("qa-cross-b","bf","qa-cross-group","QA cross B");
      await addPoolQuestion("qa-cross-spare","bf","qa-cross-spare","QA cross B");
      await addTicket("qa-cross-ticket","bf",null,1,"QA cross A");
      const doc = await settingsDocument();
      doc.categories.find(c => c.categoryId === "qa-cross-ticket").questionsPerTest = 2;
      doc.plan.push({categoryId:"qa-cross-ticket",topic:"QA cross B",count:1,sortOrder:1});
      await expectError(() => saveSettings(doc), /attestation_ticket_group_cross_topic/);
    });
    await test("draft can be classified/prepared then activated from shared pool", async () => {
      await sharedFixture();
      const draft = await rpc("public.save_attestation_category_v3($1::jsonb,null)",
        [JSON.stringify({label:"QA prepared Bistro",knowledgeType:"bar",venue:"bb"})]);
      assert.equal(draft.active,false);
      const doc = await settingsDocument();
      const c = doc.categories.find(c => c.categoryId === draft.id);
      c.questionsPerTest=2; c.specificQuestionCount=1;
      doc.plan.push({categoryId:draft.id,topic:"QA pool",count:2,sortOrder:0});
      await saveSettings(doc);
      const updated = (await rpc("public.get_attestation_editor_bank_v3(false)")).categories.find(c => c.id === draft.id);
      const activated = await rpc("public.set_attestation_category_status_v3($1,true,$2::timestamptz)",[draft.id,updated.updatedAt]);
      assert.equal(activated.active,true);
      assert.equal(activated.venue,"bb");
    });
    await test("NULL category settings must be rejected rather than erase draft plans", async () => {
      const draft = await rpc("public.save_attestation_category_v3($1::jsonb,null)",[JSON.stringify({label:"QA null settings draft",knowledgeType:"bar"})]);
      await asSuper(() => query("insert into public.attestation_ticket_plan(category_id,topic,question_count) values($1,'QA draft plan',1)",[draft.id]));
      const doc = await settingsDocument();
      const previous = doc.plan.length;
      doc.categories = null;
      doc.plan = doc.plan.filter(p => p.categoryId !== draft.id);
      await expectError(() => saveSettings(doc), /attestation_settings_invalid|attestation_category_settings_incomplete/);
      assert.equal((await settingsDocument()).plan.length,previous);
    });
    await test("NULL ticket-plan must be rejected even when all categories are drafts", async () => {
      await asSuper(() => db.exec("update public.attestation_categories set is_active=false"));
      const doc = await settingsDocument();
      doc.plan = null;
      await expectError(() => saveSettings(doc), /attestation_settings_invalid/);
    });
    await test("normalized duplicate category IDs must be rejected", async () => {
      const doc = await settingsDocument();
      const target = doc.categories.find(c => c.categoryId==="bar");
      const replaced = doc.categories.find(c => c.categoryId==="bistro");
      Object.assign(replaced,target,{categoryId:" bar ",label:"QA duplicate after trim"});
      await expectError(() => saveSettings(doc), /attestation_category_settings_duplicate|attestation_category_settings_incomplete/);
    });
    await test("NULL status rejects without changing question or category", async () => {
      const q = await createQuestion({group:"qa-null-status"});
      await expectError(() => rpc("public.set_attestation_question_status_v3($1,null,$2)",[q.id,q.revision]), /attestation_status_invalid|null value/);
      assert.equal((await rpc("public.get_attestation_editor_bank_v3(false)")).questions.find(x=>x.id===q.id).status,"active");
      const c = (await rpc("public.get_attestation_editor_bank_v3(false)")).categories.find(c=>c.id==="bar");
      await expectError(() => rpc("public.set_attestation_category_status_v3('bar',null,$1::timestamptz)",[c.updatedAt]), /attestation_status_invalid|attestation_category_status_invalid|attestation_category_invalid|null value/);
      assert.equal((await rpc("public.get_attestation_editor_bank_v3(false)")).categories.find(x=>x.id==="bar").active,true);
    });
    await test("legacy question create remains visible to both legacy/v3 readers", async () => {
      const q = await rpc("public.save_attestation_question($1::jsonb,null)",[JSON.stringify(baseDocument({group:"qa-legacy-created",topic:plans.find(p=>p.category_id==="bar").topic}))]);
      const v3 = await rpc("public.get_attestation_bank_v3()");
      const legacy = await rpc("public.get_attestation_bank()");
      assert.ok(v3.categories.find(c=>c.id==="bar").questions.some(x=>x.id===q.id),"legacy-created question absent from v3");
      assert.ok(legacy.categories.find(c=>c.id==="bar").questions.some(x=>x.id===q.id),"legacy-created question absent from legacy");
    });
    await test("legacy category move cannot leave question in old knowledge pool", async () => {
      const q = (await rpc("public.get_attestation_editor_bank_v3(false)")).questions.find(q=>q.categoryId==="bar" && q.id.startsWith("qa-seed"));
      const moved = await rpc("public.save_attestation_question($1::jsonb,$2)",[JSON.stringify({...q,categoryId:"kitchen",topic:"QA legacy moved",group:"qa-legacy-moved"}),q.revision]);
      const bank = await rpc("public.get_attestation_bank_v3()");
      assert.ok(!bank.categories.find(c=>c.id==="bar").questions.some(x=>x.id===q.id),"moved kitchen question still exposed as Bar");
      assert.equal(moved.knowledgeType,"kitchen");
    });
    await test("legacy archive accepts replacement groups from independent shared pool", async () => {
      const q = await asSuper(() => scalar("select private.attestation_question_snapshot(q) as value from public.attestation_questions q where category_id='bar' order by id limit 1"));
      await asSuper(async () => {
        await query("insert into public.attestation_categories(id,label,is_active,knowledge_type,venue) values('qa-source-draft','QA source draft',false,'bar','bf')");
        await query("update public.attestation_questions set category_id='qa-source-draft' where category_id='bar' and topic=$1 and id<>$2",[q.topic,q.id]);
      });
      await expectError(async () => {
        // Ensure the legacy RPC actually succeeds; raise a sentinel only on success.
        await rpc("public.set_attestation_question_status($1,'archive',$2)",[q.id,q.revision]);
        throw new Error("QA expected success sentinel");
      }, /QA expected success sentinel/);
    });
    await test("legacy projection preserves source-owned custom BF tickets and global ID uniqueness", async () => {
      await sharedFixture();
      await addTicket("qa-legacy-custom","bf",null,2);
      await addTicket("qa-independent-bf","bf",null,1);
      let legacy=await rpc("public.get_attestation_bank()");
      assertLegacyBank(legacy);
      assert.ok(!legacy.categories.some(c=>c.id==="qa-legacy-custom"),"source-empty custom ticket must stay v3-only");
      assert.ok(!legacy.categories.some(c=>c.id==="qa-independent-bf"),"independent ticket must stay v3-only");
      const ownQuestion=async(id,venue)=>asSuper(()=>query(
        "insert into public.attestation_questions(id,category_id,knowledge_type,venue,question_text,answers,topic,group_key) values($1,'qa-legacy-custom','bar',$2,$1,$3::jsonb,'QA pool',$1)",
        [id,venue,JSON.stringify(answers)]));
      await ownQuestion("qa-custom-common","common");
      await ownQuestion("qa-custom-bb-only","bb");
      legacy=await rpc("public.get_attestation_bank()");
      assertLegacyBank(legacy);
      assert.ok(!legacy.categories.some(c=>c.id==="qa-legacy-custom"),"BB-only source question cannot satisfy BF capacity");
      await ownQuestion("qa-custom-bf","bf");
      legacy=await rpc("public.get_attestation_bank()");
      assertLegacyBank(legacy);
      const custom=legacy.categories.find(c=>c.id==="qa-legacy-custom");
      assert.ok(custom,"legacy reader must retain a ready source-owned custom BF ticket");
      assert.deepEqual(custom.questions.map(q=>q.id).sort(),["qa-custom-bf","qa-custom-common"]);
      assert.ok(!legacy.categories.some(c=>c.id==="qa-independent-bf"));
      const v3=await rpc("public.get_attestation_bank_v3()");
      const independent=v3.categories.find(c=>c.id==="qa-independent-bf");
      assert.ok(independent.questions.some(q=>q.id==="qa-custom-common"),"v3 shared pool must remain independent of legacy ownership");
      assert.ok(v3.categories.find(c=>c.id==="bar").questions.some(q=>q.id==="qa-custom-common"));
    });
    await test("category rename with omitted optional fields preserves type/venue", async () => {
      const draft = await rpc("public.save_attestation_category_v3($1::jsonb,null)",[JSON.stringify({label:"QA kitchen BB draft",knowledgeType:"kitchen",venue:"bb"})]);
      const renamed = await rpc("public.save_attestation_category_v3($1::jsonb,$2::timestamptz)",
        [JSON.stringify({id:draft.id,label:"QA renamed kitchen BB draft"}),draft.updatedAt]);
      assert.equal(renamed.knowledgeType,"kitchen");
      assert.equal(renamed.venue,"bb");
    });
    await test("source questions remain editable after source category is retyped", async () => {
      const bank = await rpc("public.get_attestation_editor_bank_v3(false)");
      const source = bank.categories.find(c=>c.id==="bar");
      const question = bank.questions.find(q=>q.categoryId==="bar");
      const inactive = await rpc("public.set_attestation_category_status_v3('bar',false,$1::timestamptz)",[source.updatedAt]);
      await rpc("public.save_attestation_category_v3($1::jsonb,$2::timestamptz)",
        [JSON.stringify({id:"bar",label:source.label,knowledgeType:"kitchen",venue:"bf"}),inactive.updatedAt]);
      const updated = await rpc("public.save_attestation_question_v3($1::jsonb,$2::bigint)",
        [JSON.stringify({...question,q:"QA source edited after retype"}),question.revision]);
      assert.equal(updated.knowledgeType,"bar");
      assert.equal(updated.q,"QA source edited after retype");
    });
    await test("NULL save documents reject and leave settings revision unchanged", async () => {
      const before = (await rpc("public.get_attestation_editor_bank_v3(false)")).settings.revision;
      await expectError(()=>rpc("public.save_attestation_question_v3(null,null)"),/attestation_knowledge_type_invalid|attestation_question_invalid|attestation_document_invalid/);
      await expectError(()=>rpc("public.save_attestation_category_v3(null,null)"),/attestation_category_label_invalid|attestation_category_invalid|attestation_document_invalid/);
      assert.equal((await rpc("public.get_attestation_editor_bank_v3(false)")).settings.revision,before);
      const defs = await asSuper(()=>query("select proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'save_attestation%' or p.proname like 'set_attestation%')"));
      for (const entry of defs) {
        const body=entry.definition.toLowerCase();
        if (/return public\.(?:save|set)_attestation_.*_v3\(/.test(body) && !body.includes("for update")) continue;
        const lock=body.indexOf("from public.attestation_settings where singleton=true for update");
        assert.ok(lock>=0,entry.proname+" missing first singleton lock");
        const afterBegin=body.slice(body.indexOf("\nbegin"));
        assert.ok(afterBegin.indexOf("from public.attestation_settings where singleton=true for update")<=afterBegin.indexOf("for update"),entry.proname+" row lock precedes settings lock");
      }
    });
    await test("valid independent ticket submission persists ticket ID and is sequentially idempotent", async () => {
      await sharedFixture();
      await identity(ids.staff);
      const params = ["20000000-0000-4000-8000-000000000002","QA BF ticket","qa-bf-ticket",2,2,
        JSON.stringify({pass_percent:80,topics:[]}),JSON.stringify([{id:"qa-common-1",revision:1},{id:"qa-bf-1",revision:1}])];
      const call = () => rpc("public.submit_attestation_attempt($1::uuid,$2,$3,$4::smallint,$5::smallint,$6::jsonb,now(),now(),$7::jsonb,false)",params);
      const first = await call(), second = await call();
      assert.equal(first.duplicate,false);
      assert.equal(second.duplicate,true);
      assert.equal(first.id,second.id);
      assert.equal(await asSuper(()=>scalar("select category_id as value from public.quiz_attempts where id=$1",[first.id])),"qa-bf-ticket");
      // Historical references remain acceptable after editing/archiving a source,
      // retiring the ticket, and changing the current type and pass threshold.
      await identity(ids.admin);
      const editor = await rpc("public.get_attestation_editor_bank_v3(false)");
      const old = editor.questions.find(q=>q.id==="qa-common-1");
      await rpc("public.save_attestation_question_v3($1::jsonb,$2)",[JSON.stringify({...old,q:"QA historical offline reference"}),old.revision]);
      await addPoolQuestion("qa-common-offline-spare","common");
      await rpc("public.set_attestation_question_status_v3('qa-common-1','archive',2)");
      const ticket = (await rpc("public.get_attestation_editor_bank_v3(false)")).categories.find(c=>c.id==="qa-bf-ticket");
      const retired = await rpc("public.set_attestation_category_status_v3($1,false,$2::timestamptz)",[ticket.id,ticket.updatedAt]);
      await rpc("public.save_attestation_category_v3($1::jsonb,$2::timestamptz)",[JSON.stringify({id:ticket.id,label:ticket.label,knowledgeType:"kitchen",venue:"bb"}),retired.updatedAt]);
      await asSuper(()=>db.exec("update public.attestation_settings set pass_percent=100"));
      await identity(ids.staff);
      const offlineParams = [...params];
      offlineParams[0]="20000000-0000-4000-8000-000000000012";
      const offline=await rpc("public.submit_attestation_attempt($1::uuid,$2,$3,$4::smallint,$5::smallint,$6::jsonb,'2026-10-01T10:00:00Z'::timestamptz,'2026-10-01T10:01:00Z'::timestamptz,$7::jsonb,true)",offlineParams);
      assert.equal(offline.pass_percent,80);
      assert.equal(offline.passed,true);
      assert.equal(await asSuper(()=>scalar("select synced_from_offline as value from public.quiz_attempts where id=$1",[offline.id])),true);
    });
    await test("submission validates IDs, NULL/JSON inputs, bounds, timing and revision references", async () => {
      await identity(ids.staff);
      const invoke = (patch = {}) => {
        const v = {client:"20000000-0000-4000-8000-000000000003",category:"bar",total:2,correct:1,
          results:JSON.stringify({pass_percent:80}),started:"2026-10-01T10:00:00Z",finished:"2026-10-01T10:01:00Z",refs:"[]",...patch};
        return rpc("public.submit_attestation_attempt($1::uuid,'QA validation',$2,$3::smallint,$4::smallint,$5::jsonb,$6::timestamptz,$7::timestamptz,$8::jsonb,false)",
          [v.client,v.category,v.total,v.correct,v.results,v.started,v.finished,v.refs]);
      };
      for (const patch of [
        {client:null},{category:null},{category:"qa-no-such-ticket"},
        {total:null},{total:0},{total:51},{correct:null},{correct:-1},{correct:3},
        {results:null},{results:"null"},{results:"[]"},{results:'{"pass_percent":49}'},{results:'{"pass_percent":"oops"}'},
        {started:null},{finished:null},{finished:"2026-10-01T09:59:00Z"},{started:"-infinity"},
        {refs:null},{refs:"null"},{refs:"{}"},{refs:'[{"id":"qa-no-such-question","revision":999}]'}
      ]) await expectError(()=>invoke(patch),/attestation_attempt_invalid|attestation_category_not_found|attestation_revision_conflict/);
      const known = await asSuper(()=>query("select id,revision from public.attestation_questions where category_id='bar' order by id limit 2"));
      await identity(ids.staff);
      for (const refs of [
        [{...known[0]},{...known[0]}],
        [{...known[0]},{id:"qa-no-such-question",revision:1}],
        [{...known[0]},{...known[1],revision:999}],
        [{...known[0]},{...known[1],revision:0}],
        [{...known[0]},{...known[1],revision:null}],
        [{...known[0]},{...known[1],revision:"9999999999999999999999999"}]
      ]) await expectError(()=>invoke({refs:JSON.stringify(refs)}),/attestation_attempt_invalid|attestation_revision_conflict/);
      // The old aggregate-only contract cannot establish the truth of a score.
      const accepted = await invoke({total:1,correct:1,refs:"[]",results:'{"pass_percent":50}'});
      assert.equal(accepted.passed,true);
      assert.equal(accepted.pass_percent,50);
    });
    await test("submission exact pass/fail matches 39/49 at threshold 80", async () => {
      await identity(ids.staff);
      const result = await rpc(
        "public.submit_attestation_attempt('20000000-0000-4000-8000-000000000004','QA rounding','bar',49::smallint,39::smallint,'{\"pass_percent\":80}'::jsonb,now(),now(),'[]'::jsonb,false)");
      assert.equal(result.passed,false,"39/49=79.591...% must not pass 80%");
    });
    await test("duplicate submission returns same pass_percent contract", async () => {
      await identity(ids.staff);
      const call = () => rpc(
        "public.submit_attestation_attempt('20000000-0000-4000-8000-000000000005','QA duplicate contract','bar',1::smallint,1::smallint,'{\"pass_percent\":80}'::jsonb,now(),now(),'[]'::jsonb,false)");
      const first=await call(), second=await call();
      assert.equal(first.pass_percent,80);
      assert.equal(second.pass_percent,80,"duplicate branch omits pass_percent");
    });
    await test("migration rejects a baseline-valid preexisting cross-topic group collision", async () => {
      const preflight = new PGlite();
      try {
        await preflight.exec(bootstrap);
        for (const name of baselineNames) {
          await preflight.exec(readFileSync(root + "/supabase/migrations/" + name,"utf8"));
        }
        let index = 0;
        for (const part of plans) {
          for (let n=0;n<part.question_count+2;n++) {
            const id = "qa-preflight-" + (++index);
            // Two Bar topics share a source group, which baseline checks allow.
            const group = part.category_id === "bar" && n === 0 ? "qa-legacy-cross-topic" : id;
            await preflight.query("insert into public.attestation_questions(id,category_id,question_text,answers,topic,group_key) values($1,$2,$1,$3::jsonb,$4,$5)",
              [id,part.category_id,JSON.stringify(answers),part.topic,group]);
          }
        }
        // The baseline per-topic capacity checks all pass.
        for (const part of plans) await preflight.query("select private.attestation_assert_topic_capacity($1,$2)",[part.category_id,part.topic]);
        await preflight.exec("begin");
        let rejected;
        try { await preflight.exec(appliedSql); await preflight.exec("commit"); }
        catch (error) { rejected=error; await preflight.exec("rollback"); }
        assert.ok(rejected,"Migration committed invalid preexisting cross-topic groups without validating them");
        assert.match(rejected.message,/attestation_ticket_group_cross_topic/);
      } finally { await preflight.close(); }
    });
    output({ note: "PGlite uses one session. Multi-session lock inversion and concurrent same-ID submission require full PostgreSQL; no concurrency PASS is claimed." });
    output({ summary:{pass,fail,overlay},candidateSha256After:sha(readFileSync(candidatePath,"utf8")) });
    if (fail) process.exitCode=1;
  }
} catch (error) {
  output({ harnessError:true,code:error.code??null,message:error.message,stack:error.stack });
  process.exitCode=1;
} finally {
  await db.close();
}

