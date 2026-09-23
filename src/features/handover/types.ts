export type HandoverCategory =
  | "bar"
  | "kitchen"
  | "hall"
  | "equipment"
  | "purchasing"
  | "other";

export type HandoverPriority =
  | "normal"
  | "high"
  | "critical";

export type HandoverStatus =
  | "new"
  | "acknowledged"
  | "resolved";

export type HandoverProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
};

export type HandoverNote = {
  id: string;
  shift_id: string | null;
  author_id: string;
  body: string;
  priority: HandoverPriority;
  category: HandoverCategory;
  status: HandoverStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  author: HandoverProfile | null;
  acknowledgedBy: HandoverProfile | null;
  resolvedBy: HandoverProfile | null;
};
