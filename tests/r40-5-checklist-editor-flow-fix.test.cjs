const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("existing checklist editor is a separate normal-flow sibling below the item card", () => {
  const page = read("src/features/shift/ChecklistEditorPage.tsx");
  const css = read("src/components/craft/craft.css");

  assert.match(page, /const editing = draft\?\.itemKey === row\.item_key/);
  assert.match(page, /className="bf-checklist-item-stack"/);
  assert.match(page, /className="bf-checklist-editor-panel"/);
  assert.match(page, /aria-expanded=\{editing\}/);

  const stackAt = page.indexOf('className="bf-checklist-item-stack"');
  const itemSurfaceClose = page.indexOf("</Surface>", stackAt);
  const editorPanelAt = page.indexOf('className="bf-checklist-editor-panel"', stackAt);
  assert.ok(stackAt >= 0 && itemSurfaceClose >= 0 && editorPanelAt > itemSurfaceClose,
    "editor panel must be rendered after the selected item Surface, not inside it");

  assert.match(css, /\.bf-checklist-item-stack\s*\{[\s\S]*?display:\s*grid/);
  assert.match(css, /\.bf-checklist-editor-panel\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.bf-checklist-inline-editor\s*\{[\s\S]*?margin:\s*0;/);
  assert.doesNotMatch(css, /\.bf-checklist-inline-editor\s*\{[\s\S]*?margin:\s*14px\s+-2px\s+-2px/);
});
