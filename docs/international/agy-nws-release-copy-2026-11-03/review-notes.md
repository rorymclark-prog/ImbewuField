# NWS Observation-Reference Release Updates (isiZulu, Sesotho, Xitsonga, Tshivenda) — AI Candidate Review Packet

Date: 2026-11-03
Scope: 4 exact current NWS observation-reference release descriptions and update-tour strings from `source.json` (packet SHA256: `a095a99ad9d895ace2876cc7f27ff3be337aaf3bc091fcc774092d9759e106d6`).
Status: **Unreviewed AI draft**. Candidate-only translation; no fluent-human, agricultural-advice or language approval. AGY delivered standalone files without runtime integration; the coordinator subsequently wired exact NWS candidates into the existing disclosed unreviewed update-copy mechanism on this branch. This is not a production deployment.

---

## 1. Candidate Terminology & Domain Alignments

These are candidate terms used in this AI draft. A fluent grower reviewer must check whether these fit local smallholder vocabulary and mobile screen layouts. No common or standard regional usage is asserted.

| English Source Term | isiZulu (`zu`) Candidate | Sesotho (`st`) Candidate | Xitsonga (`ts`) Candidate | Tshivenda (`ve`) Candidate | Agronomic & UI Distinction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fixed public station example** | isibonelo sesiteshi somphakathi esingaguquki | mohlala oa seteishene sa sechaba se sa fetoheng | xikombiso xa xitichi xa le rivaleni lexi nga cenciki | tsumbo ya tshititshi tsha tshitshavha tshi sa shandukiho | Fixed public benchmark station; NOT a farmer's local on-farm sensor or location. |
| **Weather observations** | okubonwe ngesimo sezulu | litebello tsa boemo ba leholimo | swivonelo swa maxelo | thaluso dza mutsho | Public reference readings; distinct from farm weather, climate normals, forecasts or planting advice. |
| **Missing readings** | okufundwa okushodayo | lipalo tse sieo | tinhlayo leti kayivelaka | zwivhalo zwi siho | Explicit unrecorded sensor readings; strictly distinct from numerical zero. |
| **Observation vs retrieval times** | izikhathi zokubuka nezokulanda | linako tsa ho shebella le tsa ho lata | mikarhi yo vona na yo kuma | zwifhinga zwa u vhona na zwa u dzhia | Observation timestamp at the station versus retrieval/fetch timestamp from the API. |
| **Planting advice** | iseluleko sokutshala | keletso ea ho jala | switsundzuxo swo byala | nyeletshedzo ya u zwala | Agronomic planting guidance; explicitly NOT provided by public weather reference. |

---

## 2. Candidate-Term Questions for Grower Reviewers

### isiZulu (`zu`)
1. **Fixed public station:** Does the candidate phrase *isibonelo sesiteshi somphakathi esingaguquki* clearly convey an external, fixed benchmark station without implying a local farm sensor?
2. **Missing readings:** Does *nokufundwa okushodayo* clearly communicate that sensor readings are absent rather than reading zero?
3. **Observation vs. retrieval:** Are *izikhathi zokubuka* (observation time) and *izikhathi zokulanda* (retrieval time) distinct and clear for growers on mobile cards?

### Sesotho (`st`)
1. **Fixed public station:** Does *mohlala oa seteishene sa sechaba se sa fetoheng* clearly indicate an unchangeable public reference station?
2. **Missing readings:** Does *lipalo tse sieo* clearly distinguish unrecorded data from zero values?
3. **Observation vs. retrieval:** Does *linako tsa ho shebella le tsa ho lata* maintain the operational distinction between sensor recording time and API fetch time?

### Xitsonga (`ts`)
1. **Fixed public station:** Does *xikombiso xa xitichi xa le rivaleni lexi nga cenciki* clearly convey an external public benchmark station?
2. **Missing readings:** Does *tinhlayo leti kayivelaka* clearly convey missing sensor entries without confusion with zero?
3. **Observation vs. retrieval:** Does *mikarhi yo vona na yo kuma* keep observation and retrieval timestamps distinct on screen?

### Tshivenda (`ve`)
1. **Fixed public station:** Does *tsumbo ya tshititshi tsha tshitshavha tshi sa shandukiho* clearly signify a fixed public reference station?
2. **Missing readings:** Does *zwivhalo zwi siho* clearly denote missing readings rather than zero?
3. **Observation vs. retrieval:** Does *zwifhinga zwa u vhona na zwa u dzhia* preserve the distinct timestamps clearly?

---

## 3. Required Human Verification Checks

Before any candidate can be described as fluent-human approved or approved weather or local farming guidance:
- [ ] **Public Reference vs. Farm Weather:** Verify that reference station data is never presented as farm weather, local microclimate, or planting advice.
- [ ] **Missing vs. Zero:** Confirm that missing readings are explicitly kept distinct from numerical zero.
- [ ] **Observation vs. Retrieval Times:** Verify that station observation timestamps and API fetch timestamps stay separate.
- [ ] **Navigation Invariants:** Confirm that the navigation arrow `→` and destination label `United States` are preserved verbatim.
- [ ] **Reviewer Sign-off:** Record the named grower or agronomist reviewer, date, dialect, and feedback before claiming fluent-human approval or approved weather or local farming guidance. Candidate-only branch wiring is distinct and remains explicitly unreviewed.

---

## 4. Structural Validation & Coordinator Provenance

- **Coordinator Independent Validation:** Performed on actual materialised files in `docs/international/agy-nws-release-copy-2026-11-03/`.
- **Message Totals:** Exactly 4 matching distinct keys per locale file (16 total candidate message drafts across `zu.json`, `st.json`, `ts.json`, and `ve.json`).
- **Source Binding:** Packet SHA256 `a095a99ad9d895ace2876cc7f27ff3be337aaf3bc091fcc774092d9759e106d6` confirmed as authority.
- **Source Match:** Per-message `sourceEnglish` and `sourceSha256` exactly match `source.json`.
- **Text & Tokens:** All translated strings are non-empty; navigation arrow `→` and destination `United States` are preserved verbatim.
- **Review Status:** Every file and message explicitly carries `review: { "status": "unreviewed" }`.
- **Worker Lifecycle:** Single main writer execution; 0 active subagents.
- **Named Human Review:** Named fluent-human review by qualified growers or agronomists remains required before describing these drafts as approved. Existing source-paired unreviewed candidate display is a separate coordinator action.

## 5. Coordinator candidate integration

The executor’s no-runtime-integration handoff describes its completed historical scope. The coordinator added the four exact rows per locale to the four existing update-copy chunks on this branch; all prior chunk bytes and their order are retained. English source fallback, draft notices, release history and core locale dictionaries remain unchanged. No new language is enabled, and no weather or local agronomic guidance is approved, and no production deployment was performed by this integration.

`structural-validation.json` records exact UTF-8 source/packet/chunk hashes and exercised damaged-packet controls. These checks establish identity and wiring, not fluent translation quality. The station-reference terminology and review questions above remain pending human review.
