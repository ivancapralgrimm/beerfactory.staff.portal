-- OFFLINE REVIEW CANDIDATE. Existing function bodies, only underline allowlists extended.
begin;

create or replace function public.save_knowledge_article(
  p_document jsonb,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id text := trim(coalesce(p_document->>'id',''));
  v_title text := trim(coalesce(p_document->>'title',''));
  v_category text := trim(coalesce(p_document->>'category',''));
  v_description text := coalesce(p_document->>'description','');
  v_status text := coalesce(p_document->>'status','draft');
  v_blocks jsonb := coalesce(p_document->'blocks','[]'::jsonb);
  v_existing public.knowledge_articles%rowtype;
  v_saved public.knowledge_articles%rowtype;
  v_block jsonb;
  v_item jsonb;
  v_mark jsonb;
  v_index integer := 0;
  v_text_total bigint := 0;
  v_create boolean := false;
  v_media_id uuid;
  v_media_article text;
  v_media_creator uuid;
  v_referenced_media uuid[] := '{}'::uuid[];
  v_action text;
  v_from integer;
  v_to integer;
  v_old_featured boolean;
begin
  if v_actor is null or not private.is_active_staff() then
    raise exception 'forbidden';
  end if;

  if jsonb_typeof(p_document) <> 'object' then
    raise exception 'article_document_invalid';
  end if;

  if coalesce((p_document->>'schemaVersion')::integer, 0) <> 2 then
    raise exception 'article_schema_unsupported';
  end if;

  if v_id !~ '^[A-Za-z0-9:_-]{1,100}$' then
    raise exception 'article_id_invalid';
  end if;
  if length(v_title) < 1 or length(v_title) > 240 then
    raise exception 'article_title_invalid';
  end if;
  if length(v_category) < 1 or length(v_category) > 80 then
    raise exception 'article_category_invalid';
  end if;
  if length(v_description) > 1000 then
    raise exception 'article_description_invalid';
  end if;
  if v_status not in ('draft','published','archived') then
    raise exception 'article_status_invalid';
  end if;
  if jsonb_typeof(v_blocks) <> 'array'
     or jsonb_array_length(v_blocks) < 1
     or jsonb_array_length(v_blocks) > 200 then
    raise exception 'article_blocks_invalid';
  end if;

  select *
  into v_existing
  from public.knowledge_articles a
  where a.id = v_id
  for update;

  if v_existing.id is null then
    v_create := true;
    if not private.knowledge_permission('create') then
      raise exception 'forbidden';
    end if;
    if v_status <> 'draft' and not private.knowledge_permission('publish') then
      raise exception 'forbidden';
    end if;
    if p_expected_revision is not null and p_expected_revision <> 0 then
      raise exception 'article_revision_conflict';
    end if;

    insert into public.knowledge_articles(
      id,
      category,
      title,
      description,
      status,
      sort_order,
      dashboard_featured,
      revision,
      created_by,
      updated_by,
      created_at,
      updated_at,
      published_at
    ) values (
      v_id,
      v_category,
      v_title,
      v_description,
      v_status,
      coalesce((p_document->>'sort_order')::integer, 0),
      coalesce((p_document->>'dashboard_featured')::boolean, false),
      1,
      v_actor,
      v_actor,
      clock_timestamp(),
      clock_timestamp(),
      case when v_status = 'published' then clock_timestamp() else null end
    )
    returning * into v_saved;
  else
    if not private.knowledge_permission('edit') then
      raise exception 'forbidden';
    end if;
    if p_expected_revision is null or v_existing.revision <> p_expected_revision then
      raise exception 'article_revision_conflict';
    end if;

    v_old_featured := v_existing.dashboard_featured;

    if (
      v_existing.status <> v_status
      or v_old_featured <> coalesce((p_document->>'dashboard_featured')::boolean, v_existing.dashboard_featured)
    ) and not private.knowledge_permission('publish') then
      raise exception 'forbidden';
    end if;

    update public.knowledge_articles a
    set category = v_category,
        title = v_title,
        description = v_description,
        status = v_status,
        sort_order = coalesce((p_document->>'sort_order')::integer, a.sort_order),
        dashboard_featured = coalesce((p_document->>'dashboard_featured')::boolean, a.dashboard_featured),
        revision = a.revision + 1,
        updated_by = v_actor,
        updated_at = clock_timestamp(),
        published_at = case
          when v_status = 'published' and a.status <> 'published' then clock_timestamp()
          else a.published_at
        end
    where a.id = v_id
    returning * into v_saved;

    delete from public.knowledge_article_blocks
    where article_id = v_id;
  end if;

  for v_block in
    select value from jsonb_array_elements(v_blocks)
  loop
    if jsonb_typeof(v_block) <> 'object' then
      raise exception 'article_block_invalid';
    end if;
    if coalesce(v_block->>'id','') !~ '^[A-Za-z0-9:_-]{1,100}$' then
      raise exception 'article_block_id_invalid';
    end if;
    if coalesce(v_block->>'type','') not in ('paragraph','heading','quote','list','separator','image') then
      raise exception 'article_block_type_invalid';
    end if;

    if v_block->>'type' in ('paragraph','heading','quote') then
      if jsonb_typeof(v_block->'content') <> 'object' then
        raise exception 'article_block_content_invalid';
      end if;
      if jsonb_typeof(coalesce(v_block#>'{content,marks}','[]'::jsonb)) <> 'array' then
        raise exception 'article_marks_invalid';
      end if;
      if length(coalesce(v_block#>>'{content,text}','')) > 100000 then
        raise exception 'article_text_limit';
      end if;
      if v_block->>'type' = 'heading'
         and coalesce((v_block->>'level')::integer,0) not in (2,3) then
        raise exception 'article_heading_invalid';
      end if;

      for v_mark in
        select value from jsonb_array_elements(coalesce(v_block#>'{content,marks}','[]'::jsonb))
      loop
        if jsonb_typeof(v_mark) <> 'object'
           or coalesce(v_mark->>'type','') not in ('bold','italic','underline','highlight') then
          raise exception 'article_mark_invalid';
        end if;
        begin
          v_from := (v_mark->>'from')::integer;
          v_to := (v_mark->>'to')::integer;
        exception when others then
          raise exception 'article_mark_invalid';
        end;
        if v_from < 0 or v_to <= v_from then
          raise exception 'article_mark_invalid';
        end if;
      end loop;

      v_text_total := v_text_total + length(coalesce(v_block#>>'{content,text}',''));

    elsif v_block->>'type' = 'list' then
      if jsonb_typeof(v_block->'items') <> 'array'
         or jsonb_array_length(v_block->'items') < 1
         or jsonb_array_length(v_block->'items') > 100 then
        raise exception 'article_list_invalid';
      end if;

      for v_item in
        select value from jsonb_array_elements(v_block->'items')
      loop
        if jsonb_typeof(v_item) <> 'object'
           or jsonb_typeof(coalesce(v_item->'marks','[]'::jsonb)) <> 'array'
           or length(coalesce(v_item->>'text','')) > 100000 then
          raise exception 'article_list_invalid';
        end if;

        for v_mark in
          select value from jsonb_array_elements(coalesce(v_item->'marks','[]'::jsonb))
        loop
          if jsonb_typeof(v_mark) <> 'object'
             or coalesce(v_mark->>'type','') not in ('bold','italic','underline','highlight') then
            raise exception 'article_mark_invalid';
          end if;
          begin
            v_from := (v_mark->>'from')::integer;
            v_to := (v_mark->>'to')::integer;
          exception when others then
            raise exception 'article_mark_invalid';
          end;
          if v_from < 0 or v_to <= v_from then
            raise exception 'article_mark_invalid';
          end if;
        end loop;

        v_text_total := v_text_total + length(coalesce(v_item->>'text',''));
      end loop;

    elsif v_block->>'type' = 'image' then
      if length(coalesce(v_block->>'alt','')) > 1000
         or length(coalesce(v_block->>'caption','')) > 1000
         or length(coalesce(v_block->>'name','')) > 240 then
        raise exception 'article_image_metadata_invalid';
      end if;
      if nullif(v_block->>'mediaId','') is null
         and nullif(v_block->>'legacySrc','') is null then
        raise exception 'article_image_missing';
      end if;
      if nullif(v_block->>'legacySrc','') is not null
         and (v_block->>'legacySrc') !~ '^(?:/)?assets/[A-Za-z0-9_./-]+$' then
        raise exception 'article_legacy_image_invalid';
      end if;

      if nullif(v_block->>'mediaId','') is not null then
        begin
          v_media_id := (v_block->>'mediaId')::uuid;
        exception when invalid_text_representation then
          raise exception 'article_media_invalid';
        end;

        select m.article_id, m.created_by
        into v_media_article, v_media_creator
        from public.knowledge_article_media m
        where m.id = v_media_id
        for update;

        if not found then
          raise exception 'article_media_missing';
        end if;
        if v_media_article is not null and v_media_article <> v_id then
          raise exception 'article_media_conflict';
        end if;
        if v_media_article is null
           and v_media_creator is distinct from v_actor
           and not private.knowledge_is_privileged() then
          raise exception 'article_media_forbidden';
        end if;

        update public.knowledge_article_media
        set article_id = v_id
        where id = v_media_id;

        v_referenced_media := array_append(v_referenced_media, v_media_id);
      end if;
    end if;

    insert into public.knowledge_article_blocks(
      id,
      article_id,
      sort_order,
      block_type,
      text_content,
      marks,
      heading_level,
      list_ordered,
      list_items,
      media_id,
      legacy_src,
      alt_text,
      caption,
      media_name
    ) values (
      v_block->>'id',
      v_id,
      v_index * 10,
      v_block->>'type',
      case
        when v_block->>'type' in ('paragraph','heading','quote')
          then coalesce(v_block#>>'{content,text}','')
        else null
      end,
      case
        when v_block->>'type' in ('paragraph','heading','quote')
          then coalesce(v_block#>'{content,marks}','[]'::jsonb)
        else '[]'::jsonb
      end,
      case
        when v_block->>'type' = 'heading'
          then (v_block->>'level')::smallint
        else null
      end,
      case
        when v_block->>'type' = 'list'
          then coalesce((v_block->>'ordered')::boolean,false)
        else null
      end,
      case
        when v_block->>'type' = 'list'
          then v_block->'items'
        else null
      end,
      case
        when nullif(v_block->>'mediaId','') is null
          then null
        else (v_block->>'mediaId')::uuid
      end,
      nullif(v_block->>'legacySrc',''),
      coalesce(v_block->>'alt',''),
      coalesce(v_block->>'caption',''),
      coalesce(v_block->>'name','')
    );

    v_index := v_index + 1;
  end loop;

  if v_text_total > 500000 then
    raise exception 'article_total_text_limit';
  end if;

  -- Detach media removed from the latest document. The object is retained for
  -- recovery/cleanup, but ordinary staff immediately lose read access because
  -- it is no longer attached to a published article.
  update public.knowledge_article_media m
  set article_id = null
  where m.article_id = v_id
    and not (m.id = any(v_referenced_media));

  update public.knowledge_articles a
  set search_text = trim(concat_ws(
    ' ',
    a.title,
    a.category,
    a.description,
    coalesce((
      select string_agg(
        concat_ws(
          ' ',
          b.text_content,
          b.alt_text,
          b.caption,
          b.list_items::text
        ),
        ' ' order by b.sort_order
      )
      from public.knowledge_article_blocks b
      where b.article_id = a.id
    ), '')
  ))
  where a.id = v_id
  returning * into v_saved;

  v_action := case
    when v_create then 'knowledge_article_create'
    when v_existing.status <> 'archived' and v_saved.status = 'archived'
      then 'knowledge_article_archive'
    when v_existing.status = 'archived' and v_saved.status <> 'archived'
      then 'knowledge_article_restore'
    else 'knowledge_article_update'
  end;

  insert into public.audit_log(
    actor_id,
    action,
    entity_type,
    entity_id,
    entity_name,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor,
    v_action,
    'knowledge_article',
    v_saved.id,
    v_saved.title,
    case
      when v_create then '{}'::jsonb
      else jsonb_build_object(
        'category', v_existing.category,
        'title', v_existing.title,
        'status', v_existing.status,
        'revision', v_existing.revision,
        'dashboard_featured', v_existing.dashboard_featured
      )
    end,
    jsonb_build_object(
      'category', v_saved.category,
      'title', v_saved.title,
      'status', v_saved.status,
      'revision', v_saved.revision,
      'dashboard_featured', v_saved.dashboard_featured
    ),
    jsonb_build_object(
      'source', 'knowledge-editor',
      'schema_version', 2
    )
  );

  return jsonb_build_object(
    'id', v_saved.id,
    'revision', v_saved.revision,
    'status', v_saved.status,
    'created', v_create,
    'updated_at', v_saved.updated_at
  );
end;
$$;

create or replace function private.knowledge_validate_block_marks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mark jsonb;
  v_item jsonb;
  v_text text;
  v_from integer;
  v_to integer;
  v_length integer;
begin
  if new.block_type in ('paragraph','heading','quote') then
    if jsonb_typeof(new.marks) is distinct from 'array' then
      raise exception 'article_mark_invalid';
    end if;

    v_text := coalesce(new.text_content, '');
    v_length := private.knowledge_utf16_length(v_text);

    for v_mark in
      select value from jsonb_array_elements(new.marks)
    loop
      if jsonb_typeof(v_mark) is distinct from 'object'
         or coalesce(v_mark->>'type','') not in ('bold','italic','underline','highlight')
         or jsonb_typeof(v_mark->'from') is distinct from 'number'
         or jsonb_typeof(v_mark->'to') is distinct from 'number' then
        raise exception 'article_mark_invalid';
      end if;

      begin
        v_from := (v_mark->>'from')::integer;
        v_to := (v_mark->>'to')::integer;
      exception when others then
        raise exception 'article_mark_invalid';
      end;

      if v_from < 0
         or v_to <= v_from
         or v_to > v_length then
        raise exception 'article_mark_invalid';
      end if;
    end loop;
  elsif new.block_type = 'list' then
    if jsonb_typeof(new.list_items) is distinct from 'array' then
      raise exception 'article_list_invalid';
    end if;

    for v_item in
      select value from jsonb_array_elements(new.list_items)
    loop
      if jsonb_typeof(v_item) is distinct from 'object'
         or jsonb_typeof(coalesce(v_item->'marks','[]'::jsonb)) is distinct from 'array' then
        raise exception 'article_list_invalid';
      end if;

      v_text := coalesce(v_item->>'text', '');
      v_length := private.knowledge_utf16_length(v_text);

      for v_mark in
        select value
        from jsonb_array_elements(coalesce(v_item->'marks','[]'::jsonb))
      loop
        if jsonb_typeof(v_mark) is distinct from 'object'
           or coalesce(v_mark->>'type','') not in ('bold','italic','underline','highlight')
           or jsonb_typeof(v_mark->'from') is distinct from 'number'
           or jsonb_typeof(v_mark->'to') is distinct from 'number' then
          raise exception 'article_mark_invalid';
        end if;

        begin
          v_from := (v_mark->>'from')::integer;
          v_to := (v_mark->>'to')::integer;
        exception when others then
          raise exception 'article_mark_invalid';
        end;

        if v_from < 0
           or v_to <= v_from
           or v_to > v_length then
          raise exception 'article_mark_invalid';
        end if;
      end loop;
    end loop;
  end if;

  return new;
end;
$$;

update private.material_lifecycle_configuration set underline_ready=true where singleton=true;

commit;
