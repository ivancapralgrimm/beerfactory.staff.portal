const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("recipe photo is a clickable Polaroid that preserves the complete image", () => {
  const page = read("src/features/recipes/RecipeDetailPage.tsx");
  const css = read("src/components/craft/craft.css");

  assert.match(page, /className="recipe-polaroid group"/);
  assert.match(page, /onClick=\{\(\) => setPhotoOpen\(true\)\}/);
  assert.match(page, /className="recipe-polaroid-photo-well"/);
  assert.match(page, /className="recipe-polaroid-image"/);
  assert.match(page, /Фото «\{recipe\.name\}»/);
  assert.match(page, /<RecipePhotoDialog[\s\S]*?open=\{photoOpen\}/);
  assert.match(css, /\.recipe-polaroid-photo-well[\s\S]*?aspect-ratio:\s*1\s*\/\s*1/);
  assert.match(css, /\.recipe-polaroid-image[\s\S]*?object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.recipe-polaroid-image[\s\S]{0,250}?object-fit:\s*cover/);
});

test("recipe content uses alternating attached paper notes in normal flow", () => {
  const page = read("src/features/recipes/RecipeDetailPage.tsx");
  const css = read("src/components/craft/craft.css");

  assert.match(page, /recipe-moodboard-card recipe-ingredients-sticker/);
  assert.match(page, /recipe-moodboard-card recipe-method-note/);
  assert.match(page, /recipe-moodboard-card recipe-serving-note/);
  assert.match(page, /recipe-moodboard-card recipe-meta-note/);
  assert.match(page, /recipe-fastener-pin/);
  assert.match(page, /recipe-fastener-tape/);
  assert.match(css, /\.recipe-moodboard > \.recipe-moodboard-card:nth-child\(odd\)[\s\S]*?rotate\(-/);
  assert.match(css, /\.recipe-moodboard > \.recipe-moodboard-card:nth-child\(even\)[\s\S]*?rotate\(/);
  assert.match(css, /\.recipe-moodboard-card\s*\{[\s\S]*?position:\s*relative/);
  assert.doesNotMatch(css, /\.recipe-moodboard-card\s*\{[\s\S]{0,260}?position:\s*absolute/);
});

test("recipe calculator keeps behavior but loses its nested card shell", () => {
  const page = read("src/features/recipes/RecipeDetailPage.tsx");
  const css = read("src/components/craft/craft.css");

  assert.match(page, /<RecipeCalculator recipe=\{recipe\} \/>/);
  assert.match(page, /recipe-calculator-note/);
  assert.match(css, /\.recipe-calculator-note > section[\s\S]*?border:\s*0/);
  assert.match(css, /\.recipe-calculator-note > section[\s\S]*?background:\s*transparent/);
});
