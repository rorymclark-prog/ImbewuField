# AGY: nine source-bound grower release messages in four existing languages

This is a NEW bounded candidate-only batch. Resume the existing translation
conversation; optional interaction-data sharing stays OFF. Use the main agent and
at most two reused idle AI workers: one for isiZulu (zu), one for Sesotho (st).
Main handles Xitsonga (ts), Tshivenda (ve) and materialises the four locale files.
Workers return message arrays rather than writing overlapping files. No duplicate
writers, new parallel conversations or additional batches.

Read ONLY frozen source.json in this directory, SHA256
`1ac50ec10110e0323d9f0216d8f795fcdb445a03806bea685dd06ffcff9188fe`.
Actual runtime authorities identify the SAME nine missing source strings in every
locale: five from milestone release 34d527564 and four from prior grower entry
12b0acba4. Four locales × nine messages = 36 candidate messages. Default recent
history and Simple history have no other gaps outside this source set.

Preserve every key, sourceEnglish and sourceSha256 exactly. Translate only the
message text. Preserve the navigation arrow → and existing destinations. Keep
own estimates distinct from verified local farming advice, missing values distinct
from zero, proposals/review distinct from saved sowings, and nursery surface needs
distinct from an approved plan. Do not invent farming figures, routes, terminology
approval, reviewer names, product capabilities or regional usage claims.

Write ONLY zu.json, st.json, ts.json, ve.json, review-notes.md and status.json
inside docs/international/agy-grower-release-copy-2026-11-03/ in this worktree.
Do NOT edit source.json, WORKORDER.md, production dictionaries/chunks, old drafts,
lessons, quizzes, species, settings, tests, Git or any other file. Normal scoped
permissions apply. No shell commands, scripts, browsing, permission bypasses or
settings changes are needed; stop at an actual permission boundary and report it.

Locale JSON schema: schemaVersion 1, locale, provenance
{executor:'AGY',method:'AI draft',createdOn:'2026-11-03'},
review {status:'unreviewed'}, messages
[{key,sourceEnglish,sourceSha256,text,review:{status:'unreviewed'}}].
Each file must contain exactly the same nine rows in source order. All 36 texts
must remain explicitly unreviewed AI candidates pending fluent human review.
Notes contain candidate terminology/questions only; no worker IDs, raw logs,
transcripts, credentials, private metadata or unsupported usage claims.
Status states actual files/counts, candidate-only scope and worker stopped state.

After all four nine-row files exist, stop reused workers and hand off concrete
files/counts/stopped state. Do not integrate runtime copy, approve languages,
commit, push, deploy or start another batch. Root independently validates exact
source binding, UTF-8 hashes, row/locale completeness, quantities/placeholders and
that previous runtime chunk bytes and release history are preserved. Any later
coordinator integration must use only the existing explicitly unreviewed,
source-paired update-copy mechanism, retain English fallback/human-review
notices, then validate actual current banner/tour and recent-history coverage.
