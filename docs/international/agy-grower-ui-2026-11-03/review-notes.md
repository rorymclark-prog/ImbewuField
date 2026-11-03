# Grower UI Automatic-Plan & Nursery Workflow — AI Draft Review Packet

Date: 2026-11-03  
Scope: 32 frozen UI strings from `docs/international/agy-grower-ui-2026-11-03/source.json` (source packet SHA256: `d7f072d7bc1e1d26e67b8e2525f575fdcefc6293824b62daed801f636479314b`).  
Status: **Unreviewed AI draft**. Not approved for production release, agricultural advice, or runtime enablement.

---

## 1. Candidate Terminology & Agronomic Alignments

These are candidate terms used in this AI draft. A fluent grower reviewer must check whether these fit local smallholder vocabulary and mobile screen layouts. No common or standard regional usage is asserted.

| English Source Term | French (`fr`) Candidate | Spanish (`es`) Candidate | Brazilian Portuguese (`pt-BR`) Candidate | Swahili (`sw`) Candidate | Agronomic & UI Distinction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Whole beds** | planches entières | canteros completos | canteiros inteiros | vitanda vizima | Cultivated garden/field beds; NEVER furniture. |
| **Field plots** | parcelles de plein champ | parcelas de campo | talhões de campo | mashamba ya wazi | Measured field sections without subdivided beds. |
| **Nursery** | pépinière | vivero | viveiro | kitalu | Plant propagation facility, distinct from field areas. |
| **Recipes** (propagation) | fiches techniques de multiplication | recetas de propagación | receitas de propagação | maelekezo ya ukuzaji | Grower-supplied propagation inputs, timing and loss parameters; NEVER culinary food recipes. |
| **Proposed cycles** | cycles de culture proposés | ciclos de cultivo propuestos | ciclos de cultivo propostos | mizunguko ya mazao inayopendekezwa | Unsaved draft estimates; not planted crops, observed stock or local farming approval. |
| **Exclusive end date** | date de fin exclue | fecha final excluyente | data final exclusiva | tarehe ya mwisho iliyotengwa / haikujumuishwa | Availability interval excludes the end date. |
| **Competing nursery use** | usage concurrent de la pépinière | uso competidor del vivero | uso concorrente do viveiro | matumizi shindani ya kitalu | Other operational uses occupying nursery space. |
| **Seedling readiness** | disponibilité des jeunes plants | preparación de las plántulas | prontidão das mudas | utayari wa miche | Propagation stage when seedlings are ready for field planting. |
| **Buyer targets** | objectifs des acheteurs | objetivos de compradores | metas de compradores | malengo ya wanunuzi | Purchaser demand and delivery target quantities. |

---

## 2. Candidate-Term Questions for Grower Reviewers

### French (`fr`)
1. **Bed terminology:** Does the candidate term *planche de culture* / *planche entière* clearly convey a cultivated growing bed for growers without confusion with construction boards?
2. **Propagation recipes:** Does *fiches techniques de multiplication* accurately convey grower propagation parameters and loss estimates rather than culinary cooking recipes?
3. **Availability intervals:** Does *date de fin exclue* / *jusqu'au (exclu)* clearly signal that the final date is not included in the available window?

### Spanish (`es`)
1. **Bed terminology:** Does the candidate term *cantero* clearly convey a cultivated growing bed in the target pilot region, or would *bancal* be preferred on mobile screen cards?
2. **Propagation recipes:** Does *recetas de propagación* clearly denote propagation timing and loss parameters without being misinterpreted as culinary recipes?
3. **Availability intervals:** Does *fecha final excluyente* / *disponible hasta (excluyente)* clearly communicate that the boundary end date is not part of the active interval?

### Brazilian Portuguese (`pt-BR`)
1. **Bed terminology:** Does *canteiro inteiro* clearly convey a full growing bed distinct from open field plots (*talhões de campo*)?
2. **Propagation recipes:** Does *receitas de propagação* clearly denote grower-supplied propagation inputs and loss parameters rather than culinary food recipes?
3. **Availability intervals:** Does *data final exclusiva* / *disponível até (exclusivo)* clearly communicate to growers that the end date is excluded from the available interval?

### Swahili (`sw`)
1. **Bed terminology:** Does *kitanda kizima* (plural: *vitanda vizima*) clearly identify a cultivated field growing bed rather than household sleeping furniture?
2. **Propagation recipes:** Does *maelekezo ya ukuzaji* clearly describe propagation timing and inputs rather than cooking recipes?
3. **Availability intervals:** Does *tarehe za mwisho zimetengwa* / *inapatikana hadi (haikujumuishwa)* clearly communicate that the boundary end date is not included in the available interval?

---

## 3. Required Human Verification Checks

Before any of these files can be integrated or enabled in production:
- [ ] **Physical Layout vs. Equipment:** Verify that cultivated field beds, field plots, nursery containers, and nursery surfaces are never conflated.
- [ ] **Data States (Proposed vs. Saved vs. Observed):** Confirm that proposed planning cycles are never phrased as planted crops, observed stock, or saved plans.
- [ ] **Unknown vs. Zero:** Confirm that unentered/unknown values (such as seed purchase quantities or seedling readiness) remain distinct from numerical zero.
- [ ] **Boundary Semantics:** Confirm that interval end points are understood as exclusive in all four target languages.
- [ ] **Protected Tokens:** Ensure that literal keywords `UTC` and `CSV` remain strictly preserved verbatim in ASCII uppercase without translation or transliteration.
- [ ] **No Farming Approval / Delivery Guarantees:** Ensure translations preserve the explicit statements that automatic planning does not select local crop calendars, does not promise weekly deliveries, and does not provide local agricultural approval.
- [ ] **Reviewer Sign-off:** Record the named grower or agronomist reviewer, date, dialect, and feedback before any runtime integration or release.

---

## 4. Structural Validation & Coordinator Provenance

- **Coordinator Independent Validation:** Performed on actual materialised files in `docs/international/agy-grower-ui-2026-11-03/`.
- **Message Totals:** Exactly 32 matching distinct keys per locale file (128 total message drafts across `fr.json`, `es.json`, `pt-BR.json`, and `sw.json`).
- **Source Binding:** Packet SHA256 `d7f072d7bc1e1d26e67b8e2525f575fdcefc6293824b62daed801f636479314b` bound unchanged to each file.
- **Source Match:** Per-message `sourceEnglish` and `sourceSha256` exactly match `source.json`.
- **Text & Tokens:** All translated strings are non-empty; uppercase ASCII tokens `UTC` and `CSV` are preserved verbatim.
- **Review Status:** Every file and message explicitly carries `review: { "status": "unreviewed" }`.
- **Worker Lifecycle:** All AI subagents cleanly stopped and terminated upon translation delivery.
- **Named Human Review:** Named fluent-human review by qualified smallholder growers or agronomists remains strictly required before any runtime activation or production release.
