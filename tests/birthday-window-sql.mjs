// Exact birthday SQL with a fixed test clock, isolated PostgreSQL only.
import {PGlite}from'@electric-sql/pglite';import fs from'node:fs';import assert from'node:assert/strict';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema private;create function private.current_role()returns text language sql as $$select 'staff'::text$$;create table public.profiles(id uuid,first_name text,last_name text,position_code text,birth_date date,is_active boolean);`);
 const source=fs.readFileSync('docs/patches/dashboard-birthday-window.sql','utf8');
 assert.ok(source.includes("(current_timestamp at time zone 'Asia/Novosibirsk')::date"));
 for(const [birthday,dates]of[['2000-11-06',['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08']],['2000-01-01',['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']],['2000-02-29',['2027-02-24','2027-02-25','2027-02-26','2027-02-27','2027-02-28','2027-03-01','2027-03-02']]]){
  await db.query(`truncate public.profiles`);await db.query(`insert into public.profiles values(gen_random_uuid(),'Тест','День рождения','bartender',$1,true)`,[birthday]);
  const values=[];
  for(const date of dates){await db.exec(source.replace("(current_timestamp at time zone 'Asia/Novosibirsk')::date",`date '${date}'`));values.push((await db.query('select days_until from public.get_dashboard_upcoming_birthdays()')).rows.map(x=>x.days_until));}
  assert.deepEqual(values,[[],[3],[2],[1],[0],[-1],[]]);console.log('PASS3daysbefore through1dayafter: '+birthday+'; excludes4before/2after');
 }
}finally{await db.close()}
