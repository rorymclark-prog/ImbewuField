# AGY parallel UI translation drafts — 2 November 2026

Rory explicitly requested more parallel AGY translation jobs. Work in this tree;
other implementation/research lanes keep their ownership. Only edit
`docs/international/translation-jobs-2026-11-02/**`; do not edit source.json.
No code, i18n source, lesson, quiz, species, saved farm data, settings, dependency,
commit, push, deployment or external messaging changes. Read AGENTS.md first.

Use the fixed source.json inventory, not newly invented or broad whole-app text.
It includes exact source, file, line, SHA256 and segment context. These components
are under development: hashes bind draft meanings, not a claim they are shipped.
The existing foundation already has 32 messages per language; do not duplicate or
replace lib/international/locales/{fr,es,pt,sw}.ts or pretend full coverage.

Dispatch THREE disjoint native workers concurrently:
- fr.json + fr-notes.md: plain international French, flag regional terminology.
- es.json + es-notes.md: broadly understandable Latin American Spanish, flag
  Spain and country-specific differences; no all-Spanish-country approval.
- pt-BR.json + pt-BR-notes.md: Brazilian Portuguese for the Brazil pilot; flag
  differences for Portugal/Mozambique rather than claiming them covered.
The main agent handles sw-KE.json + sw-KE-notes.md: plain Kenyan Swahili, flag
regional and technical terminology requiring fluent grower review. These are
language pilots, not automatic country/currency/unit settings.

Each JSON: {schemaVersion:1, locale, scope, provenance:{executor:'AGY',
method:'AI draft',createdOn:'2026-11-02'}, review:{status:'unreviewed'},
messages:[{key,sourceEnglish,sourceSha256,text,review:{status:'unreviewed'}}]}.
Copy source keys/English/hash exactly, nonempty translated text; preserve any
placeholders and literal units. Translate meanings accurately: local device save
is not account/cloud confirmation; estimates are not actual harvest/stock;
country description is not agronomy approval; unknown is not zero; no calendar
is available until reviewed. Bed means cultivated growing bed, tray means seed
propagation container, nursery means plant propagation space. Do not translate
proper names, invent numbers or strengthen readiness/permission claims.

Each notes file: compact glossary, ambiguous source-fragment meanings, dialect
limits and explicit fluent-human review checklist; never invent reviewer names.
No public browsing needed for drafting. Normal scoped approvals only; do not
use permission bypass or global allow rules. Optional data sharing remains OFF.

Validate each JSON syntax, exact key coverage/uniqueness, source/hash equality,
nonempty text and unreviewed status with read-only local validation. Repair data
errors without rewriting English. Do not claim this proves translation quality.
Then consolidate index.md + status.json with exact files/counts/validation and
all four human review gates. Stop native workers after delivery and report their
real final state. No application integration or language launch is authorised by
these drafts; Codex will independently review and later wire approved strings.
