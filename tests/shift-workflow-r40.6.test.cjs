const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("Shift frontend only calls the position-aware RPC contract", () => {
  const api = read("src/features/shift/shift-api.ts");
  for (const rpc of [
    "get_position_shift_workflow",
    "set_position_shift_check",
    "set_position_shift_check_group",
    "unlock_position_shift_closing",
    "confirm_position_shift",
  ]) {
    assert.match(api, new RegExp(`['\"]${rpc}['\"]`));
  }
  assert.doesNotMatch(api, /(?:ensure|set|confirm_(?:open|close))_shift_for_date/);
});

test("Shift page keeps the complete opening and closing workflow", () => {
  const page = read("src/features/shift/ShiftPage.tsx");
  assert.match(page, /general_cleaning/);
  assert.match(page, /setPositionShiftCheckGroup/);
  assert.match(page, /unlockPositionShiftClosing/);
  assert.match(page, /confirmPhase\("open"\)/);
  assert.match(page, /confirmPhase\("close"\)/);
  assert.match(page, /11:00 - 03:00/);
});

test("Shift server contract remains role-aware and server-authoritative", () => {
  const sql = read("supabase/migrations/20260928230000_bfstaff_feed_shift_megapack.sql");
  assert.match(sql, /create or replace function public\.get_position_shift_workflow/);
  assert.match(sql, /create or replace function public\.set_position_shift_check_group/);
  assert.match(sql, /create or replace function public\.unlock_position_shift_closing/);
  assert.match(sql, /create or replace function\s+private\.finalize_position_shift_windows/);
  assert.match(sql, /beerfactory-position-shift-window-summary/);
  assert.match(sql, /grant execute on function\s+public\.confirm_position_shift\(text\)\s+to authenticated/);
});

test("Legacy date-based Shift RPCs are retired without deleting schema history", () => {
  const sql = read("supabase/migrations/20261007135717_retire_legacy_shift_rpcs.sql");
  for (const signature of [
    "ensure_shift_for_date(date)",
    "set_shift_check_for_date(date,text,text,boolean)",
    "confirm_open_shift_for_date(date)",
    "confirm_close_shift_for_date(date)",
  ]) {
    assert.match(sql, new RegExp(signature.replace(/[()]/g, "\\$&")));
  }
  assert.match(sql, /from public, anon, authenticated/g);
  assert.doesNotMatch(sql, /drop\s+(?:function|table)/i);
});
