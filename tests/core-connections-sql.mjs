// Execute the exact prepared history/birthday SQL in isolated PostgreSQL.
// Fixtures are synthetic; no hosted database, accounts, SQL or writes are used.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const actor='10000000-0000-4000-8000-000000000001';
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const asActor=async(id=actor,role='authenticated')=>{
 await db.exec('reset role');await query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);
};
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,first_name text,last_name text,position_code text,is_active boolean,role text,birth_date date);
 create function private.current_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid() and is_active=true$$;
 create table public.shifts(id uuid primary key,shift_date date);
 create table public.position_shift_states(id uuid primary key,shift_id uuid,position_code text,status text,opened_at timestamptz,closed_at timestamptz);
 create table public.position_shift_checks(position_shift_id uuid,check_type text,item_key text,label text,completed boolean);
 insert into public.profiles values('${actor}','Иван','Проверяющий','bartender',true,'admin',null);
 insert into public.shifts select md5('shift'||n)::uuid,current_date-n from generate_series(0,34)n;
 insert into public.position_shift_states select md5('bar'||id)::uuid,id,'bartender','closed',now(),now() from public.shifts;
 insert into public.position_shift_states select md5('waiter'||id)::uuid,id,'waiter','closed',now(),now() from public.shifts;
 insert into public.position_shift_checks select id,'opening','stored','Снимок пункта',true from public.position_shift_states;
 insert into public.profiles
 select md5('birthday'||n)::uuid,'Тест','День '||n,'bartender',true,'staff',make_date(2000,extract(month from d)::int,extract(day from d)::int)
 from (select n,((now() at time zone 'Asia/Novosibirsk')::date+n) as d from generate_series(-2,4)n)x;`);
 for(const file of['profile-shift-history.sql','dashboard-birthday-window.sql'])await db.exec(readFileSync(new URL('../docs/patches/'+file,import.meta.url),'utf8'));
 await asActor();
 let rows=await query('select public.get_own_position_shift_history_v1() as value');const history=rows[0].value;
 assert.equal(history.length,30);assert.ok(history.every(x=>x.position_code==='bartender'));assert.equal(history[0].checks[0].label,'Снимок пункта');assert.ok(history.every(x=>!('opened_by'in x)&&!('closed_by'in x)&&!('user_id'in x)));assert.ok(history[0].shift_date>history.at(-1).shift_date);
 console.log('PASS history keeps30 newest snapshots of current position, even for admin, without colleague IDs');
 rows=await query('select * from public.get_dashboard_upcoming_birthdays()');assert.deepEqual(rows.map(x=>x.days_until),[-1,0,1,2,3]);assert.ok(rows.filter(x=>x.days_until!==0).every(x=>x.age_years===null));assert.ok(rows.find(x=>x.days_until===0).age_years>=26);
 console.log('PASS birthday NSK window exactly yesterday through three days ahead, age only today');
 await db.exec('reset role');await query('update public.profiles set position_code=null where id=$1',[actor]);await asActor();await assert.rejects(query('select public.get_own_position_shift_history_v1()'),/position_required/);
 await db.exec('reset role');await query('update public.profiles set is_active=false where id=$1',[actor]);await asActor();await assert.rejects(query('select public.get_own_position_shift_history_v1()'),/forbidden/);assert.equal((await query('select * from public.get_dashboard_upcoming_birthdays()')).length,0);
 console.log('PASS missing position and inactive actor stay restricted');
 await asActor('', 'anon');await assert.rejects(query('select public.get_own_position_shift_history_v1()'),/permission denied/);await assert.rejects(query('select * from public.get_dashboard_upcoming_birthdays()'),/permission denied/);
 console.log('PASS anonymous cannot execute either prepared RPC');
 await db.exec('reset role');
 await db.exec("create type public.staff_position as enum('bartender','waiter')");
 const countBefore=(await query('select count(*) as total from public.position_shift_states'))[0].total;
 await db.exec(readFileSync(new URL('../docs/releases/2026-11-03-backend/rollback.sql',import.meta.url),'utf8'));
 const rollback=(await query(`select
 to_regprocedure('public.get_own_position_shift_history_v1()') is null as history_removed,
 position('generate_series(0, 2)' in pg_get_functiondef('public.get_dashboard_upcoming_birthdays()'::regprocedure))>0 as birthday_restored,
 position('opening_incomplete' in pg_get_functiondef('public.confirm_position_shift(text)'::regprocedure))>0 as shift_restored`))[0];
 assert.ok(rollback.history_removed&&rollback.birthday_restored&&rollback.shift_restored);
 assert.equal((await query('select count(*) as total from public.position_shift_states'))[0].total,countBefore);
 console.log('PASS exact rollback parses, restores prior functions and preserves business rows');
}finally{await db.close()}
