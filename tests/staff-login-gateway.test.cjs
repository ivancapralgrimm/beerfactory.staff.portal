// Actual Edge handler under mocked Deno/SDK, never a live login or database write.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const dir = path.resolve(__dirname, '../supabase/functions/staff-login');

function load(file, extra = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, {
    exports: module.exports, module, Request, Response, AbortSignal, setTimeout, ...extra,
  });
  return module.exports;
}

function fixture(scoped, employee = [true]) {
  let handler;
  const calls = [];
  const queues = [scoped.slice(), employee.slice()];
  const admin = {
    rpc(name, args) {
      calls.push({ name, args });
      if (name === 'login_rate_limit_allowed') {
        const queue = queues[args.p_limit === 6 ? 0 : 1];
        const value = queue.length > 1 ? queue.shift() : queue[0];
        return { abortSignal(signal) {
          assert.ok(signal instanceof AbortSignal);
          if (value === 'throw') return Promise.reject(new Error('network'));
          return Promise.resolve(typeof value === 'number'
            ? { data: null, error: { message: 'gateway' }, status: value }
            : { data: value, error: null, status: 200 });
        } };
      }
      return Promise.resolve({ data: true, error: null });
    },
    from() {
      calls.push({ name: 'profiles' });
      return {
        select() { return { or() { return { limit: async () => ({ data: [{
          id: 'test-user', first_name: 'Иван', last_name: 'Проверяющий',
          is_active: true, personal_code_hash: 'fixture-hash',
          recovery_code_hash: 'configured', recovery_set_at: '2026-11-03',
        }], error: null }) }; } }; },
        update() { return { eq: async () => ({ error: null }) }; },
      };
    },
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email: 'test@example.invalid' } }, error: null }),
      generateLink: async () => {
        calls.push({ name: 'generateLink' });
        return { data: { properties: { hashed_token: 'fixture' } }, error: null };
      },
    } },
  };
  const auth = { auth: { verifyOtp: async () => ({ data: { session: { access_token: 'fixture' } }, error: null }) } };
  load('index.ts', {
    ...load('name-identity.ts'), ...load('rate-limit.ts'),
    createClient: (_url, key) => key === 'service' ? admin : auth,
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://example.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' })[key] },
      serve: fn => { handler = fn; } },
  });
  return { calls, async run() {
    const response = await handler(new Request('https://example.invalid/staff-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ full_name: 'Иван Проверяющий', first_name: 'Иван', last_name: 'Проверяющий', code: '1234' }),
    }));
    return { status: response.status, body: await response.json() };
  } };
}

for (const [name, sequence, status, error, reads] of [
  ['healthy gate', [true], 200, undefined, 1],
  ['cold gateway 401 recovers inside first login', [401, true], 200, undefined, 2],
  ['temporary 503 recovers', [503, true], 200, undefined, 2],
  ['network failure recovers', ['throw', true], 200, undefined, 2],
  ['actual limit false never retries', [false], 429, 'rate_limited', 1],
  ['recovered gate still enforces a real block', [401, false], 429, 'rate_limited', 2],
  ['persistent 401 stays closed and is not a credential error', [401], 503, 'login_unavailable', 2],
  ['permission failure does not retry', [403], 503, 'login_unavailable', 1],
  ['malformed response never permits login', [null], 503, 'login_unavailable', 1],
]) test(name, async () => {
  const f = fixture(sequence), result = await f.run();
  assert.equal(result.status, status);
  assert.equal(result.body.error, error);
  const gateCalls = f.calls.filter(c => c.name === 'login_rate_limit_allowed');
  assert.equal(gateCalls.filter(c => c.args.p_limit === 6).length, reads);
  assert.equal(gateCalls.filter(c => c.args.p_limit === 30).length, 1);
  assert.equal(f.calls.filter(c => c.name === 'generateLink').length, status === 200 ? 1 : 0);
  assert.equal(f.calls.filter(c => c.name === 'profiles').length, status === 200 ? 2 : 0);
});

test('employee limit blocks even when scoped gateway recovers', async () => {
  const f = fixture([401, true], [false]);
  assert.equal((await f.run()).status, 429);
  assert.equal(f.calls.some(c => c.name === 'generateLink'), false);
});
