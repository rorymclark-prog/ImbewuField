# AGY: eight source-bound release messages in existing local languages

This is a NEW bounded task, separate from the completed Asian-language batch and
the Brazil research conversation. Resume the existing translation conversation.
Optional interaction-data sharing stays off. Reuse at most two idle AI workers:
one for isiZulu (`zu`), one for Sesotho (`st`); main handles Xitsonga (`ts`) and
Tshivenda (`ve`) plus file materialisation. Workers return arrays, not files.

Read ONLY the frozen `source.json` in this directory, SHA256
`4df26d99a699f568d62f4d92e1def27689b397770dae834b2840a5cd38dae7ab`.
It contains eight exact current release descriptions and update-tour strings.
Preserve every key, sourceEnglish and sourceSha256 exactly. Keep the navigation
arrow `→`, reference-basis scope, explicit grower confirmation and the distinction
between country description and approved local farming advice. Do not invent
routes, farming values, reviewer names or claims that terminology is standard.

Write ONLY `zu.json`, `st.json`, `ts.json`, `ve.json`, `review-notes.md` and
`status.json` inside `docs/international/agy-release-copy-2026-11-03/`.
Do NOT edit source.json, production dictionaries, old drafts, lessons, quizzes,
species, settings, Git or any other file. No shell commands, scripts, browsing,
transcripts or broader permissions are needed. Normal scoped file edits only.

Locale JSON schema: schemaVersion 1, locale, provenance
`{executor:'AGY',method:'AI draft',createdOn:'2026-11-03'}`,
review `{status:'unreviewed'}`, messages
`[{key,sourceEnglish,sourceSha256,text,review:{status:'unreviewed'}}]`.
Every translation remains an AI draft needing fluent human review. Notes contain
candidate terminology/questions only, no unsupported regional usage assertions,
worker IDs, raw transcripts or private metadata. No lesson or species examples.

After all four eight-row files exist, stop reused workers and hand off actual
files/counts/stopped state. No runtime integration, language approval, commit,
push or additional batch. Root independently checks structure/source binding and
integrates only through the existing explicitly unreviewed source-paired update
copy mechanism, retaining English fallback and all human-review disclosures.
