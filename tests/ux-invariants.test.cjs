const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const record = JSON.parse(
  fs.readFileSync(path.join(root, "UX_BASELINE_PROTECTED.json"), "utf8"),
);
test("final candidate preserves protected server/schema/permissions/reader/source/auth/legacy artifacts", () => {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,"src/styles.css")).subarray(0,record.baseline_styles_bytes_length)).digest("hex"),record.baseline_styles_sha256,"existing portal CSS must stay byte-identical; UX rules are appended");
  for (const [name, expected] of Object.entries(record.protected_sha256)) {
    assert.equal(
      crypto
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, name)))
        .digest("hex"),
      expected,
      name,
    );
  }
  const migrations = fs
    .readdirSync(path.join(root, "supabase/migrations"))
    .map((name) => `supabase/migrations/${name}`)
    .sort();
  assert.deepEqual(
    migrations,
    Object.keys(record.protected_sha256)
      .filter((name) => name.startsWith("supabase/migrations/"))
      .sort(),
  );
});
test("UX pass preserves editor logic before render: access/load/save/upload/revision/conflict/backup", () => {
  const file = path.join(
    root,
    "src/features/knowledge/editor/KnowledgeEditorPage.tsx",
  );
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );
  const page = ast.statements.find(
    (s) =>
      ts.isFunctionDeclaration(s) && s.name?.text === "KnowledgeEditorPage",
  );
  const before = [];
  for (const statement of page.body.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (d) => d.name.getText(ast) === "insertion",
      )
    )
      break;
    const scanner = ts.createScanner(
      ts.ScriptTarget.ESNext,
      true,
      ts.LanguageVariant.Standard,
      statement.getText(ast),
    );
    const tokens = [];
    while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken)
      tokens.push([
        scanner.getToken(),
        scanner.getTokenValue() || scanner.getTokenText(),
      ]);
    before.push(JSON.stringify(tokens));
  }
  assert.equal(
    crypto.createHash("sha256").update(before.join("\n")).digest("hex"),
    record.editor_logic_tokens_sha256,
  );
});
