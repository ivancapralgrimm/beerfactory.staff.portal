import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const validName=(v:string)=>v.length>=1&&v.length<=80;
const validCode=(v:string)=>/^\d{4,12}$/.test(v);
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!serviceKey)return json({error:"server_configuration_error"},500);
 const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
 try{
  const body=await req.json();
  const firstName=String(body?.first_name??"").trim(),lastName=String(body?.last_name??"").trim();
  const password=String(body?.password??"").trim(),secretCode=String(body?.secret_code??"").trim();
  if(!validName(firstName)||!validName(lastName)||!validCode(password)||!validCode(secretCode))return json({error:"invalid_input"},400);
  const {data:existing,error:existingError}=await admin.from("profiles").select("id").ilike("first_name",firstName).ilike("last_name",lastName).maybeSingle();
  if(existingError)return json({error:"registration_failed"},500);
  if(existing)return json({error:"user_exists"},409);
  const internalEmail=`staff-${crypto.randomUUID()}@beerfactory.local`;
  const internalPassword=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  const {data:created,error:createError}=await admin.auth.admin.createUser({email:internalEmail,password:internalPassword,email_confirm:true,user_metadata:{first_name:firstName,last_name:lastName}});
  if(createError||!created.user)return json({error:"registration_failed"},409);
  const userId=created.user.id;
  const [{data:passwordHash,error:passwordHashError},{data:recoveryHash,error:recoveryHashError}]=await Promise.all([admin.rpc("hash_personal_code",{p_code:password}),admin.rpc("hash_recovery_code",{p_code:secretCode})]);
  if(passwordHashError||recoveryHashError||!passwordHash||!recoveryHash){await admin.auth.admin.deleteUser(userId);return json({error:"registration_failed"},500)}
  const {error:profileError}=await admin.from("profiles").insert({id:userId,first_name:firstName,last_name:lastName,role:"staff",is_active:true,personal_code_hash:passwordHash,recovery_code_hash:recoveryHash,recovery_set_at:new Date().toISOString()});
  if(profileError){await admin.auth.admin.deleteUser(userId);return json({error:"registration_failed"},500)}
  return json({ok:true,user:{id:userId,first_name:firstName,last_name:lastName,role:"staff"}},201);
 }catch{return json({error:"invalid_request"},400)}
});
