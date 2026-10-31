# Blind back-translation review — Afrikaans Studies lessons (ImbewuField)

ImbewuField's Studies course teaches permaculture to South African smallholder farmers and students.
Its Afrikaans lessons are unreviewed machine drafts of English source text. You are an independent
reviewer: find drafts that would **mislead a learner** — above all in farming safety (frost, livestock
health, seed storage, water and greywater, earthworks, food safety, poisonous plants) and in quizzes
(the correct option must still be correct, and no wrong option may become right).

Directory: `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/af/studies/review/`
(below: `REVIEW/`). Your packet is `LN` (given in your task).

## Step 1 — blind back-translation (do NOT open `LN.en.txt` or the English module files yet)
1. Read `REVIEW/../../AF-BRIEF.md` (drafting rules and glossary).
2. Read `REVIEW/LN.af.txt`. Each line is `index | path | Afrikaans` (`\n` = a line break). The path
   tells you the field (title, body paragraph, key point, quiz question, option, rationale).
3. Write `REVIEW/LN.backtranslation.txt`: one line per index, `index | your literal English
   back-translation`. Translate what the Afrikaans actually says. Finish the whole file before Step 2.

## Step 2 — compare
4. Now read `REVIEW/LN.en.txt` (`index | path | English`; the correct quiz option is marked `(correct)`).
5. Mark **repair** only for a real problem: meaning changed, added or dropped (negation, condition,
   limit, "only", "never", tense, quantity); a wrong term (another crop, animal, pest or process; snow
   for frost); a figure, unit or line break that differs; a quiz option whose truth changed; Afrikaans
   unclear enough that a learner might misread it. Not style preferences. Never change or add a plant
   or species name, and invent no numbers.
6. Mark **hold** only when no safe correction is possible (the English itself is unclear, or the term
   needs a fluent speaker). Explain why.

## Output — `REVIEW/LN.review.json`
```json
{ "unit": "LN", "okCount": 0,
  "items": [ { "index": 0, "path": "…", "verdict": "repair", "english": "…", "draft": "…",
    "backtranslation": "…", "problem": "one sentence", "corrected": "full corrected Afrikaans" } ] }
```
List only repair and hold items; okCount + items = packet size. Copy `path` (without " (correct)"),
`english` and `draft` exactly from the packet files (unescape `\n`). For a hold, `corrected` is `""`.
`corrected` keeps every figure in the English.

Write only inside `REVIEW/`; no repository or git changes. Final message: okCount, repair and hold
counts, the three most serious problems, and any problems you see in the English source itself.
