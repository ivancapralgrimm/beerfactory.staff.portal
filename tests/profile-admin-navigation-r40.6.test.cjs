const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('profile starts with compact navigation, not all forms simultaneously', () => {
  const p = read('src/pages/ProfilePage.tsx');
  assert.match(p, /requestedView === "details" \|\| requestedView === "notifications"/);
  assert.match(p, /to="\/profile\?view=details"/);
  assert.match(p, /to="\/profile\?view=notifications"/);
  assert.match(p, /<ProfileSubheader>Личные данные<\/ProfileSubheader>/);
  assert.match(p, /<ProfileSubheader>Уведомления<\/ProfileSubheader>/);
  assert.match(p, /canManageStaffClient\(user\)/);
  assert.match(p, /to="\/admin"/);
});

test('profile retains both server profile mutations and position window constraints', () => {
  const p = read('src/pages/ProfilePage.tsx');
  assert.match(p, /updateStaffProfile\(accessToken, \{ positionCode: selectedPosition \}\)/);
  assert.match(p, /updateStaffProfile\(accessToken, \{ birthDate: birthDate \|\| null \}\)/);
  assert.match(p, /position_change_next_window/);
  assert.match(p, /position_change_window_locked/);
  assert.match(p, /positionLocked \|\| savingPosition/);
  assert.match(p, /await logout\(\)/);
  assert.match(p, /<NotificationSettingsCard accessToken=\{accessToken\} \/>/);
});

test('admin uses distinct navigation views and preserves owner/admin guard', () => {
  const a = read('src/features/admin/AdminPage.tsx');
  assert.match(a, /canManageStaffClient\(state\.user\)/);
  assert.match(a, /if \(!accessToken \|\| !canManageStaff\) return/);
  assert.match(a, /if \(!canManageStaff\) return <Navigate to="\/profile" replace \/>/);
  assert.match(a, /section="team"/);
  assert.match(a, /section="attempts"/);
  assert.match(a, /section="audit"/);
  assert.match(a, /to=\{`\/admin\?section=\$\{section\}`\}/);
  assert.match(a, /<AdminAttemptsPanel users=\{users\} \/>/);
  assert.match(a, /<AdminAuditPanel users=\{users\} \/>/);
});

test('employee roster renders compact rows and mounts full editor only when expanded', () => {
  const a = read('src/features/admin/AdminPage.tsx');
  assert.match(a, /<details/);
  assert.match(a, /onToggle=\{\(event\) => setExpanded\(event\.currentTarget\.open\)\}/);
  assert.match(a, /\{expanded \? \(/);
  assert.match(a, /<AdminUserCard/);
  assert.match(a, /user\.is_active \? "Активен" : "Отключён"/);
  assert.match(a, /onRequestDelete=\{onRequestDelete\}/);
  assert.match(a, /onRequestToggle=\{onRequestToggle\}/);
  assert.match(a, /await mutateAdminUser\(accessToken, mutation\)/);
});
