# r40.5 backend review requests — post-review status

## Backend-owner resolution after Codex UX pass

- **BR-01 RESOLVED** by live migration `20260930214301_r40_5_knowledge_integrity_hardening`: database trigger rejects missing/non-integer/out-of-range mark offsets and measures supplementary Unicode characters in JavaScript UTF-16 units. Invalid marks fail transactionally with `article_mark_invalid`.
- **BR-02 RESOLVED** by the same migration: article search text is normalized server-side and list items contribute only their plain `text`, not serialized JSON/marks.
- **BR-03 RESOLVED** by the same migration: an article-ID advisory transaction lock plus insert guard normalizes duplicate/simultaneous creates to `article_revision_conflict`.
- **BR-04 HARDENED** in live `knowledge-media-upload` v2: `@supabase/supabase-js` is pinned to `2.116.0`; PNG/GIF/JPEG/WebP containers receive bounded structural validation before Storage in addition to signature/dimension checks. This deliberately avoids a heavyweight WASM decoder for the normal 8 MiB upload path. Real-device/live upload QA remains required.

The original Codex findings are retained below as historical review context.

The supplied Live Sync foundation is authoritative and already applied. The initial
request for get_knowledge_editor_articles is CLOSED: that RPC exists. Five context
flags, object first_image, metadata/order, private media/pending binding and expected
revision are adopted by frontend. No table/RPC/API replacement is requested.

Do not change live from this file and do not rewrite already-applied migrations.
Any backend correction requires separate backend-owner review and authorization.

## BR-01: server mark bounds/null validation (review before production cutover)

In foundation SQL lines 648–663 and 679–700, mark from/to are cast to integer and
only from < 0 / to <= from are rejected. Missing/null offsets can evade that IF,
and to beyond JavaScript UTF-16 text length is accepted. A privileged or explicitly
granted caller can submit such JSON outside the UI. Frontend rejects it and may
then fail to load a document saved by a different caller. This is a server data
integrity/availability finding, not evidence Staff can bypass authorization.

Required invariant for BOTH content.marks and list item.marks: from and to are
present, non-null integer values, and 0 <= from < to <= UTF-16 code-unit length of
that particular text. Preserve emoji offsets (🍺 = two UTF-16 units). Reject invalid
marks transactionally with article_mark_invalid; do not silently clamp data.
Frontend tests retain valid offsets and never send malformed marks. No fix applied
here because supplied applied migrations/Edge must remain exact.

## BR-02: saved list search corpus (nonblocking consistency)

Foundation lines 826–844 append list_items::text JSON after save, unlike the plain
item.text seed search. This can expose field/mark names in search results and
inflate reading-time estimates. Required behavior after a reviewed correction:
concatenate ordered plain item.text, with paragraph text / image alt / caption and
metadata, without JSON field names or mark objects. No frontend schema change needed.

## BR-03: simultaneous creation of the same new ID (error normalization)

Existing articles use FOR UPDATE and revision checks correctly. For a missing row,
FOR UPDATE locks no row; concurrent same-ID inserts may give unique_violation
instead of article_revision_conflict. UUID-generated UI IDs make this unlikely.
Review mapping to article_revision_conflict without losing either user's draft.
Frontend already preserves text for generic failures and never forcibly retries.

## BR-04: Edge image inspection / dependency review

The exact deployed-source reference sniffs PNG/GIF/JPEG/WebP signatures/dimensions;
it does not fully decode/re-encode an image or prove payload structural validity.
Browser prepareKnowledgeImage additionally decodes the image, but direct authorized
Edge callers can bypass the browser. Review rejection of malformed payloads and
parser/resource limits. Dependency npm:@supabase/supabase-js@2 remains exactly as
supplied; reproducibility and advisory review belong to the server workstream.
Do not conflate source SHA with the provided deployed ezbr SHA.

Pending/replaced objects stay server owned. Review eventual cleanup separately;
frontend performs no remote delete. Signed links can outlive revoked access until
TTL. SECURITY DEFINER functions are intentional, with empty search_path; uploaded
advisory notes are not a claim that all security warnings were resolved.

Real RLS/RPC/Edge checks remain NEEDS_LIVE_QA. No changes to production data/users,
permissions, live migrations or deployed functions were performed by Codex.
