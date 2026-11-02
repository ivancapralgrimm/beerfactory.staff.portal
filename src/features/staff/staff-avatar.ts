import type { StaffProfile } from "@/types/auth";

type AvatarSubject = Pick<StaffProfile, "id" | "position_code" | "is_owner">;
type AvatarFamily = "bartender" | "waiter" | "manager" | "hostess";
const families: Record<string, AvatarFamily> = {
  bartender: "bartender", bartender_bb: "bartender",
  waiter: "waiter", waiter_bb: "waiter",
  manager: "manager", hostess: "hostess"
};

/** v1: a random account UUID gives a stable pseudorandom variant across devices.
 * Keep this mapping stable: no localStorage, render-time randomness or DB writes.
 */
export function staffAvatarSource(subject: AvatarSubject): string | null {
  if (subject.is_owner === true) return "/assets/staff-avatars/owner.webp";
  const family = Object.hasOwn(families, subject.position_code || "")
    ? families[subject.position_code!] : null;
  if (!family || !subject.id) return null;
  let hash = 2166136261;
  for (const character of subject.id.toLowerCase()) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  hash ^= hash >>> 16;
  const variant = (hash >>> 0) % 2 + 1;
  return `/assets/staff-avatars/${family}-${variant}.webp`;
}
