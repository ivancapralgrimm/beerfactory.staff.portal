import { useState } from "react";
import { WarmIcon } from "@/components/warm/WarmIcon";
import { staffAvatarSource } from "@/features/staff/staff-avatar";
import type { StaffProfile } from "@/types/auth";
import "./staff-avatar.css";

export function StaffAvatar({ user, className = "" }: {
  user: Pick<StaffProfile, "id" | "position_code" | "is_owner">;
  className?: string;
}) {
  const src = staffAvatarSource(user);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  // Name and position are already adjacent; the portrait is decorative.
  return <span className={`bf-staff-avatar ${className}`} aria-hidden="true">
    {src && src !== failedSource
      ? <img src={src} alt="" width={512} height={512} decoding="async"
          onError={() => setFailedSource(src)} />
      : <WarmIcon name="people" size={28} />}
  </span>;
}
