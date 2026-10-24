# Brief: isiXhosa drafts of the Studies lesson slides (ImbewuField)

ImbewuField teaches permaculture to South African smallholder farmers. Each Studies module has a
"Watch and listen" deck: numbered slides, each with a heading and a few short paragraphs (the
narration a farmer reads/hears). We are making isiXhosa slide cards: each card shows your isiXhosa
draft above the exact English source. Your text is labelled on the card as an unreviewed AI draft.

## Read first
1. `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/BRIEF.md` —
   translation rules + glossary. Follow it (ignore its "Output" section; use the format below).
2. Terminology already used for the SAME modules' lesson text (stay consistent with it):
   `/home/user/ImbewuField/lib/course-translation-drafts-xh.ts` — grep it for your module id and for
   terms (e.g. `grep -n "umgquba" lib/course-translation-drafts-xh.ts | head`). The slide narration
   often repeats lesson sentences; reuse the reviewed lesson wording where the English matches.

## Your input
`/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/slides/<module>.input.json`
— an array of `{ n, heading, body: [paragraphs], xh_heading: "", xh_body: ["", ...] }`.

## Your output
Write `.../scratchpad/slides/<module>.xh.json`: the same array, in the same order, with `xh_heading`
and every `xh_body[i]` filled with the isiXhosa for the matching English paragraph. Keep exactly one
isiXhosa paragraph per English paragraph (same count). You may drop the English fields or keep them.
Write the file in a few chunks if needed (it is fine to build it with a small script), but every
string must be your own careful translation — no machine copying of English.

Rules specific to slides:
- Plain spoken isiXhosa a farmer understands when read aloud; short sentences.
- Every number, measurement, unit, rand amount, percentage and time span must survive exactly
  (digits as digits). Keep negations, warnings ("do not…", "never…") and conditions exact — these
  are farming-safety instructions (frost, livestock health, seed storage, water, pests, chemicals).
- Names of plants/animals: use the common isiXhosa name when you are sure it is the same species;
  otherwise keep the English name inside the isiXhosa sentence (e.g. "i-comfrey"). Do not guess.
- If you genuinely cannot translate a paragraph safely, put the string "HOLD" for it (the card then
  shows the English); use this rarely and list each hold in your report with the reason.
- Headings are short titles (sentence case).

## Validate
Run `cd /home/user/ImbewuField && node /tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/slides/assemble.mjs <module>`
It checks counts, figures and the slide-pairing validator, and writes
`docs/narration/<module>.xh.silent-draft.json`. Fix every problem it reports until it prints OK.

## Rules of engagement
Other agents work in the same repository at the same time. Do not run git commands that change
state; do not edit any repository file other than letting assemble.mjs write your module's
`docs/narration/<module>.xh.silent-draft.json`.

## Report back (short)
Per module: slides done, holds (with reasons), and up to 5 renderings you are least sure about
(English → isiXhosa → why).
