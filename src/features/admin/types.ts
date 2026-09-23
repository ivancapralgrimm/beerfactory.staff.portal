import type {
  StaffPosition,
  StaffRole
} from "@/types/auth";

export const ACCESS_ROLE_LABELS: Record<StaffRole, string> = {
  staff: "Сотрудник",
  senior: "Старший сотрудник",
  manager: "Менеджерские права",
  admin: "Администратор"
};

export type AdminUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: StaffRole;
  is_owner: boolean;
  is_active: boolean;
  birth_date: string | null;
  position: string | null;
  position_code: StaffPosition | null;
  created_at: string;
  last_seen_at: string | null;
  recovery_set_at: string | null;
};

export type AdminSelf = {
  id: string;
  is_owner: boolean;
};

export type AdminUsersResponse = {
  users: AdminUser[];
  me: AdminSelf;
};

export type AdminMutation =
  | {
      action: "set_role";
      user_id: string;
      role: StaffRole;
    }
  | {
      action: "set_position";
      user_id: string;
      position_code: StaffPosition | null;
    }
  | {
      action: "set_active";
      user_id: string;
      is_active: boolean;
    }
  | {
      action: "set_password";
      user_id: string;
      password: string;
    }
  | {
      action: "set_secret";
      user_id: string;
      secret_code: string;
    }
  | {
      action: "delete_user";
      user_id: string;
    };

export type AdminAttempt = {
  id: string;
  user_id: string;
  category: string | null;
  category_id: string | null;
  score: number;
  passed: boolean;
  total_questions: number;
  correct_answers: number;
  category_results: unknown;
  created_at: string;
  finished_at: string | null;
};

export type AdminAuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
};
