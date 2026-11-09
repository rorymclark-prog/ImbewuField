# Translation Follow-up Batch: Full Quoted UI Messages (2026-11-02)

## 1. Overview & Scope

This packet contains the second bounded international translation batch for ImbewuField, covering **59 exact quoted UI messages**, status sentences, warnings, field dimensions, and accessibility strings omitted by the initial JSX-segment extraction.

- **Source File:** `docs/international/translation-followup-source-2026-11-02.json`
- **Output Directory:** `docs/international/translation-followup-2026-11-02/`
- **Review Status:** All messages and locale files are explicitly marked `"status": "unreviewed"`.
- **First Batch Preservation:** The prior 97-segment batch under `docs/international/translation-jobs-2026-11-02/` was completely preserved and untouched.
- **Production Code Isolation:** No production code, lessons, quizzes, plant species, dictionaries, settings, or Git state were modified.

---

## 2. Materialized Artifacts & Segment Counts

| File | Target Locale | Count | Review Status | Description |
| :--- | :--- | :---: | :---: | :--- |
| `fr.json` | `fr` | 59 | `unreviewed` | International French AI draft |
| `es.json` | `es` | 59 | `unreviewed` | Latin American Spanish AI draft |
| `pt-BR.json` | `pt-BR` | 59 | `unreviewed` | Brazilian Portuguese AI draft |
| `sw-KE.json` | `sw-KE` | 59 | `unreviewed` | Kenyan Swahili AI draft |
| `status.json` | all | 59 / locale | `needs-human-review` | Machine-readable batch status & metadata |
| `index.md` | — | — | — | This documentation & review gate index |

Every message in all four language files binds byte-for-byte to the `key`, `sourceEnglish`, and UTF-8 `sourceSha256` defined in `translation-followup-source-2026-11-02.json`.

---

## 3. Worker Execution & Stopped States

To prevent blocked shell scripts and sandbox permission denials, native workers operated without file or shell tool execution, returning JSON message arrays directly to the coordinator. The main coordinator materialized the final files directly into the repository.

- **French Subagent (`c04905ff-87c3-4313-a36c-86a83ae2992e`):** Returned 59 messages via parent message; cleanly stopped.
- **Spanish Subagent (`4ecaa2b1-506f-4f8d-a805-b5a14eae2963`):** Returned 59 messages via parent message; cleanly stopped.
- **Portuguese Subagent (`b9f7d87d-dc96-47b8-a9be-34f199c9a94d`):** Returned 59 messages via parent message; cleanly stopped.
- **Swahili (`sw-KE`):** Authored and verified directly by the main coordinator.
- **Active Subagents Remaining:** `0` (confirmed via `manage_subagents` list after `kill_all`).

---

## 4. Semantic & Agronomic Constraints Adhered To

1. **Cultivated Bed vs. Furniture:**
   - English `bed` consistently translated as field/garden growing bed (*planche de culture*, *cantero*, *canteiro*, *kitanda cha kilimo*), never sleeping furniture.
2. **Propagation Equipment vs. Field Areas:**
   - `tray` / `cell` / `container` (*plaque*, *alvéole*, *conteneur*, *bandeja*, *celda*, *célula*, *trei*, *chembe*) strictly distinguished from field beds and polygons.
   - `nursery` (*pépinière*, *vivero*, *viveiro*, *kitalu*) distinguished from open field blocks (*champ ouvert*, *campo abierto*, *campo aberto*, *shamba wazi*).
3. **Literal Tokens & Units:**
   - Exact units `m`, `m²`, `%`, `degrees`, `0–100` preserved.
   - Exact literal keywords `DEMO`, `CSV`, and brand name `ImbewuField` preserved untranslated.
4. **State Distinctions:**
   - Local device storage clearly distinguished from account/cloud confirmation.
   - Planning estimates/forecasts clearly distinguished from live observed nursery stock.
   - Unknown/unentered values clearly distinguished from zero.

---

## 5. Human Review Gates

No AI draft may be integrated into production or marked as approved without passing the four human review gates:

- [ ] **Gate 1 (French - `fr`):** Review by fluent Francophone agronomist / grower for West and Central African and international Francophone comprehension.
- [ ] **Gate 2 (Spanish - `es`):** Review by fluent Latin American Hispanophone grower / agronomist.
- [ ] **Gate 3 (Brazilian Portuguese - `pt-BR`):** Review by fluent Brazilian Portuguese smallholder farming specialist.
- [ ] **Gate 4 (Kenyan Swahili - `sw-KE`):** Review by fluent Kenyan Swahili speaker / East African smallholder farmer.

---

## 6. Boundaries & Next Steps

- **No Git Commit / Push:** As required, this coordinator turn does not commit or push to Git.
- **No Production Enablement:** Locales remain unenabled in production i18n dictionaries pending human sign-off and whole-message template source design.
- **Handoff:** Ready for independent structural checks and source matching by the Codex coordinator.

## Independent coordinator review

All four 59-entry files independently pass exact key/English/hash, literal-token,
nonempty-text and unreviewed-status checks. The source inventory was also checked
against 64 actual quoted-string occurrences. Fourteen deliberate draft corruptions
and six source/parser controls were rejected. This establishes structural binding,
not fluency, comprehension or visual fit. The three native workers reported
stopped/zero active and the main CLI exited cleanly after handoff. No translation
process remains running for this batch. No app language option was enabled.
