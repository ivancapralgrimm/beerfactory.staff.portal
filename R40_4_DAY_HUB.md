# BeerFactory Staff Portal · r40.4 Day Hub

## Goal

Dashboard is the operational hub for the current day, not a duplicate history screen.

## Active Handover

Dashboard shows only unresolved items:
- `new`;
- `acknowledged`.

Resolved items stay in the Handover module history.

## Upcoming birthdays

Dashboard shows birthdays:
- today;
- tomorrow;
- the day after tomorrow.

For a birthday happening today, Dashboard also shows the employee's current age.

Example:
`Артём сегодня отмечает день рождения`
`Исполняется 29 лет`

For future reminders, age is not returned yet.

## Privacy

The client does not receive:
- full `birth_date`;
- birth year;
- another employee's profile record.

The RPC exposes only:
- profile id;
- first / last name;
- working position code;
- `days_until`;
- computed `age_years` only when `days_until = 0`.

The event window is calculated in `Asia/Novosibirsk`.

A 29 February birthday is treated as 28 February in a non-leap year for the Day Hub reminder.

## Next sources

Future Day Hub sources can be added independently:
- important announcements;
- time-sensitive operational notices;
- manager notices;
- other explicitly approved daily signals.
