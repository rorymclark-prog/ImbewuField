# Grower Release & Tour Updates (isiZulu, Sesotho, Xitsonga, Tshivenda) — AI Candidate Review Packet

Date: 2026-11-03
Scope: 9 exact current grower crop/nursery milestone and prior grower-entry release descriptions and update-tour strings from `source.json` (packet SHA256: `1ac50ec10110e0323d9f0216d8f795fcdb445a03806bea685dd06ffcff9188fe`).
Status: **Unreviewed AI draft**. Candidate-only translation; no fluent-human, agricultural-advice or language approval. AGY delivered standalone files without runtime integration; the coordinator subsequently wired exact candidates into the existing disclosed unreviewed update-copy mechanism on this branch. This is not a production deployment.

---

## 1. Candidate Terminology & Agronomic Alignments

These are candidate terms used in this AI draft. A fluent grower reviewer must check whether these fit local smallholder vocabulary and mobile screen layouts. No common or standard regional usage is asserted.

| English Source Term | isiZulu (`zu`) Candidate | Sesotho (`st`) Candidate | Xitsonga (`ts`) Candidate | Tshivenda (`ve`) Candidate | Agronomic & UI Distinction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Automatic crop plans** | izinhlelo zokutshala ezizenzakalelayo | merero e iketsahallang ea lijalo | maendlelo ya swibyariwa lama tiendlelaka | pulane dza zwilimwa dza othomethiki | Algorithmically generated planning estimates from grower inputs, NOT local farming advice or approved calendars. |
| **Growing estimates** | izilinganiso zokutshala | likhakanyo tsa temo | mimpimo ya matirhele | mbalo dzaṋu dza u alusa | Grower's own supplied planning figures, distinct from verified agronomist guidance. |
| **Nursery tray & surface** | amathileyi nezindawo zenkulisa yezitshalo | diterei le dibaka tsa setsidifatso sa limela | switreyi swa nersari na swilaveko swa xitsandza | thirei dza nese na vhupo ha nese | Physical propagation containers and floor/bench surface, distinct from open field blocks. |
| **Measured beds** | imibhede yokutshala elinganisiwe | libethe tsa temo tse lekantsoeng | mibhedhi leyi pimiweke | mibethe yo pimiwaho | Cultivated growing beds with recorded physical dimensions; never sleeping furniture. |
| **Saved sowings** | ukuhlwanyela okugciniwe | lijalo tse bolokiloeng | swibyariwa leswi hlayisiweke | nyalo dzo vhulungwaho | Existing confirmed sowing records that remain untouched by draft planning proposals. |
| **Proposed cycles** | imijikelezo ehlongozwayo | mekoloko e sisintsweng | mirhendzeleko leyi ringanyetiweke | mitingatingo yo dzinginywaho | Uncommitted crop cycle simulations; distinct from committed sowings or field crops. |
| **Blank values stay missing** | izindinganiso ezingenalutho zihlala zingekho | litekanyetso tse se nang letho li lula li le sieo | mintsengo leyi nga hava nchumu yi tshama yi kayivela | mbalo dzi siho dzi dzula dzi siho | Explicit distinction between unknown/unentered input data and numerical zero. |

---

## 2. Candidate-Term Questions for Grower Reviewers

### isiZulu (`zu`)
1. **Bed terminology:** Does *imibhede yokutshala* clearly designate cultivated field beds without ambiguity or confusion with furniture?
2. **Nursery needs:** Does *amathileyi nezindawo zenkulisa yezitshalo* clearly describe propagation tray and surface needs?
3. **Automatic plans:** Does *izinhlelo zokutshala ezizenzakalelayo* convey an algorithmic proposal derived from grower estimates rather than verified local farming instructions?

### Sesotho (`st`)
1. **Bed terminology:** Does *libethe tsa temo* (or *mela ea temo*) best indicate cultivated growing beds for smallholders in the target region?
2. **Nursery needs:** Does *diterei le dibaka tsa setsidifatso sa limela* clearly distinguish propagation facilities from open field parcels?
3. **Blank values:** Does the candidate phrase for missing values clearly communicate that unentered inputs remain undefined rather than numerical zero?

### Xitsonga (`ts`)
1. **Bed terminology:** Does *mibhedhi leyi pimiweke* clearly identify measured cultivated garden beds rather than sleeping furniture?
2. **Nursery equipment:** Does *switreyi swa nersari na swilaveko swa xitsandza* clearly denote nursery trays and surface space on smallholder plots?
3. **Automatic plan:** Does *maendlelo ya swibyariwa lama tiendlelaka* clearly signify simulated estimates rather than an official agronomic plan?

### Tshivenda (`ve`)
1. **Bed terminology:** Does *mibethe yo pimiwaho* clearly identify measured cultivated beds?
2. **Nursery equipment:** Does *thirei dza nese na vhupo ha nese* clearly identify propagation trays and bench space?
3. **Sowing immutability:** Does *nyalo dzaṋu dzo vhulungwaho a dzi shanduki* clearly reassure growers that saved sowings are unaltered by review simulations?

---

## 3. Required Human Verification Checks

Before any candidate can be described as fluent-human approved or approved local farming guidance:
- [ ] **Proposal vs. Saved Truth:** Verify that proposed cycles and estimates are never presented as committed sowings or verified agronomic advice.
- [ ] **Missing vs. Zero:** Confirm that unentered/blank inputs remain strictly missing/undefined and are never conflated with zero.
- [ ] **Physical Equipment vs. Field:** Verify that nursery trays and propagation surface areas are kept distinct from cultivated garden beds and open field plots.
- [ ] **Navigation Invariants:** Confirm that the navigation arrow `→` and existing path labels are preserved verbatim.
- [ ] **Reviewer Sign-off:** Record the named grower or agronomist reviewer, date, dialect, and feedback before claiming fluent-human approval or approved local farming guidance. Candidate-only branch wiring is distinct and remains explicitly unreviewed.

---

## 4. Structural Validation & Coordinator Provenance

- **Coordinator Independent Validation:** Performed on actual materialised files in `docs/international/agy-grower-release-copy-2026-11-03/`.
- **Message Totals:** Exactly 9 matching distinct keys per locale file (36 total candidate message drafts across `zu.json`, `st.json`, `ts.json`, and `ve.json`).
- **Source Binding:** Packet SHA256 `1ac50ec10110e0323d9f0216d8f795fcdb445a03806bea685dd06ffcff9188fe` bound unchanged to each file.
- **Source Match:** Per-message `sourceEnglish` and `sourceSha256` exactly match `source.json`.
- **Text & Tokens:** All translated strings are non-empty; navigation arrow `→` and route paths are preserved verbatim.
- **Review Status:** Every file and message explicitly carries `review: { "status": "unreviewed" }`.
- **Worker Lifecycle:** All AI subagents cleanly stopped and terminated upon translation delivery.
- **Named Human Review:** Named fluent-human review by qualified growers or agronomists remains required before describing these drafts as approved. Existing source-paired unreviewed candidate display is a separate coordinator action.

## 5. Coordinator candidate integration

The executor’s no-runtime-integration handoff describes its completed historical scope. The coordinator added the nine exact rows per locale to the four existing update-copy chunks on this branch; all prior chunk bytes and their order are retained. English source fallback, draft notices, release history and core locale dictionaries remain unchanged. No new language or local agronomic advice is approved, and no production deployment was performed by this integration.

`structural-validation.json` records exact UTF-8 source/packet/chunk hashes and exercised damaged-packet controls. These checks establish identity and wiring, not fluent translation quality. The candidate terminology and review questions above remain pending human review.
