# Material lifecycle release candidate

These files are local, unapplied release candidates. No production SQL, deployment, Git write, NocoDB mutation, or Storage deletion was performed. Supabase CLI is absent here; the files intentionally are ordered SQL patches instead of invented migration filenames.

## Install order and readiness

1. Confirm current main's knowledge foundation/security/integrity patches and attestation independent tickets v3 are installed. Keep the main v4.5 safeupdate correction and v4.6 delete-ticket patch. Back up knowledge, media metadata, the question/version bank, tickets/plans/settings, attempts, audit, and NocoDB records plus managed attachment bytes. Snapshot the current `save_knowledge_article` and mark-validator function definitions for rollback.
2. On the authorized release machine, discover the installed CLI with `supabase --help` and `supabase migration new --help`, then generate migration names with `supabase migration new r407_material_lifecycle`, rather than naming timestamped files by hand. Place the contents of `material-lifecycle-01.sql`, `material-lifecycle-02-underline.sql`, and `material-lifecycle-03-media-cleanup.sql` in that exact order in reviewed generated migrations. Each patch is transactional and intended for one application, not blind reruns. Do not replay old foundations on an existing deployment.
3. Patch 01 installs source cascades, required-material checks, ticket repair, private operation state and the narrow RPCs. It verifies active independent source groups do not span multiple topics in the same eligible pool. `material_pool_group_cross_topic` stops installation for explicit legacy-data reconciliation; no source identities are guessed. The same invariant is enforced for new/edited/reactivated questions. Patch 02 enables real UTF16 underline validation/save and its readiness flag. Patch 03 installs a private physical-cleanup outbox. All new tables have RLS, no browser policies, and revoked direct grants.
4. Deploy `app/supabase/functions/material-media-cleanup/index.ts` as a private POST endpoint, with JWT verification enabled when invoked with the legacy service-role JWT. Configure a private scheduled caller using that service credential; do not put it in the frontend or a public URL. The handler checks its Authorization header itself and calls the actual Storage `.remove()` API before acknowledging SQL metadata deletion. Invoke it with a detached test image, confirm the Storage object is physically absent, confirm the outbox is `completed`, and confirm a failed Storage call retries without accepting an expired claim token. Monitor 503 responses and stale leases. This deployment/scheduling is still a prerequisite, not performed here.
5. Only after patch 03 and the scheduled remover are verified, an authorized operator may activate knowledge lifecycle with:

   ```sql
   update private.material_lifecycle_configuration
   set knowledge_cleanup_ready=true where singleton=true;
   ```

   `get_material_lifecycle_capabilities()` remains `knowledgeLifecycle:false` / `knowledgeMediaCleanup:false` before this step. Underline is independently enabled by patch 02. Article archive is hooked into the existing save transaction even for an old client; permanent deletion additionally verifies the current article revision and edit + publish permission. New images detached on save enqueue immediately; abandoned unattached uploads enqueue after 24 hours. Fresh uploads are not collected. The source `assets/` legacy images are never Storage cleanup targets.
6. Recipe lifecycle requires the actual Worker changes in `app/cloudflare/worker-recipe-editor-v5.js`, plus all prerequisites below. Set `MATERIAL_LIFECYCLE_ENABLED=true` only after verification. The default is false. The Worker checks SQL and cleanup-service readiness before advertising `materialLifecycle:true` / `photoCleanup:true`; missing or failing dependencies close both capabilities. The Worker still validates the authenticated actor with main's `recipe_editor_access_context`. The service-only SQL saga rechecks the same current active Owner/Admin or eligible Senior positions (`bartender`, `bartender_bb`, `waiter`, `waiter_bb`, `manager`), and rejects Staff/hostess/inactive actors.
7. On the release database, run role/access advisors with the installed CLI's supported advisor command (discover `--help` first). Verify authenticated/anon callers cannot invoke the recipe saga or cleanup claim/finish RPCs or directly access private tables. Verify scoped article editors cannot acquire publish/delete access, and eligible Seniors retain main recipe access.

## Recipe prerequisites: serialization and physical cleanup

NocoDB and Supabase are separate stores; they cannot share a SQL transaction. The implementation is a durable saga with a per-source serialized Worker. It cascades the questions and repairs tickets in the durable SQL `prepare` transaction, then performs and verifies the intended NocoDB mutation, completes physical cleanup when deleting, and only then marks the saga complete. A failure returns an error and retains `prepared` state for the exact retry. Questions may therefore become unavailable while the source mutation is pending. Historical attempts and their recorded question revisions are never modified.

Bind a Cloudflare Durable Object namespace as `RECIPE_MATERIAL_WRITER` using exported class `RecipeMaterialWriter`. Route all record writes through this Worker and disable direct/out-of-band NocoDB writers before activation: NocoDB v2 does not provide a verified compare-and-swap API here, so read/check/write cannot protect against other writers. All Worker record PATCH/DELETE requests, including ordinary edits and restores, share the per-source writer. Add `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Worker secret; the browser continues using its own access token. SQL's recipe lifecycle RPC is granted only to `service_role` and rechecks current actor access on each command. Never grant it to the browser.

Example binding fragment, to merge into the reviewed real Worker configuration:

```toml
[[durable_objects.bindings]]
name = "RECIPE_MATERIAL_WRITER"
class_name = "RecipeMaterialWriter"

[[migrations]]
tag = "r407-recipe-material-writer"
new_sqlite_classes = ["RecipeMaterialWriter"]

[[services]]
binding = "RECIPE_PHOTO_CLEANUP"
service = "REPLACE_WITH_REVIEWED_PRIVATE_CLEANUP_SERVICE"
```

**Unimplemented external prerequisite:** this checkout contains no verified NocoDB physical attachment-delete API or reviewed storage adapter. A fake deletion endpoint would be unsafe. A real private service must be bound as `RECIPE_PHOTO_CLEANUP` before activating recipe lifecycle/photo replacement. Its exact contract is:

- `GET /capabilities` returns `{schemaVersion:1, physicalCleanup:true, durableReconciliation:true}` only when real managed-byte deletion, reference checks, persistence and retry/reconciliation are operational.
- `POST /operations` JSON `{command:"prepare",operationId,sourceRef,action:"delete"|"replace",before,expectedAfter}` durably reserves the complete old attachment identities before any destructive write. It returns `{ok:true,operationId,phase:"prepared"}`. Repeating prepare is idempotent; a replacement can fill `expectedAfter` after its upload. A null `expectedAfter` for replacement is a reservation, not permission to delete old bytes.
- For replacement uploads the Worker sends multipart `POST /operations` with `command=upload`, `operationId`, `sourceRef`, and `photo`. The adapter must durably track uploaded managed bytes, then return `{ok:true,operationId,phase:"uploaded",files:[...],directUrl:"..."}`. This is required so a lost upload/write response can be reconciled and an unused new upload collected. The Worker does not directly upload a replacement behind the adapter's back.
- JSON `{command:"complete",operationId,sourceRef}` verifies the current record is deleted or matches the reserved replacement and checks references in both recipe tables and the adapter's pending operations. Delete only unreferenced managed attachments using the actual backing-storage/NocoDB-supported API; detach external URLs without attempting to delete their remote files. Return `{ok:true,operationId,phase:"completed"}` only after physical deletion is confirmed. Missing managed objects count as already removed. Network errors, failed reference checks and incomplete reconciliation must return an error.
- Persist jobs before acknowledging prepare/upload, retry interrupted jobs, and reconcile a lost Worker response against the authoritative current NocoDB record. Do not delete old bytes if the record mutation failed or a managed object remains referenced. Repeated prepare/complete calls must remain safe across process restarts. Adapter credentials and endpoint selection come from server configuration, never browser payloads.

Normal recipe create/edit continues through main APIs. Replacement/removal and lifecycle actions fail closed when their required cleanup capability is absent. Creating a new recipe uses main's upload API; garbage collection of an upload whose initial create never commits remains the deployment adapter's separate reconciliation responsibility.

## API and recovery

Knowledge frontend uses `save_knowledge_article(document, expectedRevision)` for archive and `delete_knowledge_article(p_article_id,p_expected_revision)` for deletion. Delete returns `{id,deleted:true,affectedQuestions,affectedTickets}`. Articles use real shared IDs; question metadata and direct canonical legacy routes match by source identity, never by title. Attestation material must point to a published known knowledge article or a syntactically valid unblocked source-qualified recipe route. Supabase cannot check live NocoDB row existence in this SQL transaction; the recipe picker uses the actual menu API. This is not a claim of cross-store referential integrity.

Recipe archive/delete requires `Idempotency-Key` UUID, `confirm_material_lifecycle:true`, and string `expected_version` (empty is allowed for a legacy blank version). Requests return success only with `materialLifecycle:{operationId,phase:"completed",affectedQuestions,affectedTickets}`. Ordinary full-editor saves of an already archived recipe remain ordinary edits. Photo changes are performed separately from archive. Restoring a source leaves its archived questions archived, and clears only its archive tombstone after the source update.

When a recipe request fails, repeat the same operation ID, actor, expected version and exact payload. SQL rejects changed parameters or a different actor. A pending operation blocks other record edits even if cleanup readiness becomes unavailable. A completed replay returns its persisted result without issuing a second NocoDB mutation. If the UI reload loses its operation ID, a trusted operator can inspect `private.recipe_material_operations` and replay the original authenticated request using the stored payload; do not issue a new destructive operation or manually mark a job complete. The active actor must still hold main's recipe permission. There is intentionally no rollback of archived/deleted questions after the external phase starts.

Ticket repair preserves original size, maximizes retained planned topic slots, then minimizes the change to an explicit venue quota. If that size is impossible, it archives the ticket and retains its definition/plan. The main quota/capacity integrity guard validates the final transaction. Question business deletion uses main's `status='deleted'` contract, preserving immutable revision snapshots; attempts remain untouched.

## Rollback

First set `MATERIAL_LIFECYCLE_ENABLED=false`, disable destructive entry points, and set `knowledge_cleanup_ready=false`. Keep the per-source writer and pending protection in place until prepared recipe operations have been reconciled. Stop the cleanup schedule before investigating Storage issues; unprocessed outbox jobs safely retain their identities and can later resume. Do not delete the private operation/outbox tables while work is pending. The SQL/UI flags are reversible; deleted attachment bytes, source rows and business-deleted questions cannot be restored merely by rolling back code.

For an application rollback retain the additive tables/RPCs/triggers and return the frontend to the prior approved release. Underline documents require an underline-capable reader; do not deploy a reader that discards those marks. If complete database removal is required, first finish/reconcile pending sagas and outbox jobs, back up all new state, restore the captured prior `save_knowledge_article`/mark validator bodies, then remove only the new triggers/functions/tables in reverse dependency order. Restore source/question data from the reviewed backup when required; never rewrite historical attempt snapshots. Reverting the audit constraint is optional and must preserve any events already recorded.

## Executed local evidence

From `app/`:

```sh
node tests/material-lifecycle-sql.mjs
node tests/material-lifecycle-worker.mjs
node --test tests/material-media-cleanup.test.cjs
```

The SQL test runs real checked-in foundation/v3 SQL and all three exact ordered patches inside in-memory PGlite. Profiles/Auth/Storage/attempts prerequisites are synthetic because their original CREATE TABLE statements are absent from this checkout. It checks readiness, underline ranges, authorization/revision rejection, topic/quota repair, impossible tickets, stable attempt/version snapshots, deletion counts, mandatory links, senior access, and cleanup claim/attach/failure/idempotency behavior. Worker tests execute the actual Worker and Durable Object with transport mocks; Edge tests execute the actual private handler with mocked SDK calls. These tests verify local logic, not deployed services, real Storage bytes, Cloudflare bindings, NocoDB storage behavior, SQL advisors, or network concurrency across live stores.
