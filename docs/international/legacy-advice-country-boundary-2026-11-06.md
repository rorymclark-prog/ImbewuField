# Legacy advice and saved-country scope

The older chat, site-insights and sketch-advice routes previously accepted caller
inputs while applying South African assumptions without consulting the saved-site
country authority. This candidate reuses the country resolver already used by
reports; it does not introduce a separate country store.

Chat explicitly distinguishes **Using the app** from **My saved site**. General
help attaches language and conversation text, with no saved-site, record, consent,
project or photo context. Its system scope withholds local farming, legal and
funding recommendations. People can still type their own information; this scope
does not redact their messages or certify model behaviour.

Personal requests require the verified caller's own saved places, a matching
coordinate-derived site and the current canonical country fingerprint. Supported
South African context continues to use the existing prompts. Unknown, foreign,
conflicting, stale or unreadable saved context is held before allowance and model
setup. Staff and organisation roles receive no cross-account exception. The
existing canned sample chat and separate fixed report/design-advice references
are unchanged; anonymous legacy local advice is held.

Each route rechecks before allowance, after allowance before model start, and
after consuming the metered iterator before delivering any text. Text is buffered;
usage settlement still records completed work when an answer is withheld. Typed
holds distinguish possible spent work from a pre-model refusal. A guard result is
not a fresh authentication-revocation check.

The three consumers capture actor, site, country and their actual input source.
They discard obsolete responses and gate displayed answers and attachments by
context. A LimaBar question is retained for explicit review and Send; interrupted
questions can be retried without automatic resubmission. Manual maps, drawings
and records remain available.

## Request compatibility

- Chat and sketch requests add `adviceContext` to their existing envelopes.
- Insights uses `{ adviceContext, locationData }` instead of a bare location.
- Personal metadata is `{ mode: 'personal-site', siteId, countryFingerprint }`;
  general metadata is `{ mode: 'general-help' }` and is accepted only by chat.
- Successful responses remain plain text with `X-Imbewu-Advice-Mode` and
  `Cache-Control: no-store`. Policy/model errors use static typed JSON.
- Older callers without scope metadata receive a hold rather than an implicit
  South African default. They must migrate deliberately.

## Evidence and limits

The implementation includes actual-route mocks with the real policy, canonical
country resolver and metering iterator, plus client-await and mounted-consumer
regressions. Authentication, saved-store transport, budget and SDK boundaries are
synthetic; they do not prove deployed authentication, live model output or account
behaviour. The native prompt selector and its rule tests have AGY provenance;
Codex independently reviews and executes them.

Saved-country confirmation does not verify local agronomy, legal suitability or
the completeness/origin of older environmental payloads. This change adds no
foreign crop catalogue, provider integration, lesson/species change, observed farm
record or measured-geometry mutation. New wording uses explicit English fallback;
inactive translation drafts remain a separate human-review task. Current-head
checks and actual desktop/phone/account review remain release gates. No production
release is claimed by this document.
