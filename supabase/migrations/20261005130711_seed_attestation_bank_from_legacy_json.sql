-- Production data migration marker.
-- The 334-question legacy bank was imported into Supabase on 2026-10-05.
-- Question content is intentionally NOT stored in Git after the online-bank cutover.
-- Restore question data from the encrypted Supabase backup/export, not from repository assets.
select 1;
