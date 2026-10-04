const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("profile reads are bounded and identical concurrent reads are deduplicated", () => {
  const source = read("src/features/auth/auth-api.ts");
  assert.match(source, /PROFILE_READ_TIMEOUT_MS\s*=\s*6_000/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /profileReadInFlight\?\.accessToken === accessToken/);
  assert.match(source, /profile_load_timeout/);
});

test("resume bursts are coalesced on network-heavy screens", () => {
  const helper = read("src/lib/coalesced-resume-refresh.ts");
  assert.match(helper, /focus/);
  assert.match(helper, /visibilitychange/);
  assert.match(helper, /includeOnline/);
  assert.match(helper, /trailing/);

  for (const name of [
    "src/features/feed/use-feed.ts",
    "src/features/dashboard/use-upcoming-birthdays.ts",
    "src/features/knowledge/use-knowledge.ts",
  ]) {
    assert.match(read(name), /installCoalescedResumeRefresh/, name);
  }

  const shiftApi = read("src/features/shift/shift-api.ts");
  assert.match(shiftApi, /shiftWorkflowInFlight/);
  assert.match(shiftApi, /if \(shiftWorkflowInFlight\) return shiftWorkflowInFlight/);
});

test("Feed resolves independent profile and acknowledgement reads in parallel", () => {
  const source = read("src/features/feed/feed-api.ts");
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /from\("profiles"\)/);
  assert.match(source, /from\("feed_acknowledgements"\)/);
});

test("Knowledge text readiness no longer awaits private image signing", () => {
  const source = read("src/features/knowledge/knowledge-server.ts");
  const mapIndex = source.indexOf("const articles = mapRows(rows)");
  const signingIndex = source.indexOf("startMediaSigning(rows, onMediaReady)");
  const returnIndex = source.indexOf("return articles", signingIndex);
  assert.ok(mapIndex >= 0 && signingIndex > mapIndex && returnIndex > signingIndex);
  assert.doesNotMatch(
    source.slice(mapIndex, returnIndex),
    /await\s+signKnowledgeMedia/,
  );
  assert.match(source, /SIGNED_MEDIA_CACHE_MS\s*=\s*10 \* 60_000/);
});

test("lazy route transitions expose pending and recoverable failure states", () => {
  const source = read("src/app/App.tsx");
  assert.match(source, /Suspense key=\{location\.pathname\}/);
  assert.match(source, /RouteLoadBoundary key=\{location\.pathname\}/);
  assert.match(source, /Загружаем раздел…/);
  assert.match(source, /Не удалось загрузить раздел/);
  assert.match(source, /window\.location\.reload\(\)/);
});
