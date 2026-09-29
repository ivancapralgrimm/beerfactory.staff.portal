alter table public.audit_log
  drop constraint if exists audit_log_action_check;

alter table public.audit_log
  add constraint audit_log_action_check
  check (
    action = any (
      array[
        'recipe_governance_update'::text,
        'profile_role_update'::text,
        'profile_activation_update'::text,
        'credential_reset'::text,
        'profile_delete'::text,
        'operational_critical_update'::text,
        'checklist_definition_create'::text,
        'checklist_definition_update'::text,
        'checklist_definition_reorder'::text
      ]
    )
  );
