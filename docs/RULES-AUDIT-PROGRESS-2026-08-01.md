# Firestore and Storage Rules Audit — progress

Date: 2026-08-01

## Scope and sandbox limits

- This audit documents and tests the authorization boundary; it does not edit `firestore.rules` or `storage.rules`.
- Network, Git remote operations, package installation, browser access, and Firebase emulators are unavailable in this sandbox.
- The emulator rules test is therefore intentionally unrun. The owner should run it with the Firestore emulator after installing the declared development dependency.

## Findings confirmed

- `isMentor()` is role-only and unscoped. It grants reads outside a mentor/learner relationship on logs and several course/farm collections.
- `/shared_sites/{code}` uses `allow read: if true`, which authorizes both exact-code reads and collection enumeration.
- `lib/course-enrollment.ts` defines the relationship fields (`profile_id`, `enrolled_by`, `cohort`, `org_id`, `status`) and deterministic default-track document ids.
- `app/mentor/page.tsx` still queries the full org trainee directory, then separately queries progress and assignments per trainee.
- The repository contains no enrollment migration, production backfill, or seed data proving that existing production learners already have enrollment documents. Production data could not be inspected here.

## Work log

1. Read the complete Firestore and Storage rules, package test setup, enrollment model, mentor dashboard, and Firestore query layer.
2. Confirmed the two reported holes and identified additional role/wildcard overreach for the proposal report.
3. Added `tests/firestore-rules.test.ts` for the intended deny/allow matrix and `npm run test:rules`
   with `@firebase/rules-unit-testing` as a devDependency. It was not run: the package is not
   installed and the Firestore emulator is unavailable in this sandbox.
4. The first canonical test run correctly caught that the repository's test registry treats every
   `tests/*.test.ts` as part of `npm test`. Added a documented external-emulator allowlist for this
   one suite in `tests/test-manifest.test.ts` and `tests/test-registry.test.ts`; the suite remains
   explicitly runnable through `test:rules` and is not added to the no-emulator command.
5. Verification passed: `npx tsc --noEmit`; `npm test` (1542 passed, 0 failed); and `git diff --check`.

## Not run

- `npm run test:rules`: requires the unavailable `@firebase/rules-unit-testing` install and local
  Firestore emulator. The test is intended to fail against today's rules and pass only after the
  owner applies the proposed relationship/list fixes.
- No network, Git remote, browser, Firebase rules deployment, or production-data inspection was
  attempted.
