import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const H={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"GET, PATCH, OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};

const J=(b:unknown,s=200)=>new Response(
  JSON.stringify(b),
  {status:s,headers:H}
);

const POSITION_LABELS={
  bartender:"Бармен",
  waiter:"Официант",
  manager:"Менеджер",
  hostess:"Хостес"
} as const;

type PositionCode=keyof typeof POSITION_LABELS;

const positionFromLegacy=(value:unknown):PositionCode|null=>{
  const v=String(value||"").trim().toLowerCase();
  if(!v) return null;
  if(v==="бармен"||v==="бар-менеджер"||v==="бар менеджер"){
    return "bartender";
  }
  if(v==="официант"||v==="официантка"){
    return "waiter";
  }
  if(v==="менеджер"){
    return "manager";
  }
  if(v==="хостес"||v==="hostess"){
    return "hostess";
  }
  return null;
};

Deno.serve(async req=>{
  if(req.method==="OPTIONS"){
    return new Response("ok",{headers:H});
  }

  const url=Deno.env.get("SUPABASE_URL");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if(!url||!key){
    return J({error:"server_configuration_error"},500);
  }

  const db=createClient(
    url,
    key,
    {
      auth:{
        persistSession:false,
        autoRefreshToken:false
      }
    }
  );

  const token=(req.headers.get("Authorization")||"")
    .replace(/^Bearer\s+/i,"");

  const {
    data:{user},
    error:userError
  }=await db.auth.getUser(token);

  if(userError||!user){
    return J({error:"unauthorized"},401);
  }

  const {
    data:profile,
    error:profileError
  }=await db
    .from("profiles")
    .select(
      "id,first_name,last_name,role,is_owner,is_active,birth_date,position,position_code,created_at,last_seen_at,recovery_set_at"
    )
    .eq("id",user.id)
    .maybeSingle();

  if(profileError||!profile){
    return J({error:"profile_not_found"},404);
  }
  if(!profile.is_active){
    return J({error:"account_disabled"},403);
  }

  if(req.method==="GET"){
    return J({profile});
  }

  if(req.method==="PATCH"){
    try{
      const b=await req.json();
      const patch:any={
        updated_at:new Date().toISOString()
      };

      if("birth_date" in b){
        patch.birth_date=b.birth_date||null;
      }

      if("position_code" in b){
        const code=String(
          b.position_code||""
        ) as PositionCode;

        if(!(code in POSITION_LABELS)){
          return J({error:"invalid_position"},400);
        }

        patch.position_code=code;
        patch.position=POSITION_LABELS[code];
      }else if("position" in b){
        const legacy=String(b.position||"")
          .trim()
          .slice(0,80);

        patch.position=legacy||null;
        patch.position_code=
          positionFromLegacy(legacy);
      }

      const {
        data:updated,
        error
      }=await db
        .from("profiles")
        .update(patch)
        .eq("id",user.id)
        .select(
          "id,first_name,last_name,role,is_owner,is_active,birth_date,position,position_code,created_at,last_seen_at,recovery_set_at"
        )
        .single();

      return error
        ? J({error:"failed"},500)
        : J({ok:true,profile:updated});
    }catch{
      return J({error:"invalid_request"},400);
    }
  }

  return J({error:"method_not_allowed"},405);
});
