import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: H });

const CATEGORY_LABELS: Record<string, string> = {
  bar: "Бар",
  kitchen: "Кухня",
  hall: "Зал",
  equipment: "Оборудование",
  purchasing: "Закупки",
  other: "Другое"
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: "Обычная",
  high: "Важная",
  critical: "Критичная"
};

type VapidConfig = {
  public_key: string;
  private_key: string;
};

async function ensureVapidConfig(admin: ReturnType<typeof createClient>) {
  const existing = await admin
    .from("push_vapid_config")
    .select("public_key,private_key")
    .eq("singleton", true)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as VapidConfig;

  const keys = webpush.generateVAPIDKeys();

  const inserted = await admin
    .from("push_vapid_config")
    .insert({
      singleton: true,
      public_key: keys.publicKey,
      private_key: keys.privateKey
    })
    .select("public_key,private_key")
    .single();

  if (!inserted.error && inserted.data) {
    return inserted.data as VapidConfig;
  }

  const raced = await admin
    .from("push_vapid_config")
    .select("public_key,private_key")
    .eq("singleton", true)
    .single();

  if (raced.error || !raced.data) {
    throw inserted.error || raced.error || new Error("vapid_config_failed");
  }

  return raced.data as VapidConfig;
}

function pushBody(category: string, body: string) {
  const label = CATEGORY_LABELS[category] || "Передача";
  const clean = String(body || "").replace(/\s+/g, " ").trim();
  const clipped = clean.length > 150 ? clean.slice(0, 147) + "…" : clean;
  return `${label}: ${clipped}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: H });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";

  if (!url || !serviceKey || !anonKey) {
    return J({ error: "server_configuration_error" }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const token = authorization.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await admin.auth.getUser(token);

  if (userError || !user) {
    return J({ error: "unauthorized" }, 401);
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,is_active,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return J({ error: "profile_not_found" }, 404);
  }

  if (!profile.is_active) {
    return J({ error: "account_disabled" }, 403);
  }

  let vapid: VapidConfig;

  try {
    vapid = await ensureVapidConfig(admin);
  } catch (error) {
    console.error("BFStaff VAPID config:", error);
    return J({ error: "push_configuration_failed" }, 500);
  }

  if (req.method === "GET") {
    return J({ public_key: vapid.public_key });
  }

  if (req.method !== "POST") {
    return J({ error: "method_not_allowed" }, 405);
  }

  let body: {
    body?: string;
    category?: string;
    priority?: string;
  };

  try {
    body = await req.json();
  } catch {
    return J({ error: "invalid_request" }, 400);
  }

  const userDb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data: note, error: createError } = await userDb.rpc(
    "create_handover",
    {
      p_body: String(body.body || ""),
      p_category: String(body.category || "other"),
      p_priority: String(body.priority || "normal")
    }
  );

  if (createError || !note) {
    console.error("BFStaff Handover create:", createError);
    return J({ error: createError?.message || "handover_create_failed" }, 400);
  }

  const { data: activeProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (profilesError) {
    console.error("BFStaff push profiles:", profilesError);
    return J({ ok: true, note, push: { sent: 0, failed: 0, removed: 0 } });
  }

  const recipientIds = (activeProfiles || [])
    .map((item) => item.id)
    .filter((id) => id !== user.id);

  if (!recipientIds.length) {
    return J({ ok: true, note, push: { sent: 0, failed: 0, removed: 0 } });
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,failure_count")
    .in("user_id", recipientIds);

  if (subscriptionsError || !subscriptions?.length) {
    if (subscriptionsError) {
      console.error("BFStaff push subscriptions:", subscriptionsError);
    }
    return J({ ok: true, note, push: { sent: 0, failed: 0, removed: 0 } });
  }

  webpush.setVapidDetails(
    "https://bfstaff.vercel.app/",
    vapid.public_key,
    vapid.private_key
  );

  const payload = JSON.stringify({
    title:
      body.priority === "critical"
        ? "BeerFactory · Критичная передача"
        : "BeerFactory · Новая передача",
    body: pushBody(String(body.category || "other"), String(body.body || "")),
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png",
    url: "/#/handover",
    tag: `handover:${note.id}`,
    priority: PRIORITY_LABELS[String(body.priority || "normal")] || "Обычная"
  });

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth
            }
          },
          payload,
          { TTL: 60 * 60 * 12 }
        );

        sent += 1;

        await admin
          .from("push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq("id", subscription.id);
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error &&
          "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode || 0)
            : 0;

        if (statusCode === 404 || statusCode === 410) {
          removed += 1;
          await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);
          return;
        }

        failed += 1;
        console.error("BFStaff push send:", error);

        await admin
          .from("push_subscriptions")
          .update({
            failure_count: Number(subscription.failure_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", subscription.id);
      }
    })
  );

  return J({
    ok: true,
    note,
    push: { sent, failed, removed }
  });
});
