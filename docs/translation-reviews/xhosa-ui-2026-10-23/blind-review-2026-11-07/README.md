# Blind back-translation review, 7 Nov 2026: Assistant connections page and update copy

Scope: all 41 values in `lib/locales/xh-inline/g55-main-nov.ts` (Assistant connections page, consent/scope wording,
expiry, MCP setup notes, photo-registration preview, Settings link) and the 48 entries added to
`lib/update-copy-locales/xh.ts` on 7 Nov (commits 38306f28 and b88d4838: release notes and tour stops). 89 rows.

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording
is natural. This does not replace the fluent-speaker pass in `../README.md`.

## How blind it was
- A script wrote only the numbered isiXhosa values (no English) to a scratch file; that was the only thing read before
  the back-translations. All 89 back-translations were written to one file before any English was printed, then the
  English was printed and compared row by row.
- Limits on blindness: before the script ran, the reviewer had listed the first 30 lines of the g55 shard in full
  (English key beside the isiXhosa for rows 1-24), the last 22 lines with lines cut at 80 characters (mostly English keys,
  rows 25-41), and the first five 7 Nov update-copy lines cut at 200 characters (rows 42-46). Rows 1-46 are therefore a
  weaker blind check; rows 47-89 were read from the isiXhosa alone. The task brief also named the consent topics to look
  for (no password, Gmail/Drive/computer, new-site decision, 90 days / one hour, disconnect), which primed rows 2, 5, 15, 16, 48.
- A script then checked `{placeholders}` (0 mismatches before or after).

## Result
| Verdict | Rows |
|---|---|
| ok | 76 |
| minor (left as drafted) | 8 |
| repair (applied) | 5 |

## Repairs
- **22** "No active assistant connections." was *lubalulekileyo* (reads "important"): now *Akukho qhagamshelo olusebenzayo lwabancedisi.*
- **43, 44** "bolder" arrows / contours was *ekhaphukhaphu* (reads "lighter/softer", the opposite; row 58 correctly uses it for "lighter"): now *eqaqambileyo*.
- **68** "before-works archive photograph" was *ifoto yengobo* (not read as archive): now *ifoto egciniweyo yangaphambi kwemisebenzi*.
- **88** "finer boundaries" was *ecekethekileyo* (read blind as dashed): now *emincinci*.

## Consent and privacy wording: checked and kept
Not getting the password (5), no access to Gmail, Drive or the computer (16), new sites need a new decision (16),
90 days / one hour (16), connect with no sites then reconnect (15), disconnect in Settings / here at any time (2, 48),
authentication-is-not-implied by an installed plugin card (35) all back-translate to the English meaning.

## Open note
Row 59: the English source says "classroom positions" (probably meant "class"); the draft reads as class zones. Not changed.

`review.csv`: row, source, english, xhosa_before, back_translation, verdict, xhosa_after, note.
