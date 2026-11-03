# BFStaff working rules

## Required design QA after every change

The owner explicitly requires Unslop and Hallmark audits after every update,
change or fix. Read `skills/unslop/SKILL.md` and `skills/hallmark/SKILL.md` and
follow the applicable app/polish workflow. Run the real Hallmark checker, review
actual browser screenshots and fix confirmed findings before handing back.
Repeat the relevant checks after fixes. Do not stop at a findings-only report.

The owner has already authorized these audit-driven corrections within the
approved Warm Hall direction. Do not request direction approval again for local
polish, sizing, contrast, accessibility or interaction repairs. Preserve user
decisions and application behavior. New functionality, a new art direction and
irreversible production operations are separate scope.

After each change inspect affected routes and shared controls; if a shared
component/style changes, review all route families. Include default, hover,
pressed, keyboard focus, disabled and applicable loading/error states. Check
date/select intrinsic sizing and interaction rings at narrow mobile widths;
rings must remain visible without creating overflow or moving controls.

Use fresh-context independent finish review as Hallmark requires when agents
are available. Preserve Unslop author credit and both source licenses. Record
real outcomes and limitations; machine hits are not automatically user bugs.
Never claim a clean audit, production/RLS, Safari/device or e2e PASS without
actually checking it. Fix or explain pre-existing findings; do not fabricate
waivers to hide them.

Main r40.6 is the functional baseline except explicitly agreed changes.
Work on `redesign/r40.7-warm-hall-v3`; never change main, merge, promote to
production or write production databases/backends without separate permission.
