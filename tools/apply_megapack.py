#!/usr/bin/env python3
from pathlib import Path
import re
import shutil
import subprocess
import sys

PACKAGE = Path(__file__).resolve().parents[1]
TARGET = Path.cwd()
EXPECTED_HEAD = "cf491189a6c6a108708966dbf82eb588fde66959"

def fail(message: str):
    print(f"[BFStaff MegaPack] ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def current_head():
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=TARGET,
            text=True
        ).strip()
    except Exception:
        return None

def read(path: str) -> str:
    file = TARGET / path
    if not file.exists():
        fail(f"missing target file: {path}")
    return file.read_text(encoding="utf-8")

def write(path: str, content: str):
    file = TARGET / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content, encoding="utf-8")

def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"anchor mismatch ({label}): expected 1, got {count}")
    return text.replace(old, new, 1)

def copy_payload(path: str):
    src = PACKAGE / path
    if not src.exists():
        fail(f"payload missing: {path}")
    dst = TARGET / path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

head = current_head()
if head and head != EXPECTED_HEAD:
    fail(
        "wrong repository HEAD. "
        f"Expected {EXPECTED_HEAD}, got {head}. "
        "Use the r40.4-react base this pack was built for."
    )

for path in [
    "src/features/feed/types.ts",
    "src/features/feed/feed-api.ts",
    "src/features/feed/use-feed.ts",
    "src/features/feed/FeedPostCard.tsx",
    "src/features/feed/FeedPage.tsx",
    "src/features/feed/DashboardFeedSection.tsx",
    "src/features/shift/types.ts",
    "src/features/shift/shift-api.ts",
    "src/features/shift/ShiftPage.tsx",
    "src/features/admin/AdminAuditPanel.tsx",
    "supabase/functions/handover-push/index.ts",
    "supabase/functions/handover-push/deno.json",
    "supabase/migrations/20260928230000_bfstaff_feed_shift_megapack.sql",
]:
    copy_payload(path)

path = "src/app/App.tsx"
text = read(path)

text = replace_once(
    text,
'''const HandoverPage = lazy(() =>
  import(
    "@/features/handover/HandoverPage"
  ).then((module) => ({
    default: module.HandoverPage
  }))
);''',
'''const FeedPage = lazy(() =>
  import(
    "@/features/feed/FeedPage"
  ).then((module) => ({
    default: module.FeedPage
  }))
);''',
    "App lazy HandoverPage"
)

text = replace_once(
    text,
'''        <Route
          path="handover"
          element={
            <LazyRoute>
              <HandoverPage />
            </LazyRoute>
          }
        />''',
'''        <Route
          path="feed"
          element={
            <LazyRoute>
              <FeedPage />
            </LazyRoute>
          }
        />

        <Route
          path="handover"
          element={
            <Navigate
              to="/feed"
              replace
            />
          }
        />''',
    "App handover route"
)

write(path, text)

path = "src/components/layout/AppShell.tsx"
text = read(path)

text = replace_once(
    text,
'''  {
    to: "/handover",
    label: "Передача",
    icon: StickyNote
  }''',
'''  {
    to: "/feed",
    label: "Лента",
    icon: StickyNote
  }''',
    "AppShell handover nav"
)

write(path, text)

path = "src/pages/DashboardPage.tsx"
text = read(path)

text = replace_once(
    text,
'''import { HandoverNoteCard } from "@/features/handover/HandoverNoteCard";
import { useHandoverFeed } from "@/features/handover/use-handover-feed";''',
'''import { DashboardFeedSection } from "@/features/feed/DashboardFeedSection";''',
    "Dashboard handover imports"
)

text = replace_once(
    text,
'''  { to: "/handover", title: "Заметки", text: "Обмен информацией", icon: StickyNote }''',
'''  { to: "/feed", title: "Лента", text: "Новости и сообщения", icon: StickyNote }''',
    "Dashboard action"
)

text = replace_once(
    text,
'''  const { notes, loading, error } = useHandoverFeed();
''',
    "",
    "Dashboard handover hook"
)

text = replace_once(
    text,
'''  const activeNotes = notes.filter((note) => note.status !== "resolved");
  const activeCount = activeNotes.length;
  const showBirthdaySection = birthdaysLoading || Boolean(birthdaysError) || birthdays.length > 0;
  const showHandoverSection = loading || Boolean(error) || activeNotes.length > 0;
''',
'''  const showBirthdaySection = birthdaysLoading || Boolean(birthdaysError) || birthdays.length > 0;
''',
    "Dashboard handover state"
)

section = re.compile(
    r'\n      \{showHandoverSection \? \(\n.*?\n      \) : null\}\n\n      \{showReadingSection \? \(',
    re.S
)
match = section.search(text)

if not match:
    fail("Dashboard Handover section not found")

text = (
    text[:match.start()]
    + '\n      <DashboardFeedSection />\n\n      {showReadingSection ? ('
    + text[match.end():]
)

write(path, text)

print("[BFStaff MegaPack] Source files installed.")
print("[BFStaff MegaPack] Next:")
print("  npm run typecheck")
print("  npm run build")
print("  git diff")
