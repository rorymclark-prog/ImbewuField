# Consent controls: isiZulu working draft

**Status:** translation proposals for first-language review. Not approved for production and not legal advice. Agy CLI drafted the isiZulu proposals. The CLI reported 16,305 input tokens, 14,404 output tokens, 10,852 thinking tokens, 30,709 total tokens, and 45.942 seconds. It did not report a model name or monetary cost.

**Source reviewed:** `components/ConsentPanel.tsx`, `lib/consent.ts`, and its placement on `/account` in `app/account/page.tsx`, at `origin/main` commit `2c15ac6c`.

**Behavior confirmed in code:** the six scopes are independently controlled and default to off when no grant exists. Consent is for the farmer’s own organisation. The screen says the named organisation will stop seeing a scope when it is switched off. The location scope controls exact plot location; when it is off, the server coarsens the location to district. “Stop sharing everything” runs immediately and globally revokes all scopes. There is no confirmation dialog. A later switch-on can grant a scope again. A failed save displays the error below; the control reloads the saved value after a failed individual toggle.

Agy’s response included grammar, regional usage, and legal-adjacent assertions without supporting sources. Those assertions are not carried forward as facts. The drafts below are unverified candidates. Notes identify semantic questions for a first-language reviewer.

## Screen heading and notice

**English source — `What you share`**  
**Agy draft —** `Lokho owabelana ngakho`  
**Review:** Check that this reads naturally as a concise heading.

**English source —** `Nothing here is shared unless you switch it on. You can change your mind at any time, and {who} will stop seeing it straight away.`  
`{who}` is the organisation name when available; otherwise it is `the organisation running your programme`.  
**Agy draft — with organisation name —** `Akukho lutho olwabiwayo lapha ngaphandle kokuthi uyivule. Ungashintsha umqondo wakho noma nini, futhi i-{orgName} izoyeka ukukubona ngokushesha.`  
**Agy draft — fallback —** `Akukho lutho olwabiwayo lapha ngaphandle kokuthi uyivule. Ungashintsha umqondo wakho noma nini, futhi inhlangano eqhuba uhlelo lwakho izoyeka ukukubona ngokushesha.`  
**Review:** High stakes. Confirm “switch it on” clearly refers to the relevant consent switch and that the sentence says the organisation stops seeing the shared information, not the farmer. Confirm whether an `i-` prefix works for every organisation name the app can display. Verify the fallback names the organisation receiving access.

## Six sharing scopes

**English source — `What you sold`**  
**Agy draft —** `Lokho okuthengisile`  
**English source —** `Your crop sales and the money you earned from them.`  
**Agy draft —** `Ukuthengisa kwakho izitshalo nemali oyitholile ngakho.`  
**Agy alternative —** `Izitshalo ozithengisile nemali oyitholile ngazo.`  
**Review:** Confirm the description covers both crop sales and the money earned, without implying other income.

**English source — `What you spent`**  
**Agy draft —** `Lokho okusebenzisile`  
**English source —** `What you paid for seed, tools and inputs.`  
**Agy draft —** `Imali oyikhokhele imbewu, amathuluzi nezinsiza zokulima.`  
**Review:** High stakes for the financial scope. The heading candidate may read as “what you used” rather than “what you spent”; check it against the money-specific description. Confirm “inputs” is understood as the farming items covered by the records.

**English source — `What you harvested`**  
**Agy draft —** `Lokho okuvunile`  
**English source —** `Your harvest weights per crop.`  
**Agy draft —** `Izisindo zesivuno sakho ngesitshalo ngasinye.`  
**Review:** Confirm this means recorded harvest weights for each crop, not general production or expected yield.

**English source — `Your training`**  
**Agy draft —** `Ukuqeqeshwa kwakho`  
**English source —** `Which course modules you have finished.`  
**Agy draft —** `Izingxenye zezifundo oziqedile.`  
**Agy alternative —** `Amamojula ezifundo owaqedile.`  
**Review:** Confirm the description means completed course sections/modules and does not imply the whole course was completed.

**English source — `Your survey answers`**  
**Agy draft —** `Izimpendulo zakho zenhlolovo`  
**English source —** `The answers you gave in programme surveys.`  
**Agy draft —** `Izimpendulo ozinikezile ezinhloloveni zohlelo.`  
**Review:** Confirm “programme surveys” is understood as surveys run by the farmer’s programme.

**English source — `Where your farm is`**  
**Agy draft —** `Lapho ipulazi lakho likhona`  
**English source —** `Your exact plot location. With this off, only the district is shown.`  
**Agy draft —** `Indawo eqondile yensimu yakho. Uma lokhu kuvaliwe, kuboniswa isifunda kuphela.`  
**Review:** High stakes. Confirm the words distinguish the exact farm plot from the district-level location that remains visible when this scope is off. Check that the proposed word for “plot” fits the location stored by the app.

## Status, revoke action, and save error

**English source — `You are not sharing anything.`**  
**Agy draft —** `Awabelani ngalutho.`  
**Review:** Confirm this means no consent scopes are currently enabled.

**English source —** `You are sharing {on} of {total} things.`  
`{on}` is the live number of granted scopes; `{total}` is the live number of scopes.  
**Agy draft —** `Wabelana ngezinto ezingu-{on} kwezingu-{total}.`  
**Review:** Preserve both placeholders exactly. Check number phrasing at runtime, especially when the count is zero or one.

**English source — `Stop sharing everything`**  
**Agy draft —** `Yeka ukwabelana ngakho konke`  
**Agy alternative —** `Misa ukwabelana ngakho konke`  
**Review:** High stakes. This action immediately withdraws every scope. Confirm the wording clearly means stop all sharing, rather than pause sharing or stop only the current row.

**Confirmation prompt:** None exists in the current interface. Tapping “Stop sharing everything” immediately revokes all scopes; no confirm/cancel choice is shown. If a confirmation is added later, its English source and isiZulu proposal must be reviewed together before use.

**English source — `That did not save. Your sharing settings have not changed.`**  
**Agy draft —** `Lokho akugcinwanga. Izilungiselelo zakho zokwabelana azishintshanga.`  
**Review:** High stakes after a failed consent save. Confirm that this tells the farmer the attempted change was not saved and the previous settings remain in effect.

**English source — `Loading…`**  
**Agy draft —** `Kusalayishwa…`  
**Review:** Confirm the short status text is clear in this account screen.

## Bilingual requirement before review

Keep English and isiZulu together for every consent string above until a first-language isiZulu reviewer has checked the wording and the product owner/compliance reviewer has checked the consent meaning. This includes all six scope labels and descriptions, the organisation notice, the summary counts, the global revoke button, and save-error status. Keep any future confirmation prompt bilingual as well. Give particular attention to the organisation interpolation, location precision and district fallback, financial scopes, and immediate global revocation.
