import type { Session, User } from "@supabase/supabase-js";

export type StaffRole = "staff" | "senior" | "manager" | "admin";
export type AssignableStaffRole = Exclude<StaffRole, "manager">;

export type StaffPosition =
  | "bartender"
  | "waiter"
  | "bartender_bb"
  | "waiter_bb"
  | "manager"
  | "hostess";

export const STAFF_POSITION_LABELS: Record<StaffPosition, string> = {
  bartender: "Бармен BF",
  waiter: "Официант BF",
  bartender_bb: "Бармен BB",
  waiter_bb: "Официант BB",
  manager: "Менеджер",
  hostess: "Хостес"
};

export const ASSIGNABLE_STAFF_ROLES: AssignableStaffRole[] = [
  "staff",
  "senior",
  "admin"
];

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

export type AccessSubject = Pick<
  StaffProfile,
  "role" | "is_owner" | "position_code"
>;

export function staffAccessLabel(
  subject: AccessSubject
) {
  if (subject.is_owner) return "Владелец";
  if (subject.role === "admin") return "Администратор";

  if (subject.role === "senior") {
    if (
      subject.position_code === "waiter" ||
      subject.position_code === "waiter_bb"
    ) {
      return "Старший официант";
    }

    if (subject.position_code === "hostess") {
      return "Старший хостес";
    }

    return "Старший сотрудник";
  }

  return "Сотрудник";
}

export function canManageStaffClient(subject: AccessSubject) {
  return subject.is_owner === true || subject.role === "admin";
}

const SENIOR_RECIPE_POSITIONS = new Set<StaffPosition>([
  "bartender",
  "bartender_bb",
  "waiter",
  "waiter_bb",
  "manager"
]);

const SENIOR_CHECKLIST_POSITIONS = new Set<StaffPosition>([
  "bartender",
  "bartender_bb",
  "waiter",
  "waiter_bb",
  "manager",
  "hostess"
]);

export function canManageRecipesClient(subject: AccessSubject) {
  return (
    subject.is_owner === true ||
    subject.role === "admin" ||
    (
      subject.role === "senior" &&
      Boolean(
        subject.position_code &&
        SENIOR_RECIPE_POSITIONS.has(subject.position_code)
      )
    )
  );
}

export function canManageChecklistsClient(subject: AccessSubject) {
  return (
    subject.is_owner === true ||
    subject.role === "admin" ||
    (
      subject.role === "senior" &&
      Boolean(
        subject.position_code &&
        SENIOR_CHECKLIST_POSITIONS.has(subject.position_code)
      )
    )
  );
}

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
