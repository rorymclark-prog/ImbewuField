# Weekly buyer fulfilment audit

- Auditor: Codex
- Branch: `codex/weekly-buyer-fulfilment-20261128`, based on live `f3d72287a01f2ea41c6d415f066e2d9a5b95e278`
- Prior record: [Weekly market-garden production](../2026-11-27/weekly-market-garden-production.md)
- Scope: checked harvests, checked sales, explicit buyer entries, source revalidation, reopen and the printed weekly summary

| Check | Intended evidence |
| --- | --- |
| BF-01 · Explicit quantities | The selected order displays ordered, planned, linked harvest, allocated and delivered amounts separately. A dated source supplies its physical quantity and unit. Partial delivery and unknown coverage can coexist. A grower chooses a source and handover date for every new delivery. |
| BF-02 · Bounds and identity | Recheck the owner, source ID, crop, unit, date and fingerprint. Count an invoice line or record at most once. Hold ambiguous invoice copies, quantities beyond the original record and unresolved evidence. Test exact decimal totals across buyers. |
| BF-03 · Save and reopen | Use the existing harvest-target write request and readback. Verify explicit zero, a correction, competing updates, and an old draft after changing accounts or examples. Preserve the original harvest and sale records. |
| BF-04 · Printable week | Use the same checked UI quantities and dated mapped work. Recheck the underlying receipts before downloading. HTML escapes customer and bed names. |
| BF-05 · Practice isolation | Green Horizon seeds a fictional partial 3 kg delivery against its existing 4 kg practice sale. Its chard delivery remains unknown. Replay keyboard, phone touch, reset, saved readback and the Ubhejane switch with local synthetic records. |

Exact local Node 24 TypeScript, 163 focused tests and whitespace checks passed. Full current-head CI, independent Codex review, the hosted device flows and inspection of the printed result are required before this milestone is complete. Production publication is separate.
