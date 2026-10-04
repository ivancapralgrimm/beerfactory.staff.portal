BFStaff r40.5 — Shift locked screen fix

Replace only:
src/features/shift/ShiftPage.tsx

Changes:
- removed obsolete 'СМЕНА · {position}' eyebrow from locked/unconfigured states;
- moved 'Новая смена с 11:00' and 'Следующее открытие' next to the lock icon;
- no backend/API/session logic changed.
