// Evaluate the exact supplied generator with filesystem writes captured in memory.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
let sql;
const source = fs.readFileSync(
  path.join(root, "tools/build-knowledge-legacy-seed.mjs"),
  "utf8",
);
const compiled = ts.transpileModule(source + "\nmodule.exports = {articles};", {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  },
}).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, {
  module: mod,
  exports: mod.exports,
  require: (name) =>
    name === "node:fs"
      ? {
          readFileSync: fs.readFileSync,
          mkdirSync() {},
          writeFileSync(_path, value) {
            sql = value;
          },
        }
      : require(name),
  process: { argv: [process.execPath, "generator", root], cwd: () => root },
  console: { log() {} },
});
const articles = JSON.parse(JSON.stringify(mod.exports.articles));
const documents = articles.map((a) => ({
  schemaVersion: 2,
  id: a.id,
  title: a.title,
  category: a.category,
  description: a.description,
  sort_order: a.sort_order,
  dashboard_featured: false,
  status: "published",
  revision: 1,
  blocks: a.blocks.map((b) =>
    b.type === "image"
      ? { ...b, mediaId: null, storagePath: null, width: null, height: null }
      : b,
  ),
}));
module.exports = { articles, documents, sql };
