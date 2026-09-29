import { supabase } from "@/lib/supabase";
import type {
  UpcomingBirthday
} from "@/features/dashboard/types";

export async function loadUpcomingBirthdays() {
  const { data, error } = await supabase.rpc(
    "get_dashboard_upcoming_birthdays"
  );

  if (error) {
    throw error;
  }

  return (
    Array.isArray(data) ? data : []
  ).map((item) => ({
    profile_id: String(item.profile_id),
    first_name:
      item.first_name == null
        ? null
        : String(item.first_name),
    last_name:
      item.last_name == null
        ? null
        : String(item.last_name),
    position_code:
      item.position_code == null
        ? null
        : String(item.position_code),
    days_until: Number(
      item.days_until
    ) as UpcomingBirthday["days_until"],
    age_years:
      item.age_years == null
        ? null
        : Number(item.age_years)
  })) satisfies UpcomingBirthday[];
}
