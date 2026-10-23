# Market community paired deck reuse evidence — 4 October 2026

Branch: `codex/regional-market-paired-next-20261004`  
Base/current HEAD: `3c134599985e9ccf46272914ad9d5af270309ce7`

These paired deck fields reuse current learner resolver text. Drafts remain visibly unreviewed; this record does not claim fluent or local facilitator approval. Canonical lesson content, indices, audio, and English source text were not changed. Root rendered and inspected the seven affected frames; exact preview phone review remains a publication gate.

## Changed target fields

| Language | Slide | Body field (1-based; JSON index) | Mapping |
|---|---:|---|---|
| st | 15 | `2` (`1`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| st | 18 | `3` (`2`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| ve | 15 | `2` (`1`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| ve | 18 | `3` (`2`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| ts | 15 | `2` (`1`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| ts | 18 | `3` (`2`) | Exact two-sentence canonical lesson paragraph: reused verbatim. |
| ve | 8 | `3` (`2`) | Two source sentences: existing localized first sentence retained; current learner resolver second sentence reused. |
| st | 15 | `3` (`2`) | Deck source equals the canonical paragraph after removing only the exact protection/permission suffix. |
| ts | 15 | `3` (`2`) | Deck source equals the canonical paragraph after removing only the exact protection/permission suffix. |
| ve | 15 | `3` (`2`) | Deck source equals the canonical paragraph after removing only the exact protection/permission suffix. |

The exact target text for each field is recorded below from its current paired-draft JSON.

### ST slide 15, body 2

Source: `Record the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.`

Target draft:

```text
Ngola crop, variety, source le collection date. Rera suitable isolation, selection, drying le storage bakeng sa crop e nngwe le e nngwe.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### ST slide 18, body 3

Source: `Seek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.`

Target draft:

```text
Batla qualified advice bakeng sa unfamiliar disease or technical problems. Boiphihlelo bo arolelanoang le thuso ya specialist di ka sebetsa mmoho.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### VE slide 15, body 2

Source: `Record the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.`

Target draft:

```text
Ṅwalani crop, variety, source na datumu ya u kuvhanganya. Pulani suitable isolation, selection, drying and storage kha crop iṅwe na iṅwe.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### VE slide 18, body 3

Source: `Seek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.`

Target draft:

```text
Ṱoḓani qualified advice nga ha unfamiliar disease or technical problems. Tshenzhemo yo kovhekaniwaho na specialist help zwi nga shuma khathihi.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### TS slide 15, body 2

Source: `Record the crop, variety, source and collection date. Plan suitable isolation, selection, drying and storage for each crop.`

Target draft:

```text
Tsala crop, variety, source ni siku ra ku hlengeleta. Pulana suitable isolation, selection, drying and storage eka crop yin’wana ni yin’wana.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### TS slide 18, body 3

Source: `Seek qualified advice for unfamiliar disease or technical problems. Shared experience and specialist help can work together.`

Target draft:

```text
Lavani qualified advice eka unfamiliar disease or technical problems. Ntokoto lowu avelaniweke ni specialist help swi nga tirha swin’we.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### VE slide 8, body 3

Source: `A date that works on another farm may not work here. Include a backup plan when rain, water or crops fail.`

Target draft:

```text
Datumu ine ya shuma kha ḽiṅwe bulasi i nga sa shuma hafha. Engedzani a backup plan musi mvula, maḓi kana zwimela zwi tshi kundelwa.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### ST slide 15, body 3

Source: `Sharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed.`

Target draft:

```text
Ho arolelana ha ho bolele hore diversity e tla eketseha kapa quality e ntlafale ka bo yona. Hlahloba identity le germination pele o itshetleha ka shared seed.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### TS slide 15, body 3

Source: `Sharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed.`

Target draft:

```text
Ku avelana a swi vuli leswaku diversity yi ta engeteleka kumbe quality yi ta antswa hi yoxe. Kambisisa identity ni germination u nga si titshega hi shared seed.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

### VE slide 15, body 3

Source: `Sharing does not automatically multiply diversity or improve quality. Check identity and germination before relying on shared seed.`

Target draft:

```text
U kovhekana a zwi ambi uri diversity i ḓo engedzea automatically kana quality i khwinifhale automatically. Ṱolani identity na germination ni sa athu ḓitika nga shared seed.
```

Provenance: `unreviewed-draft; independent semantic source check; exact English source paired; no fluent approval`

## Mapping checks

- Six fields (ST/VE/TS slides 15 body 2 and 18 body 3) match the entire canonical English paragraph and reuse the matching current learner paragraph verbatim.
- VE slide 8 body 3 keeps its existing localized first sentence and reuses the learner resolver’s localized backup-plan sentence. Both sentences map in order to the exact two-sentence English paragraph; “may not” and the rain, water, and crop failure conditions remain present.
- ST/TS/VE slide 15 body 3 reuses only the learner paragraph prefix corresponding to the deck’s two source sentences. The removed suffix is exactly: `Before exchanging seed, check whether the variety is protected and whether permission is needed.` That sentence is absent from slide 15’s source body; slide 20 retains its separate English protection/permission instruction.
- Focused paired-draft tests passed: 4 tests, 0 failures. The tests check whole-paragraph matching, sentence count/order, the exact removed suffix, retained permission guidance on slide 20, and failure on source drift. `git diff --check` is clean.
- Root rendered seven affected frames and inspected their source/draft panels. Exact sizes and hashes are in `MARKET-COMMUNITY-REUSED-FRAMES-2026-10-04.json`. A selective one-time offline migration refreshes only those frames and preserves narration and unrelated lessons.

## Phone review found a hidden regional frame

At exact preview `33833b71`, all three regional slide 15 image views opened the
seed-sharing film poster rather than the paired draft/source still. The selected
silent pack contained the correct WebP, but the player chose the animation poster.
The Market animation now excludes `st`, `ve` and `ts`, matching the existing silent
regional deck policy. English and isiZulu retain their registered film. A regression
test checks the three exact still URLs and prevents the poster from obscuring them.
Publication still requires a new exact-head phone review of this repair.

## Current file hashes

- `docs/narration/market-community.st.paired-draft.json` SHA-256 `332daa6077eee3d825757da29533165c3ea2345012d8ae2eac9c6735139699fd`
- `docs/narration/market-community.ve.paired-draft.json` SHA-256 `fb524c91a6e5d0b7da07d44a4ff1094078d14022dff9e449a8b04f76a19192de`
- `docs/narration/market-community.ts.paired-draft.json` SHA-256 `05b8b76a2718787331b01ce5842d7cf4836287e7fc467fa893fb514f0b31dc97`
