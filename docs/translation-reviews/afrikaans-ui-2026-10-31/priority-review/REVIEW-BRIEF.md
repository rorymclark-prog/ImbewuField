# Blind back-translation review — Afrikaans drafts (ImbewuField)

ImbewuField is a permaculture and farm-records app for South African smallholder farmers. Its
Afrikaans UI text is unreviewed machine drafts of English source text. You are an independent
reviewer: find drafts that would **mislead a farmer**. Your packet is safety, money or consent text.

Directory: `/tmp/claude-0/-home-user-ImbewuField/e2fbcdd9-55cd-53bd-a360-76840c1887f1/scratchpad/af/review/`
(below: `REVIEW/`). Your packet is `pN` (given in your task).

## Step 1 — blind back-translation (do NOT open `pN.en.txt` or `pN.meta.json` yet)
1. Read `REVIEW/../AF-BRIEF.md` (the drafting rules and glossary).
2. Read `REVIEW/pN.af.txt`. Each line is `index | Afrikaans draft` (`\n` = a line break).
3. Write `REVIEW/pN.backtranslation.txt`: one line per index, `index | your literal English
   back-translation`. Translate what the Afrikaans actually says, not what you guess it meant.
   Keep `{placeholders}` as they are. Finish the whole file before Step 2.

## Step 2 — compare
4. Now read `REVIEW/pN.en.txt` (`index | English source`). Compare each back-translation with the source.
5. Mark an item **repair** only for a real problem:
   - meaning changed, added or dropped (a lost or flipped negation, condition, limit, "only", "never",
     "not yet", tense, paid/unpaid, saved/not saved, a softened warning, a wrong quantity word);
   - a wrong term (e.g. snow for frost, a different animal or crop, a different money concept);
   - a placeholder, number, unit or line break that differs from the English;
   - Afrikaans that is ungrammatical or unclear enough that a farmer might misread it.
   Do not repair style preferences or synonyms that mean the same. Never change or add a plant or
   species name, and invent no numbers.
6. Mark **hold** only when you cannot write a safe correction (the English itself is ambiguous, or
   the correct term needs a fluent speaker). Explain why.

## Output — `REVIEW/pN.review.json`
```json
{
  "unit": "pN",
  "okCount": 0,
  "items": [
    { "index": 0, "verdict": "repair", "english": "…", "draft": "…", "backtranslation": "…",
      "problem": "one sentence: what a farmer would get wrong", "corrected": "full corrected Afrikaans" }
  ]
}
```
List only repair and hold items (`okCount` counts the rest; okCount + items = packet size). Copy
`english` and `draft` exactly from the packet files (unescape `\n` to a real newline in JSON). For a
hold, `corrected` is `""`. `corrected` must keep every `{placeholder}` and number exactly as the English.

Do not edit anything outside `REVIEW/`; do not touch the repository or git. In your final message,
report: okCount, repair count, hold count, and the three most serious problems you found.
