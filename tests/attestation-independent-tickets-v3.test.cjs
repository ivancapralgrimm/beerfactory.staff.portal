const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/features/attestation/attestation-data.ts'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261012120000_attestation_independent_tickets_v3.sql'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const exportsObject = {};
const fakeRequire = (id) => {
  if (id === '@/lib/supabase') return { supabase: { rpc: async () => ({ data: null, error: new Error('offline') }) } };
  if (id === '@/features/attestation/attestation-offline') return {
    cacheAttestationBank: async () => {}, readCachedAttestationBank: async () => null
  };
  throw new Error(`Unexpected import ${id}`);
};
vm.runInNewContext(output, { exports: exportsObject, require: fakeRequire, Math, Map, Set,
  Error, Number, JSON, String, Date, Promise, console }, { filename: 'attestation-data.transpiled.cjs' });
const { buildQuizTicket, validateQuestionBank } = exportsObject;
test('pass/fail compares exact answer counts before displaying rounded percentages', () => {
  assert.equal(exportsObject.hasPassed(39,49,80),false);
  assert.equal(exportsObject.hasPassed(2,3,67),false);
  assert.equal(exportsObject.hasPassed(4,5,80),true);
});

function q(id, knowledgeType, venue, topic = 'Основы', group = id) {
  return { id, q: `Вопрос ${id}?`, group, topic, knowledgeType, venue,
    answers: [1, 2, 3, 4].map((n) => ({ text: `${id}: ответ ${n}`, correct: n === 1 })) };
}
function c(id, knowledgeType, venue, questions, n = 2, specificQuestionCount = null) {
  return { id, label: id, knowledgeType, venue, questions, questionsPerTest: n,
    specificQuestionCount, ticketPlan: [{ topic: 'Основы', count: n }] };
}
function bank(categories) {
  return { schemaVersion: 3, passPercent: 80, questionsPerTest: 15, categories };
}
const shared = q('shared-bar', 'bar', 'common');
const bfOnly = q('bf-bar', 'bar', 'bf');
const bbOnly = q('bb-bar', 'bar', 'bb');
const kitchenBB = q('bb-kitchen', 'kitchen', 'bb');

test('same physical source question is valid in separate BF and BB tickets', () => {
  const b = bank([c('bar-bf', 'bar', 'bf', [shared, bfOnly]), c('bar-bb', 'bar', 'bb', [shared, bbOnly])]);
  assert.equal(validateQuestionBank(b).categories.length, 2);
  assert.deepEqual(new Set(buildQuizTicket(b.categories[0]).map((x) => x.id)), new Set(['shared-bar','bf-bar']));
  assert.deepEqual(new Set(buildQuizTicket(b.categories[1]).map((x) => x.id)), new Set(['shared-bar','bb-bar']));
});
test('BB ticket cannot contain BF-specific question', () => {
  const invalid = c('bar-bb', 'bar', 'bb', [shared, bfOnly]);
  assert.throws(() => validateQuestionBank(bank([invalid])), /question_bank_question_invalid/);
});
test('Kitchen question cannot be inserted into Bar ticket', () => {
  assert.throws(() => validateQuestionBank(bank([c('bb-bar','bar','bb',[shared,kitchenBB])])), /question_bank_question_invalid/);
});
test('common-only ticket cannot contain venue-specific questions', () => {
  const s2 = q('shared-other','bar','common');
  const common = c('common-bar','bar','common',[shared,s2]);
  assert.equal(buildQuizTicket(validateQuestionBank(bank([common])).categories[0]).length, 2);
  assert.throws(() => validateQuestionBank(bank([c('common-bad','bar','common',[shared,bfOnly])])), /question_bank_question_invalid/);
});
test('quota zero requires all common; exact quota requires venue-only count', () => {
  const s2 = q('shared-other','bar','common');
  const a = c('bar-bf','bar','bf',[shared,s2,bfOnly],2,1);
  assert.equal(buildQuizTicket(a).filter((x) => x.venue === 'bf').length,1);
  const b = c('bar-bf','bar','bf',[shared,s2,bfOnly],2,0);
  assert.equal(buildQuizTicket(b).filter((x) => x.venue === 'bf').length,0);
});
test('default quota null requires no general questions; archived exclusion fails closed', () => {
  const bf2 = q('bf-other','bar','bf');
  const ticket = c('bf-only','bar','bf',[bfOnly,bf2],2,null);
  assert.equal(buildQuizTicket(validateQuestionBank(bank([ticket])).categories[0]).length,2);
  assert.throws(() => validateQuestionBank(bank([c('archive-effect','bar','bf',[bfOnly],2)])), /capacity/);
});
test('duplicate group keys across topics are not selected twice', () => {
  const a = q('one','bar','bf','A','same');
  const b = q('two','bar','bf','B','same');
  const d = q('three','bar','bf','B','different');
  const ticket = c('bf','bar','bf',[a,b,d]);
  ticket.ticketPlan = [{topic:'A',count:1},{topic:'B',count:1}];
  const built = buildQuizTicket(ticket);
  assert.equal(new Set(built.map((x) => x.group)).size,2);
});
test('old bank cannot be silently used as a v3 offline bank', () => {
  assert.throws(() => validateQuestionBank({...bank([c('bf','bar','bf',[shared,bfOnly])]),schemaVersion:2}), /cache_incompatible/);
});
test('snapshot mismatch across shared source IDs is rejected', () => {
  const changed = {...shared,q:'Изменённый текст'};
  assert.throws(() => validateQuestionBank(bank([
    c('bf','bar','bf',[shared,bfOnly]),c('bb','bar','bb',[changed,bbOnly])
  ])), /shared_question_mismatch/);
});
test('SQL keeps legacy attempt table untouched and server-side admin guards', () => {
  for (const name of ['save_attestation_question_v3','set_attestation_question_status_v3',
    'save_attestation_category_v3','save_attestation_editor_settings_v3',
    'set_attestation_category_status_v3']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`));
  }
  assert.ok((sql.match(/if not private\.attestation_is_admin\(\)/g)||[]).length >= 5);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.quiz_attempts/i);
  assert.match(sql, /q\.knowledge_type=c\.knowledge_type/);
  assert.match(sql, /q\.venue='common'/);
});

test('offline outbox keeps idempotent attempt IDs and preserves submissions after bank schema upgrade', { skip: !fs.existsSync(path.join(root, 'src/features/attestation/attestation-offline.ts')) }, async () => {
  const offlineSource = fs.readFileSync(path.join(root, 'src/features/attestation/attestation-offline.ts'), 'utf8');
  const offlineOutput = ts.transpileModule(offlineSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText;
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  const out = {};
  vm.runInNewContext(offlineOutput, { exports: out, require: () => { throw new Error('unexpected runtime import'); },
    indexedDB: undefined, localStorage, Date, Promise, Map, Set, Error, JSON },
  { filename: 'attestation-offline.transpiled.cjs' });
  const entry = { clientAttemptId:'attempt-123', userId:'user-1', result:{ categoryId:'bar-bf' },queuedAt:'2026-10-12T12:00:00Z' };
  await out.enqueueAttestationAttempt(entry);
  await out.enqueueAttestationAttempt({...entry,queuedAt:'2026-10-12T12:01:00Z'});
  const before = await out.listPendingAttestationAttempts('user-1');
  assert.equal(before.length,1);
  assert.equal(before[0].result.categoryId,'bar-bf');
  assert.equal((await out.listPendingAttestationAttempts('user-2')).length,0);
  await out.removePendingAttestationAttempt('attempt-123');
  assert.equal((await out.listPendingAttestationAttempts('user-1')).length,0);
});

// Isolate randomness from the host and bound synchronous searches in the VM.
function ticketRuntime(random = () => 1 - Number.EPSILON) {
  const context = vm.createContext({ exports: {}, require: fakeRequire,
    Math: Object.assign(Object.create(Math), { random }) });
  vm.runInContext(output, context);
  return {
    build(category) {
      context.category = category;
      return vm.runInContext('exports.buildQuizTicket(category)', context, { timeout: 1000 });
    },
    validate(value) {
      context.bankValue = value;
      return vm.runInContext('exports.validateQuestionBank(bankValue)', context, { timeout: 1000 });
    }
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function assertTicket(category, ticket) {
  assert.equal(ticket.length, category.questionsPerTest);
  assert.equal(new Set(ticket.map((question) => question.group)).size, ticket.length);
  assert.equal(new Set(ticket.map((question) => question.id)).size, ticket.length);
  for (const part of category.ticketPlan) {
    assert.equal(ticket.filter((question) => question.topic === part.topic).length, part.count);
  }
  if (category.specificQuestionCount !== null) {
    assert.equal(ticket.filter((question) => question.venue !== 'common').length, category.specificQuestionCount);
  }
  for (const question of ticket) {
    const original = category.questions.find((candidate) => candidate.id === question.id);
    assert.ok(original, `unexpected question ${question.id}`);
    assert.notEqual(question, original);
    assert.notEqual(question.answers, original.answers);
    assert.equal(question.answers.filter((answer) => answer.correct).length, 1);
    assert.deepEqual(new Set(question.answers.map((answer) => JSON.stringify(answer))),
      new Set(original.answers.map((answer) => JSON.stringify(answer))));
  }
}

test('valid topic-constrained quota no longer exhausts the old 150000 permutation limit', () => {
  // With no shuffle, the old DFS enumerates venue-only choices in A before
  // learning that B must consume eight of the nine specific slots.
  const questions = [
    ...Array.from({ length: 9 }, (_, i) => q(`A-specific-${i}`, 'bar', 'bf', 'A')),
    ...Array.from({ length: 8 }, (_, i) => q(`A-common-${i}`, 'bar', 'common', 'A')),
    ...Array.from({ length: 18 }, (_, i) => q(`B-specific-${i}`, 'bar', 'bf', 'B'))
  ];
  const category = c('large-valid', 'bar', 'bf', questions, 16, 9);
  category.ticketPlan = [{ topic: 'A', count: 8 }, { topic: 'B', count: 8 }];
  const runtime = ticketRuntime();
  runtime.validate(bank([category]));
  assertTicket(category, runtime.build(category));
});

test('impossible topic quota is rejected before the old factorial search starts', () => {
  const category = c('large-impossible', 'bar', 'bf', [
    ...Array.from({ length: 9 }, (_, i) => q(`forced-${i}`, 'bar', 'bf', 'A')),
    ...Array.from({ length: 10 }, (_, i) => q(`common-${i}`, 'bar', 'common', 'B'))
  ], 16, 7);
  category.ticketPlan = [{ topic: 'A', count: 8 }, { topic: 'B', count: 8 }];
  // Global pools have nine specific and ten common groups, yet topic A
  // forces at least eight specific questions.
  const runtime = ticketRuntime(() => { throw new Error('randomness must not be needed'); });
  assert.throws(() => runtime.validate(bank([category])), /question_bank_quota_capacity:large-impossible/);
  assert.throws(() => runtime.build(category), /^Error: attestation_ticket_capacity$/);
  category.specificQuestionCount = 9;
  assert.throws(() => runtime.validate(bank([category])), /question_bank_quota_capacity/);
});

test('quota ranges ignore plentiful questions in topics outside the plan', () => {
  const category = c('unplanned', 'bar', 'bf', [
    q('planned-one', 'bar', 'common'), q('planned-two', 'bar', 'common'),
    ...Array.from({ length: 30 }, (_, i) => q(`unplanned-${i}`, 'bar', 'bf', 'Outside'))
  ], 2, 1);
  assert.throws(() => validateQuestionBank(bank([category])), /question_bank_quota_capacity/);
  assert.throws(() => buildQuizTicket(category), /attestation_ticket_capacity/);
});

test('overlapping common and specific variants provide one group slot', () => {
  const runtime = ticketRuntime(seededRandom(101));
  const questions = Array.from({ length: 3 }, (_, i) => [
    q(`mixed-common-${i}`, 'bar', 'common', 'Основы', `mixed-${i}`),
    q(`mixed-specific-${i}`, 'bar', 'bf', 'Основы', `mixed-${i}`)
  ]).flat();
  for (let quota = 0; quota <= 3; quota += 1) {
    const category = c('mixed', 'bar', 'bf', questions, 3, quota);
    runtime.validate(bank([category]));
    assertTicket(category, runtime.build(category));
  }
  const tooFew = c('mixed-capacity', 'bar', 'bf', questions.slice(0, 2), 2, 1);
  assert.throws(() => runtime.validate(bank([tooFew])), /question_bank_ticket_capacity/);
  assert.throws(() => runtime.build(tooFew), /attestation_ticket_capacity/);
});

test('all small common-only, specific-only and mixed group partitions satisfy their exact range', () => {
  const runtimes = [ticketRuntime(() => 0), ticketRuntime(), ticketRuntime(seededRandom(2026))];
  for (let common = 0; common <= 3; common += 1) {
    for (let specific = 0; specific <= 3; specific += 1) {
      for (let mixed = 0; mixed <= 3; mixed += 1) {
        const questions = [
          ...Array.from({ length: common }, (_, i) => q(`c-${i}`, 'bar', 'common')),
          ...Array.from({ length: specific }, (_, i) => q(`s-${i}`, 'bar', 'bf')),
          ...Array.from({ length: mixed }, (_, i) => [
            q(`mc-${i}`, 'bar', 'common', 'Основы', `m-${i}`),
            q(`ms-${i}`, 'bar', 'bf', 'Основы', `m-${i}`)
          ]).flat()
        ];
        for (let count = 1; count <= Math.min(4, common + specific + mixed); count += 1) {
          for (let quota = 0; quota <= count; quota += 1) {
            const category = c('partitions', 'bar', 'bf', questions, count, quota);
            const possible = possibleTicket(category, quota);
            for (const runtime of runtimes) {
              if (possible) assertTicket(category, runtime.build(category));
              else assert.throws(() => runtime.build(category), /attestation_ticket_capacity/);
            }
          }
        }
      }
    }
  }
});

test('large pools build fifty-question tickets with quota endpoints and varied topic allocations', () => {
  const topics = ['A', 'B', 'C', 'D', 'E'];
  const questions = topics.flatMap((topic) => Array.from({ length: 120 }, (_, i) => {
    const group = `${topic}-group-${i}`;
    const venues = i < 40 ? ['common'] : i < 80 ? ['bf'] : ['common', 'bf'];
    return venues.flatMap((venue) => Array.from({ length: 3 }, (_, variant) =>
      q(`${group}-${venue}-${variant}`, 'bar', venue, topic, group)));
  }).flat());
  const category = c('maximum-ticket', 'bar', 'bf', questions, 50);
  category.ticketPlan = topics.map((topic) => ({ topic, count: 10 }));
  const before = JSON.stringify(category);
  for (let seed = 1; seed <= 5; seed += 1) {
    const runtime = ticketRuntime(seededRandom(seed));
    for (const quota of [null, 0, 1, 25, 49, 50]) {
      category.specificQuestionCount = quota;
      runtime.validate(bank([category]));
      assertTicket(category, runtime.build(category));
    }
  }
  category.specificQuestionCount = null;
  assert.equal(JSON.stringify(category), before);
});

test('sampling reaches alternative unique groups and both overlapping venue variants', () => {
  const questions = Array.from({ length: 5 }, (_, i) => [
    q(`choice-common-${i}`, 'bar', 'common', 'Основы', `choice-${i}`),
    q(`choice-specific-${i}`, 'bar', 'bf', 'Основы', `choice-${i}`)
  ]).flat();
  const category = c('sampling', 'bar', 'bf', questions, 2, 1);
  const seen = new Set();
  const runtime = ticketRuntime(seededRandom(42));
  for (let i = 0; i < 80; i += 1) {
    const ticket = runtime.build(category);
    assertTicket(category, ticket);
    for (const question of ticket) seen.add(question.id);
  }
  assert.equal(seen.size, questions.length);
});

test('built tickets copy questions and answers without mutating frozen bank snapshots', () => {
  const category = c('frozen', 'bar', 'bf', [shared, bfOnly], 2, 1);
  const freeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  // Clone fixtures before freezing so other tests keep their own mutable inputs.
  const frozen = freeze(JSON.parse(JSON.stringify(category)));
  const before = JSON.stringify(frozen);
  const ticket = buildQuizTicket(frozen);
  assertTicket(frozen, ticket);
  ticket[0].q = 'Edited copy';
  ticket[0].answers[0].text = 'Edited answer';
  assert.equal(JSON.stringify(frozen), before);
});

test('cross-topic fallback preserves exact quotas without permuting identical topic slots', () => {
  const category = c('cross-large', 'bar', 'bf', [
    ...Array.from({ length: 9 }, (_, i) => q(`A-${i}`, 'bar', 'common', 'A', `g-${i}`)),
    q('B-shared', 'bar', 'bf', 'B', 'g-0'),
    ...Array.from({ length: 19 }, (_, i) => q(`B-${i}`, 'bar', 'common', 'B'))
  ], 9, 1);
  category.ticketPlan = [{ topic: 'A', count: 8 }, { topic: 'B', count: 1 }];
  const runtime = ticketRuntime();
  runtime.validate(bank([category]));
  const ticket = runtime.build(category);
  assertTicket(category, ticket);
  assert.ok(ticket.some((question) => question.id === 'B-shared'));
  assert.ok(!ticket.some((question) => question.id === 'A-0'));
});

test('global cross-topic selection is rejected even when individual and total capacities pass', () => {
  const category = c('hall-conflict', 'bar', 'bf', [
    q('Ax', 'bar', 'common', 'A', 'x'), q('Ay', 'bar', 'common', 'A', 'y'),
    q('Bx', 'bar', 'common', 'B', 'x'), q('By', 'bar', 'common', 'B', 'y'),
    ...['z', 'u', 'v'].map((group) => q(`C${group}`, 'bar', 'common', 'C', group))
  ], 4, null);
  category.ticketPlan = [{ topic: 'A', count: 2 }, { topic: 'B', count: 1 }, { topic: 'C', count: 1 }];
  const runtime = ticketRuntime(() => { throw new Error('validation must be deterministic'); });
  assert.throws(() => runtime.validate(bank([category])), /question_bank_ticket_capacity:hall-conflict:groups/);
  assert.throws(() => buildQuizTicket(category), /attestation_ticket_capacity/);
});

test('cross-topic quotas can have gaps inside their per-topic min/max range', () => {
  const category = c('quota-gap', 'bar', 'bf', [
    q('Ax', 'bar', 'common', 'A', 'x'), q('Ay', 'bar', 'bf', 'A', 'y'),
    q('Bx', 'bar', 'bf', 'B', 'x'), q('By', 'bar', 'common', 'B', 'y')
  ], 2, null);
  category.ticketPlan = [{ topic: 'A', count: 1 }, { topic: 'B', count: 1 }];
  const runtime = ticketRuntime(seededRandom(9));
  for (const quota of [null, 0, 2]) {
    category.specificQuestionCount = quota;
    runtime.validate(bank([category]));
    assertTicket(category, runtime.build(category));
  }
  category.specificQuestionCount = 1;
  assert.throws(() => runtime.validate(bank([category])), /question_bank_quota_capacity:quota-gap/);
  assert.throws(() => runtime.build(category), /attestation_ticket_capacity/);
});

// Independent exhaustive oracle for small banks; it deliberately works in
// question slots rather than using production capacity formulas or grouping.
function possibleTicket(category, quota) {
  const slots = category.ticketPlan.flatMap((part) => Array(part.count).fill(part.topic));
  const used = new Set();
  function search(index, specific) {
    if (index === slots.length) return quota === null || specific === quota;
    for (const question of category.questions) {
      if (question.topic !== slots[index] || used.has(question.group)) continue;
      used.add(question.group);
      if (search(index + 1, specific + Number(question.venue !== 'common'))) return true;
      used.delete(question.group);
    }
    return false;
  }
  return search(0, 0);
}

test('selection and bank validation agree with exhaustive search on small cross-topic banks', () => {
  const random = seededRandom(12345);
  const runtime = ticketRuntime(seededRandom(456));
  for (let sample = 0; sample < 100; sample += 1) {
    const plan = ['A', 'B', 'C'].map((topic) => ({ topic, count: random() < 0.25 ? 2 : 1 }));
    const questions = plan.flatMap(({ topic }) => Array.from({ length: 5 }, (_, i) => {
      const mask = Math.floor(random() * 4);
      return ['common', 'bf'].flatMap((venue, bit) => mask & (1 << bit)
        ? [q(`${topic}-${i}-${venue}`, 'bar', venue, topic, `group-${i}`)] : []);
    }).flat());
    const count = plan.reduce((total, part) => total + part.count, 0);
    const category = c(`oracle-${sample}`, 'bar', 'bf', questions, count);
    category.ticketPlan = plan;
    for (const quota of [null, ...Array.from({ length: count + 1 }, (_, i) => i)]) {
      category.specificQuestionCount = quota;
      const possible = possibleTicket(category, quota);
      if (possible) {
        runtime.validate(bank([category]));
        assertTicket(category, runtime.build(category));
      } else {
        assert.throws(() => runtime.validate(bank([category])), /question_bank_(ticket|quota)_capacity/);
        assert.throws(() => runtime.build(category), /attestation_ticket_capacity/);
      }
    }
  }
});

test('validation rejects coerced settings, malformed structural fields and blank identifiers', () => {
  const validCategory = () => c('types', 'bar', 'bf', [
    q('types-common', 'bar', 'common'), q('types-specific', 'bar', 'bf')
  ]);
  for (const [field, values] of [
    ['passPercent', ['80', true, null, {}, NaN, Infinity]],
    ['questionsPerTest', ['2', true, null, {}, NaN, Infinity]],
    ['revision', ['1', 0, -1, 1.5]], ['generatedAt', [5, {}, []]]
  ]) {
    for (const value of values) {
      assert.throws(() => validateQuestionBank({ ...bank([validCategory()]), [field]: value }),
        /question_bank_settings_invalid/, `bank ${field}: ${String(value)}`);
    }
  }
  for (const [field, values] of [
    ['id', [17, {}, [], ' \t ']], ['label', [17, {}, [], ' \n ']],
    ['knowledgeType', [['bar'], {}, 'unknown']], ['venue', [['bf'], {}, 'unknown']],
    ['questionsPerTest', ['2', true, 0, 51]], ['specificQuestionCount', ['1', true, undefined, -1, 3]]
  ]) {
    for (const value of values) {
      assert.throws(() => validateQuestionBank(bank([{ ...validCategory(), [field]: value }])),
        /question_bank_(category|quota)_invalid/, `category ${field}: ${String(value)}`);
    }
  }
  for (const part of [null, [], { topic: 17, count: 2 }, { topic: {}, count: 2 },
    { topic: ' \t ', count: 2 }, { topic: 'Основы', count: '2' }, { topic: 'Основы', count: true }]) {
    assert.throws(() => validateQuestionBank(bank([{ ...validCategory(), ticketPlan: [part] }])),
      /question_bank_ticket_invalid/);
  }
  for (const [field, value] of [
    ['id', ' \t '], ['group', '\n '], ['topic', '  '], ['knowledgeType', ['bar']], ['venue', ['common']],
    ['source', {}], ['sourceRef', []], ['reviewUrl', 123], ['reviewLabel', true],
    ['reviewNote', {}], ['subcategory', 5], ['revision', '1']
  ]) {
    const category = validCategory();
    category.questions[0][field] = value;
    assert.throws(() => validateQuestionBank(bank([category])), /question_bank_question_invalid/,
      `question ${field}: ${String(value)}`);
  }
  const sparse = validCategory();
  delete sparse.questions[0].answers[2];
  assert.throws(() => validateQuestionBank(bank([sparse])), /question_bank_question_invalid/);
  assert.throws(() => validateQuestionBank(Object.assign([], bank([validCategory()]))), /question_bank_invalid/);
  assert.throws(() => validateQuestionBank(bank([Object.assign([], validCategory())])), /question_bank_category_invalid/);
  const arrayQuestion = validCategory();
  arrayQuestion.questions[0] = Object.assign([], arrayQuestion.questions[0]);
  assert.throws(() => validateQuestionBank(bank([arrayQuestion])), /question_bank_question_invalid/);
});

test('validation preserves nonblank key spelling and accepts nullable RPC metadata', () => {
  const topic = ' Topic ';
  const question = { ...q(' spaced-id ', 'bar', 'common', topic, ' spaced-group '),
    source: null, sourceRef: null, reviewUrl: null, reviewLabel: null, reviewNote: null, subcategory: null };
  const category = c(' spaced-category ', 'bar', 'common', [question], 1, 0);
  category.ticketPlan = [{ topic, count: 1 }];
  const value = bank([category]);
  const before = JSON.stringify(value);
  assert.equal(validateQuestionBank(value), value);
  assertTicket(category, buildQuizTicket(category));
  assert.equal(JSON.stringify(value), before);
});

test('shared snapshot signatures ignore property order and absent nullable text', () => {
  const reordered = Object.fromEntries(Object.entries(shared).reverse());
  reordered.answers = shared.answers.map((answer) => ({ correct: answer.correct, text: answer.text }));
  reordered.source = null;
  const runtime = ticketRuntime(() => { throw new Error('validation must not sample'); });
  const value = bank([c('signature-bf', 'bar', 'bf', [shared, bfOnly]),
    c('signature-bb', 'bar', 'bb', [reordered, bbOnly])]);
  assert.equal(runtime.validate(value), value);
});

test('shared snapshot signatures still reject changes to content and review metadata', () => {
  for (const patch of [
    { q: 'Different question' }, { group: 'different-group' }, { topic: 'Different topic' },
    { source: 'Different source' }, { sourceRef: 'different-reference' }, { reviewUrl: '#/menu/other' },
    { reviewLabel: 'Different label' }, { reviewNote: 'Different note' }, { subcategory: 'Different subcategory' },
    { revision: 2 }, { answers: shared.answers.map((answer, i) => ({ ...answer, correct: i === 2 })) }
  ]) {
    const changed = { ...shared, ...patch };
    assert.throws(() => validateQuestionBank(bank([
      c('changed-bf', 'bar', 'bf', [shared, bfOnly]), c('changed-bb', 'bar', 'bb', [changed, bbOnly])
    ])), /question_bank_shared_question_mismatch/);
  }
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function versionedBank(version) {
  return { ...bank([c(`bank-${version}`, 'bar', 'bf', [
    q(`common-${version}`, 'bar', 'common'), q(`specific-${version}`, 'bar', 'bf')
  ])]), revision: version };
}

function bankLoader({ readDisk = async () => null, writeDisk = async () => {} } = {}) {
  const requests = [], writes = [];
  let reads = 0;
  const context = vm.createContext({ exports: {}, require: (id) => {
    if (id === '@/lib/supabase') return { supabase: { rpc: (name) => {
      assert.equal(name, 'get_attestation_bank_v3');
      const request = deferred();
      requests.push(request);
      return request.promise;
    } } };
    if (id === '@/features/attestation/attestation-offline') return {
      cacheAttestationBank: async (value) => { writes.push(value); await writeDisk(value); },
      readCachedAttestationBank: async () => { reads += 1; return readDisk(); }
    };
    throw new Error(`Unexpected import ${id}`);
  } });
  vm.runInContext(output, context);
  return { ...context.exports, requests, writes, get reads() { return reads; } };
}

async function flushUntil(predicate) {
  for (let i = 0; i < 30 && !predicate(); i += 1) await Promise.resolve();
  assert.ok(predicate(), 'expected pending async work to advance');
}

test('normal, forced and warm bank loads coalesce their active online refresh', async () => {
  const runtime = bankLoader();
  const initial = versionedBank(1);
  const pending = [runtime.loadQuestionBank(), runtime.loadQuestionBank({ force: true }),
    runtime.warmAttestationBank(), runtime.loadQuestionBank({ force: true })];
  assert.equal(runtime.requests.length, 1);
  runtime.requests[0].resolve({ data: initial, error: null });
  for (const result of await Promise.all(pending)) assert.equal(result, initial);
  assert.equal(await runtime.loadQuestionBank(), initial);
  assert.equal(runtime.requests.length, 1);

  const latest = versionedBank(2);
  const refresh = [runtime.warmAttestationBank(), runtime.loadQuestionBank({ force: true }),
    runtime.loadQuestionBank({ force: true })];
  assert.equal(runtime.requests.length, 2);
  runtime.requests[1].resolve({ data: latest, error: null });
  for (const result of await Promise.all(refresh)) assert.equal(result, latest);
  assert.equal(await runtime.loadQuestionBank(), latest);
});

test('invalidateQuestionBank clears memory without touching disk or existing attempt snapshots', async () => {
  const old = versionedBank(1);
  let disk = null;
  const runtime = bankLoader({ readDisk: async () => ({ bank: disk }), writeDisk: async (value) => { disk = value; } });
  const load = runtime.loadQuestionBank();
  runtime.requests[0].resolve({ data: old, error: null });
  const snapshot = await load;
  const before = JSON.stringify(snapshot);
  await flushUntil(() => disk === old);
  const writeCount = runtime.writes.length;
  assert.equal(typeof runtime.invalidateQuestionBank, 'function');
  runtime.invalidateQuestionBank();
  assert.equal(disk, old);
  assert.equal(runtime.reads, 0);
  assert.equal(runtime.writes.length, writeCount);
  assert.equal(JSON.stringify(snapshot), before);
  const refresh = runtime.loadQuestionBank();
  assert.equal(runtime.requests.length, 2);
  const latest = versionedBank(2);
  runtime.requests[1].resolve({ data: latest, error: null });
  assert.equal(await refresh, latest);
  assert.equal(JSON.stringify(snapshot), before);
});

test('invalidated responses and their cleanup cannot overwrite or detach the latest refresh', async () => {
  for (const olderFirst of [true, false]) {
    const runtime = bankLoader();
    const old = versionedBank(1), latest = versionedBank(2);
    const oldLoad = runtime.loadQuestionBank();
    const oldWarm = runtime.warmAttestationBank();
    runtime.invalidateQuestionBank();
    const newLoad = runtime.loadQuestionBank({ force: true });
    const newWarm = runtime.warmAttestationBank();
    assert.equal(runtime.requests.length, 2);
    if (olderFirst) {
      runtime.requests[0].resolve({ data: old, error: null });
      assert.equal(await oldLoad, old);
      assert.equal(await oldWarm, old);
      const anotherLoad = runtime.loadQuestionBank({ force: true });
      assert.equal(runtime.requests.length, 2);
      runtime.requests[1].resolve({ data: latest, error: null });
      assert.equal(await anotherLoad, latest);
    } else {
      runtime.requests[1].resolve({ data: latest, error: null });
      assert.equal(await newLoad, latest);
      runtime.requests[0].resolve({ data: old, error: null });
      assert.equal(await oldLoad, old);
      assert.equal(await oldWarm, old);
    }
    assert.equal(await newLoad, latest);
    assert.equal(await newWarm, latest);
    assert.equal(await runtime.loadQuestionBank(), latest);
    await flushUntil(() => runtime.writes.length === 1);
    assert.equal(runtime.writes[0], latest);
  }
});

test('failed coalesced loads share offline fallback while warm remains online-only', async () => {
  const cached = versionedBank(1), read = deferred();
  const runtime = bankLoader({ readDisk: () => read.promise });
  const first = runtime.loadQuestionBank();
  const warm = runtime.warmAttestationBank();
  const force = runtime.loadQuestionBank({ force: true });
  runtime.requests[0].resolve({ data: null, error: new Error('offline') });
  assert.equal(await warm, null);
  await flushUntil(() => runtime.reads === 1);
  const duringFallback = runtime.loadQuestionBank({ force: true });
  assert.equal(runtime.requests.length, 1);
  read.resolve({ bank: cached });
  for (const result of await Promise.all([first, force, duringFallback])) assert.equal(result, cached);
  assert.equal(await runtime.loadQuestionBank(), cached);
  assert.equal(runtime.reads, 1);
  assert.equal(runtime.writes.length, 0);
});

test('slow cached fallback from an invalidated load cannot replace newer online data', async () => {
  const read = deferred(), old = versionedBank(1), latest = versionedBank(2);
  const runtime = bankLoader({ readDisk: () => read.promise });
  const oldLoad = runtime.loadQuestionBank();
  runtime.requests[0].resolve({ data: null, error: new Error('offline') });
  await flushUntil(() => runtime.reads === 1);
  runtime.invalidateQuestionBank();
  const newLoad = runtime.loadQuestionBank();
  runtime.requests[1].resolve({ data: latest, error: null });
  assert.equal(await newLoad, latest);
  read.resolve({ bank: old });
  assert.equal(await oldLoad, old);
  assert.equal(await runtime.loadQuestionBank(), latest);
});

test('slow offline cache writes finish in snapshot order and invalidation never deletes them', async () => {
  const pendingWrites = [];
  let disk = null;
  const runtime = bankLoader({ writeDisk: async (value) => {
    const done = deferred();
    pendingWrites.push(done);
    await done.promise;
    disk = value;
  } });
  const old = versionedBank(1), latest = versionedBank(2);
  const warm = runtime.warmAttestationBank();
  runtime.requests[0].resolve({ data: old, error: null });
  assert.equal(await warm, old);
  await flushUntil(() => pendingWrites.length === 1);
  runtime.invalidateQuestionBank();
  const load = runtime.loadQuestionBank({ force: true });
  runtime.requests[1].resolve({ data: latest, error: null });
  assert.equal(await load, latest);
  assert.equal(pendingWrites.length, 1);
  pendingWrites[0].resolve();
  await flushUntil(() => pendingWrites.length === 2);
  assert.equal(disk, old);
  pendingWrites[1].resolve();
  await flushUntil(() => disk === latest);
  runtime.invalidateQuestionBank();
  assert.equal(disk, latest);
  assert.equal(runtime.writes.length, 2);
});
