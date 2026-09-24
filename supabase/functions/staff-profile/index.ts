import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: H });

const POSITION_LABELS = {
  bartender: "Бармен",
  waiter: "Официант",
  manager: "Менеджер",
  hostess: "Хостес"
} as const;

type PositionCode = keyof typeof POSITION_LABELS;

const positionFromLegacy = (
  value: unknown
): PositionCode | null => {
  const normalized =
    String(value || "").trim().toLowerCase();

  if (!normalized) return null;

  if (
    normalized === "бармен" ||
    normalized === "бар-менеджер" ||
    normalized === "бар менеджер"
  ) {
    return "bartender";
  }

  if (
    normalized === "официант" ||
    normalized === "официантка"
  ) {
    return "waiter";
  }

  if (normalized === "менеджер") {
    return "manager";
  }

  if (
    normalized === "хостес" ||
    normalized === "hostess"
  ) {
    return "hostess";
  }

  return null;
};

function validBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date =
    new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    )
  );

  return year >= 1900 && date <= todayUtc;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: H });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    return J({ error: "server_configuration_error" }, 500);
  }

  const db = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const token =
    (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: userError
  } = await db.auth.getUser(token);

  if (userError || !user) {
    return J({ error: "unauthorized" }, 401);
  }

  const select =
    "id,first_name,last_name,role,is_owner,is_active,birth_date,position,position_code,created_at,last_seen_at,recovery_set_at";

  const {
    data: profile,
    error: profileError
  } = await db
    .from("profiles")
    .select(select)
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return J({ error: "profile_not_found" }, 404);
  }

  if (!profile.is_active) {
    return J({ error: "account_disabled" }, 403);
  }

  const loadPositionContext = async () => {
    const {
      data,
      error
    } = await db.rpc(
      "get_profile_position_self_service_context",
      { p_profile_id: user.id }
    );

    if (error) {
      return null;
    }

    return data as {
      can_change?: boolean;
      reason?: "window_locked" | "already_changed" | null;
      next_open_at?: string | null;
    } | null;
  };

  const withPositionContext = async (
    currentProfile: Record<string, unknown>
  ) => {
    const context = await loadPositionContext();

    return {
      ...currentProfile,
      position_change_allowed:
        context?.can_change ?? false,
      position_change_available_at:
        context?.next_open_at ?? null,
      position_change_reason:
        context?.reason ?? "window_locked"
    };
  };

  if (req.method === "GET") {
    return J({
      profile: await withPositionContext(
        profile as Record<string, unknown>
      )
    });
  }

  if (req.method === "PATCH") {
    try {
      const body = await req.json();

      if ("position_code" in body) {
        const code =
          String(body.position_code || "") as PositionCode;

        if (!(code in POSITION_LABELS)) {
          return J({ error: "invalid_position" }, 400);
        }

        if (profile.position_code !== code) {
          const {
            error: positionError
          } = await db.rpc(
            "set_profile_position_self_service",
            {
              p_profile_id: user.id,
              p_position_code: code
            }
          );

          if (positionError) {
            const message =
              String(positionError.message || "");

            if (
              message.includes(
                "position_change_window_locked"
              )
            ) {
              return J(
                { error: "position_change_window_locked" },
                409
              );
            }

            if (
              message.includes(
                "position_change_next_window"
              )
            ) {
              return J(
                { error: "position_change_next_window" },
                409
              );
            }

            return J({ error: "failed" }, 500);
          }
        }
      } else if ("position" in body) {
        const legacy =
          String(body.position || "")
            .trim()
            .slice(0, 80);

        const code = positionFromLegacy(legacy);

        if (!code) {
          return J({ error: "invalid_position" }, 400);
        }

        if (profile.position_code !== code) {
          const {
            error: positionError
          } = await db.rpc(
            "set_profile_position_self_service",
            {
              p_profile_id: user.id,
              p_position_code: code
            }
          );

          if (positionError) {
            const message =
              String(positionError.message || "");

            if (
              message.includes(
                "position_change_window_locked"
              )
            ) {
              return J(
                { error: "position_change_window_locked" },
                409
              );
            }

            if (
              message.includes(
                "position_change_next_window"
              )
            ) {
              return J(
                { error: "position_change_next_window" },
                409
              );
            }

            return J({ error: "failed" }, 500);
          }
        }
      }

      if ("birth_date" in body) {
        const birthDate =
          String(body.birth_date || "").trim();

        if (birthDate && !validBirthDate(birthDate)) {
          return J({ error: "invalid_birth_date" }, 400);
        }

        const {
          error: birthError
        } = await db
          .from("profiles")
          .update({
            birth_date: birthDate || null,
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id);

        if (birthError) {
          return J({ error: "failed" }, 500);
        }
      }

      const {
        data: updated,
        error: updatedError
      } = await db
        .from("profiles")
        .select(select)
        .eq("id", user.id)
        .single();

      return updatedError
        ? J({ error: "failed" }, 500)
        : J({
            ok: true,
            profile: await withPositionContext(
              updated as Record<string, unknown>
            )
          });
    } catch {
      return J({ error: "invalid_request" }, 400);
    }
  }

  return J({ error: "method_not_allowed" }, 405);
});
