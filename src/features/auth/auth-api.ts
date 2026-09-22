import type { Session } from "@supabase/supabase-js";
import { config, edgeFunctions } from "@/lib/config";
import type { StaffProfile } from "@/types/auth";

type LoginResponse = {
  session?: Session;
  user?: Record<string, unknown>;
  recovery_configured?: boolean;
  error?: string;
};

async function jsonOrEmpty(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function staffLogin(input: {
  firstName: string;
  lastName: string;
  code: string;
}) {
  const response = await fetch(edgeFunctions.login, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey
    },
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      code: input.code.trim()
    })
  });

  const data = (await jsonOrEmpty(response)) as LoginResponse;
  if (!response.ok || !data.session) {
    throw new Error(data.error || "login_failed");
  }
  return data;
}

export async function fetchStaffProfile(accessToken: string) {
  const response = await fetch(edgeFunctions.profile, {
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    const error = new Error("profile_auth_failed");
    Object.assign(error, { status: response.status });
    throw error;
  }

  if (!response.ok) {
    throw new Error("profile_load_failed");
  }

  const data = (await jsonOrEmpty(response)) as { profile?: StaffProfile };
  return data.profile ?? null;
}

export async function registerStaff(input: {
  firstName: string;
  lastName: string;
  password: string;
  secretCode: string;
}) {
  const response = await fetch(edgeFunctions.register, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey
    },
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      password: input.password,
      secret_code: input.secretCode
    })
  });

  const data = await jsonOrEmpty(response);
  if (!response.ok || !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error || "registration_failed");
  }
}

export async function recoverStaff(input: {
  firstName: string;
  lastName: string;
  recoveryCode: string;
  newCode: string;
}) {
  const response = await fetch(edgeFunctions.recover, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey
    },
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      recovery_code: input.recoveryCode,
      new_code: input.newCode
    })
  });

  const data = await jsonOrEmpty(response);
  if (!response.ok || !(data as { ok?: boolean }).ok) {
    throw new Error((data as { error?: string }).error || "recovery_failed");
  }
}

export async function setRecoveryCode(accessToken: string, recoveryCode: string) {
  const response = await fetch(edgeFunctions.setRecovery, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ recovery_code: recoveryCode })
  });

  if (!response.ok) {
    throw new Error("set_recovery_failed");
  }
}
