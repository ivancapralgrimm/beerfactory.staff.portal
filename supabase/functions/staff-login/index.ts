import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const validName = (value: string) => value.length >= 1 && value.length <= 80;
const validCode = (value: string) => /^\d{4,12}$/.test(value);

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const clientIp = (req: Request) => {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const forwarded = req.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "unknown";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !serviceKey || !anonKey) {
    return json({ error: "server_configuration_error" }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const auth = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const body = await req.json();
    const firstName = String(body?.first_name ?? "").trim();
    const lastName = String(body?.last_name ?? "").trim();
    const code = String(body?.code ?? "").trim();

    if (!validName(firstName) || !validName(lastName) || !validCode(code)) {
      return json({ error: "login_failed" }, 400);
    }

    const normalizedFirst = normalizeName(firstName);
    const normalizedLast = normalizeName(lastName);
    const ip = clientIp(req);

    const scopedFingerprint =
      "login:" + ip + ":" + normalizedFirst + ":" + normalizedLast;
    const employeeFingerprint =
      "login-employee:" + normalizedFirst + ":" + normalizedLast;

    const [
      { data: scopedAllowed, error: scopedAllowedError },
      { data: employeeAllowed, error: employeeAllowedError }
    ] = await Promise.all([
      admin.rpc("login_rate_limit_allowed", {
        p_fingerprint: scopedFingerprint,
        p_limit: 6
      }),
      admin.rpc("login_rate_limit_allowed", {
        p_fingerprint: employeeFingerprint,
        p_limit: 30
      })
    ]);

    if (
      scopedAllowedError ||
      employeeAllowedError ||
      scopedAllowed !== true ||
      employeeAllowed !== true
    ) {
      return json({ error: "rate_limited" }, 429);
    }

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select(
        "id,first_name,last_name,role,is_owner,is_active,personal_code_hash,recovery_code_hash,recovery_set_at"
      )
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)
      .limit(2);

    const profile = !profileError && profiles?.length === 1
      ? profiles[0]
      : null;

    const recordFailure = async () => {
      await Promise.all([
        admin.rpc("record_login_failure", {
          p_fingerprint: scopedFingerprint,
          p_limit: 6
        }),
        admin.rpc("record_login_failure", {
          p_fingerprint: employeeFingerprint,
          p_limit: 30
        })
      ]);
    };

    if (!profile || profile.is_active !== true || !profile.personal_code_hash) {
      await recordFailure();
      return json({ error: "login_failed" }, 401);
    }

    const { data: codeValid, error: codeError } = await admin.rpc(
      "verify_personal_code",
      {
        p_code: code,
        p_hash: profile.personal_code_hash
      }
    );

    if (codeError || codeValid !== true) {
      await recordFailure();
      return json({ error: "login_failed" }, 401);
    }

    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(profile.id);
    const email = userData.user?.email;

    if (userError || !email) {
      return json({ error: "login_unavailable" }, 503);
    }

    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email
      });

    const tokenHash = (linkData as {
      properties?: { hashed_token?: string }
    })?.properties?.hashed_token;

    if (linkError || !tokenHash) {
      return json({ error: "login_unavailable" }, 503);
    }

    const { data: verifyData, error: verifyError } =
      await auth.auth.verifyOtp({
        token_hash: tokenHash,
        type: "email"
      });

    if (verifyError || !verifyData.session) {
      return json({ error: "login_unavailable" }, 503);
    }

    await Promise.all([
      admin.rpc("clear_login_failures", {
        p_fingerprint: scopedFingerprint
      }),
      admin.rpc("clear_login_failures", {
        p_fingerprint: employeeFingerprint
      }),
      admin
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", profile.id)
    ]);

    return json({
      session: verifyData.session,
      user: {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        is_owner: profile.is_owner === true
      },
      recovery_configured:
        Boolean(profile.recovery_code_hash) &&
        Boolean(profile.recovery_set_at)
    });
  } catch {
    return json({ error: "login_failed" }, 400);
  }
});
