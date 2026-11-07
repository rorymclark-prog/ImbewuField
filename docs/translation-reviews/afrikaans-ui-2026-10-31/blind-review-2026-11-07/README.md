# Afrikaans blind back-translation review, 7 Nov 2026 drafts

Scope: all 41 values of `lib/locales/af-inline/g57-main-nov.ts` (Assistant connections page, photo-registration preview, Settings link) and the 48 lines added to `lib/update-copy-locales/af.ts` on 7 Nov (commits 98f04c02 and 79072ee4: release notes and tour stops). 89 drafts in total.

## How blind it was
A script printed only the numbered Afrikaans values to a scratch file. Only that file was read; all 89 back-translations were written to a second file before any English was printed, and only then compared. Limits on blindness: the reviewer had read the file header comment of `g57-main-nov.ts` and the CLAUDE.md product glossary (so the page topic, "Assistant connections", and the product names were known beforehand), and the script's own output of how many entries were parsed (41 and 48) was seen. No English sentence was seen before back-translating.

## Result
- 89 drafts reviewed, 0 repairs.
- Consent and privacy meaning all survived: own scoped connection and no password shared (5), no access to Gmail, Drive or computer (16), new sites need a new decision (16), disconnect at any time (2, 48), expiry "90 dae" and "een uur" (16), only continue if you started the connection (13).
- Placeholders ({name}, {n}, {date}, {size}, {mime}, {authorisation}, {rms}, {max}), figures, arrows and product names matched the English in a mechanical check.
- No false friends found (kaart read as map, bedding as bed, trooi as tray, greep as byte).
- Two notes, no change: row 35 "geverifieer" reads as "verified" for "authenticated" (same user meaning); row 59 English itself says "classroom positions".

Rows: `review.csv`. Drafts remain unreviewed machine drafts pending a fluent reviewer.
