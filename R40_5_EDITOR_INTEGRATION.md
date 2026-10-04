# BeerFactory Staff Portal r40.5 — final integration

The workspace is the existing portal, with its native Knowledge routes. Live Sync
is authoritative; BACKEND_CONTRACT_CHECK.md describes the comparison and exact
server files. NocoDB recipes and auth access hotfix v2 remain unchanged.

## Local development and preview

Node 24.x: npm ci, npm run typecheck, npm test, npm run build.
Use npm run dev:preview or npm run build:preview to read Knowledge through Supabase.
Vercel preview with VERCEL_ENV=preview and VERCEL_GIT_COMMIT_REF=r40.5 also selects
Supabase during the normal build. A production deployment always remains legacy at
this stage; a plain local/default build remains legacy. VITE_KNOWLEDGE_SOURCE=legacy
provides explicit rollback on preview. No automatic server-error fallback occurs.

Configure the existing public VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY for
an approved test backend when needed; never put service-role credentials in frontend.
Do not deploy/build against new credentials or mutate live automatically.

## Native routes and permissions

- #/knowledge: published index/categories/search and allowed editor actions.
- #/knowledge/new: requires server can_create.
- #/knowledge/manage: server editor index; edit links require can_edit.
- #/knowledge/lesson-1/edit: requires can_edit, stable ID retained.
- #/knowledge/lesson-1: reader and existing training_progress.
- #/article/lesson-1 and #/training: original redirects retained.

Owner/Admin have create/edit/publish by server default. Staff/Senior defaults remain
read-only regardless of working position. Context consumes all five server flags;
future explicit grants are respected without creating any grant UI or grant rows.
Before save/upload context is checked again; actual RPC/Edge/RLS are authoritative.
Text editing of an existing published article needs edit, while changing status
requires publish. New documents start as drafts. A create-only user can create a
draft, but cannot subsequently edit it without can_edit, matching server behavior.

## RPC, media and conflicts

get_knowledge_articles / get_knowledge_editor_articles / get_knowledge_article
provide the only Knowledge reads. save_knowledge_article receives schemaVersion=2
p_document and the currently loaded p_expected_revision. No direct browser table
CRUD, local article DB or persistent base64 storage is used.

knowledge-media-upload receives only multipart file. Private knowledge-media URLs
are temporary previews; pending mediaId/storagePath bind when the article is saved.
An upload can succeed with an empty signed_url: keep the block, allow save and retry
SDK signing. Reader/editor refresh signed URLs on resume/online and periodically.
Paragraph, heading, quote, ordered/unordered list, separator and bold/italic/highlight
are supported. Images insert between blocks, move/replace and retain alt/caption.
One to 200 blocks are required. Description is list metadata, not an extra body block.
Legacy images preserve alt as their old visible caption when server caption is empty.

On article_revision_conflict the draft and old revision remain in memory. Download
JSON backup, explicitly confirm loading the current server document, manually merge
needed changes and save against its revision. No automatic last-write overwrite or
force-save action exists. Network/permission errors also retain the draft; route leave
and browser unload guards protect unsaved work. Memory drafts are not durable after
tab/process loss; save online or download the explicit backup.

## Server history and review

Three supplied live migration versions are recorded locally, not applied again.
The third is reproduced by the supplied tools/build-knowledge-legacy-seed.mjs.
The earlier scripts/build-knowledge-legacy-seed.mjs is a local legacy parity utility,
not the live import source. Do not run db push or redeploy Edge as part of review.

CODEX_FINAL_REPORT.md and TEST_REPORT.md are current. Initial reports are preserved
in docs/r40.5-initial-integration/ as historical evidence. Retain training-data.txt,
all legacy assets and the legacy reader until a separate reviewed cutover/removal.

## Final UX interface

UX_PASS_REPORT.md documents presentation changes. Use + Добавить for Text/Photo,
Aa for text types, ••• for ordering/removal/backup and Дополнительно for alt. Description
is in Параметры статьи. Technical setup, server calls, rights and revision handling above
remain unchanged. Current tests/screenshots are in TEST_REPORT.md and reports/.
