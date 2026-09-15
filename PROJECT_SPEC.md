# BeerFactory Staff Portal · Product + Design System v1

## Product principle
Рабочий инструмент для живой смены, а не архив рецептов.

## Core modules
- Home: контекст текущей смены + быстрые действия.
- Menu: поиск рецептов/техкарт, API + локальный fallback.
- Knowledge: существующая training-data.json, просмотр материалов.
- Attestation: questions.txt -> интерактивный тест -> score/history.
- Shift: opening + closing checklists, persistence by date.
- Notes: handover notes, critical flag, done state.
- Pause: 60s timer, breathing, grounding exercise.

## Future modules
- Auth / staff profile / role.
- Real shift entity: venue + date + employee + opening/closing.
- Realtime notes and chat.
- Mentions, acknowledgement, notifications.
- Admin console and content editor.
- Training paths, onboarding, analytics.

## Design tokens
Background #14100D; surface #241B15; surface2 #2C2119; border #49372A; cream #F5EAD7; muted #B9A58D; copper #BD6331; copper highlight #DF8B4E; gold #C7A04B; green #6EAA72; red #D96A5E.

## Design rules
1. Mobile first at 360/390/430 px.
2. One-thumb operation during a busy shift.
3. Search before browsing long lists.
4. Horizontal category rails.
5. No modal overload.
6. Copper = primary action/brand accent; gold = secondary/premium; green/red = semantic only.
7. No wood/paper/leather textures that harm readability.
8. Craft references should feel like brewing hardware, labels, metal, taproom, not a Wild West pub.
9. Desktop is a derived layout, not a separate product.

## Architecture
Static PWA frontend -> API -> NocoDB.
Secrets stay server-side in Cloudflare Worker.
Realtime layer later: Auth + Postgres + Realtime (Supabase or equivalent).

## Definition of done for v1
- Responsive shell and bottom navigation.
- Menu local fallback + API adapter.
- Training detail views.
- Attestation from questions.txt with score/history.
- Opening/closing persistence.
- Notes persistence + critical/done states.
- Micro-pause mini-apps.
- PWA metadata.
- No secrets in frontend.
