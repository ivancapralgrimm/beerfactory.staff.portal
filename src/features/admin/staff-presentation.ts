import type { StaffPosition } from "@/types/auth";

// Venue follows the server's position contract; it is never an independent setting.
export function staffVenue(position: StaffPosition | null | undefined) {
  if (position === "bartender_bb" || position === "waiter_bb") return "BeerBistro";
  if (position === "bartender" || position === "waiter" || position === "manager" || position === "hostess") return "BeerFactory";
  return "По рабочей должности";
}

export function staffFullName(user: { first_name?: string | null; last_name?: string | null }) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || "Сотрудник";
}
