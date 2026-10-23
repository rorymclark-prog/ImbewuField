# Independent semantic review — ImbewuField money book drafts

You are the INDEPENDENT reviewer. You did not write these drafts. They are unreviewed machine drafts
of participant-facing finance UI for South African smallholder farmers (390px phones). Your job is
to catch meaning errors BEFORE they ship. Do not edit the repo.

PHASE A (blind). Read ONLY `<lang>-A-blind.json` (id, usage, draft). Do NOT open the B file or the
inventory. For every item write a literal English back-translation (`back`) and list any problems
you see in the draft itself (`flags`): wrong-language words (e.g. isiZulu/Sesotho/Tshivenda/Xitsonga
words in another language's draft), nonsense or ungrammatical wording, a word that means something
else in this context, untranslated ordinary words left in English. Write
`<lang>-A-out.json` = [{"id","back","flags":[...]}] to the review directory FIRST.

PHASE B (compare). Only after A-out.json is written, read `<lang>-B-compare.json` (english, draft,
drafter_note). For each item compare your back-translation with the English and give a verdict:
- "ok"  — same meaning, order of clauses, negation, tense, and distinctions.
- "repair" — a specific problem; give `repaired` (a full replacement draft in the same language,
  same {placeholders}) and `problem`.
- "hold" — cannot be repaired confidently; it will show English instead.
Check especially: negation ("not", "never", "do not enter again", "nothing is lost", "not touched");
tense (saved = past, will reach = future, waiting = pending); entry vs record; income/money in/sale
vs expense/cost/money out; buyer vs supplier; "Recover invoice" (rebuild a missing invoice) must
differ from View, Create invoice and Try again/Retry; "Picked" = harvested (not "chosen"); "Sure?" =
confirm delete; quantities and units; "greater than zero"; no new advice, figures or promises
(e.g. nothing implies a feature is free); {placeholders} identical to English; short fragments
('sale', 'harvested', 'month', unit words) must work when inserted in a phrase; tabs ≤ ~10 chars.
Write `<lang>-B-out.json` = [{"id","verdict":"ok|repair|hold","problem":"","repaired":"","severity":"meaning|wording|minor"}].
Every item must appear once in each output. Also add a final summary object in
`<lang>-summary.json`: counts by verdict, the 10 most important issues, and a candid statement of
your confidence limits as a machine reviewer (you are not a fluent-speaker approval).

Directory: /tmp/claude-0/-home-user-ImbewuField/589e6547-f935-590b-9189-0e70cb07889c/scratchpad/inv/review/

PHASE C (existing wording, st/ve/ts only). After B, read `<lang>-C-existing.json` (key, english,
existing — wording ALREADY shipped in the app's dictionary). Report ONLY specific demonstrated
meaning errors (dropped clause such as "& invoice", inverted negation, wrong entry/record or
income/expense, wrong-language words). No style preferences. Write `<lang>-C-out.json` =
[{"key","problem","suggested","severity"}] (empty array if none).
