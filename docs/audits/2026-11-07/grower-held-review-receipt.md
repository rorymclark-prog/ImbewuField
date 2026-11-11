# Completed-write receipts and a held review — 7 November 2026

Auditor: Codex. Source base: local `683055718745d16a3f0e866e589b5416fe2751ad`, with this isolated continuation. No deployment or browser inspected. The running consolidated check's source was not changed.

## Finding and behavior

F1: after a completed crop-plan write, another review could be held by saved-book or source checks. Review startup reset the completed-but-unconfirmed warning before those checks finished, and the held review displayed the sentence saying no crop cycle had been added.

The hook now retains that warning through the book/source gates and resets it when a fresh review is admitted. The existing no-write sentence renders only for a ready review, not a held review. Refresh behavior, held/failed manual retry and the completed-review replay guards remain unchanged. No new English wording or planning arithmetic was introduced.

## Evidence

The finite external source review was a lead, with synthetic parent/planner/source collaborators and omitted full-repository dependencies. It was not adopted as whole-app proof. Repository controls instead execute the actual extracted parent callbacks, real storage, source inspection/hashing, planner and acceptance machinery with the real hook and panel. Auth/network/browser delivery and parent state snapshots are explicit controlled boundaries; the whole parent form and live account were not executed.

Before production edits, the same 12 controls produced five passes and seven failures. After the minimal two-file correction, all 12 passed without changing their bytes. Two additional controls cover the actual parent's completed-write readback exception and a changed ready-book token after source hashing. Final selected checks passed 87/87: 14 additive cases and 73 existing cases, with zero failures, cancellations, skips or TODOs. Existing overlapping-act warnings are retained in the log rather than reported as absent.

All original tests and the parent page remain byte-identical. Every original string literal and JSX text node is retained; the other 15 hook function bodies, including refresh and acceptance, are unchanged. Independent bounded read-only review found no actionable issue. The additive test is registered exactly once.

## Remaining gates

Typecheck/full suite on the eventual consolidated tree, newer-main integration and genuine device/account inspection remain pending. This changes when existing notices appear; the visual result is unverified. No cloud deployment, production release, runtime language activation or broader repeated-demand/account semantics decision is claimed. `PLAN_VERSION`, calibrated lessons, species and saved geometry are unchanged.
