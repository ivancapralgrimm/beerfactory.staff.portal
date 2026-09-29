# BeerFactory Staff Portal · r40.4 Handover

## Product model

Handover is a shared operational feed, not a private chat.

Every authenticated active employee sees the same retained notes:
- on the Dashboard;
- in the Handover section.

Each note has:
- category;
- priority;
- status;
- author;
- acknowledged employee/time;
- resolved employee/time;
- optional shared operational-day `shift_id`.

## Categories

- bar
- kitchen
- hall
- equipment
- purchasing
- other

## Priorities

- normal
- high
- critical

## Status lifecycle

`new` → `acknowledged` → `resolved`

A note may also move directly from `new` to `resolved`.
The existing constrained RPC marks acknowledgement automatically when resolving.

## Creation

React uses `public.create_handover(...)`.

Rules:
- authenticated staff only;
- anonymous RPC execution explicitly revoked;
- author comes from `auth.uid()`;
- body is trimmed;
- 1–2000 characters;
- if a shared operational-day row already exists during the active 11:00–03:00 window, the note is linked to it;
- Handover never creates or opens a Shift just by creating a note.

## Visibility

`notes_staff_read` makes retained notes readable to authenticated staff with a valid current role.

The React Dashboard and Handover page use the same shared feed.
`notes` is already in the Supabase Realtime publication, so open clients refresh when a note changes.

## Retention

Current history was intentionally reset before r40.4 Handover QA.

Retention policy:
- keep notes for 60 days;
- applies to resolved and unresolved notes;
- monthly cleanup on the first day of the month;
- cron job: `beerfactory-handover-retention`;
- cleanup function is private and not executable by client roles.

## Legacy compatibility

Stable r40.3 still uses direct INSERT into allowed `notes` columns.

Therefore the migration:
- removes `anon` table access;
- removes authenticated `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`;
- keeps authenticated read access;
- does not remove the existing legacy column-level INSERT/UPDATE grants before the r40.4 release gate.

After r40.4 replaces production, those remaining legacy mutation grants should be reviewed again.

## Push notifications

Handover creation is integrated with Web Push.
Subscribed active employees receive a system notification, excluding the author.
Notification setup is per device in Profile and is optional.
See `R40_4_HANDOVER_PUSH.md`.
