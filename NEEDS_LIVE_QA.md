# NEEDS_LIVE_QA — required before production cutover

Use an approved isolated/staging backend and test data for writes. This checklist
does not authorize mutations of production users/data or production publication.

No real user credentials/sessions were supplied or used. No physical device or
isolated PostgreSQL/Supabase test instance was available. The uploaded server state
is evidence supplied by the backend workstream, not a fresh live measurement by Codex.

1. With approved test accounts, Owner and Admin independently create/edit/publish;
   default Senior/Staff cannot mutate via RPC, Edge, direct table REST or Storage.
   Changing working position to manager must not grant article editing.
2. Backend owner checks inactive/revoked users, anonymous calls, effective table
   privileges/restrictive RLS, future granular grants in an isolated environment,
   pending media ownership, cross-article media rejection and published/draft visibility.
   Do not create/change production users or grants merely to execute this checklist.
3. Two real sessions open the same revision. A saves; B gets article_revision_conflict;
   B retains/exports its draft and explicitly reloads A's version before manual merging.
   Confirm actual database rollback and no lost writes, not only mocked transport.
4. Review 26 live published rows/351 blocks/12 legacy image blocks against repository
   assets and provided generator; confirm lesson-7 remains absent and lesson-27 present.
   Verify existing training_progress mappings and actual Dashboard/global search results.
5. Test actual knowledge-media-upload JWT gateway, CORS, MIME/signature/dimension limits,
   private signed URLs, pending media binding, replacement/detachment and expired URL
   behavior. Verify real media objects remain private and Storage SELECT RLS is effective.
   Issued URLs may remain valid until their TTL after detachment/revocation.
6. `knowledge-media-upload` v2 has been deployed ACTIVE with `verify_jwt=true` and a pinned Supabase client. Still test real authenticated uploads against the deployed runtime, including valid PNG/JPEG/WebP/GIF and malformed/truncated files; the local Node harness is not a physical-device or end-to-end Storage test.
7. On physical iOS/Android installed PWA, test keyboard, image picker/large images,
   background/resume, offline draft handling, URL expiry, leave warning and downloaded
   backup. Desktop Chromium emulation cannot prove platform-specific PWA behavior.
8. After architecture/security review, inspect r40.5 preview with approved real sessions.
   Production main stays on legacy. No legacy content/assets removal or production
   cutover is authorized by this package; each is a separate decision.

Status: NEEDS_LIVE_QA. Local tests passed do not convert these items to PASS.
