const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("production CI runs actual TypeScript, tests and Vite build", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
});

test("staff login rate limiting is persistent and service-role only", () => {
  const migration = read(
    "supabase/migrations/20261005101209_add_staff_login_rate_limit.sql"
  );
  const login = read("supabase/functions/staff-login/index.ts");

  assert.match(migration, /private\.login_rate_limits/);
  assert.match(migration, /revoke all .* from public, anon, authenticated/is);
  assert.match(migration, /grant execute .* to service_role/is);
  assert.match(login, /login_rate_limit_allowed/);
  assert.match(login, /record_login_failure/);
  assert.match(login, /clear_login_failures/);
  assert.match(login, /p_limit:\s*6/);
  assert.match(login, /p_limit:\s*30/);
  assert.match(login, /rate_limited/);
});

test("the repository contains source for all staff auth Edge Functions", () => {
  for (const name of [
    "staff-login",
    "staff-register",
    "staff-recover",
    "staff-set-recovery"
  ]) {
    assert.ok(
      fs.existsSync(path.join(root, "supabase/functions", name, "index.ts")),
      name
    );
    assert.ok(
      fs.existsSync(path.join(root, "supabase/functions", name, "deno.json")),
      name
    );
  }
});

test("installed PWA does not precache legacy training payload or push worker twice", () => {
  const vite = read("vite.config.ts");
  assert.match(vite, /injectRegister:\s*null/);
  assert.match(vite, /importScripts:\s*\["push-sw\.js"\]/);
  assert.match(vite, /"push-sw\.js"/);
  assert.match(vite, /assets\/training-data\.txt/);
  assert.match(vite, /assets\/training-data\.json/);
  assert.match(vite, /assets\/questions\.txt/);

  const includeBlock = vite.match(/includeAssets:\s*\[([\s\S]*?)\]/)?.[1] || "";
  assert.doesNotMatch(includeBlock, /push-sw\.js/);
});

test("primary recipe route compacts the upstream payload before returning it to phones", () => {
  const api = read("api/recipes/menu.js");
  const config = JSON.parse(read("vercel.json"));

  assert.match(api, /compactRecipe/);
  assert.match(api, /recipes\s*=\s*raw\.map\(compactRecipe\)/);
  assert.doesNotMatch(api, /\.\.\.row/);
  assert.match(api, /s-maxage=30/);

  const rewrites = config.rewrites || [];
  assert.ok(
    rewrites.some(
      (item) =>
        item.source === "/api/recipes/admin/:path*" &&
        item.destination.includes("workers.dev/admin/:path*")
    )
  );
  assert.ok(
    !rewrites.some((item) => item.source === "/api/recipes/:path*"),
    "menu must be handled by the local Vercel function, not the broad external rewrite"
  );
});

test("database backups are encrypted before artifact upload", () => {
  const workflow = read(".github/workflows/supabase-backup.yml");
  assert.match(workflow, /pg_dump/);
  assert.match(workflow, /openssl enc -aes-256-cbc/);
  assert.match(workflow, /BACKUP_ENCRYPTION_PASSWORD/);
  assert.match(workflow, /rm -f bfstaff\.dump/);
  assert.match(workflow, /retention-days:\s*7/);
});
