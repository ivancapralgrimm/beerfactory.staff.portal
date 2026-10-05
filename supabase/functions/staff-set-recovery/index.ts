import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return json({ error: "server_configuration_error" }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const auth = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userError } = await auth.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401);
    const body = await req.json();
    const recoveryCode = String(body?.recovery_code ?? "").trim();
    if (!/^\d{4,12}$/.test(recoveryCode)) return json({ error: "invalid_recovery_code" }, 400);
    const { data: hash, error: hashError } = await admin.rpc("hash_recovery_code", { p_code: recoveryCode });
    if (hashError || !hash) return json({ error: "save_failed" }, 500);
    const { error: updateError } = await admin.from("profiles").update({ recovery_code_hash: hash, recovery_set_at: new Date().toISOString() }).eq("id", userData.user.id);
    if (updateError) return json({ error: "save_failed" }, 500);
    return json({ ok: true });
  } catch { return json({ error: "invalid_request" }, 400); }
});
