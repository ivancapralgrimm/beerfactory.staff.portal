import type { StaffPosition } from "@/types/auth";

export type ShiftCheckType = "opening" | "closing";
export type PositionShiftStatus =
  | "not_started"
  | "active"
  | "closed"
  | "expired";

export type ShiftContextState =
  | "position_required"
  | "locked"
  | "available";

export interface PositionShiftContext {
  state: ShiftContextState;
  window_state: "open" | "locked";
  venue_timezone: string;
  server_now: string;
  operational_date: string | null;
  closes_at: string | null;
  next_open_at: string | null;
  position_code: StaffPosition | null;
  position_label: string | null;
}

export interface PositionShift {
  id: string | null;
  operational_shift_id: string | null;
  shift_date: string;
  position_code: StaffPosition;
  position_label: string;
  status: PositionShiftStatus;
  opened_by: string | null;
  closed_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  expired_at: string | null;
  created_at: string | null;
}

export interface PositionShiftCheck {
  id: string;
  check_type: ShiftCheckType;
  item_key: string;
  label: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
}

export interface PositionShiftRow {
  item_key: string;
  check_type: ShiftCheckType;
  label: string;
  sort_order: number;
  critical: boolean;
  is_active: boolean;
  check: PositionShiftCheck | null;
}

export interface PositionShiftWorkflow {
  context: PositionShiftContext;
  shift: PositionShift | null;
  rows: PositionShiftRow[];
  configured: boolean;
}
