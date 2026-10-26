# First required run — retained failure

The ordered Node 24 run at 409d500ee09fd31422a9a8c2c2833d2cbf28ea58 passed typecheck and completed all 5,907 tests: 5,905 passed, one failed and one existing shape-sync TODO. No frozen source or runtime artifact changed. The runner stopped before the diff step because npm test failed. Raw logs are excluded.

The failure in crop-plan-page-ux.test.ts assumed a visible heading must be a literal JSX text child. Localization moved the same English heading into the shared language helper. The rule remains necessary: the planned-crop comparison must direct the farmer to a heading actually visible on the food card. The corrected test renders the actual English card, retains the original destination assertion, and adds a mutation probe that removes the rendered heading and must fail. No production wording, data, selection, source figure or rendered browser artifact changed for this repair. All 69 affected tests across the page, year card and production localization pass after typecheck; diff checks pass. A fresh required full run remains necessary.

The inherited shape-sync TODO is recorded separately by the test runner and is not counted as a passing test. Whole-app translation and fluent review remain incomplete.
