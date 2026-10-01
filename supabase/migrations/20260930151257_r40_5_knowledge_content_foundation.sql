-- BFStaff r40.5 Knowledge / Article Editor server foundation
-- Production-safe additive foundation. It does NOT switch any current read path
-- and does NOT import legacy articles. Existing r40.4 behavior remains unchanged.

create table public.knowledge_articles (
  id text primary key,
  category text not null,
  title text not null,
  description text not null default '',
  status text not null default 'draft',
  sort_order integer not null default 0,
  dashboard_featured boolean not null default false,
  search_text text not null default '',
  revision bigint not null default 1,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null,
  constraint knowledge_articles_id_check
    check (id ~ '^[A-Za-z0-9:_-]{1,100}$'),
  constraint knowledge_articles_category_check
    check (length(trim(category)) between 1 and 80),
  constraint knowledge_articles_title_check
    check (length(trim(title)) between 1 and 240),
  constraint knowledge_articles_description_check
    check (length(description) <= 1000),
  constraint knowledge_articles_status_check
    check (status in ('draft','published','archived')),
  constraint knowledge_articles_revision_check
    check (revision >= 1)
);

create table public.knowledge_article_media (
  id uuid primary key default gen_random_uuid(),
  article_id text null references public.knowledge_articles(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null default '',
  mime_type text not null,
  byte_size bigint not null,
  width integer not null,
  height integer not null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint knowledge_article_media_path_check
    check (length(storage_path) between 1 and 500),
  constraint knowledge_article_media_name_check
    check (length(original_name) <= 240),
  constraint knowledge_article_media_mime_check
    check (mime_type in ('image/png','image/jpeg','image/webp','image/gif')),
  constraint knowledge_article_media_size_check
    check (byte_size between 1 and 8388608),
  constraint knowledge_article_media_dimensions_check
    check (
      width between 1 and 12000
      and height between 1 and 12000
      and width::bigint * height::bigint <= 40000000
    )
);

create table public.knowledge_article_blocks (
  id text primary key,
  article_id text not null references public.knowledge_articles(id) on delete cascade,
  sort_order integer not null,
  block_type text not null,
  text_content text null,
  marks jsonb not null default '[]'::jsonb,
  heading_level smallint null,
  list_ordered boolean null,
  list_items jsonb null,
  media_id uuid null references public.knowledge_article_media(id) on delete restrict,
  legacy_src text null,
  alt_text text not null default '',
  caption text not null default '',
  media_name text not null default '',
  constraint knowledge_article_blocks_id_check
    check (id ~ '^[A-Za-z0-9:_-]{1,100}$'),
  constraint knowledge_article_blocks_type_check
    check (block_type in ('paragraph','heading','quote','list','separator','image')),
  constraint knowledge_article_blocks_sort_check
    check (sort_order >= 0),
  constraint knowledge_article_blocks_text_check
    check (text_content is null or length(text_content) <= 100000),
  constraint knowledge_article_blocks_alt_check
    check (length(alt_text) <= 1000),
  constraint knowledge_article_blocks_caption_check
    check (length(caption) <= 1000),
  constraint knowledge_article_blocks_name_check
    check (length(media_name) <= 240),
  constraint knowledge_article_blocks_heading_check
    check (
      (block_type = 'heading' and heading_level in (2,3))
      or (block_type <> 'heading' and heading_level is null)
    ),
  constraint knowledge_article_blocks_list_check
    check (
      (block_type = 'list' and list_ordered is not null and list_items is not null)
      or (block_type <> 'list' and list_ordered is null and list_items is null)
    ),
  constraint knowledge_article_blocks_image_check
    check (
      (block_type = 'image' and (media_id is not null or legacy_src is not null))
      or (block_type <> 'image' and media_id is null and legacy_src is null)
    )
);

-- Empty by default. It gives us a future per-user permission layer without
-- changing access-role or working-position semantics. Until explicit grants are
-- added, only active Owner/Admin can edit articles.
create table public.knowledge_editor_grants (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_publish boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create unique index knowledge_article_blocks_article_sort_uidx
  on public.knowledge_article_blocks(article_id, sort_order);
create index knowledge_articles_status_sort_idx
  on public.knowledge_articles(status, sort_order, updated_at desc);
create index knowledge_article_media_article_idx
  on public.knowledge_article_media(article_id, created_at);
create index knowledge_editor_grants_updated_idx
  on public.knowledge_editor_grants(updated_at desc);

alter table public.knowledge_articles enable row level security;
alter table public.knowledge_article_blocks enable row level security;
alter table public.knowledge_article_media enable row level security;
alter table public.knowledge_editor_grants enable row level security;

-- Data API contract: no direct browser access to content tables. Reads and
-- writes go through narrow RPCs. Service-role access is explicit for Edge Functions.
revoke all on public.knowledge_articles from anon, authenticated;
revoke all on public.knowledge_article_blocks from anon, authenticated;
revoke all on public.knowledge_article_media from anon, authenticated;
revoke all on public.knowledge_editor_grants from anon, authenticated;

grant select, insert, update, delete on public.knowledge_articles to service_role;
grant select, insert, update, delete on public.knowledge_article_blocks to service_role;
grant select, insert, update, delete on public.knowledge_article_media to service_role;
grant select, insert, update, delete on public.knowledge_editor_grants to service_role;

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
  )
$$;

create or replace function private.knowledge_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active is true
      and (
        p.is_owner is true
        or p.role = 'admin'::public.staff_role
      )
  )
$$;

create or replace function private.knowledge_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active is true
    ) then false
    when exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active is true
        and (
          p.is_owner is true
          or p.role = 'admin'::public.staff_role
        )
    ) then true
    else coalesce((
      select case p_permission
        when 'create' then g.can_create
        when 'edit' then g.can_edit
        when 'publish' then g.can_publish
        else false
      end
      from public.knowledge_editor_grants g
      where g.profile_id = auth.uid()
    ), false)
  end
$$;

create or replace function private.can_read_knowledge_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_staff()
    and (
      private.knowledge_permission('edit')
      or private.knowledge_permission('create')
      or private.knowledge_permission('publish')
      or exists (
        select 1
        from public.knowledge_article_media m
        join public.knowledge_articles a on a.id = m.article_id
        where m.storage_path = p_object_name
          and a.status = 'published'
      )
    )
$$;

revoke all on function private.is_active_staff() from public, anon, authenticated;
revoke all on function private.knowledge_is_privileged() from public, anon, authenticated;
revoke all on function private.knowledge_permission(text) from public, anon, authenticated;
revoke all on function private.can_read_knowledge_media(text) from public, anon, authenticated;
-- Storage RLS evaluates this helper as the authenticated role. Expose only the
-- final boolean media-read predicate, not role/grant internals.
grant execute on function private.can_read_knowledge_media(text) to authenticated;

create or replace function public.get_knowledge_editor_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_staff() then
    raise exception 'forbidden';
  end if;

  return jsonb_build_object(
    'can_read', true,
    'can_create', private.knowledge_permission('create'),
    'can_edit', private.knowledge_permission('edit'),
    'can_publish', private.knowledge_permission('publish'),
    'can_manage_permissions', private.knowledge_is_privileged()
  );
end;
$$;

create or replace function public.get_knowledge_articles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_staff() then
    raise exception 'forbidden';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'category', a.category,
        'title', a.title,
        'description', a.description,
        'status', a.status,
        'sort_order', a.sort_order,
        'dashboard_featured', a.dashboard_featured,
        'search_text', a.search_text,
        'revision', a.revision,
        'updated_at', a.updated_at,
        'published_at', a.published_at,
        'first_image', (
          select jsonb_build_object(
            'mediaId', b.media_id,
            'storagePath', m.storage_path,
            'legacySrc', b.legacy_src,
            'alt', b.alt_text
          )
          from public.knowledge_article_blocks b
          left join public.knowledge_article_media m on m.id = b.media_id
          where b.article_id = a.id
            and b.block_type = 'image'
          order by b.sort_order
          limit 1
        )
      )
      order by a.sort_order, a.title, a.id
    )
    from public.knowledge_articles a
    where a.status = 'published'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_knowledge_editor_articles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active_staff() then
    raise exception 'forbidden';
  end if;

  if not (
    private.knowledge_permission('create')
    or private.knowledge_permission('edit')
    or private.knowledge_permission('publish')
  ) then
    raise exception 'forbidden';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'category', a.category,
        'title', a.title,
        'description', a.description,
        'status', a.status,
        'sort_order', a.sort_order,
        'dashboard_featured', a.dashboard_featured,
        'revision', a.revision,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'published_at', a.published_at
      )
      order by
        case a.status when 'published' then 0 when 'draft' then 1 else 2 end,
        a.sort_order,
        a.title,
        a.id
    )
    from public.knowledge_articles a
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_knowledge_article(p_article_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_open_unpublished boolean := (
    private.knowledge_permission('create')
    or private.knowledge_permission('edit')
    or private.knowledge_permission('publish')
  );
  v_result jsonb;
begin
  if auth.uid() is null or not private.is_active_staff() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'id', a.id,
    'category', a.category,
    'title', a.title,
    'description', a.description,
    'status', a.status,
    'revision', a.revision,
    'sort_order', a.sort_order,
    'dashboard_featured', a.dashboard_featured,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'published_at', a.published_at,
    'blocks', coalesce((
      select jsonb_agg(
        case b.block_type
          when 'paragraph' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type,
            'content', jsonb_build_object(
              'text', coalesce(b.text_content,''),
              'marks', b.marks
            )
          )
          when 'quote' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type,
            'content', jsonb_build_object(
              'text', coalesce(b.text_content,''),
              'marks', b.marks
            )
          )
          when 'heading' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type,
            'level', b.heading_level,
            'content', jsonb_build_object(
              'text', coalesce(b.text_content,''),
              'marks', b.marks
            )
          )
          when 'list' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type,
            'ordered', b.list_ordered,
            'items', b.list_items
          )
          when 'separator' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type
          )
          when 'image' then jsonb_build_object(
            'id', b.id,
            'type', b.block_type,
            'mediaId', b.media_id,
            'storagePath', m.storage_path,
            'legacySrc', b.legacy_src,
            'alt', b.alt_text,
            'caption', b.caption,
            'name', b.media_name,
            'width', m.width,
            'height', m.height
          )
        end
        order by b.sort_order
      )
      from public.knowledge_article_blocks b
      left join public.knowledge_article_media m on m.id = b.media_id
      where b.article_id = a.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.knowledge_articles a
  where a.id = p_article_id
    and (a.status = 'published' or v_can_open_unpublished);

  if v_result is null then
    raise exception 'article_not_found';
  end if;

  return v_result;
end;
$$;

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
           or coalesce(v_mark->>'type','') not in ('bold','italic','highlight') then
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
             or coalesce(v_mark->>'type','') not in ('bold','italic','highlight') then
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

revoke all on function public.get_knowledge_editor_context() from public, anon;
revoke all on function public.get_knowledge_articles() from public, anon;
revoke all on function public.get_knowledge_editor_articles() from public, anon;
revoke all on function public.get_knowledge_article(text) from public, anon;
revoke all on function public.save_knowledge_article(jsonb,bigint) from public, anon;

grant execute on function public.get_knowledge_editor_context() to authenticated, service_role;
grant execute on function public.get_knowledge_articles() to authenticated, service_role;
grant execute on function public.get_knowledge_editor_articles() to authenticated, service_role;
grant execute on function public.get_knowledge_article(text) to authenticated, service_role;
grant execute on function public.save_knowledge_article(jsonb,bigint) to authenticated, service_role;

-- Expand the existing constrained audit vocabulary without changing old events.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action = any (array[
    'recipe_governance_update'::text,
    'profile_role_update'::text,
    'profile_position_update'::text,
    'profile_activation_update'::text,
    'credential_reset'::text,
    'profile_delete'::text,
    'operational_critical_update'::text,
    'checklist_definition_create'::text,
    'checklist_definition_update'::text,
    'checklist_definition_reorder'::text,
    'checklist_definition_delete'::text,
    'knowledge_article_create'::text,
    'knowledge_article_update'::text,
    'knowledge_article_archive'::text,
    'knowledge_article_restore'::text,
    'knowledge_permission_update'::text
  ]));

insert into storage.buckets(
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'knowledge-media',
  'knowledge-media',
  false,
  8388608,
  array['image/png','image/jpeg','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Browser write access to Storage is intentionally NOT granted. Uploads go
-- through knowledge-media-upload with service_role after server-side validation.
drop policy if exists "knowledge_media_staff_read" on storage.objects;
create policy "knowledge_media_staff_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'knowledge-media'
  and private.can_read_knowledge_media(name)
);
