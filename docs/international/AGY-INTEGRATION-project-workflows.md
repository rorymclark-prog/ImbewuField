# Project workflows: proposed integration boundary — 1 November 2026

Executor: **Codex delegated agent**, using the project lane after AGY could not request headless permissions and its interactive run stopped at unaccepted terms. No AGY implementation or native swarm is claimed.

Baseline: `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`; branch `codex/agy-project-workflows`. This document proposes shared integration changes; it does not apply them or approve release.

## Delivered independently

`lib/international/projects/` contains five grower-owned workflow templates, ten indicators, typed references to existing authorities, a pure completeness evaluator, a pure monthly-production adapter and fictional demo fixtures. `/international/projects` lets the reviewer choose a template and indicator, edit a local objective and reporting dates/cutoff/time zone, select failure scenarios and inspect excluded references.

The route performs no account, farm-record or network reads and no persistence. It cannot publish results. Its objective text is intentionally ephemeral and labelled as such. Demonstration rows remain fictional even when they meet structural evidence checks. There is no country selection or automatic country-specific farming support.

## Exact proposed coordinator changes

| Integration | Existing owner / path | Proposed change and acceptance condition |
| --- | --- | --- |
| Discovery | Country lane `app/international/page.tsx` | Add a link to `/international/projects`, labelled workflow/evidence reference. Do not label it worldwide crop-plan support. |
| Test registration | Coordinator `package.json` | Add `tests/international-project-workflows.test.ts` to the existing full test list, preserving every current entry. No package edits were made in this lane. |
| Existing language context | Coordinator `lib/i18n.tsx`, locale lane draft registry | Extract new English UI messages into source-paired drafts when integrating. Keep the route marked English review draft until coverage and human review are known. No existing lesson/quiz text is altered. |
| Navigation | Coordinator-owned shared navigation | Decide whether this experimental route should be discoverable beyond the international foundation. Current back link expects the country lane’s `/international` route after integration. |
| Real production review | Existing crop-plan/production caller and permission-filtered services | Feed `productionProjectEvidence` canonical saved monthly records plus the authorised project mapping and actual recording/consent/publication metadata. Never manufacture those fields from today’s clock. No existing persistence/schema changes are needed for the demo. |
| Programme indicators | `lib/programme-progress.ts`, `lib/programme-evidence.ts`, `lib/mel.ts` owners | Reuse the existing template IDs recorded in each compatible descriptor and existing permission-projected milestone/assessment sources. Keep baseline, follow-up, source version, suppression and publication behavior under their current authorities. |
| Release notes | Coordinator-owned current release notes | Integrate the supplied `AGY-RELEASE-NOTES-project-workflows.md` sidecar after review. Do not claim release or visual verification from this branch alone. |

## Evidence source authority

- Production: `lib/production-records.ts` remains the canonical monthly record contract and sanitizer. The adapter preserves site, actual/expected status, unit, fictional provenance and the complete calendar month. A monthly value cannot be sliced into daily results; no pack conversion is guessed. Legacy unassigned records are omitted, leaving the reviewer without evidence rather than borrowing another site.
- Harvest, costs and sales: `lib/farm-records.ts` retains exact decimal quantity arithmetic, quantity/unit contracts and transaction reconciliation. The new evaluator imports its `decimalQuantitySum`; it does not add another financial book.
- Tasks and journal: `lib/task-board.ts`, `lib/field-journal.ts` and `lib/task-record-link.ts` remain the work and observation authorities. Their references carry no quantitative outcome automatically. A completed task or free-text note cannot become a harvested weight, survival count or soil result.
- Invoices: `lib/invoices.ts` remains rand-based. No payment adapter is supplied because its record has no explicit site/currency scope and a paid status alone does not establish the complete comparable receipt envelope. Reconcile linked sale/invoice identities before supplying money evidence; no new currency is inferred.
- Programme/MEL: `lib/programme-progress-records.ts`, `lib/programme-evidence.ts`, `lib/programme-report.ts`, `lib/mel.ts` and `lib/mel-report.ts` retain their permission, publication, consent, date and comparison decisions. This lane adds no access control or private-source reader.

The evaluator refuses a complete sum combining different source authorities because a monthly summary and harvest ledger, or invoice and sale, may describe the same events. Different source IDs alone cannot establish independence. A future reconciliation adapter may support canonical event identities, but that requires review against the existing source contracts.

## Readiness and limits

`workflow-reference` means an executable generic workflow and evidence review, not reviewed local crop advice, fluent translations, a certified evaluation method or a funding application. Country, region and language remain separate integration concerns. Template actions supply no crop species, spacings, yields, rainfall, carbon or survival targets.

The pure evaluator accepts typed evidence supplied by its caller. It checks completeness, scope, chronology, source class, actual/estimate status, duplicates, units, currency and consent/publication metadata. It does **not** authenticate the caller or independently verify an asserted source observation. Only existing authorised services may supply a future live envelope; never expose arbitrary client JSON as validated programme evidence.

For matched comparisons, baseline may precede the reporting window but must end by its start. Follow-up/current records must lie entirely within the window, and both event periods and submission dates must be at or before cutoff. The reporting time zone is explicit; already-local date strings are not reinterpreted as timestamps. Matched comparisons require the same population and documented method. Survival additionally requires a positive denominator matching the original baseline count; replacements are excluded by the source method.

Publication remains a separate, existing permission-controlled operation. Demonstration data is categorically rejected for publication. Missing/withheld consent and unpublished sources cannot qualify for a publication review. These metadata checks create no permission grant.

Known partial sums are labelled separately from a complete result. Zero is accepted only when actually observed; missing values remain missing. Mixed currency is never summed, even as a partial subtotal. Soil observation changes may be negative; no beneficial direction or project causation is inferred. Counts, practice adoption and tree symbols prove no carbon, soil-health or resilience outcome.

## Coordinator acceptance

Before integration, register the owned test and inspect `/international/projects` at a narrow viewport and dark theme, including the agroforestry survival scenario, missing baseline, duplicate references and mixed-currency receipts. Check the route inside the integrated app chrome and ensure all five template selections work. The parent owns visual evidence, full current-head suite/CI, rules, integration and publication review. No commits, pushes, PR or merge are authorised to this delegated writer before parent review.
