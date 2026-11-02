# AGY: Hindi, Bengali and Indonesian UI drafts

Rory requested more parallel translation jobs. India, Bangladesh and Indonesia
already appear in the international research queue. This does not approve a
country launch, farming advice or a production language.

Resume the existing translation conversation. Check its actual native-worker
states; reuse at most two idle workers for hi-IN and bn-BD. Main handles id-ID.
No duplicate writers. Workers RETURN their message arrays; main materialises
them with the normal scoped file-edit tool. No shell commands, scripts, public
browsing, transcripts, permission/settings changes or broader grants are needed.

Read the immutable 59-message input:
`docs/international/translation-followup-source-2026-11-02.json`.
Its SHA256 is
`1fdb6e2bb095f026c30dba552b6a717c3fbf9a16c2eade252cc6ea75663d29a2`.
Read context only from the named source components if needed. Do not edit input,
production source, lessons, quizzes, crop/species names, dictionaries or Git state.
Do not touch either completed translation batch.

Write ONLY `docs/international/translation-asia-2026-11-02/**`:

- `hi-IN.json`: plain Hindi for review by Indian growers.
- `bn-BD.json`: plain Bengali for review by Bangladeshi growers.
- `id-ID.json`: plain Indonesian for review by Indonesian growers.

Each file uses schemaVersion 1, locale, provenance
`{executor:'AGY',method:'AI draft',createdOn:'2026-11-02'}`,
review `{status:'unreviewed'}`, and messages
`[{key,sourceEnglish,sourceSha256,text,review:{status:'unreviewed'}}]`.
Copy every key, English sentence and English hash exactly from the frozen input.
Keep all numbers, literal unit tokens (cm, m², %, etc.), DEMO and CSV exact.
Preserve unknown versus zero, estimate versus actual observation, device save
versus account confirmation, and unavailable advice versus local approval.
Do not invent agricultural numbers, reviewer identities or terminology evidence.
No transliterated substitutions for protected unit tokens.

Write one short `review-notes.md` with candidate terms and regional/fluency
questions, plus `index.md` and `status.json` listing actual files/counts and real
worker state. A named fluent reviewer must check meaning, terminology and phone
layout before any runtime language can use these drafts. Structural validity is
not fluency or release approval. No placeholder runtime messages or template
interiors are part of this batch.

After all three files exist, stop reused workers and return a concrete handoff.
Do not commit, push, enable a language or start another batch. The coordinator
independently checks hashes, source binding, protected tokens and corruption
controls before publication.
