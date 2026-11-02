-- Durable Storage API outbox: SQL metadata deletion alone does not delete bytes.
begin;
create table private.knowledge_media_cleanup (
 id uuid primary key default gen_random_uuid(),
 media_id uuid not null,
 storage_path text not null unique,
 state text not null default 'queued' check(state in ('queued','processing','completed','cancelled')),
 attempts integer not null default 0,
 lease_until timestamptz,
 claim_token uuid,
 last_error text,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
alter table private.knowledge_media_cleanup enable row level security;
revoke all on private.knowledge_media_cleanup from public,anon,authenticated,service_role;

create function private.knowledge_media_cleanup_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or (old.article_id is not null and new.article_id is null) then
   insert into private.knowledge_media_cleanup(media_id,storage_path) values(old.id,old.storage_path)
   on conflict(storage_path) do update set state='queued',lease_until=null,completed_at=null;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger knowledge_media_cleanup_enqueue after update of article_id or delete
 on public.knowledge_article_media for each row execute function private.knowledge_media_cleanup_trigger();

create function private.knowledge_media_cleanup_attach_guard()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.article_id is not null and old.article_id is null then
   -- A claimed object may already have been physically deleted. Do not reattach.
   if exists(select 1 from private.knowledge_media_cleanup where media_id=new.id and state in ('processing','completed')) then
     raise exception 'article_media_cleanup_in_progress';
   end if;
   update private.knowledge_media_cleanup set state='cancelled',completed_at=clock_timestamp()
   where media_id=new.id and state='queued';
 end if;
 return new;
end $$;
create trigger knowledge_media_cleanup_attach_guard before update of article_id
 on public.knowledge_article_media for each row execute function private.knowledge_media_cleanup_attach_guard();

create function public.claim_knowledge_media_cleanup(p_limit integer default 50)
returns table(id uuid,storage_path text,claim_token uuid)
language plpgsql security definer set search_path='' as $$
declare job private.knowledge_media_cleanup%rowtype; media public.knowledge_article_media%rowtype;
begin
 -- Also collect abandoned uploads after a full day. Fresh uploads can still be
 -- attached by the existing save RPC; detached former images enqueue immediately.
 insert into private.knowledge_media_cleanup(media_id,storage_path)
 select m.id,m.storage_path from public.knowledge_article_media m
 where m.article_id is null and m.created_at<clock_timestamp()-interval '24 hours'
   and not exists(select 1 from public.knowledge_article_blocks b where b.media_id=m.id)
 on conflict on constraint knowledge_media_cleanup_storage_path_key do nothing;
 for job in select c.* from private.knowledge_media_cleanup c
   where c.state='queued' or (c.state='processing' and c.lease_until<clock_timestamp())
   order by c.created_at limit greatest(1,least(coalesce(p_limit,50),100))
 loop
   -- Same media -> outbox lock order as the attach/detach triggers.
   select * into media from public.knowledge_article_media where knowledge_article_media.id=job.media_id for update skip locked;
   if not found and exists(select 1 from public.knowledge_article_media m where m.id=job.media_id) then continue; end if;
   select * into job from private.knowledge_media_cleanup c where c.id=job.id
     and (c.state='queued' or (c.state='processing' and c.lease_until<clock_timestamp()))
     for update skip locked;
   if not found then continue; end if;
   if media.article_id is not null or exists(select 1 from public.knowledge_article_blocks where media_id=job.media_id) then
     update private.knowledge_media_cleanup set state='cancelled',completed_at=clock_timestamp() where knowledge_media_cleanup.id=job.id;
     continue;
   end if;
   update private.knowledge_media_cleanup set state='processing',attempts=attempts+1,
     lease_until=clock_timestamp()+interval '5 minutes',claim_token=gen_random_uuid()
     where knowledge_media_cleanup.id=job.id returning knowledge_media_cleanup.claim_token into job.claim_token;
   id:=job.id; storage_path:=job.storage_path; claim_token:=job.claim_token; return next;
 end loop;
end $$;

create function public.finish_knowledge_media_cleanup(p_id uuid,p_claim_token uuid,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare job private.knowledge_media_cleanup%rowtype;
begin
 select * into job from private.knowledge_media_cleanup where id=p_id;
 if job.id is null then raise exception 'media_cleanup_job_invalid'; end if;
 perform 1 from public.knowledge_article_media where id=job.media_id for update;
 select * into job from private.knowledge_media_cleanup where id=p_id for update;
 if job.state='completed' and job.claim_token=p_claim_token then return; end if;
 if job.state<>'processing' or job.claim_token is distinct from p_claim_token then raise exception 'media_cleanup_job_invalid'; end if;
 if p_error is not null then
   update private.knowledge_media_cleanup set last_error=left(p_error,500),lease_until=clock_timestamp()+interval '5 minutes' where id=p_id;
   return;
 end if;
 if exists(select 1 from public.knowledge_article_blocks where media_id=job.media_id)
   or exists(select 1 from public.knowledge_article_media where id=job.media_id and article_id is not null)
 then raise exception 'media_cleanup_referenced'; end if;
 -- Enqueue trigger runs on metadata deletion; mark completed after it runs.
 delete from public.knowledge_article_media where id=job.media_id;
 update private.knowledge_media_cleanup set state='completed',completed_at=clock_timestamp(),lease_until=null,last_error=null where id=p_id;
end $$;

revoke all on function private.knowledge_media_cleanup_trigger() from public,anon,authenticated,service_role;
revoke all on function private.knowledge_media_cleanup_attach_guard() from public,anon,authenticated,service_role;
revoke all on function public.claim_knowledge_media_cleanup(integer) from public,anon,authenticated;
revoke all on function public.finish_knowledge_media_cleanup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_knowledge_media_cleanup(integer) to service_role;
grant execute on function public.finish_knowledge_media_cleanup(uuid,uuid,text) to service_role;
commit;
