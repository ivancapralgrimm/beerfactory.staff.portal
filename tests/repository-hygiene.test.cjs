const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");
const normalize = (value) => path.normalize(value);

function sourceFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(file, output);
    else if (/\.(?:ts|tsx)$/u.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      output.push(normalize(file));
    }
  }
  return output;
}

function resolveImport(files, importer, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(importer), specifier);
  } else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    const normalized = normalize(candidate);
    if (files.has(normalized)) return normalized;
  }
  return null;
}

test("runtime source tree has no unexpected orphan modules", () => {
  const files = new Set(sourceFiles(srcRoot));
  const graph = new Map();

  for (const file of files) {
    const parsed = ts.preProcessFile(fs.readFileSync(file, "utf8"), true, true);
    graph.set(
      file,
      parsed.importedFiles
        .map((item) => resolveImport(files, file, item.fileName))
        .filter(Boolean),
    );
  }

  const reached = new Set();
  const pending = [normalize(path.join(srcRoot, "main.tsx"))];
  while (pending.length) {
    const file = pending.pop();
    if (!file || reached.has(file)) continue;
    reached.add(file);
    pending.push(...(graph.get(file) || []));
  }

  const allowedToolingModules = new Set([
    normalize(path.join(srcRoot, "features/knowledge/knowledge-source.ts")),
    normalize(path.join(srcRoot, "features/knowledge/editor/legacy-markdown.ts")),
  ]);
  const unexpected = [...files]
    .filter((file) => !reached.has(file) && !allowedToolingModules.has(file))
    .map((file) => path.relative(root, file).replaceAll("\\", "/"))
    .sort();

  assert.deepEqual(unexpected, []);
});

test("Knowledge source selection keeps legacy only as an explicit rollback", () => {
  const filename = path.join(
    srcRoot,
    "features/knowledge/knowledge-source.ts",
  );
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  const { resolveKnowledgeSource } = module.exports;

  assert.equal(resolveKnowledgeSource({ mode: "production" }), "supabase");
  assert.equal(resolveKnowledgeSource({ mode: "preview" }), "supabase");
  assert.equal(
    resolveKnowledgeSource({ deploymentEnv: "preview" }),
    "supabase",
  );
  assert.equal(
    resolveKnowledgeSource({ mode: "production", requested: "legacy" }),
    "legacy",
  );
  assert.equal(resolveKnowledgeSource({ mode: "development" }), "legacy");
});
