# Handoff: Site Survey Release Copy Drafts

## Packet & Source Identity
- Source read: `source.json` (SHA-256: `0125c11b7512565f0ab16d5a8ee349d563d86dce237c7250400267cde544e4df`)
- Captured 8 English release messages from `lib/release-notes.ts` (SHA-256: `bb2de1e7913f6ed23c437a86d74cf306c30e6810c296050b85340bee840534ca`)
- Output candidates: 32 drafts across 4 locales (`zu`, `st`, `ts`, `ve`), 8 messages each.

## Terminology Corrections & Semantic Distinctions
- Reconciled against authorized `survey-glossary.json` without modifying live sources:
  - Tshivenda: Elevation aligned to `Vhulapfu/vhulapfu` (avoiding capability terms); reference aligned to `tshiko` (avoiding protection `tsireledzo`); data source aligned to `vhubvo` (preventing collision with borehole `Tshisima`).
  - isiZulu: Row 08 clarified reference assumptions (`imicabango ethathwayo`) without implying observed measurements or verified estimates.
  - Sotho/Tsonga: Preserved existing draft byte counts, route arrows (`→`), and keys.
- Core distinctions maintained: benchmark vs terrain model, fetched references vs measured evidence, wind height/source/period retained before saving.
- Marked `reviewStatus: "unreviewed-ai-draft"` and `runtimeActivation: false`.

## Validation & Status
- Native validation: NOT RUN (coordinator-owned).
- All candidates remain unreviewed AI drafts requiring fluent human verification before any runtime activation or release integration.
