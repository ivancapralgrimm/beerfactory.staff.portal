const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const pulseSource = read("src/features/feed/feed-pulse.ts");

function loadPulseEngine() {
  const { outputText, diagnostics } = ts.transpileModule(pulseSource, {
    fileName: "feed-pulse.ts",
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      strict: true
    }
  });
  assert.equal((diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error).length, 0);
  const mod = { exports: {} };
  new Function("module", "exports", outputText)(mod, mod.exports);
  return mod.exports;
}

const pulse = loadPulseEngine();

// UTC date helper to express a time on a local Novosibirsk workday (+07:00).
function localTime(day, hour, minute = 0) {
  return new Date(Date.UTC(2026, 9, day, hour - 7, minute));
}

test("pulse uses BFStaff's 11:00 Novosibirsk workday, not the phone time zone", () => {
  assert.equal(pulse.getPulseWorkdayKey(localTime(11, 2, 59)), "2026-10-10");
  assert.equal(pulse.getPulseWorkdayKey(localTime(11, 3, 0)), "2026-10-10");
  assert.equal(pulse.getPulseWorkdayKey(localTime(11, 10, 59)), "2026-10-10");
  assert.equal(pulse.getPulseWorkdayKey(localTime(11, 11, 0)), "2026-10-11");
  assert.equal(pulse.getPulseWorkdayKey(localTime(12, 0, 30)), "2026-10-11");
  assert.equal(pulse.getPulseWorkdayKey(localTime(1, 1, 0)), "2026-09-30");
});

test("pulse editorial library has unique, actionable, non-deceptive entries", () => {
  assert.ok(pulse.FEED_PULSE_PROMPTS.length >= 30);
  assert.equal(pulse.FEED_PULSE_PROMPTS.filter((item) => item.action === "compose").length, 24);
  assert.equal(pulse.FEED_PULSE_PROMPTS.filter((item) => item.action === "knowledge").length, 12);
  const ids = pulse.FEED_PULSE_PROMPTS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of pulse.FEED_PULSE_PROMPTS) {
    assert.ok(entry.title.trim().length >= 14 && entry.title.length <= 90, entry.id);
    assert.ok(entry.body.trim().length >= 45 && entry.body.length <= 235, entry.id);
    assert.ok(["compose", "knowledge"].includes(entry.action), entry.id);
    assert.equal(/\b(сегодня вы|наш рекорд|ваш менеджер|поздравляем вас)\b/i.test(`${entry.title} ${entry.body}`), false, entry.id);
  }
});

test("pulse rotates once per day, remains stable, and covers all entries in one cycle", () => {
  const chosen = [];
  const start = Date.UTC(2026, 9, 11);
  for (let i = 0; i < pulse.FEED_PULSE_PROMPTS.length; i += 1) {
    const dayKey = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    const result = pulse.getPulseForWorkday(dayKey);
    assert.equal(result, pulse.getPulseForWorkday(dayKey));
    chosen.push(result.id);
  }
  assert.equal(new Set(chosen).size, pulse.FEED_PULSE_PROMPTS.length);
  const chosenActions = chosen.map((id) => pulse.FEED_PULSE_PROMPTS.find((item) => item.id === id).action);
  for (let i = 0; i < chosenActions.length; i += 1) {
    const triple = [chosenActions[i], chosenActions[(i + 1) % chosen.length], chosenActions[(i + 2) % chosen.length]];
    assert.ok(triple.includes("knowledge"), `too many consecutive prompts to compose at day ${i}`);
  }
});

test("pulse is a distinct system card, not a synthetic staff feed post", () => {
  const card = read("src/features/feed/FeedPulseCard.tsx");
  const css = read("src/features/feed/feed-pulse.css");
  assert.match(card, /<aside .*aria-label="Пульс команды BFStaff"/);
  assert.match(card, /Идея от BFStaff, не запись сотрудника/);
  assert.match(card, /to="\/knowledge"/);
  assert.match(card, /to="\/feed\?compose=1"/);
  assert.match(card, /onClick=\{onCompose\}/);
  assert.doesNotMatch(card + pulseSource, /\.rpc\(|\.from\(|\.invoke\(|localStorage|notify_all|pushSubscription/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /focus-visible/);
});

test("feed shows pulse only after successful empty active-list load", () => {
  const feed = read("src/features/feed/FeedPage.tsx");
  const dashboard = read("src/features/feed/DashboardFeedSection.tsx");
  assert.match(feed, /\) : statusFilter === "active" \? \(/);
  assert.match(feed, /<FeedPulseCard onCompose=\{openComposerFromPulse\} \/>/);
  assert.match(feed, /setComposerOpen\(true\)/);
  assert.match(feed, /searchParams\.get\("compose"\) === "1"/);
  assert.ok(feed.indexOf(") : error ? (") < feed.indexOf(') : statusFilter === "active" ? ('));
  assert.match(dashboard, /\) : active\.length === 0 \? \(/);
  assert.match(dashboard, /<FeedPulseCard compact \/>/);
  assert.ok(dashboard.indexOf(") : error ? (") < dashboard.indexOf(") : active.length === 0 ? ("));
  assert.match(dashboard, /active\.map\(\(post\) => \(/);
});

test("the existing feed persistence, delivery and lifecycle remain untouched", () => {
  const feed = read("src/features/feed/FeedPage.tsx");
  assert.match(feed, /await createFeedPost\(/);
  assert.match(feed, /await acknowledgeFeedPost\(post\.id\)/);
  assert.match(feed, /await resolveFeedPost\(post\.id\)/);
  assert.match(feed, /<FeedPostCard/);
  assert.match(feed, /statusFilter === "resolved"/);
  assert.match(feed, /Решённых записей пока нет/);
  assert.doesNotMatch(pulseSource, /\.from\(|\.rpc\(|\.invoke\(|auth\.uid\(/);
});
