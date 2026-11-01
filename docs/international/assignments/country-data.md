# AGY lane: country evidence and public provider foundation

Read [the common work order](../AGY-WORKORDER-2026-11-01.md) and local `AGENTS.md`.
Work only in `/Users/roryclark/ImbewuField-tokens/agy-country-foundation`
on `codex/agy-country-foundation`, baseline `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`.
Assigned model: Sonnet High. Codex launches the installed CLI.
Status path: `docs/international/AGY-STATUS-country-data.json`.

## First concrete milestone

After workspace acknowledgement, create a typed country evidence schema and one
clearly provisional pilot fixture. Add a test that fails if missing review is
mistaken for locally reviewed farming support. Then expand the implementation.
Do not wait to finish every country's literature review before writing working code.

## Deliverables

1. Typed country/region/provider records under `lib/international/countries/**`
   and `lib/international/providers/**`, with provenance and explicit unknown states.
2. A registry and readiness evaluator that keeps country, agricultural region,
   interface language, source availability and reviewed crop-plan support separate.
3. At least one working public read-only provider adapter with injected/mockable
   fetch, bounded requests, decoded response validation and useful failure states.
4. Mocked-network contract tests plus a separately recorded live request proof,
   using a public place or coarse demonstration location, with no farmer coordinates.
5. A usable `/international` review page showing pilot countries, evidence gaps,
   provider capabilities and actual readiness. Its actions must work and statuses
   must not imply supported local crop recommendations from a working reference API.
6. Source matrix, proposed core integration patch, release-note draft and status.

## Research sequence

First engineering pilots: Kenya, United Kingdom, United States and Brazil.
These are provisional research priorities, not suitability or launch approvals.
Create a broader research-priority matrix for Kenya, Uganda, Tanzania, Rwanda,
Ethiopia; India, Nepal, Bangladesh, Indonesia; Brazil, Colombia, Peru, Mexico;
United Kingdom, United States, Canada, Australia, New Zealand; and Europe.
Europe must not be treated as one legal jurisdiction or one agricultural region.
Differentiate verified pilot dossiers from an unreviewed research queue.
Do not imply equal research depth across all listed countries.

Candidate official families to verify, not prevalidated claims:

| Pilot | Candidate authority families |
| --- | --- |
| Kenya | KALRO, Kenya Meteorological Department, KEFRI; verify separate legal authority |
| United States | USDA/NRCS, NOAA, state cooperative extension; federal/state legal scope |
| United Kingdom | Met Office, UKCEH, NBN, JNCC; verify devolved jurisdiction/legal scope |
| Brazil | Embrapa, INMET, SiBBr; verify federal/state legal scope and language |

For each pilot distinguish biodiversity/taxonomy/conservation, agricultural
extension, meteorology/frost, soils and plant legality. A biodiversity occurrence
record does not establish a planting recommendation, invasive status or legality.
Record exact official sources, coverage/resolution, update/licence/attribution,
access requirements, freshness/missingness and review status per evidence category.
Use global layers only as qualified references. Do not invent local sowing/yield figures.

## Repository authority and adapter checks

Inspect `lib/site-survey.ts`, `lib/growing-zones.ts`, `lib/site-climate.ts`,
`lib/site-ecology.ts`, `lib/nasa-power.ts` and existing geographic/provider tests.
Reuse their concepts where helpful; edit none of these existing authorities.
Show a precise integration proposal stating where country context could enter
later and which existing SA behavior must be gated or kept untouched.
No automatic fallback to SA catalogues, seasons, climate labels or advice abroad.
Do not infer reviewed local agronomy from a valid ISO code or available API.

Test unsupported country, unknown region, missing source, stale/undated evidence,
malformed response, missing measurement, wrong units, timeouts and rate limits.
Distinguish a zero measurement from no measurement; retain provider attribution.
Choose a public adapter that can actually be demonstrated without new accounts.
If the first candidate needs a secret, record that limitation and use another
verified public endpoint; do not spend the lane waiting for credentials.
No arbitrary URL fetching from user input or accidental precise-coordinate logging.

## Completion evidence

Run typecheck, owned tests and whitespace checks; inspect the actual review route.
Record public live request date, endpoint, coarse inputs, outcome and provenance
in `docs/international/AGY-COUNTRY-DATA-EVIDENCE.md`, without raw logs.
Report public-read success separately from local agronomic review.
Deliver `docs/international/AGY-INTEGRATION-country-data.md` and
`docs/international/AGY-RELEASE-NOTES-country-data.md` alongside source and tests.
Use port 4250 if a development server is needed. Finish with the common PR handoff.
