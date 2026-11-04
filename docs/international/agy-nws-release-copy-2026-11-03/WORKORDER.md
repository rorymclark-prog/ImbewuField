# AGY: four source-bound NWS release messages in existing languages

NEW bounded candidate-only batch. Resume the existing translation conversation.
Optional interaction-data sharing stays OFF. Use the main agent and at most two
reused idle AI workers: isiZulu (zu) and Sesotho (st). Main handles Xitsonga (ts),
Tshivenda (ve), consolidation and file materialisation. Workers return arrays,
not overlapping file edits. No duplicate writers or additional conversations.

Read ONLY frozen source.json in this directory, SHA256
`a095a99ad9d895ace2876cc7f27ff3be337aaf3bc091fcc774092d9759e106d6`.
Actual runtime confirms the SAME four missing strings per locale: four locales ×
four messages = 16 candidates. All belong to release 66e2dffc6. The existing
country entry’s eight source strings remain covered. Default recent-history and
Simple-history gaps are contained in this packet; there are no other gaps.

Preserve every key, sourceEnglish and sourceSha256 exactly. Translate only text.
Preserve the navigation arrow → and existing destination. Clearly distinguish a
fixed PUBLIC US station example from a farmer’s location, observation time from
retrieval time, missing readings from zero, and public reference observations
from farm weather, climate normals, forecasts or planting advice. Do not invent
weather/farming values, capabilities, routes, standard terminology, reviewer
names, private coordinates or claims of human approval.

Write ONLY zu.json, st.json, ts.json, ve.json, review-notes.md and status.json
inside docs/international/agy-nws-release-copy-2026-11-03/ in THIS weather worktree.
Do NOT edit source.json, WORKORDER.md, runtime/source files, existing chunks,
production/core dictionaries, lessons, quizzes, species, tests, settings, Git or
any other file. Use normal scoped file permissions only. No shell commands,
scripts, browsing, permission bypasses, settings changes, commits or pushes are
needed. Report an actual permission boundary rather than widening permissions.

Locale schema: schemaVersion 1, locale, provenance
{executor:'AGY',method:'AI draft',createdOn:'2026-11-03'},
review {status:'unreviewed'}, messages
[{key,sourceEnglish,sourceSha256,text,review:{status:'unreviewed'}}].
Every locale file has exactly four rows in source order. All 16 texts remain
explicitly unreviewed AI candidates pending fluent human review. Notes contain
candidate terminology/questions only; no regional usage assertions, worker IDs,
raw transcripts/logs, credentials or private metadata. Status records actual
files/counts, candidate-only scope and actual stopped-worker state.

After the four complete files exist, stop reused workers and hand off actual
files/counts/stopped state. No runtime integration, production deployment,
language/agronomic approval, Git actions or additional batch. Root independently
checks exact source binding, UTF-8 hashes, completeness, tokens/arrows and prior
runtime-chunk bytes/history. Any subsequent coordinator integration must use only
the existing explicitly unreviewed source-paired update-copy mechanism, retain
English fallback and human-review notices, preserve all prior chunk bytes/order,
and verify actual current banner/tour and recent-history coverage. Structural
validation never constitutes fluent-human review or weather/agronomic approval.
