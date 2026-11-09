# AGY translation follow-up: exact full UI messages

Rory requested parallel translation jobs. Continue the existing translation
conversation. The first97-segment files have now been independently structurally
reviewed and committed; do NOT edit them again. Do not edit production source,
lessons, quizzes, species, i18n dictionaries, permissions, settings or Git state.

Only write docs/international/translation-followup-2026-11-02/**.
Read the frozen input docs/international/translation-followup-source-2026-11-02.json.
It contains59 exact quoted messages omitted by the initial JSX-text extraction,
including warning/status sentences and field dimensions. Copy key, sourceEnglish
and sourceSha256 exactly. Do not change the input or add your own source messages.
Raw template-expression interiors have been excluded for separate source design.

First check native worker states in this conversation. Reuse up to three idle
workers for fr, es and pt-BR; main handles sw-KE. No duplicate writers. To avoid
blocked native script/file commands, workers should RETURN their complete JSON
message arrays to the parent rather than use Bash or write files. Main uses the
normal file-edit tool to materialise final files in the shared repo. No shells,
Python scripts, directory reconnaissance, transcript reads or public browsing
are needed for translation. Do not request broader/always-allow permissions.

Write fr.json, es.json, pt-BR.json and sw-KE.json with schemaVersion1, locale,
provenance {executor:'AGY',method:'AI draft',createdOn:'2026-11-02'},
review {status:'unreviewed'}, messages[{key,sourceEnglish,sourceSha256,text,
review:{status:'unreviewed'}}]. All text is unreviewed; do not invent reviewer names.
Keep literal unit tokens (cm,m²,%,etc), numbers, DEMO and CSV exact. Preserve
unknown versus zero, local device versus cloud acknowledgement, estimates versus
actual records, unavailable advice versus approval. Never add farming figures.
Locale scope: plain international French, broadly understandable Latin American
Spanish, Brazilian Portuguese, Kenyan Swahili. Other regional fit is UNKNOWN.
No claims of common/standard local terminology without primary evidence; instead
record candidate terms for fluent grower review. No crop/species names or lessons.

After the four files exist, write a compact index.md and status.json identifying
actual files/counts, original English/hash binding, all human review gates and
real native-worker stopped states. A coherent file handoff is required; a Working
label is not progress. The Codex coordinator will run independent structural
checks, source matching and meaningful corruption controls. Do not claim quality
approval or app language enablement, commit/push, or start any additional batch.
