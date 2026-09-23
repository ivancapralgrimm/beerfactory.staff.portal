import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const J = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: H });

const codeOk = (value: string) => /^\d{4,12}$/.test(value);

const ACCESS_ROLES = ["staff", "senior", "manager", "admin"] as const;
const POSITION_LABELS = {
  bartender: "Бармен",
  waiter: "Официант",
  manager: "Менеджер",
  hostess: "Хостес"
} as const;

type AccessRole = typeof ACCESS_ROLES[number];
type PositionCode = keyof typeof POSITION_LABELS;

const isAccessRole = (value: string): value is AccessRole =>
  (ACCESS_ROLES as readonly string[]).includes(value);

const isPositionCode = (value: string): value is PositionCode =>
  value in POSITION_LABELS;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: H });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return J({ error: "method_not_allowed" }, 405);
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

  const token = (req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "");

  const {
    data: { user },
    error: authError
  } = await db.auth.getUser(token);

  if (authError || !user) {
    return J({ error: "unauthorized" }, 401);
  }

  const {
    data: me,
    error: meError
  } = await db
    .from("profiles")
    .select("id,role,is_owner,is_active,first_name,last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (
    meError ||
    !me ||
    !me.is_active ||
    me.role !== "admin"
  ) {
    return J({ error: "forbidden" }, 403);
  }

  const audit = async (
    action:
      | "profile_role_update"
      | "profile_position_update"
      | "profile_activation_update"
      | "credential_reset",
    target: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
    },
    beforeData: Record<string, unknown>,
    afterData: Record<string, unknown>,
    metadata: Record<string, unknown> = {}
  ) => {
    const { error } = await db
      .from("audit_log")
      .insert({
        actor_id: user.id,
        action,
        entity_type: "profile",
        entity_id: String(target.id),
        entity_name:
          [target.first_name, target.last_name]
            .filter(Boolean)
            .join(" ") || null,
        before_data: beforeData,
        after_data: afterData,
        metadata: {
          source: "staff-admin-users",
          ...metadata
        }
      });

    return !error;
  };

  const requireOwnerForAdminTarget = (
    targetRole: string,
    targetId: string
  ) => {
    if (
      targetRole === "admin" &&
      targetId !== user.id &&
      !me.is_owner
    ) {
      return true;
    }

    return false;
  };

  if (req.method === "GET") {
    const { data, error } = await db
      .from("profiles")
      .select(
        "id,first_name,last_name,role,is_owner,is_active,birth_date,position,position_code,created_at,last_seen_at,recovery_set_at"
      )
      .order("is_owner", { ascending: false })
      .order("is_active", { ascending: false })
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    return error
      ? J({ error: "list_failed" }, 500)
      : J({
          users: data || [],
          me: {
            id: me.id,
            is_owner: Boolean(me.is_owner)
          }
        });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const userId = String(body?.user_id || "");

    if (!userId) {
      return J({ error: "invalid_input" }, 400);
    }

    const {
      data: target,
      error: targetError
    } = await db
      .from("profiles")
      .select(
        "id,first_name,last_name,role,is_owner,is_active,position,position_code,recovery_set_at"
      )
      .eq("id", userId)
      .maybeSingle();

    if (targetError || !target) {
      return J({ error: "user_not_found" }, 404);
    }

    if (
      target.is_owner &&
      userId !== user.id
    ) {
      return J({ error: "owner_protected" }, 403);
    }

    if (action === "set_role") {
      const role = String(body?.role || "");

      if (!isAccessRole(role)) {
        return J({ error: "invalid_role" }, 400);
      }

      if (target.is_owner && role !== "admin") {
        return J({ error: "owner_protected" }, 403);
      }

      if (userId === user.id && role !== "admin") {
        return J({ error: "cannot_demote_self" }, 400);
      }

      if (
        !me.is_owner &&
        userId !== user.id &&
        (target.role === "admin" || role === "admin")
      ) {
        return J({ error: "owner_required" }, 403);
      }

      if (target.role === role) {
        return J({
          ok: true,
          unchanged: true,
          audit_recorded: true
        });
      }

      const before = { role: target.role };
      const after = { role };

      const { error } = await db
        .from("profiles")
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) {
        return J({ error: "update_failed" }, 500);
      }

      const auditRecorded = await audit(
        "profile_role_update",
        target,
        before,
        after
      );

      return J({
        ok: true,
        audit_recorded: auditRecorded
      });
    }

    if (action === "set_position") {
      const raw =
        body?.position_code === null
          ? ""
          : String(body?.position_code || "");

      if (raw && !isPositionCode(raw)) {
        return J({ error: "invalid_position" }, 400);
      }

      const positionCode =
        raw ? raw as PositionCode : null;
      const position =
        positionCode
          ? POSITION_LABELS[positionCode]
          : null;

      if (target.position_code === positionCode) {
        return J({
          ok: true,
          unchanged: true,
          audit_recorded: true
        });
      }

      const before = {
        position_code: target.position_code,
        position: target.position
      };
      const after = {
        position_code: positionCode,
        position
      };

      const { error } = await db
        .from("profiles")
        .update({
          position_code: positionCode,
          position,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) {
        return J({ error: "update_failed" }, 500);
      }

      const auditRecorded = await audit(
        "profile_position_update",
        target,
        before,
        after
      );

      return J({
        ok: true,
        audit_recorded: auditRecorded
      });
    }

    if (action === "set_active") {
      const next = Boolean(body?.is_active);

      if (target.is_owner && !next) {
        return J({ error: "owner_protected" }, 403);
      }

      if (userId === user.id && !next) {
        return J({ error: "cannot_disable_self" }, 400);
      }

      if (
        requireOwnerForAdminTarget(
          target.role,
          userId
        )
      ) {
        return J({ error: "owner_required" }, 403);
      }

      if (Boolean(target.is_active) === next) {
        return J({
          ok: true,
          unchanged: true,
          audit_recorded: true
        });
      }

      const before = { is_active: target.is_active };
      const after = { is_active: next };

      const { error } = await db
        .from("profiles")
        .update({
          is_active: next,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) {
        return J({ error: "update_failed" }, 500);
      }

      const auditRecorded = await audit(
        "profile_activation_update",
        target,
        before,
        after
      );

      return J({
        ok: true,
        audit_recorded: auditRecorded
      });
    }

    if (action === "set_password") {
      if (
        requireOwnerForAdminTarget(
          target.role,
          userId
        )
      ) {
        return J({ error: "owner_required" }, 403);
      }

      const code = String(body?.password || "").trim();

      if (!codeOk(code)) {
        return J({ error: "invalid_password" }, 400);
      }

      const {
        data: hash,
        error: hashError
      } = await db.rpc(
        "hash_personal_code",
        { p_code: code }
      );

      if (hashError || !hash) {
        return J({ error: "update_failed" }, 500);
      }

      const { error } = await db
        .from("profiles")
        .update({
          personal_code_hash: hash,
          updated_at: new Date().toISOString()
        })
        .eq("id", userId);

      if (error) {
        return J({ error: "update_failed" }, 500);
      }

      const auditRecorded = await audit(
        "credential_reset",
        target,
        {},
        {},
        { credential: "password" }
      );

      return J({
        ok: true,
        audit_recorded: auditRecorded
      });
    }

    if (action === "set_secret") {
      if (
        requireOwnerForAdminTarget(
          target.role,
          userId
        )
      ) {
        return J({ error: "owner_required" }, 403);
      }

      const code = String(body?.secret_code || "").trim();

      if (!codeOk(code)) {
        return J({ error: "invalid_secret" }, 400);
      }

      const {
        data: hash,
        error: hashError
      } = await db.rpc(
        "hash_recovery_code",
        { p_code: code }
      );

      if (hashError || !hash) {
        return J({ error: "update_failed" }, 500);
      }

      const now = new Date().toISOString();

      const { error } = await db
        .from("profiles")
        .update({
          recovery_code_hash: hash,
          recovery_set_at: now,
          updated_at: now
        })
        .eq("id", userId);

      if (error) {
        return J({ error: "update_failed" }, 500);
      }

      const auditRecorded = await audit(
        "credential_reset",
        target,
        {
          recovery_set_at: target.recovery_set_at
        },
        {
          recovery_set_at: now
        },
        { credential: "recovery_code" }
      );

      return J({
        ok: true,
        audit_recorded: auditRecorded
      });
    }

    if (action === "delete_user") {
      if (userId === user.id) {
        return J({ error: "cannot_delete_self" }, 400);
      }

      if (target.is_owner) {
        return J({ error: "owner_protected" }, 403);
      }

      if (
        requireOwnerForAdminTarget(
          target.role,
          userId
        )
      ) {
        return J({ error: "owner_required" }, 403);
      }

      const {
        data: prepared,
        error: prepareError
      } = await db.rpc(
        "admin_prepare_user_deletion",
        {
          p_actor_id: user.id,
          p_target_id: userId
        }
      );

      if (prepareError) {
        const message = String(
          prepareError.message || ""
        );

        if (message.includes("cannot_delete_self")) {
          return J({ error: "cannot_delete_self" }, 400);
        }
        if (message.includes("owner_protected")) {
          return J({ error: "owner_protected" }, 403);
        }
        if (message.includes("owner_required")) {
          return J({ error: "owner_required" }, 403);
        }
        if (message.includes("user_not_found")) {
          return J({ error: "user_not_found" }, 404);
        }
        if (message.includes("forbidden")) {
          return J({ error: "forbidden" }, 403);
        }

        return J({ error: "delete_prepare_failed" }, 500);
      }

      const { error: deleteError } =
        await db.auth.admin.deleteUser(userId);

      if (deleteError) {
        return J({
          error: "auth_delete_failed",
          prepared: true,
          disabled: true
        }, 500);
      }

      return J({
        ok: true,
        deleted: true,
        purge: prepared || null
      });
    }

    return J({ error: "unknown_action" }, 400);
  } catch {
    return J({ error: "invalid_request" }, 400);
  }
});
