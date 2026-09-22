# Shift checkbox interaction QA

Expected behavior after v5:

1. Tap one checklist item.
2. Only that row shows a small spinner.
3. Other rows must not fade, jump or lock.
4. Tap a second/third different item before the first request finishes.
5. Each row saves independently.
6. Checkmark appears only after that row receives server success.
7. Progress count/bar changes smoothly from local React state.
8. No full-page skeleton and no whole-workflow refresh occurs on ordinary checkbox writes.
9. Confirm opening/closing remains disabled until all pending item writes finish.
10. Manual refresh and open/close phase transition may refresh the full workflow.

Failure behavior:
- failed row keeps its previous checked state;
- error message appears;
- other rows remain usable.

11. Repeated fast tap on the same pending row must not create duplicate save requests.
