export type UpcomingBirthday = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  position_code: string | null;
  days_until: 0 | 1 | 2;
  age_years: number | null;
};
