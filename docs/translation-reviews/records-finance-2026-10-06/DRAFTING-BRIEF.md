# Drafting brief — ImbewuField money book (participant finance UI)

Users: South African smallholder farmers, many low-literacy, on 390px phones. Screen: "the money
book" — tabs Picked (harvests) · Sold (money in) · Spent (money out/costs) · Charts. Farmers log
harvests, sales and costs, attach receipt photos, create invoices.

ENGLISH IS THE SOURCE AUTHORITY. Translate the meaning of each English string exactly. Do not add
advice, figures, promises ("free"), or explanations. Do not drop clauses.

Must preserve:
- negation ("not", "never", "Do not enter them again", "Nothing is lost", "not touched")
- tense (saved = past; "will reach" = future; "waiting to send" = still pending)
- entry vs record; income/money in/sale vs expense/cost/money out; buyer vs supplier
- quantities and units; "greater than zero"
- "Recover invoice" = rebuild a missing invoice from an already-saved sale (reconstruct), which is
  different from "View/Open" (open an existing one) and "Try again/Retry" (repeat a failed action)
  and from "Create invoice" (make a new one from a sale).
- "Picked" = harvested (picked from the garden), not "chosen".
- "Log" = record/write down (not a wooden log). "Sure?" = confirm a delete.
- {placeholders} must appear EXACTLY as in English (same names, same count); move them to fit grammar.
- Keep these as-is (technical/proper): R (rand), kg, m², R/kg, R/m², kg/m², CSV, JPG, PNG, WebP, MB,
  AI, Lima (the assistant's name), Ubhejane, Ubhejane Crèche, "Co-op" may be localised.
- "Invoice": use the locale's existing word (see glossary below). Do NOT leave ordinary words
  (eggs, bags, spinach, market, month, price, buyer…) in English under a technical-term excuse.
- Buttons/labels/tab names: SHORT. Tabs must fit 4 across a 390px phone (aim ≤ 10 characters).
- Lowercase fragments ('sale', 'harvested', 'planned', 'via', 'month', 'entries', unit words) are
  inserted after/before other words — see "context"; draft them as fragments.

If you cannot translate a string confidently, set status "hold" and draft "" with a note — it will
show English. Never guess on money/negation meaning.

Output: a JSON array, one object per input item that lists your language in "needs":
  {"id": "R001", "english": "<copied exactly>", "draft": "<translation>", "status": "draft"|"hold", "note": "<optional: uncertainty, alternatives, why>"}
Write it with the Write tool to the output path you were given. No other files. Do not edit the repo.

Glossary — read existing wording in the repo locale file to stay consistent, e.g. grep in
/home/user/ImbewuField/lib/locales/<lang>.ts for keys starting myRecords, invoice, homeQuick, tab.
