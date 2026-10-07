# BFStaff online attestation bank

## Source of truth

Supabase is the source of truth for attestation questions, categories, ticket plans and global test settings. Repository JSON/TXT question payloads remain temporarily only as a rollback bridge until preview QA is complete.

Production currently contains 334 imported questions:
- Bar: 60
- Kitchen: 110
- Wine: 50
- Service: 114

Current global settings:
- pass threshold: 80%
- questions per ticket: 15

The editor is available inside Profile -> Staff management -> Attestations and contains three views:
- Results
- Questions
- Settings

## Editor capabilities

### Questions

- Create and edit questions.
- Four answers with exactly one correct answer.
- Category, topic and optional subcategory.
- Source and review metadata.
- Archive, restore and soft-delete.
- Revision-conflict protection.

### Settings

- Pass threshold from 50 to 100%.
- Ticket size from 1 to 50 questions.
- Per-category ticket plan: topic + number of questions.
- Capacity validation against active question groups.
- Global revision-conflict protection.

### Categories

- Create a category.
- Rename it.
- Change display order.
- Disable / restore it.

New categories start disabled. Questions and a ticket plan can be prepared while disabled. Activation is blocked until the ticket plan total equals the global ticket size and enough active question groups exist for every planned topic.

## Hierarchy

- Category: Bar / Kitchen / Wine / Service plus admin-created categories.
- Topic: ticket-plan grouping.
- Subcategory: optional finer grouping.
- Group key: prevents multiple near-duplicate questions from the same source group entering one ticket.

## Offline

The latest valid bank is cached in IndexedDB. Completed attempts are stored in an IndexedDB outbox before remote submission. Reconnect/focus/visibility events retry the outbox. Server submission is idempotent by `client_attempt_id`.

## Clean r40.6 architecture

Attestation synchronization is mounted only after authentication through `AttestationSyncBridge` inside `AppShell`. It does not subscribe to Supabase Auth and cannot participate in the login bootstrap.

The foundation migration `20261005130639_attestation_bank_online_editor_foundation.sql` is restored in source control to match the already-applied live schema. The full editor admin layer is recorded in `20261006211201_attestation_editor_settings_categories.sql`.

## Repository state after QA

The old attestation payloads were removed after the online-bank preview passed.
Question content now comes from Supabase and the authenticated offline cache.
Knowledge fallback assets remain separate from this cutover.
