# Re-translation brief — second edition (27 Sep 2026)

The English manual has been rewritten (`research/manual/REWRITE.md`): shorter, in Rory's voice
(`research/manual/VOICE.md`), with the warnings and legal notes moved into one paragraph in a
new chapter 13. The old translations no longer match. You translate one LANGUAGE (zu, st, ve or ts).

Read first: `research/manual/STYLE.md` (translation rules and the Markdown format),
`research/manual/KEEP-ENGLISH.md` (technical words stay in English), `research/manual/VOICE.md`,
and `research/manual/glossary-<LANGUAGE>.md` (especially its "Kept in English" section).

## What to do

1. **Chapters 00–11 and 13:** write `content/manual/<LANGUAGE>/<slug>.md` fresh from the new
   English `content/manual/en/<slug>.md`, replacing the old file. Do not patch the old
   translation — the English changed too much. You may reuse good sentences from the old file
   where the English meaning is the same.
2. **Chapter 12 (Glossary):** unchanged — leave it.
3. **Chapter 13 `13-notes-and-references`:** translate the title, the intro, the "Safety and the
   law" paragraph, the References intro, each `### Chapter N: …` heading (use the chapter title
   exactly as in your own translated chapter file), the Key points and the closing lines. **Copy
   every reference line (`- …`) unchanged** — citations stay as published. Act names stay in
   English, with a short local explanation in brackets the first time if it helps.
4. **Figure captions:** eight English captions changed; their ids are in
   `research/manual/rewrite/captions-to-translate.txt`. Write
   `research/manual/rewrite/captions-<LANGUAGE>.json` as `{ "<id>": "<translated caption>" }`.
   Do not edit `content/manual/figures.json` (the coordinator merges; four agents run at once).

## Voice in translation

Keep Rory's rhythm where the language allows: the WHY-first openings, short punchy sentences
next to longer ones, the "we" of the shared journey and the "you" of instruction, and the closing
line that opens forward. Plain rural spoken register, as STYLE.md says. Local words for morogo,
mielies, veld and pikmatok are fine where the language has its own everyday word.

## Structure

Identical to the English: same headings (count and order), list items, numbered steps,
callouts and table rows. `node --import ./tests/register-alias.mjs --test tests/manual.test.ts`
must pass for your language (the structure test checks it; for Xitsonga, which is paused in the
app, run a quick structure comparison yourself — `blockShape` in `lib/manual.ts`).

## Record

Append "## Second edition (27 Sep 2026)" to `research/manual/glossary-<LANGUAGE>.md` with any new
terms you had to choose. Machine draft for fluent-speaker review, as before.

## Working

Edit only your language's files and your captions file. Scratch files in
`/tmp/claude-0/-home-user-ImbewuField/980f162d-6f98-5a75-af44-533d03612c33/scratchpad/tr-<LANGUAGE>/`.
Do not commit. If you are interrupted, finished chapters are on disk — on restart, check which
chapters already match the English structure and continue with the rest.

Report: chapters done, test result, new glossary terms, anything uncertain.
