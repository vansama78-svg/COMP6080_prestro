# Testing Approach

This project uses Vitest + Testing Library for UI-level tests and keeps all UI tests under `frontend/src/__test__/`.

## How tests are run

From the `frontend` directory:

```bash
npm run test
```

The command runs `vitest run` in jsdom mode.

## Happy path test (required)

File: `frontend/src/__test__/app.ui.test.tsx`  
Test: `covers admin happy path from register to relogin`

Covered steps:

1. Register successfully.
2. Create a new presentation from dashboard.
3. Open the presentation and update title + thumbnail.
4. Add additional slides.
5. Switch between slides.
6. Delete the presentation.
7. Log out successfully.
8. Log back in successfully.

Implementation notes:

- The test renders the real `App` routes with providers (`AuthProvider`, `ErrorProvider`) and `MemoryRouter`.
- A deterministic mocked backend is used via `global.fetch` to emulate auth/store endpoints.

## Alternative path test (required)

File: `frontend/src/__test__/app.ui.test.tsx`  
Test: `covers alternative path: reject deleting the only slide`

Why this path:

- The happy path verifies successful actions.
- This path verifies a guard/failure case that must be handled gracefully, covering a different behavior branch.

Covered steps:

1. Register and create a presentation.
2. Open editor while only one slide exists.
3. Attempt to delete that only slide.
4. Confirm an error dialog is shown with the expected message.
5. Dismiss the dialog and confirm it closes.

## Manual verification done alongside automated tests

- `npm run lint`
- `npm run tsc`

These checks ensure the submission is lint-clean and TypeScript compliant in addition to UI tests.
