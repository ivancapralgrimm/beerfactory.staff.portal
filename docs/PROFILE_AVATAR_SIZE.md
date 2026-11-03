# Profile avatar:60px →62px

User-requested2px optical enlargement, only in the brown profile identity card. The62×62 image uses margin−1px, retaining the existing60px grid slot and the same image center. Greeting portraits and image assets/role mapping are untouched. Name and job text are not moved or resized.

Unslop/Hallmark polish within the approved Warm Hall direction; spacing-only change, no colour/icon/copy/type/assets/motion change. The optical1px compensation is intentional. Real upstream Hallmark ran on StaffAvatar.tsx/staff-avatar.css with two saved actual-browser profile DOM snapshots:0FAIL/0REFLEX/0WARN, render ran. This is scoped QA, not global stylesheet certification.

Actual before/after geometry in Chromium and Linux WebKit:20 cases across320/375/390/430/768, ordinary and long full names. Card, name and job rectangles match exactly; avatar center unchanged, dimensions62px, no document overflow. Fresh-context independent finish reviewer inspected16 captures and all20 comparisons:ship, no confirmed new defects. Physical iPhone/production/RLS not checked.

Build/typecheck and113 project tests pass. Existing avatar/browser checks updated for the requested62px size:30/30. Normal fixture-only app e2e:21/21. New unit-test infrastructure was not added for this small reversible CSS change; the temporary before/after measuring runner is outside the permanent suite. Evidence:qa/r407/evidence/profile-avatar-size/.

Unslop by Damir Sokolovsky/@heydamir(CC BY4.0), Hallmark by Hallmark contributors(MIT); source skills/licenses retained in skills/. Main, production and databases unchanged.
