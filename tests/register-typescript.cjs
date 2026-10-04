// Test-only transpilation. Production remains the TypeScript/Vite build.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(
    this,
    name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name,
    ...args,
  );
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    let source = fs
      .readFileSync(filename, "utf8")
      .replaceAll("import.meta.env", "({})");
    if (filename.endsWith("r40.5-knowledge-data.baseline.ts"))
      source += "\nexport { parseArticles };";
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}
global.window = {
  location: { origin: "http://localhost" },
  dispatchEvent() {},
};

const unitFetch = global.fetch;
global.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url || String(input);
  if (!/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)/.test(url)) throw new Error("Unit test blocked external network: " + new URL(url).origin);
  return unitFetch(input, init);
};
