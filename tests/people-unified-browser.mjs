// Actual app + localhost transport fixtures. No external service or production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4193';
const api = 'http://127.0.0.1:54329';
const results = [], pageErrors = [], unexpectedNetwork = [];
fs.mkdirSync('reports/people', { recursive: true });
const stream = fs.openSync('reports/people/vite.log', 'w');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4193', '--strictPort'], {
  stdio: ['ignore', stream, stream],
  env: { ...process.env, VITE_SUPABASE_URL: api, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture_only', VITE_RECIPE_API_BASE: `${api}/recipes`, VITE_KNOWLEDGE_SOURCE: 'supabase' }
});
fs.closeSync(stream);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function poll(run) { for (let count = 0; count < 100; count++) { if (await run()) return; await pause(100); } throw new Error('Condition did not settle'); }
let browser;
const profile = (overrides = {}) => ({ id: randomUUID(), first_name: 'Тест', last_name: 'Сотрудник', role: 'staff', is_owner: false, is_active: true, position_code: 'waiter_bb', birth_date: '1998-03-17', position_change_allowed: true, position_change_reason: null, recovery_configured: true, ...overrides });
const record = p => ({ created_at: '2026-01-01T00:00:00Z', last_seen_at: null, recovery_set_at: null, position: null, ...p });
async function fixture(p = profile(), options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 390, height: 844 }, serviceWorkers: 'block' });
  const state = { profile: p, users: [], reads: [], writes: [], profileFailure: null, mutationFailure: false, listFailure: false, failListAfterSave: false, historyMissing: false, historyInvalid: false, historyForbidden: false, pushFailure: false, knowledge: false, capabilities: null };
  state.users = [record(p), record(profile({ first_name: 'Светлана', last_name: 'Владелец', role: 'admin', is_owner: true })), record(profile({ first_name: 'Никита', last_name: 'Коллега', role: 'staff' })), record(profile({ first_name: 'Алексей', last_name: 'Прежний', role: 'manager' }))];
  const user = { id: p.id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const part = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: p.id, exp, aud: 'authenticated' })}.fixture`;
  await context.addInitScript(({ auth, push }) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(auth));
    if (!push) return;
    const subscription = { endpoint: 'https://push.example.invalid/device', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'fixture-public', auth: 'fixture-auth' } }; }, async unsubscribe() { localStorage.removeItem('fixture-subscribed'); return true; } };
    const pushManager = { async getSubscription() { return localStorage.getItem('fixture-subscribed') ? subscription : null; }, async subscribe() { localStorage.setItem('fixture-subscribed', '1'); return subscription; } };
    const registration = { pushManager, active: { postMessage() {} } };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration), async getRegistration() { if (localStorage.getItem('fixture-state-failure')) throw new Error('device_failure'); return registration; }, addEventListener() {} } });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    Object.defineProperty(window, 'Notification', { configurable: true, value: class Notification { static get permission() { return localStorage.getItem('fixture-permission') || 'granted'; } static async requestPermission() { return 'granted'; } } });
  }, { auth: { access_token: token, refresh_token: 'fixture', token_type: 'bearer', expires_in: 3600, expires_at: exp, user }, push: options.push || false });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin === base) return route.continue();
    if (url.origin !== api) { unexpectedNetwork.push(url.origin + url.pathname); return route.abort(); }
    const pathname = url.pathname;
    const body = req.postData() ? req.postDataJSON() : {};
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const denied = () => json({ code: 'P0001', message: 'forbidden' }, 403);
    const privileged = state.profile.is_owner || state.profile.role === 'admin';
    state.reads.push({ pathname, method: req.method(), body });
    if (pathname.endsWith('/staff-profile')) {
      if (req.method() === 'PATCH') {
        state.writes.push({ kind: 'profile', body });
        if (state.profileFailure) {
          if (state.profileFailure === 'position_change_next_window') { state.profile.position_change_allowed = false; state.profile.position_change_reason = 'already_changed'; }
          return json({ error: state.profileFailure }, state.profileFailure.startsWith('position_change') ? 409 : 500);
        }
        if ('birth_date' in body) state.profile.birth_date = body.birth_date;
        if ('position_code' in body) { state.profile.position_code = body.position_code; state.profile.position_change_allowed = false; state.profile.position_change_reason = 'already_changed'; }
        return json({ ok: true, profile: state.profile });
      }
      return json({ profile: state.profile });
    }
    if (pathname.endsWith('/staff-admin-users')) {
      if (!privileged) return denied();
      if (req.method() === 'GET') return state.listFailure ? json({ error: 'temporary_failure' }, 500) : json({ users: state.users, me: { id: p.id, is_owner: p.is_owner } });
      state.writes.push({ kind: 'admin', body });
      if (state.mutationFailure) return json({ error: 'update_failed' }, 500);
      const target = state.users.find(person => person.id === body.user_id);
      if (!target) return json({ error: 'user_not_found' }, 404);
      if (target.is_owner && target.id !== p.id) return json({ error: 'owner_protected' }, 403);
      if (body.action === 'set_role') target.role = body.role;
      if (body.action === 'set_position') target.position_code = body.position_code;
      if (body.action === 'set_active') target.is_active = body.is_active;
      if (body.action === 'set_secret') target.recovery_set_at = new Date().toISOString();
      if (body.action === 'delete_user') state.users = state.users.filter(person => person.id !== body.user_id);
      if (state.failListAfterSave) state.listFailure = true;
      return json({ ok: true, audit_recorded: true });
    }
    if (pathname === '/auth/v1/user') return json(user);
    if (pathname.startsWith('/auth/')) return json({});
    if (pathname.endsWith('/handover-push')) return json({ public_key: Buffer.alloc(65,4).toString('base64url') });
    if (pathname.includes('/rest/v1/rpc/')) {
      const rpc = pathname.split('/').pop();
      if (rpc === 'portal_access_context') return json(state.capabilities || { can_manage_staff: privileged, can_view_admin_logs: privileged, can_manage_recipes: privileged || state.profile.role === 'senior', can_manage_attestation_bank: privileged, checklist_positions: privileged || state.profile.role === 'senior' ? ['waiter_bb'] : [] });
      if (rpc === 'get_knowledge_editor_context') return json({ can_read: true, can_create: privileged || state.knowledge, can_edit: privileged || state.knowledge, can_publish: privileged, can_manage_permissions: privileged });
      if (rpc === 'get_own_position_shift_history_v1') {
        if (state.historyMissing) return json({ code: 'PGRST202', message: 'RPC missing' }, 404);
        if (state.historyForbidden) return denied();
        if (!state.profile.position_code) return json({ code: 'P0001', message: 'position_required' }, 400);
        return json([{ id: 'own-shift', shift_date: '2026-10-30', position_code: state.historyInvalid ? '__proto__' : state.profile.position_code, status: 'closed', opened_at: null, closed_at: null, checks: [{ check_type: 'opening', item_key: 'glass', label: 'Подготовить бокалы', completed: true }, { check_type: 'closing', item_key: 'clean', label: 'Убрать рабочее место', completed: false }] }]);
      }
      if (rpc === 'register_push_subscription' || rpc === 'unregister_push_subscription') { state.writes.push({ kind: 'push', rpc, body }); return state.pushFailure ? json({ code: 'XX000', message: 'push_save_failed' }, 500) : json(null); }
      return json([]);
    }
    if (pathname.endsWith('/audit_log')) return privileged ? json([{ id: randomUUID(), actor_id: p.id, action: 'profile_position_update', entity_type: 'profile', entity_id: p.id, entity_name: 'Тест Сотрудник', before_data: { position_code: 'waiter_bb' }, after_data: { position_code: 'bartender_bb' }, metadata: {}, created_at: '2026-10-30T10:00:00Z' }]) : denied();
    if (pathname.endsWith('/quiz_attempts')) return json([{ id: 'attempt', user_id: p.id, category: 'Бар', score: 80, passed: true, total_questions: 10, correct_answers: 8, category_results: { weak_topics: [{ topic: 'Посуда', correct: 0, total: 2 }] }, created_at: '2026-10-30T10:00:00Z', finished_at: '2026-10-30T10:10:00Z' }]);
    unexpectedNetwork.push(pathname);
    return json({ error: 'unexpected_fixture_request' }, 500);
  });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  const go = async path => { await page.goto(`${base}/#${path}`); await page.locator('.bf-account-page').waitFor(); };
  return { page, context, state, go };
}
async function check(name, run) {
  if(process.env.BF_PEOPLE_FILTER&&!name.includes(process.env.BF_PEOPLE_FILTER))return;
  try { await run(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'failed', error: error.stack }); console.error(`FAIL ${name}: ${error.stack}`); for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: 'reports/people/failure.png', fullPage: true }).catch(() => {}); for(const c of browser.contexts())for(const p of c.pages())fs.writeFileSync('reports/people/failure.txt',await p.locator('body').innerText().catch(()=>'')); throw error; }
}
try {
  await poll(async () => { if (server.exitCode !== null) throw new Error('Fixture Vite server failed'); try { return (await fetch(base)).ok; } catch { return false; } });
  browser = await chromium.launch({ executablePath: process.env.BF_TEST_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  await check('Profile: immutable names, dirty failure, confirmed save and reload', async () => {
    const f = await fixture(); await f.go('/profile?view=details');
    assert.equal(await f.page.getByLabel('Имя', { exact: true }).getAttribute('readonly'), '');
    assert.equal(await f.page.getByLabel('Фамилия', { exact: true }).getAttribute('readonly'), '');
    const save = f.page.getByRole('button', { name: 'Сохранить изменения' });
    await poll(() => save.isDisabled());
    await f.page.getByLabel('Дата рождения').fill('1999-04-18');
    await f.page.getByLabel('Рабочая должность').selectOption('bartender_bb');
    f.state.profileFailure = 'temporary_failure'; await save.click();
    await f.page.getByText('Не удалось подтвердить сохранение всех данных. Проверьте поля и повторите попытку.', { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Дата рождения').inputValue(), '1999-04-18');
    assert.equal(await f.page.getByLabel('Рабочая должность').inputValue(), 'bartender_bb');
    assert.equal(await save.isEnabled(), true);
    assert.deepEqual(f.state.writes[0].body, { birth_date: '1999-04-18', position_code: 'bartender_bb' });
    f.state.profileFailure = null; await save.click();
    await f.page.getByText('Личные данные сохранены.', { exact: true }).waitFor(); await poll(() => save.isDisabled());
    assert.equal(await f.page.getByLabel('Рабочая должность').isDisabled(), true);
    assert.equal(await f.page.locator('.bf-profile-facts dd').first().innerText(), 'BeerBistro');
    await f.page.reload(); await f.page.getByRole('heading', { name: 'Личные данные' }).waitFor();
    assert.equal(await f.page.getByLabel('Дата рождения').inputValue(), '1999-04-18');
    assert.equal(await f.page.getByLabel('Рабочая должность').inputValue(), 'bartender_bb');
    assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await f.page.getByLabel('Дата рождения').evaluate(el => getComputedStyle(el).textAlign), 'center');
    await f.page.screenshot({ path: 'reports/people/profile-mobile.png', fullPage: true }); await f.context.close();
  });
  await check('Profile: birthday-only save when position locked and navigation draft guard', async () => {
    const f = await fixture(profile({ position_change_allowed: false, position_change_reason: 'already_changed' })); await f.go('/profile?view=details');
    await f.page.getByLabel('Дата рождения').fill('2000-01-02');
    await f.page.getByRole('button', { name: 'В профиль', exact: true }).click();
    const dialog = f.page.getByRole('alertdialog', { name: 'Покинуть личные данные?' }); await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Остаться', exact: true }).click();
    assert.equal(await f.page.getByLabel('Дата рождения').inputValue(), '2000-01-02');
    await f.page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await f.page.getByText('Личные данные сохранены.', { exact: true }).waitFor();
    assert.deepEqual(f.state.writes.at(-1).body, { birth_date: '2000-01-02' }); await f.context.close();
  });
  await check('Profile: server position window rejection retains unsaved selection', async () => {
    const f = await fixture(); await f.go('/profile?view=details'); await f.page.getByLabel('Рабочая должность').selectOption('bartender');
    f.state.profileFailure = 'position_change_next_window'; await f.page.getByRole('button', { name: 'Сохранить изменения' }).click();
    await f.page.getByText('Должность уже менялась в эту смену.', { exact: true }).waitFor();
    assert.equal(await f.page.getByLabel('Рабочая должность').inputValue(), 'bartender');
    assert.equal(await f.page.getByLabel('Рабочая должность').isDisabled(), true); await f.context.close();
  });
  await check('Settings: ordinary staff menu, direct admin guard and own shift Journal without admin data', async () => {
    const f = await fixture(); await f.go('/admin?section=team'); await f.page.getByRole('heading', { name: 'Настройки и редактирование' }).waitFor();
    assert.equal(await f.page.getByRole('link', { name: /Сотрудники/ }).count(), 0);
    assert.equal(await f.page.getByRole('heading', { name: 'Редакторы', exact: true }).count(), 0);
    assert.deepEqual(await f.page.locator('.bf-settings-group').first().locator('.bf-nav-title').allTextContents(), ['Уведомление', 'Журнал']);
    await f.page.getByRole('link', { name: /Журнал/ }).click(); await f.page.getByRole('link', { name: /История смен/ }).click();
    await f.page.locator('.bf-history-record summary').waitFor(); await f.page.locator('.bf-history-record summary').click();
    await f.page.getByText('Подготовить бокалы', { exact: true }).waitFor();
    assert.equal(f.state.reads.some(req => /staff-admin-users|audit_log/.test(req.pathname)), false);
    const read = f.state.reads.find(req => req.pathname.endsWith('get_own_position_shift_history_v1')); assert.deepEqual(read.body, {});
    assert.equal(await f.page.locator('.bf-history-record').innerText().then(t => t.includes('Официант BB')), true);
    await f.page.screenshot({ path: 'reports/people/history-mobile.png', fullPage: true }); await f.context.close();
  });
  await check('Settings: server capabilities filter senior editors and separate knowledge grant', async () => {
    const f = await fixture(profile({ role: 'senior' })); f.state.knowledge = true; await f.go('/settings');
    await f.page.getByRole('heading', { name: 'Редакторы', exact: true }).waitFor();
    assert.equal(await f.page.getByRole('link', { name: /Сотрудники/ }).count(), 0);
    assert.deepEqual(await f.page.locator('.bf-settings-group').last().locator('.bf-nav-title').allTextContents(), ['Рецепты', 'Знания', 'Чек-листы смены']);
    assert.equal(await f.page.getByRole('link', { name: /Уведомление/ }).innerText(), 'Уведомление\nУстановка и уведомления'); await f.context.close();
  });
  await check('Journal: missing RPC, forbidden, invalid response and missing position remain explicit', async () => {
    const f = await fixture(); f.state.historyMissing = true; await f.go('/admin?section=audit&view=shifts');
    await f.page.getByText('История смен ещё не подключена. Обратитесь к администратору.', { exact: true }).waitFor();
    f.state.historyMissing = false; f.state.historyForbidden = true; await f.page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await f.page.getByText('История смен недоступна с текущими правами.', { exact: true }).waitFor();
    f.state.historyForbidden = false; f.state.historyInvalid = true; await f.page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await f.page.getByText('Не удалось загрузить историю смен.', { exact: true }).waitFor();
    f.state.historyInvalid = false; f.state.profile.position_code = null; await f.page.getByRole('button', { name: 'Повторить', exact: true }).click();
    await f.page.getByRole('heading', { name: 'Сначала выберите должность' }).waitFor(); await f.context.close();
  });
  await check('Admin: compact directory, local registration QR and owner/self guards', async () => {
    const f = await fixture(profile({ role: 'admin', first_name: 'Иван', last_name: 'Администратор' })); await f.go('/admin?section=team');
    await f.page.locator('.bf-directory-row').first().waitFor(); assert.equal(await f.page.locator('.bf-directory-row').count(), 4); assert.equal(await f.page.getByLabel('Роль доступа').count(), 0);
    await f.page.getByRole('button', { name: 'Пригласить', exact: true }).click();
    const invite = f.page.getByRole('dialog', { name: 'Пригласить сотрудника' }); await invite.waitFor();
    assert.equal(await invite.getByRole('link').getAttribute('href'), 'https://bfstaff.vercel.app/#/register');
    assert.match(await invite.getByRole('img').getAttribute('src'), /^data:image\/png;base64,/);
    assert.equal(await invite.getByRole('img').evaluate(img => img.complete && img.naturalWidth > 0), true);
    await invite.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await f.page.getByRole('link', { name: /Иван Администратор/ }).click(); await f.page.getByLabel('Роль доступа').waitFor();
    assert.equal(await f.page.getByLabel('Роль доступа').isDisabled(), true); assert.equal(await f.page.getByRole('button', { name: 'Отключить доступ', exact: true }).isDisabled(), true); assert.equal(await f.page.getByRole('button', { name: 'Удалить сотрудника' }).count(), 0);
    await f.page.getByRole('button', { name: 'К сотрудникам', exact: true }).click(); await f.page.getByRole('link', { name: /Светлана Владелец/ }).click();
    assert.equal(await f.page.getByLabel('Рабочая должность').isDisabled(), true); assert.equal(await f.page.getByRole('button', { name: 'Безопасность', exact: true }).isDisabled(), true); await f.context.close();
  });
  await check('Admin: legacy access correction, failed mutation draft, discard guard, confirmed save/reload', async () => {
    const f = await fixture(profile({ role: 'admin' })); await f.go('/admin?section=team'); await f.page.getByRole('link', { name: /Алексей Прежний/ }).click();
    const role = f.page.getByLabel('Роль доступа'); await role.selectOption('senior'); assert.equal(await role.inputValue(), 'senior');
    f.state.mutationFailure = true; await f.page.getByRole('button', { name: 'Сохранить доступ', exact: true }).click(); await f.page.getByText('Изменение не применено.', { exact: true }).waitFor(); assert.equal(await role.inputValue(), 'senior');
    await f.page.getByRole('button', { name: 'К сотрудникам', exact: true }).click(); const guard = f.page.getByRole('alertdialog', { name: 'Покинуть карточку сотрудника?' }); await guard.waitFor(); await guard.getByRole('button', { name: 'Остаться', exact: true }).click();
    f.state.mutationFailure = false; await f.page.getByRole('button', { name: 'Сохранить доступ', exact: true }).click(); await f.page.getByText('Изменение сохранено.', { exact: true }).waitFor();
    await poll(async () => await f.page.getByRole('button', { name: 'Сохранить доступ', exact: true }).count() === 0);
    await f.page.reload(); await role.waitFor(); assert.equal(await role.inputValue(), 'senior'); await f.context.close();
  });
  await check('Admin: security validation, failure retained, successful secret cleared', async () => {
    const f = await fixture(profile({ role: 'admin' })); await f.go('/admin?section=team'); await f.page.getByRole('link', { name: /Никита Коллега/ }).click(); await f.page.getByRole('button', { name: 'Безопасность', exact: true }).click();
    const dialog = f.page.getByRole('dialog', { name: 'Безопасность', exact: true }); await dialog.waitFor(); const input = dialog.getByLabel('Новый код входа'); const save = dialog.getByRole('button', { name: 'Изменить код входа', exact: true });
    await input.fill('123'); assert.equal(await save.isDisabled(), true); await input.fill('12345'); f.state.mutationFailure = true; await save.click(); await dialog.getByText('Не удалось обновить код. Повторите попытку.', { exact: true }).waitFor(); assert.equal(await input.inputValue(), '12345');
    f.state.mutationFailure = false; await save.click(); await dialog.getByText('Код входа обновлён.', { exact: true }).waitFor(); assert.equal(await input.inputValue(), ''); assert.equal(f.state.writes.at(-1).body.action, 'set_password'); await f.context.close();
  });
  await check('Admin: deletion requires phrase, retains dialog on failure and removes confirmed record', async () => {
    const f = await fixture(profile({ role: 'admin' })); await f.go('/admin?section=team'); await f.page.getByRole('link', { name: /Никита Коллега/ }).click(); await f.page.getByRole('button', { name: 'Удалить сотрудника', exact: true }).click();
    const dialog = f.page.getByRole('alertdialog'); await dialog.waitFor(); const remove = dialog.getByRole('button', { name: 'Удалить навсегда', exact: true }); assert.equal(await remove.isDisabled(), true); assert.equal(await dialog.getByRole('button', { name: 'Закрыть', exact: true }).count(), 0);
    await dialog.getByLabel('Для подтверждения введите УДАЛИТЬ').fill('удалить'); f.state.mutationFailure = true; await remove.click(); await dialog.getByText('Изменение не применено.', { exact: true }).waitFor();
    f.state.mutationFailure = false; await remove.click(); await dialog.waitFor({ state: 'detached' }); await f.page.getByRole('heading', { name: 'Сотрудник не найден' }).waitFor(); assert.equal(f.state.users.some(p => p.first_name === 'Никита'), false); await f.context.close();
  });
  await check('Admin: successful write plus failed refresh is reported honestly', async () => {
    const f = await fixture(profile({ role: 'admin' })); await f.go('/admin?section=team'); await f.page.getByRole('link', { name: /Никита Коллега/ }).click(); await f.page.getByLabel('Рабочая должность').selectOption('bartender'); f.state.failListAfterSave = true;
    await f.page.getByRole('button', { name: 'Сохранить должность', exact: true }).click(); await f.page.getByText('Изменение сохранено, но обновить список не удалось. Обновите страницу перед следующим изменением.', { exact: true }).waitFor(); assert.equal(f.state.users.find(p => p.first_name === 'Никита').position_code, 'bartender'); await f.context.close();
  });
  await check('Admin: Warm team attempt results and audit groups preserve main reads', async () => {
    const f = await fixture(profile({ role: 'admin' }), { width: 1440 }); await f.go('/admin?section=attempts'); await f.page.getByRole('heading', { name: 'Результаты команды', exact: true }).waitFor(); await f.page.locator('.bf-attempts-result').waitFor(); assert.match(await f.page.locator('.bf-attempts-result').innerText(), /80%\s*·\s*Зачтено/);
    assert.equal(await f.page.getByRole('link', { name: /Вопросы/ }).getAttribute('href'), '#/settings/attestation/questions'); assert.equal(await f.page.locator('svg.lucide').count(), 0);
    await f.go('/admin?section=audit'); await f.page.getByText('Персонал и доступ', { exact: true }).waitFor(); assert.equal(await f.page.getByText('Портал', { exact: true }).count(), 1); await f.page.screenshot({ path: 'reports/people/admin-audit-desktop.png', fullPage: true }); await f.context.close();
  });
  await check('Notifications: real device API fixture enable/disable, errors, permission denial and retry', async () => {
    const f = await fixture(profile(), { push: true }); await f.go('/settings/notifications'); const toggle = f.page.getByRole('switch', { name: 'Уведомления Ленты', exact: true }); await toggle.waitFor(); assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    await toggle.click(); await f.page.getByText('Уведомления включены на этом устройстве.', { exact: true }).waitFor(); assert.equal(f.state.writes.at(-1).rpc, 'register_push_subscription'); assert.equal(await toggle.getAttribute('aria-checked'), 'true');
    f.state.pushFailure = true; await toggle.click(); await f.page.getByText('Не удалось изменить уведомления. Повторите попытку.', { exact: true }).waitFor(); assert.equal(await toggle.getAttribute('aria-checked'), 'true');
    f.state.pushFailure = false; await toggle.click(); await f.page.getByText('Уведомления отключены на этом устройстве.', { exact: true }).waitFor(); assert.equal(await toggle.getAttribute('aria-checked'), 'false');
    await f.page.evaluate(() => localStorage.setItem('fixture-permission', 'denied')); await f.page.reload(); await f.page.getByText('Уведомления запрещены в настройках устройства.', { exact: true }).waitFor(); assert.equal(await toggle.isDisabled(), true);
    await f.page.evaluate(() => { localStorage.removeItem('fixture-permission'); localStorage.setItem('fixture-state-failure', '1'); }); await f.page.reload(); await f.page.getByRole('button', { name: 'Повторить проверку', exact: true }).waitFor(); await f.page.evaluate(() => localStorage.removeItem('fixture-state-failure')); await f.page.getByRole('button', { name: 'Повторить проверку', exact: true }).click(); await toggle.waitFor(); await f.context.close();
  });
  await check('No JavaScript errors or external network requests', async () => { assert.deepEqual(pageErrors, []); assert.deepEqual(unexpectedNetwork, []); });
} catch (error) { process.exitCode = 1; }
finally {
  if (browser) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      await page.evaluate(() => window.addEventListener('beforeunload', event => event.stopImmediatePropagation(), { capture: true })).catch(() => {});
      await page.close({ runBeforeUnload: false }).catch(() => {});
    }
    await browser.close();
  }
  server.kill('SIGTERM');
  fs.writeFileSync('reports/people/results.json', JSON.stringify({ scope: 'Actual source app with localhost transport fixtures only. No deployed Edge/RLS/SQL or real OS push verification.', results, pageErrors, unexpectedNetwork }, null, 2) + '\n');
}
