const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { fingerprint } = require("./craft-logic.cjs");
const root = path.resolve(__dirname, "..");
const record = JSON.parse(
  fs.readFileSync(path.join(root, "FULL_REDESIGN_V2_BASELINE.json")),
);
const performance = JSON.parse(
  fs.readFileSync(path.join(root, "PERFORMANCE_NETWORK_BASELINE.json"), "utf8"),
);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
test("V2 retains protected baseline except explicitly pinned performance/network overrides", () => {
  for (const [name, expected] of Object.entries(record.protected_sha256)) {
    const pinned = performance.override_sha256[name] || expected;
    assert.equal(sha(fs.readFileSync(path.join(root, name))), pinned, name);
  }
  assert.equal(
    sha(fs.readFileSync(path.join(root, "package-lock.json"))),
    record.lockfile_sha256,
  );
  assert.deepEqual(
    fs.readdirSync(path.join(root, "supabase/migrations")).sort(),
    record.migrations,
  );
  const command = JSON.parse(fs.readFileSync(path.join(root, "package.json")))
    .scripts.test;
  for (const name of [
    "backend-hardening.test.cjs",
    "edge-contract.test.cjs",
    "knowledge-redesign.test.cjs",
    "full-redesign-v2.test.cjs",
  ])
    assert.ok(command.includes(name));
});
test("V2 presentation integration retains all original page controllers and event callbacks", () => {
  for (const [name, before] of Object.entries(record.presentation_logic)) {
    const after = fingerprint(path.join(root, name));
    assert.equal(after.logic_sha256, before.logic_sha256, name);
    const remaining = [...after.handlers];
    for (const handler of before.handlers) {
      const i = remaining.indexOf(handler);
      assert.ok(i >= 0, `${name}: original handler missing`);
      remaining.splice(i, 1);
    }
  }
  const main = fs
    .readFileSync(path.join(root, "src/main.tsx"), "utf8")
    .replace('import "@/components/craft/craft.css";\n', "");
  assert.equal(sha(main), record.allowed_source_before_sha256["src/main.tsx"]);
});
test("V2 materials are code-native with shared primitives, not target/crop screenshots in runtime assets", () => {
  const css = fs.readFileSync(
    path.join(root, "src/components/craft/craft.css"),
    "utf8",
  );
  assert.ok(
    css.includes("--craft-paper:") &&
      css.includes("--craft-leather:") &&
      css.includes("--craft-display:"),
  );
  const code = fs.readFileSync(
    path.join(root, "src/components/craft/CraftPage.tsx"),
    "utf8",
  );
  assert.ok(
    code.includes('aria-hidden="true"') &&
      code.includes("craft-clipboard-clip") &&
      code.includes("craft-pen"),
  );
  assert.match(css, /\.craft-pen[^}]*pointer-events:\s*none/s);
  function walk(dir) {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      );
  }
  for (const file of walk(path.join(root, "src")))
    if (/\.(tsx?|css)$/.test(file))
      assert.doesNotMatch(
        fs.readFileSync(file, "utf8"),
        /bfstaff-full-redesign-v2-target|target-screens\//,
        file,
      );
  for (const file of walk(path.join(root, "assets")))
    assert.doesNotMatch(file, /target-screens|full-redesign-v2-target/);
});
