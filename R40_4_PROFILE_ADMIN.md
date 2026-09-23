# BeerFactory Staff Portal · r40.4 Profile / Admin

## Architecture

Working position and access role are separate concepts.

Working position:
- bartender / Бармен
- waiter / Официант
- manager / Менеджер
- hostess / Хостес

Access role:
- staff / Сотрудник
- senior / Старший сотрудник
- manager / Менеджерские права
- admin / Администратор

A working position never grants authorization rights.

## Personal Profile

Profile now contains:
- current access label;
- working-position selector;
- birth date;
- per-device Web Push settings;
- Admin entry point for users with access role `admin`;
- logout.

Birth date is validated server-side and can be cleared.
It is intended for internal birthday reminders / Dashboard Day Hub.

## React Admin

Route: `/admin`

Only authenticated active users with access role `admin` can load the admin backend.
The React page also redirects non-admin UI access back to Profile.

Tabs:
1. Team
2. Attestations
3. Audit log

Team administration supports:
- four access roles;
- four working positions, independently from access role;
- active / disabled account state;
- reset personal login code;
- reset recovery code;
- protected account deletion;
- search and summary metrics.

## Owner protection

`is_owner` is a separate protection flag.

Rules:
- owner must remain active admin;
- owner cannot be deleted;
- admin cannot disable/delete itself;
- non-owner admin cannot promote another user to admin;
- non-owner admin cannot demote/disable/delete another admin;
- non-owner admin cannot reset another admin's credentials;
- owner can manage non-owner admin accounts.

This prevents ordinary admins from minting additional admin accounts or taking over peer admins.

## Admin delete v2

Deletion preparation now clears references from both legacy Shift and position-aware Shift v2:
- `shift_checks`
- `shifts`
- `position_shift_checks`
- `position_shift_states`

Push subscriptions, quiz attempts, training progress, messages and notifications already follow profile deletion through their foreign-key cascade rules.

## Security hardening

Migrations already applied live:
- `20260923174754_harden_profile_admin_and_update_delete_v2`
- `20260923175915_restrict_profile_directory_columns`

Client grants now keep only required capabilities:
- `profiles`: authenticated can read only staff-directory columns `id / first_name / last_name / position / position_code / avatar_url`;
- sensitive profile columns such as login/recovery hashes are not exposed through the client role;
- `quiz_attempts`: authenticated SELECT + INSERT, with RLS deciding self/manager/admin visibility;
- `audit_log`: authenticated SELECT + INSERT, with admin RLS;
- anon: no direct table privileges on these tables

RLS remains the row-level authority.
Administrative mutations go through `staff-admin-users` Edge Function with service-role backend access plus explicit auth/role checks.

## Live backend versions

- `staff-admin-users` v5
- `staff-profile` v6

Both are already deployed live before the frontend package is installed.
