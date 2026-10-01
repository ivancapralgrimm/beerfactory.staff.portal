create index knowledge_article_blocks_media_idx
  on public.knowledge_article_blocks(media_id)
  where media_id is not null;

create index knowledge_article_media_created_by_idx
  on public.knowledge_article_media(created_by)
  where created_by is not null;

create index knowledge_articles_created_by_idx
  on public.knowledge_articles(created_by)
  where created_by is not null;

create index knowledge_articles_updated_by_idx
  on public.knowledge_articles(updated_by)
  where updated_by is not null;

create index knowledge_editor_grants_updated_by_idx
  on public.knowledge_editor_grants(updated_by)
  where updated_by is not null;

create policy "knowledge_articles_browser_direct_deny"
on public.knowledge_articles
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "knowledge_blocks_browser_direct_deny"
on public.knowledge_article_blocks
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "knowledge_media_browser_direct_deny"
on public.knowledge_article_media
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy "knowledge_grants_browser_direct_deny"
on public.knowledge_editor_grants
as restrictive
for all
to anon, authenticated
using (false)
with check (false);
