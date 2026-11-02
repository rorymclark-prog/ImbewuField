# Blind back-translation review, 2 Nov 2026 (batch c): Design Studio leftovers

Scope: every value in `lib/locales/xh-inline/g54-design-leftovers.ts` (101 strings): Layers panel button labels (rows
1-17), sector notes with figures (18-22), and the palette element tips (23-101), including the greywater, tank, swale,
vetiver, guava, female-tree and frost-siting instructions.

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording is
natural or in the Eastern Cape farming register. This review does not replace the fluent-speaker pass in `../README.md`.

## How blind it was
- A script extracted only the isiXhosa values, numbered, with no English keys, to a scratch file. That file was the only
  thing read before the back-translations were written.
- All 101 back-translations were written in one file before any English key was printed. Then the English was printed
  and compared row by row.
- Limit on blindness: the reviewer had seen the file's header comment and the first ~30 lines of the shard (English keys
  beside the isiXhosa for rows 1-22) in the first listing of the file, and the task brief named the safety tips
  (greywater, tank weight, 5 m, siting survey, dip, vetiver, guava, female trees). Rows 1-22 are therefore a weaker blind
  check; rows 23-101 were read from the isiXhosa alone, though the brief primed what to look for in the safety tips.
- A script then checked that `{placeholders}` and every figure match the English before and after (0 mismatches), and
  that only the repaired row changed in the shard.

## Result
| Verdict | Rows |
|---|---|
| ok | 86 |
| minor (left as drafted) | 14 |
| repair (applied in the shard) | 1 |

`review.csv`: row, english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repair
- **Row 74, thorny hedge tip** ("Grown as a stock-proof edible hedge as often as a single tree"):
  *olukhusela imfuyo rhoqo njengomthi omnye* back-translates to "an edible hedge that protects livestock, always as a
  single tree". "Stock-proof" (keeps animals out) became "protects livestock", and "as often as" became "always".
  Now *Ityalwa njengothango olutyiwayo olungangenwa yimfuyo, okanye njengomthi omnye.* (a hedge livestock cannot enter, or
  a single tree). The female-only fruiting caveat is unchanged.

## Safety, siting and direction: checked and kept
- Greywater: "Never tap the toilet (that is blackwater), and use plant-safe soap" kept as *Musa ukuthabatha kwindlu
  yangasese (leyo yi-blackwater), uze usebenzise isepha ekhuselekileyo kwizityalo*. "Never plant a fruit tree standing in the
  dip" kept (*Musa ukutyala umthi weziqhamo emngxunyeni*). Valve and leaf filter, kitchen/laundry outlet, banana circle: ok.
- Tanks: full tank ~2.5 t and the solid round concrete base; 3 m from the downpipe; 1.85 m, 2.2 m and 3.15 m; first-flush
  diverter. All figures match.
- Siting: 5 m clear of foundations (basin), 4/5/8/10/12 m canopy clearances, 5-10 m approach path, 1.2 m bed width,
  30-40 cm fill, 30-50 cm basin depth, 1:5 slope, 20-30 and 10-15 cm spacings, 40-50% shade net, DWS licensing thresholds.
- "Siting survey before drilling, avoid septic/kraal runoff" keeps the survey and the avoid caveat (see minor, row 30).
- Directions: bunds and the demi-lune on contour with the opening uphill (*kujonge ngaphezulu kwethambeka*); swale mound on
  the downhill side; contour line below the catchment; pen "downhill and downwind" (*ezantsi kwethambeka* and the
  wind-goes-to wording used since batch b); hive entrance east, away from foot traffic; panels north-facing and unshaded;
  garden rows north-facing; ridge north-south; pigs downhill of water sources; tools out of the prevailing rain side.
- Species caveats: sterile non-seeding vetiver (rows 47 and 88, "not a seeding local relative"), guava hidden as invasive,
  only female trees fruit (rows 73, 74). Harpephyllum caffrum, Pappea capensis, umgwenya, JoJo, DWS, SA unchanged.

## The two words the drafter was unsure of
- **"ii-snail"** (row 92): kept. It is an English loanword in isiXhosa orthography; read blind as "snails". No other shard
  words snail (grepped `lib/locales`), so there is nothing to match, and *inkonkxa* in the locale already means a can or
  tin. Any invented native word would be worse than a readable loanword. For the fluent pass: supply a common native term if
  farmers use one.
- **"Ubulongwe"** (manure; rows 52, 53, 93, 95): kept. The locale already words manure as *ubulongwe* (`soilAmendmentKraalManure`
  "Ubulongwe besibaya", the nut-harvest tip, biomeSoilDesert) with *umgquba* for compost, and worm bin as *iintshulube*
  (`Worm Farm` "Ifama yeentshulube"). Row 93 has a small concord slip (*ubulongwe wehla*, would be *buhla*); the meaning is clear.

## Minor, left as drafted (14)
Rows 4-7 (the layer name follows a colon instead of "on {name}"), 19 ("across about {m} m" read as "goes around"), 30 ("drilling"
read as "digging"), 43 ("flat-bottomed" read loosely), 49 ("ridge" as *incopho*, peak), 50 and 96 ("nursery" as *iempandla*,
read as herb; same draft as batches b and g43), 80 ("stone fruit" as fruit with hard seed), 81 ("each winter" as *ngabunye*),
92 (loanword), 93 (concord). Details in `review.csv`.
