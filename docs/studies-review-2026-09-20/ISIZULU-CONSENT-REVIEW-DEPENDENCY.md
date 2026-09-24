# IsiZulu data-sharing consent review dependency

**24 September 2026.** The Account page warns in isiZulu that the consent
details below are in English and asks the farmer to get help before agreeing.
The six sharing switches, their consequences, the recipient description and
the stop-sharing control in `components/ConsentPanel.tsx` remain English. This
is a deliberate hold: translating the interface without checking the exact
scope could change what a farmer thinks they have agreed to. This document
records the current source for a fluent South African isiZulu reviewer and a
POPIA/privacy reviewer; it is not a translation or an approval.

| Scope in `lib/consent.ts` | Current farmer-facing detail |
| --- | --- |
| What you sold | Your crop sales and the money you earned from them. |
| What you spent | What you paid for seed, tools and inputs. |
| What you harvested | Your harvest weights per crop. |
| Your training | Which course modules you have finished. |
| Your survey answers | The answers you gave in programme surveys. |
| Where your farm is | Your exact plot location. With this off, only the district is shown. |

The same review must cover the named organisation or fallback recipient,
the default-off explanation, the count of active sharing scopes, the save
failure message (sharing settings have **not** changed), and the one-action
"Stop sharing everything" revocation. The runtime source of these strings is
`components/ConsentPanel.tsx`; the scope catalogue and actual data granularity
are in `lib/consent.ts`. The reviewer should check each sentence against the
current rules and data views, record exact corrections and reviewed scope,
and give an accepted/revise/hold decision with their name, role and date.

Until then, the consent panel stays English with the existing isiZulu warning.
The assessment participation/consent text in `components/MelDashboard.tsx` is
a separate review item and must not be treated as cleared by this packet.
