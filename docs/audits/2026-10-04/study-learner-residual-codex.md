# Core Study learner translation residual audit — 2026-10-04

- Auditor: Codex independent read-only audit agent
- Reviewed revision: `4c10484c02db2c429c660981b92d2f98ae562e26` on `codex/regional-learner-text-next-20261004`; `origin/main` matched this revision during enumeration. Active uncommitted registry edits were excluded.
- Deployment inspected: Not inspected.
- Previous audit: No earlier durable learner-residual audit appears in the current `docs/audits` index. Prior snapshot ledger is retained by its source files and findings are carried forward here; study translation snapshots are linked below.
- Scope: Ten core Study modules (Intro to Permaculture, Reading the Landscape, Water Harvesting, Soil Health, Vegetables and Staples, Food Forest, Plant Selection and Guilds, Market and Community, Seeds and Seed Sovereignty, Small Livestock Integration); 33 canonical lessons across Sesotho, Tshivenda and Xitsonga; canonical lesson fields title, body, optional infographicAlt, key points and quiz text. Farm Finance/reserves/newFlow and paired slide copy are outside this ledger.
- Evidence type: Source/registry/resolver enumeration and inherited source-bound English-hold snapshot. No language-fluency approval is claimed.

## What was already done

The earlier translation work remains visible in the review snapshots, including [Food Forest and Plant Guilds regional review record](../../study-translation-reviews/food-forest-guilds-regional-2026-10-02/README.md), [Seeds and Small Livestock regional review record](../../study-translation-reviews/seeds-livestock-regional-2026-10-02/README.md), the [Reading Landscape observation check](../../study-translation-reviews/READING-LANDSCAPE-OBSERVATION-FINAL-SEMANTIC-CHECK-2026-10-04.json), [Vegetables and Market batch audit](../../study-translation-reviews/REGIONAL-VEGETABLES-MARKET-ROOT-BATCH-AUDIT-2026-10-04.json), and [ordinary metadata implementation proof](../../study-translation-reviews/REGIONAL-ORDINARY-METADATA-IMPLEMENTATION-PROOF-2026-10-04.json). These are evidence for distinct fields/batches, not evidence that every Study field is translated or reviewed.

The prior ledger's 213 explicit `hold` fields and 178 exact English body-sentence occurrences are carried forward unchanged. All 30 registry files and both canonical source/resolver files have matching SHA-256 hashes between that ledger and revision `4c10484c02db2c429c660981b92d2f98ae562e26`. The inherited triage labels were 31 ordinary-draftable fields, 139 source-sensitive mixed-framing fields needing checked translation, and 43 difficult technical anchors. These labels are prioritization aids, not publication authority: the ordinary bucket includes technical water distractors (including overtopping/breach and permanent storage), while the difficult bucket includes ordinary quiz framing about surplus. None of the 43 technical-class fields is automatically exempt from future drafting; preserve only the specific uncertain technical clause as English where needed. Pending packet references remain separate: the final Vegetables L2 root-ready candidate packet is archived at `docs/study-translation-reviews/VEGETABLES-L2-ORDINARY-COMPLETION-ROOT-READY-2026-10-04.json` (packet SHA-256 `fdceb34da4a14966ea018596216b95f658906e0d4cb907afd80024b0cc2f9bf3`). The Soil/Market metadata root-ready packet is archived at `docs/study-translation-reviews/STUDY-SOIL-MARKET-METADATA-ROOT-READY-2026-10-04.json` (packet SHA-256 `c40f6d99393835cfcb2c3985edc9b886611ac237f4738ba87c3ef9298be27c84`). These are checked candidate evidence. The next branch applies their approved targets; publication and completion still require the release gates. The earlier rejected Vegetables L2 composition is superseded and is not cited here.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-001 | Three canonical Xitsonga Intro to Permaculture infographic descriptions have no regional field pair. The resolver returns lesson status `draft` but its resolved content omits the optional description, so this field has neither localized text nor an English fallback in the returned presentation object. | Open | Current exact field evidence and source/registry binding are in the expanded ledger's `canonicalFieldCoverage.omissions`: L1, L2 and L3 `infographicAlt` in `lib/course-translation-drafts-ts.ts`. Add source-bound fields or deliberately establish a field fallback and test it; do not misreport these as three more explicit holds. |
| STUDY-RES-002 | Regional learner content still contains explicitly held English fields and copied body sentences. | Open, field-level | The expanded ledger preserves all 213 registered `hold` fields (20 ST, 98 VE, 95 TS) and 178 exact copied English body-sentence occurrences at this source revision. Continue source-bound drafting/review; keep technical terms and uncertain claims exact in English where needed. Facilitator feedback follows visible unreviewed draft publication; fluent approval is not claimed. |

Canonical coverage reconciliation: 1,878 canonical lesson-field slots were enumerated; 1,875 have registered source-bound regional field pairs; the remaining three are the Xitsonga Intro infographic descriptions above. The 99 language/lesson slots all have a regional lesson registry record. The three missing optional fields do not change the inherited hold or copied-sentence counts.

## Verification

- Typecheck: Not run; no code was changed.
- Full test suite: Not run; read-only audit.
- Whitespace: Not run; no repository file changed.
- Output inspected: Resolver content/status from source; no deployment or screen inspection for this audit.
- Other limits: I followed `AGENTS.md` section 5b and read `docs/audits/README.md` and `docs/audits/TEMPLATE.md`. This is not a fluency review and does not cover paired-slide fields, module card metadata, all lesson meaning quality, or whether the optional image descriptions are consumed by a particular UI surface. This changes no picture. `PLAN_VERSION` was not touched.

## Next continuation

1. Decide and implement the three source-bound TS Intro `infographicAlt` fields, retaining their complete image descriptions.
2. Use the expanded ledger to select the next ordinary learner-text batch, while avoiding duplication with pending Vegetables L2 and Soil/Market metadata packets.
3. After any implementation, rerun canonical-field/source binding and resolver checks at the new committed revision; keep facilitator review distinct from machine-draft publication.

Durable residual evidence: `docs/study-translation-reviews/STUDY-LEARNER-RESIDUAL-COMPLETION-LEDGER-2026-10-04.json` (expanded ledger, SHA-256 `4f444593968dab82c96ba81d6070b5329d8ec18cf4f6d1ab9acab07b9b1ec270`) and `docs/study-translation-reviews/STUDY-LEARNER-RESIDUAL-FALLBACK-FIELDS-2026-10-04.json` (canonical field enumeration, SHA-256 `1821baaab80c5fcc1f95afb70f8b5579d2a9ce663254774c6735fc7784e965a1`). The residual ledger and canonical enumeration are archived at these paths; candidate packets remain separate from implemented learner status.
