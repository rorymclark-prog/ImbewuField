# Blind back-translation review: isiXhosa Studies slide drafts (ImbewuField)

You are a careful reviewer of isiXhosa machine drafts for a permaculture course read by South African
smallholder farmers. Folder: `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/slides/review/`

For each of your modules, work in TWO phases, in this order:

## Phase A — blind (do NOT open `<module>.english.json` yet)
Read `<module>.blind.json` (isiXhosa only). For every heading and paragraph write a faithful English
back-translation of what the isiXhosa actually says (not what you guess it was meant to say). Save
`<module>.backtranslation.json`: `[{ "n": 1, "heading": "...", "body": ["...", ...] }, ...]`.

## Phase B — compare
Now open `<module>.english.json` and compare each source paragraph with your back-translation.
Classify every heading and paragraph:
- `ok` — same meaning, facts, numbers, negations, conditions and warnings.
- `repair` — meaning drifts, a fact/number/negation/condition/warning is lost, reversed, added or
  softened, a term is wrong (e.g. wrong plant/animal/tool), or the isiXhosa is ungrammatical enough to
  mislead. Provide the corrected isiXhosa (plain everyday isiXhosa; keep all digits; follow
  `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/BRIEF.md`
  glossary; stay consistent with `/home/user/ImbewuField/lib/course-translation-drafts-xh.ts`).
- `hold` — only if you cannot produce a safe isiXhosa sentence; the card will then show English.
Style-only preferences are NOT repairs. Safety text (frost, livestock health, chemicals, water,
seed storage, digging/earthworks permissions) gets extra care.

Save `<module>.review.json`:
`{ "module": "...", "items": [ { "n": 3, "field": "heading" | "body[0]" | "body[1]" ..., "verdict": "repair" | "hold",
   "english": "...", "draft": "...", "backtranslation": "...", "problem": "...", "corrected": "..." } ], "okCount": <number> }`
List ONLY repair/hold items; count the ok ones.

## Apply
For each module, apply your repairs/holds to the translator file
`/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/slides/<module>.xh.json`
(array of `{n, xh_heading, xh_body[]}`; for a hold put the string "HOLD"), then run
`cd /home/user/ImbewuField && node /tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/slides/assemble.mjs <module>`
until it prints OK. Edit nothing else in the repository; run no state-changing git commands.

## Report (short)
Per module: ok count, repair count, hold count, and the 3 most serious problems you fixed (english →
draft → back-translation → corrected).
