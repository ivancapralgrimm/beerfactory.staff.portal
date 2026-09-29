import {
  config,
  edgeFunctions
} from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type {
  AdminAttempt,
  AdminAuditRow,
  AdminMutation,
  AdminUsersResponse
} from "@/features/admin/types";

export class AdminApiError extends Error {
  code: string;
  payload: Record<string, unknown>;

  constructor(
    code: string,
    payload: Record<string, unknown> = {}
  ) {
    super(code);
    this.code = code;
    this.payload = payload;
  }
}

async function jsonOrEmpty(response: Response) {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function loadAdminUsers(
  accessToken: string
): Promise<AdminUsersResponse> {
  const response = await fetch(
    edgeFunctions.adminUsers,
    {
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await jsonOrEmpty(response);

  if (!response.ok) {
    throw new AdminApiError(
      String(data.error || "admin_load_failed"),
      data
    );
  }

  return data as unknown as AdminUsersResponse;
}

export async function mutateAdminUser(
  accessToken: string,
  mutation: AdminMutation
) {
  const response = await fetch(
    edgeFunctions.adminUsers,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(mutation)
    }
  );

  const data = await jsonOrEmpty(response);

  if (!response.ok || data.ok !== true) {
    throw new AdminApiError(
      String(data.error || "admin_update_failed"),
      data
    );
  }

  return data;
}

export async function loadAdminAttempts() {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(
      "id,user_id,category,category_id,score,passed,total_questions,correct_answers,category_results,created_at,finished_at"
    )
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) throw error;

  return (data || []) as AdminAttempt[];
}

export async function loadAdminAudit() {
  const { data, error } = await supabase
    .from("audit_log")
    .select(
      "id,actor_id,action,entity_type,entity_id,entity_name,before_data,after_data,metadata,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) throw error;

  return (data || []) as AdminAuditRow[];
}
