# Vegetables L4 diagnostic anchor check — 2026-10-04

## Reviewed learner text

- **TS paragraph 4:** `A yellow leaf a swi vuli automatically leswaku ku ni insect.` The candidate localizes the negative frame while keeping the yellow-leaf subject, `automatically`, and `insect` visible. The following water, nutrition and root-damage alternatives and the identify-before-acting instruction remain as supplied.
- **VE paragraph 6:** `Tsha u thoma. Sedzani. Sedzani the damage pattern, the underside of the leaf, the stem, and the plants nearby.` Both source commands remain distinct. The four inspection locations stay exact English because the earlier Tshivenda anatomy wording risked changing leaf underside to skin.

Both bodies remain machine-draft/unreviewed. This check does not claim fluent approval.

## Safeguards and source binding

The focused checks confirm all four checklist locations, the yellow/insect negative and automaticity qualifier, the unchanged diagnostic alternatives, and the instruction to identify the cause before acting. They also confirm the treatment safeguards remain exact: product registration for crop and pest, label directions, neem mention, protection, harvest waiting instructions, and the ban on improvised mixtures or stronger doses.

A source-drift check changes the diagnostic qualifier in the TS source and one inspection location in the VE source. In both cases the resolver falls back to canonical English instead of serving the stale draft.

The previous exact-English TS assertion for the whole yellow-leaf sentence was retired because that sentence now has an independently checked localized negative frame. Its semantic protections remain explicit in the new assertion. The VE checklist retains English anatomy anchors because no safe localized underside term was confirmed; only the second observation command is localized.

## Verification

- The focused test selection for `Pest framing retains four-step order` and `Tshivenda succession and pest drafts` passes: **2 passed, 0 failed**.
- Running both entire focused test files produced **17 passed, 1 failed**. The unrelated failure is in the Tshivenda Vegetables module-card assertion, which expects `english-fallback`; a concurrent module-metadata change now makes the card status `draft`. The metadata change is outside this diagnostic test update and was left untouched.
- No full suite, typecheck, build, commit or push was run for this focused task.
