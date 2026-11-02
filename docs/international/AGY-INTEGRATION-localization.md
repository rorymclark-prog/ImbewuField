# Localization integration proposal

Prepared by Codex delegated agent, 1 November 2026. **Proposal only; core files
were not edited.** The additive review route and CLI work without enabling the
four languages in the existing app.

## Review entrypoint available now

`/international/locales` loads real `T_en` source and the isolated review dictionaries.
It lets a reviewer choose language, separately choose formatting locale, search
source/draft pairs, preview interpolation/plurals and inspect review/source status.
Default resolved examples remain English. No approval or preference is persisted.
The coordinator can add a link from `app/international/page.tsx` (country lane)
to this route; that shared entrypoint was not edited here.

## Exact future core patch scope

Do not enable `fr`, `es`, `pt` or `sw` in `APP_LANGS` from this draft delivery.
First obtain fluent human review for the pilot surface and preserve its exact
reviewer/date/source/text evidence in each corresponding draft record. A structurally
complete 32-key draft is not a complete app language.

For a limited, explicitly labelled UI pilot, the coordinator could make this
guarded addition to `lib/i18n.tsx`. The pseudodiff below names exact dependencies;
it is not an applied patch or a claim that the whole language is reviewed.

```diff
+ import { DRAFT_DICTIONARIES } from '@/lib/international/locales/dictionaries';
+ import { SOURCE_MESSAGES } from '@/lib/international/locales/source';
+ import { resolveMessage } from '@/lib/international/locales/coverage';
+ import type { DraftLanguage } from '@/lib/international/locales/types';

  export async function loadLocale(code: string): Promise<void> {
+   // New reviewed pilot messages use their source-paired authority; no missing ./locales/fr import.
+   if (Object.hasOwn(DRAFT_DICTIONARIES, code)) return;
    // existing loading code follows unchanged
  }

  export function translate(lang: string, key: string): string {
+   if (Object.hasOwn(DRAFT_DICTIONARIES, lang)) {
+     const source = SOURCE_MESSAGES.find(message => message.key === key);
+     if (!source) return T_en[key] ?? key;
+     return resolveMessage(source, T_en, DRAFT_DICTIONARIES[lang as DraftLanguage], lang as DraftLanguage).text;
+   }
    return LOADED[lang]?.[key] ?? LOADED.en[key] ?? key;
  }
```

This safe default still falls back to English for every current draft. Pilot
language selection would additionally need `APP_LANGS` labels, visible partial
support and draft notices in `components/Onboarding.tsx`/the actual language picker,
and an updated `lib/lang-coverage.ts` contract. `getLoadedDict` currently returns
English for an unloaded locale, so its result must never be counted as translated
coverage for the pilot. Use `coverageReport` with the actual source and draft records.
Existing key-based `t` interpolation does not pass plural counts; a later typed
message API must pass values/count explicitly to `resolveMessage` before enabling
the photo-count plural feature on a real screen. Keep whole templates rather than
concatenating nouns and numbers in components.

The actual global language preference remains a string under `permamap_lang`.
A separate future formatting preference should carry `formattingLocale`, not
overload that value with country/jurisdiction. New account persistence or sync
requires its own reviewed schema/ownership change. No migration is delivered here;
old preferences remain valid and untouched.

## Other proposed owners and verification boundaries

- `lib/format-figures.ts`, `lib/records-months.ts`: coordinator decides whether an
  explicit formatting context is appropriate per surface. Keep current deterministic
  defaults; validate hydration, copy/paste, parsing and timezone boundaries before
  changing their contracts. This lane's new helpers are opt-in review examples.
- `lib/invoices.ts`, `lib/invoice-document.ts`, invoice renderers and exports:
  retain historical ZAR. Future multicurrency storage needs an explicit recorded
  currency and versioned migration, followed by separate subtotals or a separately
  authorized conversion record. Display locale is never a conversion authority.
- `lib/report-localisation.ts`, report/PDF/Word generators: extend the existing
  report authority with reviewed source pairs and document rendering checks, rather
  than reusing these generic interface drafts as farming/report translations.
- `lib/offline-pack.ts`, `lib/offline-cache.ts`, service-worker/runtime chunk
  handling: coordinator verifies the chosen UI chunks and retry/failure states
  actually work after network removal. Four new dictionaries provide no lesson,
  narration or offline-cache entitlement.
- Shared navigation: coordinator decides discoverability after reviewing the
  foundation. The direct route currently requires its URL.

The integration touches no crop engine, species registry, geometry, tenant rules,
billing, `PLAN_VERSION`, existing lesson translation or calibrated course body.

## Test registry union

The coordinator should add these two files to the existing `npm test` list,
preserving every existing entry. This lane did not edit `package.json`:

```text
tests/international-locales-foundation.test.ts
tests/international-locales-review.test.ts
```

Affected validation command (Node 24):

```sh
node --import ./tests/register-alias.mjs --test tests/international-locales-foundation.test.ts tests/international-locales-review.test.ts
```

Full current-head CI, rules and release checks remain the coordinator's gates.
