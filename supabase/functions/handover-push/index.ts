import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Content-Type":"application/json; charset=utf-8"};
const J=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const CATEGORY_LABELS:Record<string,string>={bar:"Бар",kitchen:"Кухня",hall:"Зал",equipment:"Оборудование",purchasing:"Закупки",other:"Другое"};
const PRIORITY_LABELS:Record<string,string>={normal:"Обычная",high:"Важная",critical:"Критичная"};
type VapidConfig={public_key:string;private_key:string};
type PushStats={sent:number;failed:number;removed:number};

async function ensureVapidConfig(admin:ReturnType<typeof createClient>){
  const existing=await admin.from("push_vapid_config").select("public_key,private_key").eq("singleton",true).maybeSingle();
  if(existing.error) throw existing.error;
  if(existing.data) return existing.data as VapidConfig;
  const keys=webpush.generateVAPIDKeys();
  const inserted=await admin.from("push_vapid_config").insert({singleton:true,public_key:keys.publicKey,private_key:keys.privateKey}).select("public_key,private_key").single();
  if(!inserted.error&&inserted.data) return inserted.data as VapidConfig;
  const raced=await admin.from("push_vapid_config").select("public_key,private_key").eq("singleton",true).single();
  if(raced.error||!raced.data) throw inserted.error||raced.error||new Error("vapid_config_failed");
  return raced.data as VapidConfig;
}

function excerpt(value:unknown,max=150){
  const clean=String(value||"").replace(/\\s+/g," ").trim();
  return clean.length>max?clean.slice(0,Math.max(0,max-1))+"…":clean;
}
function personName(profile:{first_name?:string|null;last_name?:string|null}){
  return [profile.first_name,profile.last_name].filter(Boolean).join(" ").trim()||"Сотрудник";
}

async function sendToTeam(admin:ReturnType<typeof createClient>,vapid:VapidConfig,actorId:string,payload:Record<string,unknown>):Promise<PushStats>{
  const {data:activeProfiles,error:profilesError}=await admin.from("profiles").select("id").eq("is_active",true);
  if(profilesError){console.error("BFStaff push profiles:",profilesError);return{sent:0,failed:0,removed:0};}
  const recipientIds=(activeProfiles||[]).map((item)=>item.id).filter((id)=>id!==actorId);
  if(!recipientIds.length) return{sent:0,failed:0,removed:0};
  const {data:subscriptions,error:subscriptionsError}=await admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,failure_count").in("user_id",recipientIds);
  if(subscriptionsError||!subscriptions?.length){if(subscriptionsError)console.error("BFStaff push subscriptions:",subscriptionsError);return{sent:0,failed:0,removed:0};}
  webpush.setVapidDetails("https://bfstaff.vercel.app/",vapid.public_key,vapid.private_key);
  let sent=0,failed=0,removed=0;
  await Promise.all(subscriptions.map(async(subscription)=>{
    try{
      await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload),{TTL:60*60*12});
      sent+=1;
      await admin.from("push_subscriptions").update({last_success_at:new Date().toISOString(),failure_count:0,updated_at:new Date().toISOString()}).eq("id",subscription.id);
    }catch(error){
      const statusCode=typeof error==="object"&&error&&"statusCode" in error?Number((error as{statusCode?:number}).statusCode||0):0;
      if(statusCode===404||statusCode===410){removed+=1;await admin.from("push_subscriptions").delete().eq("id",subscription.id);return;}
      failed+=1;console.error("BFStaff push send:",error);
      await admin.from("push_subscriptions").update({failure_count:Number(subscription.failure_count||0)+1,updated_at:new Date().toISOString()}).eq("id",subscription.id);
    }
  }));
  return{sent,failed,removed};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:H});
  const url=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),anonKey=Deno.env.get("SUPABASE_ANON_KEY"),authorization=req.headers.get("Authorization")||"";
  if(!url||!serviceKey||!anonKey) return J({error:"server_configuration_error"},500);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const token=authorization.replace(/^Bearer\\s+/i,"");
  const {data:{user},error:userError}=await admin.auth.getUser(token);
  if(userError||!user) return J({error:"unauthorized"},401);
  const {data:profile,error:profileError}=await admin.from("profiles").select("id,is_active,role,first_name,last_name").eq("id",user.id).maybeSingle();
  if(profileError||!profile) return J({error:"profile_not_found"},404);
  if(!profile.is_active) return J({error:"account_disabled"},403);
  let vapid:VapidConfig;
  try{vapid=await ensureVapidConfig(admin);}catch(error){console.error("BFStaff VAPID config:",error);return J({error:"push_configuration_failed"},500);}
  if(req.method==="GET") return J({public_key:vapid.public_key});
  if(req.method!=="POST") return J({error:"method_not_allowed"},405);
  let body:{action?:"create"|"resolve";note_id?:string;body?:string;category?:string;priority?:string};
  try{body=await req.json();}catch{return J({error:"invalid_request"},400);}
  const action=body.action||"create";
  if(action!=="create"&&action!=="resolve") return J({error:"invalid_action"},400);
  const userDb=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});

  if(action==="resolve"){
    const noteId=String(body.note_id||"").trim();
    if(!noteId) return J({error:"note_id_required"},400);
    const {data:existing,error:existingError}=await userDb.from("notes").select("id,body,category,priority,status").eq("id",noteId).maybeSingle();
    if(existingError||!existing) return J({error:"handover_not_found"},404);
    if(existing.status==="resolved") return J({ok:true,note:existing,already_resolved:true,push:{sent:0,failed:0,removed:0}});
    const {data:note,error:resolveError}=await userDb.rpc("resolve_handover",{p_note_id:noteId});
    if(resolveError||!note){console.error("BFStaff Handover resolve:",resolveError);return J({error:resolveError?.message||"handover_resolve_failed"},400);}
    const actor=personName(profile),category=CATEGORY_LABELS[String(note.category||"other")]||"Передача",noteText=excerpt(note.body,125);
    const push=await sendToTeam(admin,vapid,user.id,{title:"BeerFactory · Передача решена",body:`${actor} решил: ${category} · ${noteText}`,icon:"/assets/icons/icon-192.png",badge:"/assets/icons/icon-192.png",url:"/#/handover",tag:`handover-resolved:${note.id}`,event:"resolved"});
    return J({ok:true,note,push});
  }

  const {data:note,error:createError}=await userDb.rpc("create_handover",{p_body:String(body.body||""),p_category:String(body.category||"other"),p_priority:String(body.priority||"normal")});
  if(createError||!note){console.error("BFStaff Handover create:",createError);return J({error:createError?.message||"handover_create_failed"},400);}
  const category=CATEGORY_LABELS[String(body.category||"other")]||"Передача",noteText=excerpt(body.body,150);
  const push=await sendToTeam(admin,vapid,user.id,{title:body.priority==="critical"?"BeerFactory · Критичная передача":"BeerFactory · Новая передача",body:`${category}: ${noteText}`,icon:"/assets/icons/icon-192.png",badge:"/assets/icons/icon-192.png",url:"/#/handover",tag:`handover-created:${note.id}`,priority:PRIORITY_LABELS[String(body.priority||"normal")]||"Обычная",event:"created"});
  return J({ok:true,note,push});
});
