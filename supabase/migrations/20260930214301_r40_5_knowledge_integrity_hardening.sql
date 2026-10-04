create or replace function private.knowledge_utf16_length(p_text text)
returns integer
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(
    sum(case when octet_length(ch) = 4 then 2 else 1 end),
    0
  )::integer
  from regexp_split_to_table(coalesce(p_text, ''), '') as ch
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
         or coalesce(v_mark->>'type','') not in ('bold','italic','highlight')
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
           or coalesce(v_mark->>'type','') not in ('bold','italic','highlight')
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

drop trigger if exists knowledge_article_blocks_validate_marks
on public.knowledge_article_blocks;

create trigger knowledge_article_blocks_validate_marks
before insert or update of block_type, text_content, marks, list_items
on public.knowledge_article_blocks
for each row
execute function private.knowledge_validate_block_marks();

create or replace function private.knowledge_build_search_text(
  p_article_id text,
  p_title text,
  p_category text,
  p_description text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select trim(
    regexp_replace(
      concat_ws(
        ' ',
        coalesce(p_title, ''),
        coalesce(p_category, ''),
        coalesce(p_description, ''),
        coalesce((
          select string_agg(
            concat_ws(
              ' ',
              case
                when b.block_type in ('paragraph','heading','quote')
                  then coalesce(b.text_content, '')
                else null
              end,
              case
                when b.block_type = 'list' then (
                  select string_agg(
                    coalesce(item.value->>'text',''),
                    ' ' order by item.ordinality
                  )
                  from jsonb_array_elements(coalesce(b.list_items,'[]'::jsonb))
                    with ordinality as item(value, ordinality)
                )
                else null
              end,
              nullif(b.alt_text, ''),
              nullif(b.caption, '')
            ),
            ' ' order by b.sort_order
          )
          from public.knowledge_article_blocks b
          where b.article_id = p_article_id
        ), '')
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
$$;

create or replace function private.knowledge_set_article_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := private.knowledge_build_search_text(
    new.id,
    new.title,
    new.category,
    new.description
  );
  return new;
end;
$$;

drop trigger if exists knowledge_articles_normalize_search_text
on public.knowledge_articles;

create trigger knowledge_articles_normalize_search_text
before insert or update of title, category, description, search_text
on public.knowledge_articles
for each row
execute function private.knowledge_set_article_search_text();

create or replace function private.knowledge_guard_article_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('bfstaff:knowledge:' || new.id, 0)
  );

  if exists (
    select 1
    from public.knowledge_articles a
    where a.id = new.id
  ) then
    raise exception 'article_revision_conflict';
  end if;

  return new;
end;
$$;

drop trigger if exists knowledge_articles_insert_guard
on public.knowledge_articles;

create trigger knowledge_articles_insert_guard
before insert
on public.knowledge_articles
for each row
execute function private.knowledge_guard_article_insert();

revoke all on function private.knowledge_utf16_length(text)
  from public, anon, authenticated;
revoke all on function private.knowledge_validate_block_marks()
  from public, anon, authenticated;
revoke all on function private.knowledge_build_search_text(text,text,text,text)
  from public, anon, authenticated;
revoke all on function private.knowledge_set_article_search_text()
  from public, anon, authenticated;
revoke all on function private.knowledge_guard_article_insert()
  from public, anon, authenticated;
