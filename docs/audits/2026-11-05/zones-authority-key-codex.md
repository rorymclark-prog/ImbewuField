# Zones boundary authority and key wording — 2026-11-05

- Auditor: Codex, following Rory's map-by-map visual review. Findings only; no presentation implementation.
- Reviewed revision: `06315a74ae03d6cb771c659776e09ce47f1d4a2b`, on `codex/zones-label-audit`.
- Deployment inspected: normal signed-in `https://imbewufield.vercel.app/design`, selected saved Ubhejane Creche; public build-info returned `06315a7/main`.
- Previous audit: [Zone photo coverage and key](../2026-11-03/zone-photo-coverage-codex.md). Carry forward AI-MAP-034/056/057/058 with the current versus older-output distinction below.
- Scope: sheet 03 boundary wording, zone-key meaning and evidence limits. Preserve all saved zone points, counts, features, classifications, badges and swatches. Independent energy/terrain survey work is outside scope and not edited.
- Evidence: actual current exact download, older cached exact/AI exports visually inspected, normal-browser gallery and source review. No paid generation.

## What was already done

The current free exact export retains the numbered polygons, matching swatches and one row for each present zone class. Its Zone 0 caption is already **Classroom & play courtyard**, consistent with the saved classroom/play-feature guard at `components/design/DesignGlossy.tsx:10586–10593`. This verifies the earlier AI-MAP-058 correction in the current exact output; do not reopen it based on the old AI image.

Current exact evidence: `01-Zones-exact-live-06315a7-2026-11-05.png`, 3462 × 2448, 2,267,695 bytes, SHA-256 `04746963f4f629a50e7311a1a2a0852d8827c89464adc58bc3226816cc3954a2`. It was rendered free through the normal app and downloaded with **Plain paper / High** selected. Full-screen UI and downloaded PNG were both visually inspected. No aerial capture date is implied by the export date.

The available Chrome gallery initially contained only a Sector exact copy; the free Zones render added its second entry. It contained no saved AI Zones copy. The separate cached AI export modified 3 November has SHA-256 `b80656e91a4906e6e2f9e22e1f2cc719e1f7ebf4a8389db1ddc8ea8757ce4371`; cached job revision `1a820cb5cb153fad30b6d3031f4f66c2336fe084161c6a3526fed72d8271c02e`, OpenAI/high/precision_atlas, worker complete. It still says Home & hub and shows later planted-site imagery with a blurry top strip. Its capture date and currentness are unverified. That does not establish a new regression in today's exact output or a verified current AI reassembly.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and bounded recommendation |
| --- | --- | --- | --- |
| AI-MAP-066 | The current key calls the saved proposed design extent “Property boundary” | Verified wording defect; not implemented | `components/design/DesignGlossy.tsx:10801–10804` emits the literal for both the quiet Zone swatch and fallback path. `lib/base-layers.ts:28–42` and `DesignGlossy.tsx:649` provide a saved ring/source origin, with no cadastral-authority record. For this Ubhejane proposal, use **Proposed design extent**, matching the user's approved boundary distinction. A general site with unknown proposal status can use **Saved design boundary**. Do not infer a legal property edge or equate the ring with the old courtyard fence. Scope the correction to the shared Zones legend path; do not replace unrelated boundary labels across the app blindly. Keep the same points and charcoal dashed swatch. |
| AI-MAP-067 | The key names zones but does not explain intended care intensity | Supported general explanation available; actual site cadence unknown | `sheetLegendRows` at `DesignGlossy.tsx:10623–10626` prints only the grouped name. Existing `ZONE_KEY` at `lib/design-elements.ts:131–140` already explains intensity: daily tending for Zone 1, regular care for Zone 2, seasonal work for Zone 3. These can supply short **general zone meanings**, without new numerical visit schedules. A compact second line can say “Daily tending”, “Regular tending”, “Seasonal work”, under a “Typical care intensity” heading/qualification. Zone 0 keeps the actual classroom/play label; no visit count is known for it. This is not evidence of actual observed attendance or why each specific polygon was placed there. |
| AI-MAP-067 | A tempting spatial rationale would be invented from temporary advice | Verified data limit | `ZoneShape` at `lib/design-canvas.ts:162–193` stores class, ring, optional name/status and feature-specific measurements, but no visit-frequency/placement-rationale field. `zone-advice.ts:7–14,31–42` carries suggestion notes, and `app/design/page.tsx:1218,3027` holds them as temporary UI advice. Do not present those suggestions or guessed access patterns as a saved farmer decision. Site-specific rationale remains unknown unless actually recorded and verified. No schema change is proposed here. |
| AI-MAP-034/057 | Repeated Zone 2 areas and missing Zones 4/5 could be mistaken for a defect | Current behavior retained | `lib/glossy-filters.ts:362–377` groups only valid, actually drawn non-feature zone rings, once per class. Both visible Zone 2 regions keep their badges with one key row. `ZONE_KEY` explicitly says a site need not have every zone. Do not add 4/5, invent new polygons or impose concentric rings on this small creche site. |
| AI-MAP-056/058 | Old AI has a top blur strip and obsolete generic Zone 0 text | Older-output recovery gap; current AI not verified | Carry forward the requirement to inspect a current original-device free reassembly before claiming the AI path is current. The fresh exact already has the correct classroom/play wording; its plain-paper base cannot validate photographic edge trimming. Do not charge for a regeneration to hide that evidence gap. |

## Verification

- Typecheck/tests: not rerun for this read-only source/documentation audit. No runtime change or new pass claimed; any later implementation needs the affected wording/legend checks, typecheck, whitespace and applicable release gates.
- Whitespace: `git diff --check` for the audit documents.
- Actual exports and `zones-review-provenance.json` are preserved in the local workspace folder `Documents/ImbewuField App/Map style samples/2026-11-05/Zones review/`. `Zones review.html` pairs the fresh exact with the explicitly older AI copy.
- Live design-revision hash was not exposed by the normal UI. Connector profile/connection/site-list calls all returned “Connect ImbewuField”; no connection scope or site authorization was invented. The normal already-signed-in browser was used instead. Own browser tab was closed; no server/heavy process remains.
- This audit does not change the picture, saved geometry, zone counts, species/advice, data schemas or app configuration. PLAN_VERSION remains `v93`; recipe counters untouched. No paid render or background job was started.

## Next continuation

Keep Rory's current Zones visual review first. The small boundary-label correction can then be implemented in the shared Zones legend path with its authority/data guard. Add general care-intensity wording only as such, using the existing catalog; do not claim site-specific cadence or invent rationale. A current saved AI copy/reassembly remains a separate verification need. Preserve this audit's findings rather than treating the old AI artifact as today's source state.
