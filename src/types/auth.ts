import type { Session, User } from "@supabase/supabase-js";

export type StaffRole = "staff" | "senior" | "manager" | "admin";
export type StaffPosition = "bartender" | "waiter" | "manager" | "hostess";

export const STAFF_POSITION_LABELS: Record<StaffPosition, string> = {
  bartender: "Бармен",
  waiter: "Официант",
  manager: "Менеджер",
  hostess: "Хостес"
};

export type StaffProfile = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: StaffRole | null;
  is_owner?: boolean | null;
  is_active?: boolean | null;
  position?: string | null;
  position_code?: StaffPosition | null;
  birth_date?: string | null;
  position_change_allowed?: boolean | null;
  position_change_available_at?: string | null;
  position_change_reason?: "window_locked" | "already_changed" | null;
  recovery_configured?: boolean | null;
};

export type AuthUser = User & Partial<StaffProfile>;

export type AuthState =
  | { status: "booting"; session: null; user: null }
  | { status: "anonymous"; session: null; user: null }
  | {
      status: "authenticated";
      session: Session;
      user: AuthUser;
      recoveryRequired: boolean;
    };
