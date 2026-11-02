import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

// Private scheduled endpoint. No browser CORS or user-supplied object paths.
// Deploy with JWT verification enabled and call using the service-role JWT.
Deno.serve(async (request: Request) => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!key || request.headers.get("Authorization") !== `Bearer ${key}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (request.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: jobs, error } = await admin.rpc("claim_knowledge_media_cleanup", { p_limit: 50 });
  if (error) return Response.json({ error: "cleanup_claim_failed" }, { status: 503 });
  let completed = 0;
  let failed = 0;
  for (const job of (jobs || []) as { id: string; storage_path: string; claim_token: string }[]) {
    // Storage API removes both bytes and Storage metadata. Never DELETE storage.objects in SQL.
    const removed = await admin.storage.from("knowledge-media").remove([job.storage_path]);
    const finished = await admin.rpc("finish_knowledge_media_cleanup", {
      p_id: job.id,
      p_claim_token: job.claim_token,
      p_error: removed.error ? "storage_remove_failed" : null
    });
    if (removed.error || finished.error) failed++;
    else completed++;
  }
  return Response.json({ completed, failed }, { status: failed ? 503 : 200 });
});
