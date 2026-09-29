# BeerFactory Staff Portal · r40.4 Attestation migration

## Scope

Phase 4 migrates Attestation from legacy DOM code to React while keeping the current question bank and Supabase result storage.

Source of truth remains:
- `assets/question-banks.json`

The bank currently contains:
- Бар: 60
- Кухня: 110
- Вино: 50
- Сервис: 114
- Total: 334 questions
- 15 questions per attempt
- pass threshold: 80% = 12/15

## Data validation

The React loader refuses to start an attempt if the bank is structurally invalid.

Validated:
- exactly 4 categories
- expected labels and minimum bank sizes
- globally unique question IDs
- 4 unique answers per question
- exactly 1 correct answer
- topic and group present
- ticket plan totals exactly 15
- enough unique groups for each topic quota

This preserves the r40.3 ticket-generation rule rather than simply drawing 15 random questions.

## Supabase verification

Before implementation, the current production project was inspected read-only.

`training_progress` and `quiz_attempts` both have RLS enabled.

`quiz_attempts`:
- authenticated user may INSERT only when `user_id = auth.uid()`
- users may read their own rows
- manager/admin read access remains controlled by the existing server policy

The authenticated role currently has:
- SELECT on `quiz_attempts`
- INSERT on `quiz_attempts`

No database schema or policies were changed.

Current Supabase docs/changelog were also checked. The 2026 Data API change separating explicit table grants from RLS does not block this module because the required grants already exist.

## Product behavior

### Start screen
- four category choices: Бар, Кухня, Вино, Сервис
- Start disabled until category selection
- bank size visible
- last 5 attempts loaded from profile, local fallback if unavailable

### Ticket
- 15 questions
- quotas follow `ticketPlan`
- different groups are selected within each topic
- selected question per group is randomized
- question order randomized
- answer order randomized
- correctness is not shown until the attempt ends

### Result
- score
- pass/fail
- weak topics
- full mistake review
- chosen answer + correct answer
- link back to the relevant recipe search or Knowledge article
- result saved locally first
- then persisted to `quiz_attempts`

### Compatibility
Legacy local storage remains:
`bf-learning-r18:<userId>`

This keeps old local attempt history usable as an offline/fallback cache.

Legacy question review links such as:
- `#/menu`
- `#/article/lesson-17`

are translated into React routes:
- `/menu?q=<recipe>`
- `/knowledge/lesson-17`

## Design basis

Primary reference is the stable r40.3 Attestation flow, translated into the r40.4 React design system.

The UI keeps:
- dark industrial BeerFactory palette
- copper active state
- large mobile touch targets
- simple 2x2 category selection
- single-question focus during an attempt
- no decorative result animation
- accessible `aria-pressed` answer/category states
- focus moved to the next question heading
- semantic progressbar

## QA gate

After build/deploy is green:

1. Open Attestation.
2. Confirm Start is disabled before category choice.
3. Select each category at least once and confirm count:
   - Бар 60
   - Кухня 110
   - Вино 50
   - Сервис 114
4. Start one test, answer several questions, verify progress and no early correctness reveal.
5. Exit and cancel once, then exit and confirm once.
6. Complete one full 15-question attempt.
7. Verify final score and pass threshold.
8. If there are mistakes, open one recipe/article review link.
9. Return to Attestation and confirm the attempt appears in history.
10. Reload Preview and confirm history remains.


## UI refinement after r40.3 review

Removed from the employee-facing category selector:
- bank-size counts under each category
- the repeated “select a category” status line
- implementation-detail copy about shuffling and avoiding repeated groups

Those rules still operate in code, but staff do not need to read implementation mechanics before every attempt.

Category cards are now compact and contain only the category name. The only visible test contract remains:
- 15 questions
- pass from 12 correct answers / 80%


## Category motion icons

The category selector now has one-shot semantic motion when a category becomes selected:

- Бар: shaker moves over the glass, tilts and pours, then returns.
- Кухня: cloche lifts, steam rises, then the lid settles.
- Вино: two glasses move together, clink, flash, then settle.
- Сервис: a finger presses the service bell, ring marks appear, then the hand retracts.

Implementation:
- inline SVG, no bitmap/GIF
- Motion for React, already present in the r40.4 stack
- animation runs only on selection, never loops
- selected-state icon occupies a reserved right-hand slot so text does not shift
- `useReducedMotion()` disables object transforms for users who request reduced motion

Reference research:
- LottieFiles free animated icon library and examples were reviewed for motion behavior.
- A free “wine glasses clinking” example exists but its standard Lottie JSON is roughly 808 KB, which is excessive for four tiny category controls.
- Small free cocktail and bell examples also exist, but mixing third-party icon styles would weaken the BeerFactory visual system.
- Therefore the shipped implementation uses custom vector micro-animations inspired by those action patterns rather than importing third-party assets.

This keeps the interaction semantic and physical, while remaining tiny, themeable and consistent with the portal.
