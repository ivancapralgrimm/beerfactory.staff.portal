import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: H
  });

type StaffPosition =
  | "bartender"
  | "waiter"
  | "manager"
  | "hostess";

type VapidConfig = {
  public_key: string;
  private_key: string;
};

type Audience = {
  notifyAll: boolean;
  positions: StaffPosition[];
};

async function ensureVapidConfig(
  admin: ReturnType<typeof createClient>
) {
  const existing = await admin
    .from("push_vapid_config")
    .select("public_key,private_key")
    .eq("singleton", true)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    return existing.data as VapidConfig;
  }

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
    throw (
      inserted.error ||
      raced.error ||
      new Error("vapid_config_failed")
    );
  }

  return raced.data as VapidConfig;
}

function excerpt(value: unknown, max = 150) {
  const clean = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > max
    ? clean.slice(0, Math.max(0, max - 1)) + "…"
    : clean;
}

function personName(profile: {
  first_name?: string | null;
  last_name?: string | null;
}) {
  return [
    profile.first_name,
    profile.last_name
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "Сотрудник";
}

function normalizePositions(
  value: unknown
): StaffPosition[] {
  const allowed = new Set<StaffPosition>([
    "bartender",
    "waiter",
    "manager",
    "hostess"
  ]);

  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map(
          (item) =>
            String(item || "")
              .trim() as StaffPosition
        )
        .filter(
          (item): item is StaffPosition =>
            allowed.has(item)
        )
    )
  ];
}

async function sendToAudience(
  admin: ReturnType<typeof createClient>,
  vapid: VapidConfig,
  actorId: string,
  audience: Audience,
  payload: Record<string, unknown>
) {
  let profileQuery = admin
    .from("profiles")
    .select("id,position_code")
    .eq("is_active", true);

  if (!audience.notifyAll) {
    if (!audience.positions.length) {
      return {
        sent: 0,
        failed: 0,
        removed: 0
      };
    }

    profileQuery = profileQuery.in(
      "position_code",
      audience.positions
    );
  }

  const {
    data: activeProfiles,
    error: profilesError
  } = await profileQuery;

  if (profilesError) {
    console.error(
      "BFStaff push profiles:",
      profilesError
    );
    return {
      sent: 0,
      failed: 0,
      removed: 0
    };
  }

  const recipientIds =
    (activeProfiles || [])
      .map((item) => item.id)
      .filter((id) => id !== actorId);

  if (!recipientIds.length) {
    return {
      sent: 0,
      failed: 0,
      removed: 0
    };
  }

  const {
    data: subscriptions,
    error: subscriptionsError
  } = await admin
    .from("push_subscriptions")
    .select(
      "id,user_id,endpoint,p256dh,auth,failure_count"
    )
    .in("user_id", recipientIds);

  if (
    subscriptionsError ||
    !subscriptions?.length
  ) {
    if (subscriptionsError) {
      console.error(
        "BFStaff push subscriptions:",
        subscriptionsError
      );
    }

    return {
      sent: 0,
      failed: 0,
      removed: 0
    };
  }

  webpush.setVapidDetails(
    "https://bfstaff.vercel.app/",
    vapid.public_key,
    vapid.private_key
  );

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
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 }
        );

        sent += 1;

        await admin
          .from("push_subscriptions")
          .update({
            last_success_at:
              new Date().toISOString(),
            failure_count: 0,
            updated_at:
              new Date().toISOString()
          })
          .eq("id", subscription.id);
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error &&
          "statusCode" in error
            ? Number(
                (
                  error as {
                    statusCode?: number;
                  }
                ).statusCode || 0
              )
            : 0;

        if (
          statusCode === 404 ||
          statusCode === 410
        ) {
          removed += 1;

          await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);

          return;
        }

        failed += 1;

        console.error(
          "BFStaff push send:",
          error
        );

        await admin
          .from("push_subscriptions")
          .update({
            failure_count:
              Number(
                subscription.failure_count || 0
              ) + 1,
            updated_at:
              new Date().toISOString()
          })
          .eq("id", subscription.id);
      }
    })
  );

  return {
    sent,
    failed,
    removed
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: H
    });
  }

  const url =
    Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY");

  const authorization =
    req.headers.get("Authorization") || "";

  if (
    !url ||
    !serviceKey ||
    !anonKey
  ) {
    return J({
      error: "server_configuration_error"
    }, 500);
  }

  const admin = createClient(
    url,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  const token =
    authorization.replace(
      /^Bearer\s+/i,
      ""
    );

  const {
    data: { user },
    error: userError
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return J({
      error: "unauthorized"
    }, 401);
  }

  const {
    data: profile,
    error: profileError
  } = await admin
    .from("profiles")
    .select(
      "id,is_active,role,first_name,last_name,position_code"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return J({
      error: "profile_not_found"
    }, 404);
  }

  if (!profile.is_active) {
    return J({
      error: "account_disabled"
    }, 403);
  }

  let vapid: VapidConfig;

  try {
    vapid =
      await ensureVapidConfig(admin);
  } catch (error) {
    console.error(
      "BFStaff VAPID config:",
      error
    );

    return J({
      error: "push_configuration_failed"
    }, 500);
  }

  if (req.method === "GET") {
    return J({
      public_key: vapid.public_key
    });
  }

  if (req.method !== "POST") {
    return J({
      error: "method_not_allowed"
    }, 405);
  }

  let body: {
    action?: "create" | "resolve" | "notify_created" | "notify_resolved";
    note_id?: string;
    subject?: string;
    body?: string;
    category?: string;
    priority?: string;
    notify_all?: boolean;
    notify_positions?: string[];
  };

  try {
    body = await req.json();
  } catch {
    return J({
      error: "invalid_request"
    }, 400);
  }

  const action =
    body.action || "create";

  if (
    action !== "create" &&
    action !== "resolve" &&
    action !== "notify_created" &&
    action !== "notify_resolved"
  ) {
    return J({
      error: "invalid_action"
    }, 400);
  }

  const userDb = createClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          Authorization: authorization
        }
      }
    }
  );

  if (action === "notify_created") {
    const noteId =
      String(body.note_id || "").trim();

    if (!noteId) {
      return J({
        error: "note_id_required"
      }, 400);
    }

    const {
      data: existing,
      error: existingError
    } = await userDb
      .from("notes")
      .select(
        "id,author_id,subject,body,priority,notify_all,notify_positions"
      )
      .eq("id", noteId)
      .maybeSingle();

    if (
      existingError ||
      !existing
    ) {
      return J({
        error: "feed_post_not_found"
      }, 404);
    }

    if (existing.author_id !== user.id) {
      return J({
        error: "forbidden"
      }, 403);
    }

    const audience: Audience = {
      notifyAll:
        existing.notify_all !== false,
      positions:
        normalizePositions(
          existing.notify_positions
        )
    };

    const push =
      await sendToAudience(
        admin,
        vapid,
        user.id,
        audience,
        {
          title:
            existing.priority === "critical"
              ? `Критично · ${excerpt(existing.subject, 90)}`
              : excerpt(existing.subject, 100),
          body:
            excerpt(existing.body, 150),
          icon:
            "/assets/icons/icon-192.png",
          badge:
            "/assets/icons/icon-192.png",
          url:
            "/#/feed",
          tag:
            `feed-created:${existing.id}`,
          event:
            "created"
        }
      );

    return J({
      ok: true,
      note: existing,
      push
    });
  }

  if (action === "notify_resolved") {
    const noteId =
      String(body.note_id || "").trim();

    if (!noteId) {
      return J({
        error: "note_id_required"
      }, 400);
    }

    const {
      data: existing,
      error: existingError
    } = await userDb
      .from("notes")
      .select(
        "id,subject,body,priority,status,notify_all,notify_positions,resolved_by"
      )
      .eq("id", noteId)
      .maybeSingle();

    if (
      existingError ||
      !existing
    ) {
      return J({
        error: "feed_post_not_found"
      }, 404);
    }

    if (
      existing.status !== "resolved" ||
      existing.resolved_by !== user.id
    ) {
      return J({
        error: "forbidden"
      }, 403);
    }

    const audience: Audience = {
      notifyAll:
        existing.notify_all !== false,
      positions:
        normalizePositions(
          existing.notify_positions
        )
    };

    const actor =
      personName(profile);

    const push =
      await sendToAudience(
        admin,
        vapid,
        user.id,
        audience,
        {
          title:
            `Решено · ${excerpt(existing.subject, 90)}`,
          body:
            `${actor} отметил запись как решённую.`,
          icon:
            "/assets/icons/icon-192.png",
          badge:
            "/assets/icons/icon-192.png",
          url:
            "/#/feed",
          tag:
            `feed-resolved:${existing.id}`,
          event:
            "resolved"
        }
      );

    return J({
      ok: true,
      note: existing,
      push
    });
  }

  if (action === "resolve") {
    const noteId =
      String(body.note_id || "").trim();

    if (!noteId) {
      return J({
        error: "note_id_required"
      }, 400);
    }

    const {
      data: existing,
      error: existingError
    } = await userDb
      .from("notes")
      .select(
        "id,subject,body,priority,status,notify_all,notify_positions"
      )
      .eq("id", noteId)
      .maybeSingle();

    if (
      existingError ||
      !existing
    ) {
      return J({
        error: "feed_post_not_found"
      }, 404);
    }

    if (
      existing.status === "resolved"
    ) {
      return J({
        ok: true,
        note: existing,
        already_resolved: true,
        push: {
          sent: 0,
          failed: 0,
          removed: 0
        }
      });
    }

    const {
      data: note,
      error: resolveError
    } = await userDb.rpc(
      "resolve_handover",
      {
        p_note_id: noteId
      }
    );

    if (
      resolveError ||
      !note
    ) {
      console.error(
        "BFStaff feed resolve:",
        resolveError
      );

      return J({
        error:
          resolveError?.message ||
          "feed_resolve_failed"
      }, 400);
    }

    const audience: Audience = {
      notifyAll:
        existing.notify_all !== false,
      positions:
        normalizePositions(
          existing.notify_positions
        )
    };

    const actor =
      personName(profile);

    const subject =
      excerpt(
        existing.subject ||
          "Сообщение команды",
        90
      );

    const push =
      await sendToAudience(
        admin,
        vapid,
        user.id,
        audience,
        {
          title:
            `Решено · ${subject}`,
          body:
            `${actor} отметил запись как решённую.`,
          icon:
            "/assets/icons/icon-192.png",
          badge:
            "/assets/icons/icon-192.png",
          url:
            "/#/feed",
          tag:
            `feed-resolved:${note.id}`,
          event:
            "resolved"
        }
      );

    return J({
      ok: true,
      note,
      push
    });
  }

  const subject =
    String(body.subject || "").trim();

  // Backward compatibility for a previously
  // deployed Handover client.
  if (!subject) {
    const {
      data: legacyNote,
      error: legacyError
    } = await userDb.rpc(
      "create_handover",
      {
        p_body:
          String(body.body || ""),
        p_category:
          String(
            body.category || "other"
          ),
        p_priority:
          String(
            body.priority || "normal"
          )
      }
    );

    if (
      legacyError ||
      !legacyNote
    ) {
      return J({
        error:
          legacyError?.message ||
          "handover_create_failed"
      }, 400);
    }

    const push =
      await sendToAudience(
        admin,
        vapid,
        user.id,
        {
          notifyAll: true,
          positions: []
        },
        {
          title:
            "Сообщение команды",
          body:
            excerpt(body.body, 150),
          icon:
            "/assets/icons/icon-192.png",
          badge:
            "/assets/icons/icon-192.png",
          url:
            "/#/feed",
          tag:
            `feed-created:${legacyNote.id}`,
          event:
            "created"
        }
      );

    return J({
      ok: true,
      note: legacyNote,
      push,
      legacy: true
    });
  }

  const priority =
    body.priority === "critical"
      ? "critical"
      : "normal";

  const notifyAll =
    body.notify_all !== false;

  const positions =
    notifyAll
      ? []
      : normalizePositions(
          body.notify_positions
        );

  if (
    !notifyAll &&
    !positions.length
  ) {
    return J({
      error:
        "feed_notification_target_required"
    }, 400);
  }

  const {
    data: note,
    error: createError
  } = await userDb.rpc(
    "create_feed_post",
    {
      p_subject: subject,
      p_body:
        String(body.body || ""),
      p_priority: priority,
      p_notify_all: notifyAll,
      p_notify_positions:
        positions
    }
  );

  if (
    createError ||
    !note
  ) {
    console.error(
      "BFStaff feed create:",
      createError
    );

    return J({
      error:
        createError?.message ||
        "feed_create_failed"
    }, 400);
  }

  const push =
    await sendToAudience(
      admin,
      vapid,
      user.id,
      {
        notifyAll,
        positions
      },
      {
        title:
          priority === "critical"
            ? `Критично · ${excerpt(subject, 90)}`
            : excerpt(subject, 100),
        body:
          excerpt(body.body, 150),
        icon:
          "/assets/icons/icon-192.png",
        badge:
          "/assets/icons/icon-192.png",
        url:
          "/#/feed",
        tag:
          `feed-created:${note.id}`,
        event:
          "created"
      }
    );

  return J({
    ok: true,
    note,
    push
  });
});
