# BFStaff r40.5 Knowledge backend contract

Live Supabase project: `oltbkrvernfgymxtsfys`.
Prepared on 2026-09-30 while frontend `r40.5` was still identical to `main` at `d98aab55fc8893cc44313379c52e47db61a42f0f`.

## Live migrations already applied

- `20260930151257_r40_5_knowledge_content_foundation`
- `20260930151818_r40_5_knowledge_security_hardening`
- `20260930152047_r40_5_knowledge_legacy_seed_v1`

Do **not** reapply these migrations to the same live database. The repository must eventually contain matching migration files so repo history and live history converge.

## Live content state

- `knowledge_articles`: 26 published legacy articles.
- `knowledge_article_blocks`: 351 blocks.
- block types: paragraph 169, heading 44, quote 4, list 59, separator 63, image 12.
- ordered list blocks: 2.
- inline marks: bold 188, italic 101, highlight 1.
- category counts: Алкоголь 5, Пиво 1, Вино 10, Сервис 10.
- current article IDs are preserved (`lesson-*`, ending at `lesson-27`, with the same hidden placeholder gap as production).
- `training_progress.article_id` parity check: 0 missing references.
- existing 12 article images remain `legacySrc` for dual-read parity; Storage migration of those bundled assets is intentionally not completed yet.

Production r40.4 still reads `/assets/training-data.txt`; no user-facing read cutover has happened.

## Tables

- `public.knowledge_articles`
- `public.knowledge_article_blocks`
- `public.knowledge_article_media`
- `public.knowledge_editor_grants`

All four have RLS enabled and explicit restrictive browser-deny policies. `anon` and `authenticated` have no direct table CRUD grants. Edge/service work has explicit `service_role` CRUD grants.

## Access model

Current effective editor policy:
- active Owner: create/edit/publish;
- active Admin: create/edit/publish;
- Senior: read only unless an explicit future grant is added;
- Staff: read only unless an explicit future grant is added.

`knowledge_editor_grants` is empty by default. It exists to support later owner-controlled per-user `can_create`, `can_edit`, `can_publish` rights without conflating access role and working position.

### RPC access context

`public.get_knowledge_editor_context()` returns:

```json
{
  "can_read": true,
  "can_create": true,
  "can_edit": true,
  "can_publish": true,
  "can_manage_permissions": true
}
```

Exact booleans depend on the current user. Smoke test passed for Owner/Admin/Senior/Staff.

## RPCs

- `get_knowledge_articles()` -> published summaries for active staff.
- `get_knowledge_editor_articles()` -> all statuses for users with editor capabilities.
- `get_knowledge_article(p_article_id text)` -> published for active staff; draft/archive only for editor-capable users.
- `get_knowledge_editor_context()` -> authoritative capability snapshot.
- `save_knowledge_article(p_document jsonb, p_expected_revision bigint)` -> atomic structured-v2 save.

`save_knowledge_article` uses row locking + `revision`. A stale expected revision raises `article_revision_conflict` and writes nothing.

Smoke-tested behavior:
- Staff mutation denied (`forbidden`).
- temporary explicit Staff grant correctly changed capabilities and was removed after the test.
- Owner create -> revision 1.
- stale save -> `article_revision_conflict`.
- valid second save -> revision 2.
- structured content round-trip passed.
- QA article/audit/grant rows were cleaned; no test residue remains.

## Storage

Private bucket: `knowledge-media`.

- public=false
- max object size=8 MiB
- MIME allowlist: PNG/JPEG/WebP/GIF
- authenticated Storage SELECT policy calls `private.can_read_knowledge_media(name)`.
- ordinary staff may read an object only when its metadata is attached to a published article.
- editor-capable users can read pending/draft media.
- no browser INSERT/UPDATE/DELETE policy exists for this bucket.

## Edge Function

`knowledge-media-upload` v1 is ACTIVE with `verify_jwt=true`.

It:
- validates the signed-in user through Supabase Auth;
- calls `get_knowledge_editor_context` and requires `can_create` or `can_edit`;
- validates file size and binary signature/dimensions server-side;
- accepts PNG/JPEG/WebP/GIF up to 8 MiB / 12k dimension / 40MP;
- uploads with service role to `pending/<user>/<uuid>.<ext>`;
- writes metadata to `knowledge_article_media`;
- returns a 15-minute signed preview URL.

## Advisor status after hardening

New Knowledge tables no longer produce `RLS enabled no policy` findings or unindexed-FK findings.

Remaining relevant advisor items are pre-existing/intentional project-wide items:
- `push_vapid_config` RLS/no-policy INFO;
- authenticated SECURITY DEFINER RPC warnings. New Knowledge RPCs are intentionally in this pattern and perform explicit `auth.uid()`/profile/permission checks;
- leaked-password-protection warning remains;
- unused-index INFO is expected, including newly created indexes before production traffic exercises them.

Do not claim security warnings are zero.
