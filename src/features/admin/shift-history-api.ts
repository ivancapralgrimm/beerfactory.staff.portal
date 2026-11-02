import { supabase } from "@/lib/supabase";
import { STAFF_POSITION_LABELS, type StaffPosition } from "@/types/auth";

export type ShiftHistoryRow = {
  id: string; shift_date: string; position_code: StaffPosition;
  status: "not_started" | "active" | "closed" | "expired";
  opened_at: string | null; closed_at: string | null;
  checks: Array<{ check_type: "general_cleaning" | "opening" | "closing"; item_key: string; label: string; completed: boolean }>;
};
export async function loadOwnPositionShiftHistory(): Promise<ShiftHistoryRow[]> {
  // The RPC accepts no staff/position/venue argument. It derives all scope from auth.uid().
  const { data, error } = await supabase.rpc("get_own_position_shift_history_v1");
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") throw new Error("shift_history_server_upgrade_required");
    if (error.message.includes("position_required")) throw new Error("position_required");
    if (error.message.includes("forbidden")) throw new Error("forbidden");
    throw new Error("shift_history_load_failed");
  }
  if (!Array.isArray(data)) throw new Error("shift_history_response_invalid");
  return data.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("shift_history_response_invalid");
    const row = raw as ShiftHistoryRow;
    if (typeof row.id !== "string" || typeof row.shift_date !== "string" || typeof row.position_code !== "string" || !Object.hasOwn(STAFF_POSITION_LABELS, row.position_code) || !["not_started", "active", "closed", "expired"].includes(row.status) || !Array.isArray(row.checks)) throw new Error("shift_history_response_invalid");
    if (row.checks.some((check) => !check || typeof check.item_key !== "string" || typeof check.label !== "string" || typeof check.completed !== "boolean" || !["general_cleaning", "opening", "closing"].includes(check.check_type))) throw new Error("shift_history_response_invalid");
    return { id: row.id, shift_date: row.shift_date, position_code: row.position_code, status: row.status, opened_at: row.opened_at, closed_at: row.closed_at, checks: row.checks.map(({ check_type, item_key, label, completed }) => ({ check_type, item_key, label, completed })) };
  });
}
