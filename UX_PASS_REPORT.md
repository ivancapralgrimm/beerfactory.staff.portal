# BeerFactory Staff Portal r40.5 — final UX pass

Scope: interface only, built on the technically accepted Article Editor. The backend
contract, article schema v2, permissions and concurrency are unchanged. No Supabase,
GitHub, push/merge/deploy or migration operations occurred.

## Result

The main workflow is text → optional photo → more text. Content is a continuous dark
BeerFactory writing surface with copper primary Save, not numbered technical cards.
No visible block terminology, IDs, schema/revision/level labels or ordinary limit counter.
The capacity hint appears only from 180 elements; the unchanged maximum stays 200.

| Interface | Where functions are now |
| --- | --- |
| Inserting content | One + Добавить between content; Текст/Фото first, then Список/Подзаголовок/Заметка/Разделитель |
| Text type | Compact Lucide Aa/Type menu: ordinary text, heading, nested heading, note; heading defaults to level 2 internally |
| Formatting | Three 44px icon targets with accessible names; one instruction above content; no per-textarea preview |
| Ordering/removal | ••• → Переместить выше/ниже/Удалить; boundary actions disabled; existing deletion confirmation retained |
| Photo | Preview, replace, caption; ••• overlays photo; alt in Дополнительно with human label/helper |
| List | Compact marker/number selector, items, add/remove; per-item Формат disclosure preserves existing marks |
| Main actions | Back, page heading, Preview, primary Save; backup and published reader link in ••• |
| Recovery | Backup automatically visible for error/network/conflict and access loss; explicit server reload/discard unchanged |
| Metadata | Title/category and compact status stay visible; description in Параметры статьи; new articles remain draft |

Textareas grow to fit content (with a safe visible editing maximum). Explicitly adding
text focuses the new field. Menus support keyboard Enter/Space, arrows, Home/End,
Escape with focus return, Tab and outside dismissal. Mobile uses a compact bottom
popover. A fallback supports browsers without Popover API without new dependencies.
Touch targets are at least 44px; text inputs are at least 16px. Only existing Lucide
icons and BeerFactory color tokens are used.

## Design evidence and decisions

Reference lock: user's UX brief + existing DESIGN_SYSTEM.md + the accepted editor
screenshots. Preserve dark/copper palette, cream text, existing navigation and primary
Save semantics. Remove repeated containers/chrome and disclose rare operations.
Refero style/screen searches returned NO_SUBSCRIPTION; no successful external-reference
retrieval is claimed. Bundled craft-details/anti-ai-slop guidance informed focus,
touch targets, form labels and avoiding unnecessary cards. Existing product is the
dominant reference; no new theme, font family, image library or generic CMS layout.

Visual QA uses real Playwright screenshots of a production-built preview:

- `reports/editor-mobile.png`: 390px wide, clean saved text/photo/text draft.
- `reports/editor-desktop.png`: 1366px wide, same content.

The photograph is an unchanged portal asset uploaded through mocked Edge/Storage
transport. These are screenshots of the actual UI, not generated design mockups or
edited images. Viewport height was expanded to the content height for full-article
capture so the fixed portal navigation appears at the bottom, not across the photo.
Mobile layout/overflow/touch checks run separately at 390×844. Reader/navigation
source was not changed for screenshots.

## Technical protection

`UX_BASELINE_PROTECTED.json` records the accepted ZIP hash and SHA for all migrations,
Edge, Knowledge model/API/reader/source selection, permissions, auth and legacy assets.
Two invariant tests check exact files and editor logic tokens before presentation:
load/save/upload/expected_revision/conflict/draft handling/backup and existing effects.
Only the presentation tail of KnowledgeEditorPage is changed. Migrations are also
enumerated to detect any added file. No model/controller/RPC/reader redesign occurred.

## Verification and corrections

28 unit/source/contract tests and 35 browser scenarios passed, along with TypeScript
and default/preview production builds. TEST_REPORT.md gives actual commands/evidence.
Coverage includes text-only creation, photo ordering, all format/type/list actions,
movement/removal, caption/advanced alt/replace, save/reopen, two-editor conflict,
permission loss/recovery backup, keyboard, 390px/desktop and console/runtime checks.

During development, typecheck caught an edit-boundary mistake before a runtime run;
the exact accepted controller prefix was restored and token-guarded. Browser QA caught
asynchronous menu focus, fixed via synchronous open/focus, and a quote-test selector
that incorrectly expected blockquote although the unchanged reader uses aside.
The fallback test now uses keyboard toggle when its mobile sheet physically covers
the insertion trigger. Visual QA caught global heading sizing and fixed-navigation
occlusion in long screenshot capture. These corrections are logged in ERROR_LOG.md.

Live backend/RLS/device checks remain the previously recorded NEEDS_LIVE_QA. The UX
pass does not repeat or claim real Supabase authorization tests or physical iOS QA.

## Return and review

Full workspace: BFStaff_r40.5_CODEX_ARTICLE_EDITOR_UX_FINAL.zip. CHANGED_FILES.md
describes this pass versus the accepted technical archive; MANIFEST/CHECKSUMS cover
the full payload. Technical reports/screenshots are retained as history under
docs/r40.5-technical-accepted/. Review UX, rerun tests/builds and upload to r40.5 only
through the user's repository workflow. No backend migration or deployment is needed
to adopt these presentation changes.
