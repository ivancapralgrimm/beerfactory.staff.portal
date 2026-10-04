import type { StaffProfile } from "@/types/auth";

// Presentation only. RPC/Storage/Edge must independently authorize every mutation.
// Working position never grants article permissions.
export function canEditKnowledgeClient(
  user: Partial<StaffProfile> | null | undefined,
) {
  return Boolean(
    user &&
      user.is_active !== false &&
      (user.is_owner === true || user.role === "admin"),
  );
}
