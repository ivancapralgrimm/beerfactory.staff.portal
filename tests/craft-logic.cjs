// Ignore presentation trees, but retain every non-JSX business statement and callback.
const ts = require("typescript");
const fs = require("node:fs");
const crypto = require("node:crypto");
function fingerprint(file) {
  const ast = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );
  function encode(node) {
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    )
      return ["view"];
    if (ts.isParenthesizedExpression(node)) return encode(node.expression);
    const children = [];
    ts.forEachChild(node, (n) => {
      if (
        ts.isVariableStatement(n) &&
        n.declarationList.declarations.some(
          (d) => d.name.getText(ast) === "[visiblePhase, setVisiblePhase]",
        )
      )
        return;
      children.push(encode(n));
    });
    return [node.kind, node.text ?? null, children];
  }
  const nodes = ast.statements.filter((n) => !ts.isImportDeclaration(n));
  const handlers = [];
  function walk(n) {
    if (
      ts.isJsxAttribute(n) &&
      /^on[A-Z]/.test(n.name.getText(ast)) &&
      n.initializer
    )
      handlers.push(JSON.stringify(encode(n.initializer)));
    ts.forEachChild(n, walk);
  }
  walk(ast);
  return {
    logic_sha256: crypto
      .createHash("sha256")
      .update(JSON.stringify(nodes.map(encode)))
      .digest("hex"),
    handlers,
  };
}
module.exports = { fingerprint };
