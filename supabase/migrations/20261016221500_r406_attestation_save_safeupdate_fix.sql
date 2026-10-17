-- BFStaff r40.6 v4.5 — fix the actual ticket-save failure on Supabase PostgREST.
-- PostgreSQL log 2026-10-16 21:45–21:47 UTC:
--   DELETE requires a WHERE clause
--   SQL statement "delete from public.attestation_ticket_plan"
--   PL/pgSQL function public.save_attestation_editor_settings_v3(...) line 48.
-- PostgREST connects with the safeupdate session library enabled. The legacy
-- unqualified DELETE was rejected despite otherwise valid ticket settings.
--
-- We deliberately patch the *existing* function definition, preserving its
-- signature, security-definer context, search_path, grants and all validation.
-- The matching WHERE selects existing ticket categories; it changes no
-- business semantics because the FK prohibits plan rows for absent categories.
--
-- Safe to rerun. Abort if the live function differs from the audited version.
DO $bfstaff_safeupdate_fix$
DECLARE
  v_definition text;
  v_target_constant constant text := 'delete from public.attestation_ticket_plan;';
  v_fixed_constant constant text := 'delete from public.attestation_ticket_plan where category_id in (select id from public.attestation_categories);';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_definition
  FROM pg_proc AS p
  JOIN pg_namespace AS ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname = 'save_attestation_editor_settings_v3'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_pass_percent smallint, p_category_settings jsonb, p_ticket_plan jsonb, p_expected_revision bigint';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'BFStaff v4.5: expected attestation settings function not found; no changes made';
  END IF;

  IF strpos(v_definition, v_fixed_constant) > 0 THEN
    RAISE NOTICE 'BFStaff v4.5: server function already patched';
    RETURN;
  END IF;

  IF strpos(v_definition, v_target_constant) = 0 THEN
    RAISE EXCEPTION 'BFStaff v4.5: function body differs from audited version; no changes made';
  END IF;

  EXECUTE replace(v_definition, v_target_constant, v_fixed_constant);
  RAISE NOTICE 'BFStaff v4.5: saved the corrected server function';
END
$bfstaff_safeupdate_fix$;

-- Expected result: fixed = true. This query does not change data.
SELECT
  strpos(pg_get_functiondef(p.oid),
    'delete from public.attestation_ticket_plan where category_id in (select id from public.attestation_categories);') > 0
    AS fixed,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS ns ON ns.oid = p.pronamespace
WHERE ns.nspname = 'public'
  AND p.proname = 'save_attestation_editor_settings_v3';
