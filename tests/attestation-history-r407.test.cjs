const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the shipped module, replacing only its transport and device queue.
const filename = path.resolve(__dirname, '../src/features/attestation/attestation-history.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
const attemptId = '00000000-0000-4000-8000-000000000001';

function question(id = 'q1') {
  return { id, q: `Original ${id}?`, group: id, topic: 'Основы', knowledgeType: 'bar', venue: 'common', revision: 3,
    source: 'knowledge', sourceRef: 'lesson-1', reviewUrl: '#/knowledge/lesson-1', reviewLabel: 'Открыть статью',
    // This is the saved shuffle, so the correct answer is deliberately third.
    answers: ['Wrong A', 'Wrong B', 'Correct', 'Wrong C'].map((text, index) => ({ text, correct: index === 2 })) };
}
function row(overrides = {}) {
  return { id: attemptId, user_id: 'A', category: 'Бар', category_id: 'bar', total_questions: 2,
    correct_answers: 1, score: 50, passed: false, started_at: '2026-10-30T10:00:00Z',
    finished_at: '2026-10-30T10:01:30Z', created_at: '2026-10-30T10:01:31Z',
    category_results: { pass_percent: 80, attempt_snapshot: { schemaVersion: 1, questions: [question('q1'), question('q2')], answers: [2, 0] } }, ...overrides };
}
function harness(options = {}) {
  const auth = { userId: 'A' }, calls = [], storage = new Map(), pending = [];
  const exports = {};
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    eq(...value) { calls.push(['eq', ...value]); return this; },
    order(...value) { calls.push(['order', ...value]); return this; },
    limit(value) { calls.push(['limit', value]); return this; },
    maybeSingle() { calls.push(['maybeSingle']); return options.read ? options.read(auth) : Promise.resolve({ data: row(), error: null }); },
    then(resolve, reject) { return Promise.resolve(options.rows || { data: [row()], error: null }).then(resolve, reject); }
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: auth.userId ? { user: { id: auth.userId } } : null }, error: null }) },
    from(name) { calls.push(['from', name]); return query; },
    rpc: async (name, value) => { calls.push(['rpc', name, plain(value)]); return { data: { id: attemptId }, error: null }; }
  };
  vm.runInNewContext(compiled, { exports, require: id => {
    if (id === '@/lib/supabase') return { supabase };
    if (id === '@/features/attestation/attestation-offline') return {
      listPendingAttestationAttempts: async userId => pending.filter(item => item.userId === userId),
      enqueueAttestationAttempt: async item => { pending.push(plain(item)); },
      removePendingAttestationAttempt: async id => { const i = pending.findIndex(item => item.clientAttemptId === id); if (i >= 0) pending.splice(i, 1); }
    };
    throw new Error(`Unexpected import ${id}`);
  }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
  crypto: { randomUUID: () => attemptId }, Map, Set, Date, Number, String, Math, JSON, Promise, Error, Uint8Array });
  return { api: exports, auth, calls, storage, pending };
}

test('saved detail retains its shuffled answer order and exact review source without reading the current bank', async () => {
  const h = harness(), detail = await h.api.getQuizAttemptDetail(attemptId, 'A');
  assert.equal(detail.result.questions[0].answers[2].text, 'Correct');
  assert.deepEqual(plain(detail.result.answers), [2, 0]);
  assert.equal(detail.result.questions[0].reviewUrl, '#/knowledge/lesson-1');
  assert.deepEqual(plain(detail.result.topicResults), { 'Основы': { total: 2, correct: 1 } });
  assert.equal(h.calls.filter(call => call[0] === 'rpc').length, 0);
  assert.deepEqual(h.calls.find(call => call[0] === 'eq'), ['eq', 'id', attemptId]);
});

test('legacy summary and incomplete snapshots never reconstruct questions from a live bank', () => {
  const { api } = harness();
  for (const category_results of [null, {}, { pass_percent: 80 }, { pass_percent: 80, attempt_snapshot: { schemaVersion: 2, questions: [], answers: [] } }]) {
    assert.equal(api.decodeQuizAttemptSnapshot(row({ category_results })), null);
  }
  const missingAnswer = row(); missingAnswer.category_results.attempt_snapshot.answers.pop();
  assert.equal(api.decodeQuizAttemptSnapshot(missingAnswer), null);
});

test('tampered result arithmetic, pass state and malformed nested data fall back to summary', () => {
  const { api } = harness();
  for (const patch of [{ correct_answers: 2 }, { score: 51 }, { passed: true }, { total_questions: 2.5 }]) {
    assert.equal(api.decodeQuizAttemptSnapshot(row(patch)), null);
  }
  const badRows = [row(), row(), row(), row(), row()];
  badRows[0].category_results.attempt_snapshot.questions[0].reviewUrl = 42;
  badRows[1].category_results.attempt_snapshot.questions[1].id = 'q1';
  badRows[2].category_results.attempt_snapshot.questions[0].answers[0].text = 'Correct';
  badRows[3].category_results.attempt_snapshot.questions[0].answers[0].correct = true;
  badRows[4].category_results.attempt_snapshot.answers[0] = null;
  for (const bad of badRows) assert.equal(api.decodeQuizAttemptSnapshot(bad), null);
});

test('rounded display score never changes the exact pass threshold in history', () => {
  const { api } = harness(), data = row({ total_questions: 3, correct_answers: 2, score: 67, passed: false });
  data.category_results = { pass_percent: 67, attempt_snapshot: { schemaVersion: 1, questions: [question('q1'), question('q2'), question('q3')], answers: [2, 2, 0] } };
  assert.equal(api.decodeQuizAttemptSnapshot(data).passed, false);
  data.passed = true;
  assert.equal(api.decodeQuizAttemptSnapshot(data), null);
});

test('missing or impossible start times stay unknown while a valid completion time is required', () => {
  const { api } = harness();
  for (const started_at of [null, 'invalid', '2027-01-01T00:00:00Z']) {
    assert.equal(api.decodeQuizAttemptSnapshot(row({ started_at })).startedAt, '');
  }
  assert.equal(api.decodeQuizAttemptSnapshot(row({ finished_at: 'invalid' })), null);
});

test('invalid IDs and absent sessions cannot trigger attempt detail reads', async () => {
  const h = harness();
  assert.equal(await h.api.getQuizAttemptDetail('not-an-id', 'A'), null);
  h.auth.userId = null;
  await assert.rejects(h.api.getQuizAttemptDetail(attemptId, 'A'), /attestation_account_changed/);
  assert.equal(h.calls.length, 0);
});

test('RLS denied or hidden detail remains unavailable, without an elevated fallback', async () => {
  const denied = harness({ read: async () => ({ data: null, error: new Error('permission denied') }) });
  await assert.rejects(denied.api.getQuizAttemptDetail(attemptId, 'A'), /permission denied/);
  assert.equal(denied.calls.filter(call => call[0] === 'rpc').length, 0);
  const hidden = harness({ read: async () => ({ data: null, error: null }) });
  assert.equal(await hidden.api.getQuizAttemptDetail(attemptId, 'A'), null);
});

test('a session change while detail is loading cannot expose the returned snapshot', async () => {
  const h = harness({ read: async auth => { auth.userId = 'B'; return { data: row(), error: null }; } });
  await assert.rejects(h.api.getQuizAttemptDetail(attemptId, 'A'), /attestation_account_changed/);
});

test('personal history restricts the table read to its owner and labels device fallback honestly', async () => {
  const online = harness(), loaded = await online.api.getPersonalQuizHistory('A', 999);
  assert.equal(loaded.source, 'profile');
  assert.deepEqual(online.calls.find(call => call[0] === 'eq'), ['eq', 'user_id', 'A']);
  assert.deepEqual(online.calls.find(call => call[0] === 'limit'), ['limit', 100]);
  const offline = harness({ rows: { data: null, error: new Error('offline') } });
  offline.storage.set('bf-learning-r18:A', JSON.stringify({ history: [{ clientAttemptId: attemptId, total: 2, correct: 1, score: 50, passed: false, time: row().finished_at, category: 'Offline' }] }));
  offline.storage.set('bf-learning-r18:B', JSON.stringify({ history: [{ total: 2, correct: 1, score: 50, passed: false, time: row().finished_at, category: 'Other user' }] }));
  const fallback = await offline.api.getPersonalQuizHistory('A');
  assert.equal(fallback.source, 'device');
  assert.deepEqual(plain(fallback.items.map(item => item.category)), ['Offline']);
});

test('submission writes the full immutable snapshot in the existing category_results payload', async () => {
  const h = harness(), snapshot = h.api.decodeQuizAttemptSnapshot(row());
  await h.api.persistQuizResultLocally('A', snapshot);
  await h.api.persistQuizResultRemote('A', snapshot);
  const call = h.calls.find(call => call[0] === 'rpc');
  assert.equal(call[1], 'submit_attestation_attempt');
  assert.deepEqual(call[2].p_category_results.attempt_snapshot, { schemaVersion: 1, questions: plain(snapshot.questions), answers: [2, 0] });
  assert.deepEqual(call[2].p_question_revisions, [{ id: 'q1', revision: 3 }, { id: 'q2', revision: 3 }]);
});
