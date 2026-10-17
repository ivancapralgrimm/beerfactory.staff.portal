-- BFStaff r40.6 v4.6: Delete ticket definitions safely, without deleting questions or results.
-- Only administrators/owner may call this RPC. It is not a bulk-delete API.
-- Existing r40.6 database conventions: snapshot questions/attempts; ticket-plan FK CASCADE;
-- questions.category_id FK RESTRICT; safeupdate extension on PostgREST.

CREATE OR REPLACE FUNCTION public.delete_attestation_category_v3(
  p_category_id text,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old public.attestation_categories%rowtype;
  v_revision bigint;
  v_preserved_results integer;
BEGIN
  IF NOT private.attestation_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_category_id IS NULL OR btrim(p_category_id) = '' OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'attestation_ticket_delete_invalid';
  END IF;

  -- Serialize alongside save_attestation_editor_settings_v3 and question writes.
  PERFORM 1 FROM public.attestation_settings WHERE singleton=true FOR UPDATE;
  SELECT * INTO v_old
  FROM public.attestation_categories
  WHERE id=p_category_id FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'attestation_category_not_found';
  END IF;
  IF v_old.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'attestation_ticket_delete_revision_conflict';
  END IF;

  -- Question bank is global, and these question rows must NEVER disappear as
  -- a side-effect of deleting a ticket. Even archived/deleted questions block.
  IF EXISTS (
    SELECT 1 FROM public.attestation_questions
    WHERE category_id=p_category_id
  ) THEN
    RAISE EXCEPTION 'attestation_ticket_delete_questions_exist';
  END IF;

  IF v_old.is_active AND
    (SELECT count(*) FROM public.attestation_categories WHERE is_active=true) <= 1 THEN
    RAISE EXCEPTION 'attestation_ticket_last_active';
  END IF;

  -- Historical attempts carry immutable snapshots and a text category_id, with
  -- no FK to the ticket table. They must remain for employees and audit.
  SELECT count(*) INTO v_preserved_results FROM public.quiz_attempts
  WHERE category_id=p_category_id;

  -- The ticket-plan rows are removed via ON DELETE CASCADE. Always include
  -- a WHERE clause: PostgREST's safeupdate extension rejects unconditional DELETEs.
  DELETE FROM public.attestation_categories WHERE id=p_category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'attestation_ticket_delete_failed'; END IF;

  -- All surviving active tickets must remain valid after deletion.
  PERFORM private.attestation_v3_assert_all();
  UPDATE public.attestation_settings
  SET revision=revision+1,updated_at=clock_timestamp(),updated_by=auth.uid()
  WHERE singleton=true
  RETURNING revision INTO v_revision;

  RETURN jsonb_build_object(
    'id',v_old.id,
    'label',v_old.label,
    'deleted',true,
    'preservedResults',v_preserved_results,
    'revision',v_revision
  );
END;
$function$;

-- Privileged function has explicit permissions; public/anon cannot invoke it.
REVOKE ALL ON FUNCTION public.delete_attestation_category_v3(text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_attestation_category_v3(text,timestamptz)
  TO authenticated;

-- Refresh PostgREST schema cache for the new RPC.
NOTIFY pgrst, 'reload schema';
