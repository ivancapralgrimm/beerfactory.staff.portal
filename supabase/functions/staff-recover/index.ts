import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"method_not_allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!serviceKey||!anonKey)return json({error:"server_configuration_error"},500);
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const auth=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
    const body=await req.json();
    const firstName=String(body?.first_name??"").trim(),lastName=String(body?.last_name??"").trim(),recoveryCode=String(body?.recovery_code??"").trim(),newCode=String(body?.new_code??"").trim();
    if(!firstName||!lastName||!/^\d{4,12}$/.test(recoveryCode)||!/^\d{4,12}$/.test(newCode))return json({error:"recovery_failed"},400);
    const {data:result,error:rpcError}=await admin.rpc("recover_personal_code",{p_first_name:firstName,p_last_name:lastName,p_recovery_code:recoveryCode,p_new_code:newCode});
    if(rpcError)return json({error:"recovery_failed"},401);
    const r:any=result;
    if(!r?.ok){const err=r?.error||"recovery_failed";return json({error:err},err==="rate_limited"?429:401)}
    const {data:userData,error:userError}=await admin.auth.admin.getUserById(r.user_id);
    const email=userData.user?.email;
    if(userError||!email)return json({error:"recovery_failed"},401);
    const {data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:"magiclink",email});
    const tokenHash=(linkData as any)?.properties?.hashed_token;
    if(linkError||!tokenHash)return json({error:"recovery_failed"},401);
    const {data:verifyData,error:verifyError}=await auth.auth.verifyOtp({token_hash:tokenHash,type:"email"});
    if(verifyError||!verifyData.session)return json({error:"recovery_failed"},401);
    await admin.from("profiles").update({last_seen_at:new Date().toISOString()}).eq("id",r.user_id);
    return json({ok:true,session:verifyData.session,user:{id:r.user_id,first_name:r.first_name,last_name:r.last_name,role:r.role}});
  }catch{return json({error:"recovery_failed"},400)}
});
