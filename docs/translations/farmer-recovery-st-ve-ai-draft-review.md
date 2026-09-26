# Farmer recovery UI — Sesotho and Tshivenda draft review

**Status:** unreviewed machine drafts for the seven map-crash and offline Reports keys in each
locale. A fluent speaker has not checked them. Both recovery states display the exact English
source beside the drafts, including the action buttons.

The source is `lib/i18n.tsx` (`mapHeldTitle`, `mapHeldBody`, `mapHeldLoad`,
`reportsOfflineTitle`, `reportsOfflineMessage`, `reportsOfflineRetry`,
`reportsOfflineClose`). The text changes no report, saved map, measurement, farming instruction
or offline-cache behaviour.

| English source | Sesotho draft | Tshivenda draft |
| --- | --- | --- |
| The map is taking a break | Mmapa o eme nakwana | Mmapa wo ima lwa tshifhinganyana |
| This page closed unexpectedly a few times in a row, so the map is paused to get you back in. Your reports, photos and places all still work below. | Leqephe lena le kwetse ka tshohanyetso makgetlo a mmalwa ka tatellano, kahoo mmapa o emisitswe nakwana hore o kgone ho kgutlela ka hara app. Ditlaleho, dinepe le dibaka tsa hao di ntse di sebetsa ka tlase. | This page closed unexpectedly a few times in a row. Ngauralo mmapa wo imiswa lwa tshifhinganyana uri ni kone u dzhena hafhu kha app. Mivhigo yaṋu, zwifanyiso na fhethu haṋu zwi kha ḓi shuma afho fhasi. |
| Load the map | Kenya mmapa | Laisani mmapa |
| Reports need signal the first time | Ditlaleho di hloka marang-rang lekgetlo la pele | Mivhigo i ṱoḓa inthanethe lwa u thoma |
| This part of the app is not saved on your phone yet, and there is no signal right now. Open it once with signal and it will work offline after that. | Karolo ena ya app ha e so bolokwe fonong ena, mme ha ho marang-rang hona jwale. E bule hang ha marang-rang a le teng; ka mora moo e tla sebetsa ntle le marang-rang. | Tshipiḓa itshi tsha app a tshi athu vhulungwa kha founu yaṋu, nahone a hu na inthanethe zwino. Tshi vuleni luthihi musi inthanethe i hone; nga murahu tshi ḓo shuma ni si na inthanethe. |
| Try again | Leka hape | Lingedzani hafhu |
| Close | Kwala | Valani |

The English-to-draft check found the clauses in the same order: repeated unexpected closures,
temporary map pause, continued access to reports/photos/places below; and a Reports part not yet
saved on this phone, no current connection, one connected opening needed before later offline use.
The candidate's Tshivenda `lunzhi` can imply “many”, so the opening “a few times in a row” clause
is held in English until a fluent reviewer supplies a precise equivalent.
The draft uses the internet terms `marang-rang` and `inthanethe` for English “signal”. A fluent
speaker should check whether these are the clearest words for a farmer who has no connection.

Terminology was checked against the current locale files, overriding a conflicting independent
machine backcheck: Sesotho uses `Mmapa`, `Ditlaleho`, `dinepe`, `dibaka`; Tshivenda uses `Mmapa`,
`Mivhigo`, `Zwifanyiso`, `Fhethu`. The original candidate substituted `Mapa` and `Mmebe`,
which do not match those existing controls. A fluent reviewer should check the full sentences,
imperative buttons and the naturalness of the map's “taking a break” metaphor before removing
the notice or English source.
