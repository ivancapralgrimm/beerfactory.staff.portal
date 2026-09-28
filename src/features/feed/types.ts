import type { StaffPosition } from "@/types/auth";

export type FeedPriority = "normal" | "high" | "critical";
export type FeedStatus = "new" | "acknowledged" | "resolved";

export type FeedProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
};

export type FeedPost = {
  id: string;
  shift_id: string | null;
  author_id: string;
  subject: string;
  body: string;
  priority: FeedPriority;
  status: FeedStatus;
  notify_all: boolean;
  notify_positions: StaffPosition[];
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  author: FeedProfile | null;
  resolvedBy: FeedProfile | null;
  acknowledgedByMe: boolean;
  acknowledgementCount: number;
};
