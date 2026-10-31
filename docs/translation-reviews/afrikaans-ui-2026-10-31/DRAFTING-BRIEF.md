# Afrikaans drafting brief — ImbewuField

ImbewuField is a permaculture and farm-records app for South African smallholder farmers, mentors,
students, NGOs and funders. You are drafting **unreviewed Afrikaans machine drafts** of English UI
text. English is the authority. A fluent reviewer will check them later; your job is a faithful,
plain, natural draft that cannot mislead a farmer.

## Hard rules
1. **Faithful.** Translate what the English says — add nothing, drop nothing, soften nothing. Keep
   every negation, condition, warning, permission, limit and "not / never / only / unless".
   Safety text (frost, livestock health, chemicals and pesticides, water and greywater, earthworks
   and digging, seed storage, food safety, poisonous plants, child supervision), money (prices,
   costs, profit, loans, invoices, paid/unpaid), consent and privacy get extra care.
2. **Placeholders and numbers exactly.** Every `{name}` placeholder must appear in the draft exactly
   as in the English (same name, same count). Keep every number, unit (kg, m², mm, °C, R), currency
   and date format. Invent no numbers. Keep markdown, `**bold**`, list markers, line breaks (`\n`),
   links and arrows (→) exactly.
3. **Names stay.** Keep brand and product names (ImbewuField, Lima, Design Studio is translated only
   where the English is a description — see glossary), file formats (PDF, PNG, CSV, JPG, WebP),
   acronyms (AI, GPS, POPIA, NGO is "NRO"), and **every plant, animal and species name exactly as the
   English writes it** (crop common names may be translated only when the English is a plain everyday
   crop word like "maize", "spinach", "cabbage" — never change or add a Latin name, and never swap one
   species for another). People's names stay.
4. **Plain Afrikaans.** Everyday Standard Afrikaans a farmer reads on a phone. Use "jy/jou" (informal
   you) consistently. Short sentences. No anglicisms where a common Afrikaans word exists, but keep
   widely used loanwords (app, aanlyn, e-pos, kliek → use "tik" for tap).
5. **UI conventions.** Buttons and labels: imperative/infinitive as Afrikaans apps do ("Stoor",
   "Kanselleer", "Voeg by", "Maak oop", "Laai af", "Deel"). Sentence case as in the English.
6. **Never return the English unchanged** unless it is only a name/code/number (then keep it as is and
   say so in your report).

## Lessons from the isiXhosa reviews (avoid these failure modes)
- "Prepared" (a prepared example/record) is *voorbereide*, not "corrected".
- "can still be saved" must stay a reassurance (*kan steeds gestoor word*), not "might be saved".
- "Min safe level" is a lower limit, not "a safe low level".
- "unpaid" / "not yet sent" / "not saved" — keep the negation and the tense precise.
- Do not turn "supervised" into "unsupervised" or drop it; do not soften "never".

## Glossary (use consistently; matches existing Afrikaans in the app)
| English | Afrikaans |
|---|---|
| report / site report | verslag / terreinverslag |
| site | terrein |
| map / maps | kaart / kaarte |
| saved maps | gestoorde kaarte |
| design / Design Studio | ontwerp / Ontwerpateljee |
| records / My records | rekords / My rekords |
| crop / crops | gewas / gewasse |
| bed / beds (garden bed) | bedding / beddings |
| harvest | oes |
| soil | grond |
| compost | kompos |
| water harvesting | wateropvang |
| greywater | gryswater |
| survey / questionnaire | opname / vraelys |
| farmer | boer |
| mentor | mentor |
| student / learner | student / leerder |
| funder | befondser |
| NGO | NRO |
| invoice | faktuur |
| sale / sales | verkoping / verkope |
| cost / expense | koste / uitgawe |
| receipt | kwitansie |
| profit | wins |
| paid / unpaid | betaal / onbetaal |
| offline | vanlyn |
| online / connection | aanlyn / verbinding |
| Offline & sync | Vanlyn en sinkroniseer |
| save / saved | stoor / gestoor |
| sign in / sign out | meld aan / meld af |
| settings | instellings |
| tap | tik |
| download / upload | laai af / laai op |
| share | deel |
| draft (translation) | konsep |
| unreviewed draft translation | onhersiene konsepvertaling |
| English source | Engelse bron |
| study / course / lesson / module | studie / kursus / les / module |
| practice (sample) workspace | oefenwerkruimte |
| sample / example | voorbeeld |
| prepared example | voorbereide voorbeeld |
| tour | toer |
| journal | joernaal |
| exchange (trade board) | ruilbord |
| community | gemeenskap |
| programme / cohort | program / groep |
| evidence | bewyse |
| consent | toestemming |
| household | huishouding |
| food forest | voedselwoud |
| guild (plant guild) | gilde |
| swale | kontoersloot |
| contour | kontoer |
| frost | ryp |
| seedling | saailing |
| sow / plant / transplant | saai / plant / oorplant |
| pest / disease | pes / siekte |
| livestock / poultry | vee / pluimvee |
| AI glossy map | AI-blinkkaart |

If a term is missing, grep the existing Afrikaans in `lib/locales/af.ts` and any finished
`lib/locales/af-inline/*.ts` shard for the English word first, and stay consistent.
