# isiXhosa UI translation brief — ImbewuField

ImbewuField is a permaculture / smallholder-farming app for South African farmers, mentors
(field facilitators), students (learners doing permaculture studies), NGOs and funders.
Readers are rural and peri-urban isiXhosa speakers (Eastern Cape, Western Cape), many with
modest schooling, reading on a phone. Write **plain, everyday standard isiXhosa** — the way a
friendly extension officer would speak — not academic or legal register.

## Hard rules (a string that breaks these is rejected)
1. **Placeholders** like `{n}`, `{lang}`, `{percent}`, `{name}` must appear in the isiXhosa
   EXACTLY as in English (same spelling, same count). Never translate the word inside braces.
   You may move them in the sentence and attach concords around them (e.g. `iimitha ezi-{n}`).
2. Keep unchanged: `ImbewuField`, `Lima` (the assistant's name), `Mapbox`, `GPS`, `PDF`, `CSV`,
   `POPIA`, `WhatsApp`, `YouTube`, `HD`, `3D`, `AI`, units (`m²`, `mm`, `kg`, `ha`, `°C`, `km`,
   `L`, `R` for rand), numbers, URLs, email addresses, file names, and symbols `→ ← · — % / & …`.
   Loanwords take a hyphenated prefix: `i-PDF`, `kwi-GPS`, `nge-WhatsApp`, `i-NGO`.
3. Do **not** add or remove facts, warnings, numbers or promises. Keep negations and
   conditions exact — many strings are money, consent or farming-safety text.
4. No emoji. Keep sentence case (only the first word and proper nouns capitalised).
5. Short UI labels (keys ending in Button, Label, Tab, Title, Chip, Short, or values of 1–3
   English words) must stay SHORT — one or two isiXhosa words where possible. Bottom-nav tabs
   and buttons cannot wrap.
6. If a value is only a symbol, a number, a brand, a unit, or a code (e.g. `3D`, `HD`, `Topo`,
   `→`), return it unchanged.
7. The English is the source authority. A `zu_draft` (unreviewed isiZulu machine draft) is
   given for some keys only as a hint for meaning; do NOT copy isiZulu spelling — isiXhosa
   differs (e.g. zu `-thola` vs xh `-fumana`, zu `isithombe` vs xh `ifoto`, zu `ukulima` OK in both).
8. Strings that name **isiZulu** specifically (e.g. "This isiZulu wording is an unreviewed
   machine draft") must be translated to name **isiXhosa** instead ("Lo mbhalo wesiXhosa…"),
   because in the isiXhosa locale the draft being described is the isiXhosa one.
   Strings that mention "English" stay about English (`isiNgesi`).

## Glossary (use these consistently)
| English | isiXhosa |
|---|---|
| tap / click | cofa |
| map | imephu |
| site (a farm location) | indawo / isiza (plot) |
| land | umhlaba |
| boundary | umda |
| contours (map lines) | imigca yokuphakama |
| slope | ithambeka |
| design (noun) / design studio | uyilo / isitudiyo soyilo |
| plan / planning | isicwangciso / ucwangciso |
| production plan / crop plan | isicwangciso semveliso / isicwangciso sezityalo |
| crop(s) | isityalo / izityalo (crops grown) ; izilimo (field crops) |
| vegetables | imifuno |
| fruit tree(s) | umthi weziqhamo / imithi yeziqhamo |
| harvest (noun / verb) | isivuno / ukuvuna |
| seed(s) | imbewu |
| soil | umhlaba (soil); umgangatho womhlaba (soil quality) |
| compost | umgquba |
| mulch | ingca yokugquma (mulch) |
| water harvesting | ukuqokelela amanzi |
| rainwater tank / tank | itanki yamanzi emvula / itanki |
| swale | umsele (swale) |
| borehole | umngxuma wamanzi (borehole) |
| frost | iqabaka |
| rainfall | imvula |
| climate | imozulu |
| livestock / animals | imfuyo / izilwanyana |
| chickens / poultry | iinkukhu |
| records / my records | iirekhodi / iirekhodi zam |
| money book | incwadi yemali |
| sales / sold | intengiso / kuthengisiwe |
| costs / spent | iindleko / kusetyenzisiwe imali |
| income | ingeniso |
| invoice | i-invoyisi |
| price(s) | ixabiso / amaxabiso |
| report | ingxelo |
| survey (site survey) | uphando (uphando lwendawo) |
| photo | ifoto |
| journal (field journal) | incwadi yemihla (field journal) |
| studies / course / lesson | izifundo / ikhosi / isifundo |
| assessment | uvavanyo |
| mentor | umcebisi (mentor) |
| student / learner | umfundi |
| farmer | umfama |
| NGO | i-NGO |
| funder | umxhasi-mali |
| programme | inkqubo |
| evidence | ubungqina |
| consent | imvume |
| account / sign in / sign out | i-akhawunti / ngena / phuma |
| settings | iisetingi |
| save / saved | gcina / kugciniwe |
| delete | cima |
| cancel | rhoxisa |
| close | vala |
| back | buyela umva |
| next | okulandelayo |
| done | kugqityiwe |
| edit | hlela |
| share | yabelana |
| download / export / print | khuphela / thumela ngaphandle / shicilela |
| offline / no signal | ngaphandle kwe-intanethi / akukho siginali |
| loading… | iyalayisha… |
| try again | zama kwakhona |
| sample / tour / demo | umzekelo / ukhenketho |
| draft (unreviewed) | uyilo olungekahlolwa (machine draft) / idrafti |
| permaculture | i-permaculture |

## Output
Write a single JSON object `{ "<key>": "<isiXhosa>" , ... }` containing EVERY key from your
input file, in the same order, valid JSON (escape `"` and `\n` correctly; keep `\n` where the
English has a newline). No commentary in the file.
