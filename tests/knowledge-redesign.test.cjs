const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const record = JSON.parse(
  fs.readFileSync(path.join(root, "KNOWLEDGE_REDESIGN_PROTECTED.json"), "utf8"),
);
const sha = (b) => createHash("sha256").update(b).digest("hex");
test("Knowledge redesign preserves accepted editor, backend, permissions, data and source switching bytes", () => {
  for (const [name, expected] of Object.entries(record.protected_sha256))
    assert.equal(sha(fs.readFileSync(path.join(root, name))), expected, name);
  assert.equal(
    sha(
      fs
        .readFileSync(path.join(root, "src/styles.css"))
        .subarray(0, record.baseline_styles_bytes_length),
    ),
    record.baseline_styles_sha256,
    "all accepted portal/editor CSS preserved before scoped additions",
  );
  const config = fs
    .readFileSync(path.join(root, "vite.config.ts"), "utf8")
    .replace("json,txt,woff,woff2}", "json,txt}").replace(record.added_vite_asset_config, "");
  assert.equal(
    sha(config),
    record.baseline_vite_sha256,
    "only local fonts and duplicate shell-icon precache fix; source policy intact",
  );
  const migrations = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .map((n) => "supabase/migrations/" + n)
    .sort();
  assert.deepEqual(
    migrations,
    Object.keys(record.protected_sha256)
      .filter((n) => n.startsWith("supabase/migrations/"))
      .sort(),
  );
});

const ts = require("typescript");
function controllerHash(file, name) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = ast.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  const nodes = [];
  for (const n of fn.body.statements) {
    if (name === "KnowledgePage" && ts.isReturnStatement(n)) break;
    if (
      name === "KnowledgeArticlePage" &&
      ts.isIfStatement(n) &&
      n.expression.getText(ast).includes("state.status")
    )
      break;
    nodes.push(n);
  }
  const encode = (n) => {
    if (ts.isParenthesizedExpression(n)) return encode(n.expression);
    const children = [];
    ts.forEachChild(n, (c) => {
      children.push(encode(c));
    });
    return [n.kind, n.text ?? null, children];
  };
  return createHash("sha256")
    .update(JSON.stringify(nodes.map(encode)))
    .digest("hex");
}

test("Knowledge list and reader controllers retain loading, sharing, progress, filtering, back links and source decisions", () => {
  for (const [file, expected] of Object.entries(record.controller_ast_sha256))
    assert.equal(
      controllerHash(path.join(root, file), expected.name),
      expected.sha256,
      file,
    );
});


test("cumulative package preserves current HEAD security assertions and includes all test suites",()=>{
 const prefix=fs.readFileSync(path.join(root,"tests/ux-invariants.test.cjs")).subarray(0,record.head_ux_test_prefix_length);
 assert.equal(sha(prefix),record.head_ux_test_prefix_sha256);
 const command=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).scripts.test;
 for(const name of ["knowledge.test.cjs","live-sync.test.cjs","edge-contract.test.cjs","ux-invariants.test.cjs","backend-hardening.test.cjs","knowledge-redesign.test.cjs"]) assert.ok(command.includes("tests/"+name),name);
});
