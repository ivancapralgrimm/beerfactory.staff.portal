const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const OUTBOX = 'bfstaff-attestation-outbox-fallback-v1';
const BANK = 'bfstaff-attestation-bank-fallback-v1';
const sources = new Map(['attestation-offline.ts', 'attestation-history.ts'].map(name => [
  name, ts.transpileModule(fs.readFileSync(path.join(root, 'src/features/attestation', name), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
  }).outputText
]));
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storage() {
  const values = new Map();
  const controls = { fail: () => false };
  return {
    values, controls,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      if (controls.fail(key)) throw new Error('QuotaExceededError');
      values.set(key, value);
    }
  };
}
function locks() {
  const tails = new Map();
  return { request(name, callback) {
    const pending = (tails.get(name) || Promise.resolve()).then(() => callback({ name }));
    tails.set(name, pending.then(() => undefined, () => undefined));
    return pending;
  } };
}
// A small asynchronous IndexedDB double: requests finish before transactions,
// and storage failures abort the transaction rather than becoming successful puts.
function indexed() {
  const stores = { bank: new Map(), outbox: new Map() };
  const controls = { beforePut: async () => {}, failPut: false, failDelete: false };
  const db = {
    close() {},
    transaction(name) {
      const tx = { error: null };
      function request(operation, mutate = false) {
        const req = {};
        setImmediate(async () => {
          try {
            req.result = await operation();
            req.onsuccess?.();
            setImmediate(() => tx.oncomplete?.());
          } catch (error) {
            req.error = tx.error = error;
            req.onerror?.();
            if (mutate) tx.onabort?.();
            else tx.onerror?.();
          }
        });
        return req;
      }
      tx.objectStore = () => ({
        get: key => request(() => stores[name].get(key)),
        getAll: () => request(() => [...stores[name].values()].map(plain)),
        put: value => request(async () => {
          await controls.beforePut(name, value);
          if (controls.failPut) throw new Error('indexed_write_failed');
          stores[name].set(name === 'bank' ? value.key : value.clientAttemptId, plain(value));
        }, true),
        delete: key => request(() => {
          if (controls.failDelete) throw new Error('indexed_delete_failed');
          stores[name].delete(key);
        }, true)
      });
      return tx;
    }
  };
  return { stores, controls, open() {
    const req = {};
    setImmediate(() => { req.result = db; req.onsuccess(); });
    return req;
  } };
}
function load(name, imports, globals) {
  const exports = {};
  vm.runInNewContext(sources.get(name), {
    exports, require: id => {
      if (!(id in imports)) throw new Error(`Unmocked runtime import: ${id}`);
      return imports[id];
    }, Error, Date, Promise, Map, Set, Math, Number, String, JSON, Uint8Array,
    ...globals
  }, { filename: name });
  return exports;
}
function harness(options = {}) {
  const localStorage = options.storage || storage();
  const auth = options.auth || { userId: 'A' };
  const calls = [];
  const globals = { localStorage, indexedDB: options.indexedDB, navigator: options.navigator };
  const offline = load('attestation-offline.ts', {}, globals);
  const history = load('attestation-history.ts', {
    '@/features/attestation/attestation-offline': offline,
    '@/lib/supabase': { supabase: {
      auth: { getSession: async () => ({
        data: { session: auth.userId ? { user: { id: auth.userId } } : null }, error: null
      }) },
      rpc: async (name, params) => {
        calls.push({ name, params: plain(params), userId: auth.userId });
        if (options.rpc) return options.rpc(name, params, calls);
        return { data: { ok: true }, error: null };
      }
    } }
  }, globals);
  return { offline, history, storage: localStorage, auth, calls };
}
function result(id = '00000000-0000-4000-8000-000000000001', overrides = {}) {
  return {
    clientAttemptId: id, categoryId: 'bar-bf', categoryLabel: 'Bar BF', passPercent: 80,
    questions: [{ id: 'question-1', revision: 7, q: 'Original question', answers: [] }],
    answers: [0], total: 1, correct: 1, score: 100, passed: true,
    startedAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T10:01:00Z',
    topicResults: { Basics: { correct: 1, total: 1 } }, weakTopics: [], ...overrides
  };
}
function entry(r, userId = 'A') {
  return { clientAttemptId: r.clientAttemptId, userId, result: r, queuedAt: r.finishedAt };
}

test('background acknowledgment before direct save never resends the same completed attempt', async () => {
  const h = harness(), r = result();
  assert.equal(await h.history.persistQuizResultLocally('A', r), true);
  assert.equal((await h.history.syncPendingAttestationAttempts('A')).sent, 1);
  await h.history.persistQuizResultRemote('A', r);
  assert.equal(h.calls.filter(call => call.name === 'submit_attestation_attempt').length, 1);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 0);
});

test('local durability waits for storage; immediate remote save cannot resurrect the queue', async () => {
  const db = indexed(), gate = deferred(), entered = deferred();
  let puts = 0;
  db.controls.beforePut = async name => {
    if (name === 'outbox' && ++puts === 1) { entered.resolve(); await gate.promise; }
  };
  const h = harness({ indexedDB: db }), r = result();
  let settled = false;
  const local = h.history.persistQuizResultLocally('A', r).then(value => { settled = true; return value; });
  const remote = h.history.persistQuizResultRemote('A', r);
  await entered.promise;
  try {
    await tick();
    assert.equal(settled, false);
    assert.equal(h.calls.length, 0);
  } finally { gate.resolve(); }
  assert.equal(await local, true);
  await remote;
  assert.equal(h.calls.length, 1);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 0);
});

test('concurrent syncs and a direct save share one upload', async () => {
  const gate = deferred(), entered = deferred();
  const h = harness({ rpc: async () => { entered.resolve(); await gate.promise; return { data: { ok: true }, error: null }; } });
  const r = result();
  await h.history.persistQuizResultLocally('A', r);
  const first = h.history.syncPendingAttestationAttempts('A');
  const second = h.history.syncPendingAttestationAttempts('A');
  assert.equal(first, second);
  await entered.promise;
  const direct = h.history.persistQuizResultRemote('A', r);
  await tick();
  gate.resolve();
  await Promise.all([first, second, direct]);
  assert.equal(h.calls.length, 1);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 0);
});

test('Web Locks prevent two tabs from uploading the same queued attempt', async () => {
  const shared = storage(), navigator = { locks: locks() }, gate = deferred(), entered = deferred();
  let uploads = 0;
  const rpc = async () => { uploads++; entered.resolve(); await gate.promise; return { data: { ok: true }, error: null }; };
  const a = harness({ storage: shared, navigator, rpc }), b = harness({ storage: shared, navigator, rpc });
  await a.offline.enqueueAttestationAttempt(entry(result()));
  const first = a.history.syncPendingAttestationAttempts('A');
  await entered.promise;
  const second = b.history.syncPendingAttestationAttempts('A');
  await tick();
  gate.resolve();
  const outcomes = await Promise.all([first, second]);
  assert.equal(uploads, 1);
  assert.deepEqual(outcomes.map(value => value.pending), [0, 0]);
});

test('mismatched and missing accounts never upload or delete another user queue', async () => {
  const h = harness();
  await h.history.persistQuizResultLocally('A', result());
  for (const userId of ['B', null]) {
    h.auth.userId = userId;
    assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 0, pending: 1 });
    await assert.rejects(h.history.persistQuizResultRemote('A', result()), /attestation_account_changed/);
  }
  assert.equal(h.calls.length, 0);
  assert.equal((await h.offline.listPendingAttestationAttempts('B')).length, 0);
});

test('account change during a batch leaves the remaining attempt for its owner', async () => {
  const gate = deferred(), entered = deferred();
  const h = harness({ rpc: async () => { entered.resolve(); await gate.promise; return { data: { ok: true }, error: null }; } });
  await h.offline.enqueueAttestationAttempt(entry(result('first')));
  await h.offline.enqueueAttestationAttempt(entry(result('second', { finishedAt: '2026-10-12T10:02:00Z' })));
  const sync = h.history.syncPendingAttestationAttempts('A');
  await entered.promise;
  h.auth.userId = 'B';
  gate.resolve();
  assert.deepEqual(plain(await sync), { sent: 1, pending: 1 });
  assert.equal(h.calls.length, 1);
  assert.equal((await h.offline.listPendingAttestationAttempts('A'))[0].clientAttemptId, 'second');
});

test('a lost response retains the same id through reload and an idempotent retry', async () => {
  const shared = storage(), accepted = new Set();
  let loseResponse = true;
  const rpc = async (name, params) => {
    const duplicate = accepted.has(params.p_client_attempt_id);
    accepted.add(params.p_client_attempt_id);
    if (loseResponse) { loseResponse = false; return { data: null, error: new Error('response_lost') }; }
    return { data: { ok: true, duplicate }, error: null };
  };
  const a = harness({ storage: shared, rpc }), r = result(undefined, { clientAttemptId: undefined });
  await assert.rejects(a.history.persistQuizResultRemote('A', r), /response_lost/);
  const b = harness({ storage: shared, rpc });
  assert.deepEqual(plain(await b.history.syncPendingAttestationAttempts('A')), { sent: 1, pending: 0 });
  assert.equal(accepted.size, 1);
  assert.equal(a.calls[0].params.p_client_attempt_id, b.calls[0].params.p_client_attempt_id);
  assert.match(r.clientAttemptId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('failed fallback deletion is reported; retry cleans up without another RPC', async () => {
  const h = harness({ rpc: async () => {
    h.storage.controls.fail = key => key === OUTBOX;
    return { data: { ok: true }, error: null };
  } });
  await assert.rejects(h.history.persistQuizResultRemote('A', result()), error =>
    error.message === 'attestation_ack_cleanup_failed' && error.savedRemotely === true);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 1);
  h.storage.controls.fail = () => false;
  assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 1, pending: 0 });
  assert.equal(h.calls.length, 1);
});

test('failed IndexedDB deletion remains pending and retries local cleanup', async () => {
  const db = indexed(), h = harness({ indexedDB: db });
  db.controls.failDelete = true;
  await assert.rejects(h.history.persistQuizResultRemote('A', result()), /attestation_ack_cleanup_failed/);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 1);
  db.controls.failDelete = false;
  assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 1, pending: 0 });
  assert.equal(h.calls.length, 1);
});

test('fallback outbox preserves more than 200 attempts and separates accounts', async () => {
  const h = harness();
  await Promise.all(Array.from({ length: 205 }, (_, i) =>
    h.offline.enqueueAttestationAttempt(entry(result(`attempt-${i}`), i % 2 ? 'B' : 'A'))));
  const a = await h.offline.listPendingAttestationAttempts('A'), b = await h.offline.listPendingAttestationAttempts('B');
  assert.equal(a.length + b.length, 205);
  assert.equal(a.some(item => item.clientAttemptId === 'attempt-0'), true);
});

test('duplicate copies across IndexedDB and fallback are uploaded and removed once', async () => {
  const db = indexed(), h = harness({ indexedDB: db }), e = entry(result());
  db.stores.outbox.set(e.clientAttemptId, plain(e));
  h.storage.setItem(OUTBOX, JSON.stringify([e]));
  assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 1, pending: 0 });
  assert.equal(h.calls.length, 1);
  assert.equal(db.stores.outbox.size, 0);
  assert.deepEqual(JSON.parse(h.storage.getItem(OUTBOX)), []);
});

test('local history deduplicates retries by id and keeps completion time and learning progress', async () => {
  const h = harness(), r = result();
  h.storage.setItem('bf-learning-r18:A', JSON.stringify({ read: ['lesson-1'], history: [] }));
  await Promise.all([h.history.persistQuizResultLocally('A', r), h.history.persistQuizResultLocally('A', r)]);
  const saved = JSON.parse(h.storage.getItem('bf-learning-r18:A'));
  assert.deepEqual(saved.read, ['lesson-1']);
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].clientAttemptId, r.clientAttemptId);
  assert.equal(saved.history[0].time, r.finishedAt);
});

test('offline history merges pending results with legacy records, deduplicates, sorts and limits', async () => {
  const h = harness({ rpc: async () => ({ data: null, error: new Error('offline') }) });
  h.storage.setItem('bf-learning-r18:A', JSON.stringify({ history: [
    { time: '2026-10-11T09:00:00Z', category: 'Legacy', total: 10, correct: 8, score: 80, passed: true }
  ] }));
  await h.history.persistQuizResultLocally('A', result());
  await h.offline.enqueueAttestationAttempt(entry(result('new', { categoryLabel: 'Newest', finishedAt: '2026-10-12T12:00:00Z' })));
  await h.offline.enqueueAttestationAttempt(entry(result('other-user'), 'B'));
  const all = await h.history.getQuizHistory('A', 10);
  assert.equal(all.source, 'device');
  assert.deepEqual(plain(all.items.map(item => item.category)), ['Newest', 'Bar BF', 'Legacy']);
  assert.equal((await h.history.getQuizHistory('A', 2)).items.length, 2);
});

test('thrown history RPC also falls back to device history', async () => {
  const h = harness({ rpc: async () => { throw new Error('network'); } });
  await h.history.persistQuizResultLocally('A', result());
  const loaded = await h.history.getQuizHistory('A');
  assert.equal(loaded.source, 'device');
  assert.equal(loaded.items.length, 1);
});

test('successful history retains the team RPC semantics and profile source', async () => {
  const h = harness({ rpc: async () => ({ data: [{
    display_name: 'Colleague', category: 'Kitchen BB', category_id: 'kitchen-bb',
    attempted_at: '2026-10-12T12:00:00Z', correct_answers: 8, total_questions: 10, score: 80, passed: true
  }], error: null }) });
  await h.history.persistQuizResultLocally('A', result());
  const loaded = await h.history.getQuizHistory('A');
  assert.equal(loaded.source, 'profile');
  assert.deepEqual(plain(loaded.items.map(item => item.category)), ['Colleague · Kitchen BB']);
  assert.deepEqual(h.calls[0].params, { p_limit: 5 });
});

test('failed durable storage returns false, even when history metadata can be written', async () => {
  const h = harness({ rpc: async () => ({ data: null, error: new Error('offline') }) });
  h.storage.controls.fail = key => key === OUTBOX;
  assert.equal(await h.history.persistQuizResultLocally('A', result()), false);
  assert.equal(JSON.parse(h.storage.getItem('bf-learning-r18:A')).history.length, 1);
  await assert.rejects(h.history.persistQuizResultRemote('A', result()), /offline/);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 0);
});

test('IndexedDB durability succeeds without localStorage; offline history uses the full queue', async () => {
  const db = indexed(), h = harness({ indexedDB: db, rpc: async () => ({ data: null, error: new Error('offline') }) });
  h.storage.controls.fail = () => true;
  assert.equal(await h.history.persistQuizResultLocally('A', result()), true);
  const loaded = await h.history.getQuizHistory('A');
  assert.equal(loaded.source, 'device');
  assert.equal(loaded.items.length, 1);
});

test('v3 fallback supersedes v2 IndexedDB bank without deleting legacy pending attempts', async () => {
  const db = indexed(), h = harness({ indexedDB: db });
  db.stores.bank.set('current', { key: 'current', bank: { schemaVersion: 2 }, savedAt: '2026-10-11T00:00:00Z' });
  const legacy = entry(result());
  db.stores.outbox.set(legacy.clientAttemptId, legacy);
  db.controls.failPut = true;
  await h.offline.cacheAttestationBank({ schemaVersion: 3, revision: 3 });
  assert.equal((await h.offline.readCachedAttestationBank()).bank.schemaVersion, 3);
  assert.equal(JSON.parse(h.storage.getItem(BANK)).bank.schemaVersion, 3);
  assert.equal((await h.offline.listPendingAttestationAttempts('A')).length, 1);
});

test('cache reader chooses the newer v3 copy but never replaces v3 with a v2 fallback', async () => {
  const db = indexed(), h = harness({ indexedDB: db });
  db.stores.bank.set('current', { key: 'current', bank: { schemaVersion: 3, revision: 1 }, savedAt: '2026-10-10T00:00:00Z' });
  h.storage.setItem(BANK, JSON.stringify({ key: 'current', bank: { schemaVersion: 3, revision: 2 }, savedAt: '2026-10-11T00:00:00Z' }));
  assert.equal((await h.offline.readCachedAttestationBank()).bank.revision, 2);
  h.storage.setItem(BANK, JSON.stringify({ key: 'current', bank: { schemaVersion: 2 }, savedAt: '2026-10-12T00:00:00Z' }));
  assert.equal((await h.offline.readCachedAttestationBank()).bank.schemaVersion, 3);
});

test('queued snapshot retains threshold and question revisions despite later object changes', async () => {
  const db = indexed(), h = harness({ indexedDB: db }), r = result();
  const save = h.history.persistQuizResultLocally('A', r);
  r.passPercent = 99;
  r.questions[0].revision = 30;
  r.questions[0].q = 'Edited question';
  await save;
  assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 1, pending: 0 });
  const params = h.calls[0].params;
  assert.equal(params.p_category_results.pass_percent, 80);
  assert.deepEqual(params.p_question_revisions, [{ id: 'question-1', revision: 7 }]);
  assert.equal(params.p_synced_from_offline, true);
  assert.equal(params.p_finished_at, '2026-10-12T10:01:00Z');
});

test('mismatched result and outbox ids fail closed rather than inventing a retry id', async () => {
  const h = harness();
  await h.offline.enqueueAttestationAttempt({ ...entry(result('result-id')), clientAttemptId: 'queue-id' });
  assert.deepEqual(plain(await h.history.syncPendingAttestationAttempts('A')), { sent: 0, pending: 1 });
  assert.equal(h.calls.length, 0);
});

test('anonymous results never create a guest outbox', async () => {
  const h = harness();
  assert.equal(await h.history.persistQuizResultLocally('', result()), false);
  await assert.rejects(h.history.persistQuizResultRemote('', result()), /auth_required/);
  assert.equal(h.storage.values.size, 0);
});
