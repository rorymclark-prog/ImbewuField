// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The farmer's own production and finance report built by lib/farm-report.ts (buildFarmReport with
// language 'xh'), plus the two offline lines FarmReports.tsx adds. Recorded data (crop, buyer and farm
// names, the units a farmer typed, rand amounts, dates, counts) is never translated: it is passed into
// the {placeholders}. Money wording follows the money book (lib/records-regional-drafts-data.ts):
// Money in = Imali engenayo, Money out = Imali ephumayo, Costs = Iindleko, Recorded cash margin =
// Imali eseleyo ebhaliweyo, entry = ubhalo, invoice = i-invoyisi, paid = ehlawulweyo, unpaid =
// ezingahlawulwanga. Terms already drafted in another shard (Date, Quantity, Source, Invoice, Due,
// Category, Month, Produce, Not recorded, Not available, Harvest logged, Costs recorded, ...) are
// not repeated here.
const drafts: Record<string, string> = {
  // Words and short labels the report builds
  "items": "izinto",
  "No known quantities": "Akukho bungakanani baziwayo",
  "No entries": "Akukho mibhalo",
  "{n} units recorded": "Iiyunithi ezirekhodiweyo: {n}",
  "Date unavailable": "Umhla awufumaneki",
  "not available": "ayifumaneki",
  "Quantity not recorded": "Ubungakanani abubhalwanga",
  "Uncategorised": "Ayinadidi",
  "Not set": "Ayisetwanga",

  // Titles
  "Farm production report": "Ingxelo yemveliso yefama",
  "Farm finance report": "Ingxelo yemali yefama",
  "What needs a closer look": "Okufuna ukujongwa ngenyameko",
  "Record coverage & checks": "Ubungakanani beerekhodi nokuhlolwa",
  "Production by recorded name": "Imveliso ngegama elirekhodiweyo",
  "Harvest entries": "Imibhalo yesivuno",
  "Cash record detail": "Iinkcukacha zerekhodi yemali",
  "Unpaid invoices · current snapshot": "Ii-invoyisi ezingahlawulwanga · imeko yangoku",
  "Costs by recorded category": "Iindleko ngodidi olurekhodiweyo",
  "Recorded harvest weight": "Ubunzima besivuno esirekhodiweyo",

  // Period and scope
  "{start} to {end} · current period is incomplete": "{start} ukuya ku-{end} · ixesha langoku alipheleli",
  "Farm / business: {farm}. Prepared {date}.": "Ifama / ishishini: {farm}. Kulungiswe ngomhla we-{date}.",
  "Record period: {period}. This report covers all gardens in the available book; it is not a single-site export.": "Ixesha lerekhodi: {period}. Le ngxelo iquka onke amagadi akwincwadi ekhoyo; ayiyongxelo yendawo enye.",
  "Only dated entries in the selected period contribute to period totals. Unpaid invoices are a separate current snapshot, as recorded on this device.": "Imibhalo enemihla kuphela ekwixesha elikhethiweyo ebalwa kwiitotali zexesha. Ii-invoyisi ezingahlawulwanga ziyimeko yangoku eyahlukileyo, njengoko zirekhodwe kwesi sixhobo.",
  "DEMONSTRATION RECORDS: illustrative figures, not evidence of real production or finances.": "IIREKHODI ZOMZEKELO: amanani omzekelo, asingobungqina bemveliso okanye yemali yokwenyani.",
  "Personal farm report: review the contents before sharing. Organisation and funder access remain governed by the existing consent controls.": "Ingxelo yefama yakho: hlola okuqulethwe phambi kokwabelana. Ufikelelo lombutho nolomxhasi-mali luhlala lulawulwa zizilawuli zemvume ezikhoyo.",

  // Sources & method
  "Source: the harvest, sales and expense books available to this account, plus invoices saved on this device. This export does not establish that the books are complete or independently verified.": "Umthombo: iincwadi zesivuno, zentengiso neendleko ezikhoyo kule akhawunti, kunye nee-invoyisi ezigcinwe kwesi sixhobo. Oku kuthunyelwa ngaphandle akuqinisekisi ukuba iincwadi zipheleleyo okanye ziqinisekiswe ngokuzimeleyo.",
  "Dates use the same local-calendar period as Records. Harvest, sale, expense and invoice-payment dates determine which entries appear. Some dates record when an entry was saved; check the event date independently.": "Imihla isebenzisa ixesha lekhalenda lasekuhlaleni elifanayo neeRekhodi. Imihla yesivuno, yentengiso, yendleko neyentlawulo ye-invoyisi imisela ukuba ngowuphi umbhalo obonakalayo. Eminye imihla irekhoda xa umbhalo wawugcinwa; hlola umhla wesiganeko ngokwahlukileyo.",
  "A paid local invoice is counted once as money received. Its linked sale rows are replaced by its recorded quantities. An invoice unavailable on this device may appear through linked sales; non-produce charges may then be absent.": "I-invoyisi ehlawulweyo yasekhaya ibalwa kanye njengemali efunyenweyo. Imiqolo yentengiso exhunyiweyo itshintshwa ngobungakanani oburekhodiweyo. I-invoyisi engekho kwesi sixhobo inokubonakala ngeentengiso ezixhunyiweyo; iintlawulo ezingezizo zemveliso zinokungabikho.",
  "Quantities stay in their recorded units. Bags, crates, eggs, items and other counts are never converted to kilograms. Names are kept as recorded; differently named crops are not automatically merged.": "Ubungakanani buhlala kwiiyunithi ezirekhodwe ngazo. Iingxowa, amakhreyithi, amaqanda, izinto nezinye iinkcukacha azitshintshelwa kwiikhilogram. Amagama agcinwa njengoko arekhodwe; izityalo ezinamagama ahlukeneyo azidityaniswa ngokuzenzekelayo.",
  "No modelled harvest, guide price, planned production, opening bank balance or estimated household spending enters this report.": "Akukho sivuno esiqikelelweyo, ixabiso eliyisikhokelo, imveliso ecwangcisiweyo, ibhalansi yebhanki yokuqala okanye inkcitho yekhaya eqikelelweyo equkiweyo kule ngxelo.",

  // Coverage table
  "Counts describe readable entries in this selection. A book with no entries is not evidence of no farming activity.": "Amanani achaza imibhalo efundekayo kolu khetho. Incwadi engenamibhalo asingobungqina bokuba akukho msebenzi wokulima.",
  "Source / check": "Umthombo / ukuhlola",
  "Entries": "Imibhalo",
  "Meaning": "Intsingiselo",
  "Harvest book": "Incwadi yesivuno",
  "Dated harvest entries in the selected period": "Imibhalo yesivuno enemihla kwixesha elikhethiweyo",
  "Direct / unrepresented sales": "Iintengiso ezithe ngqo / ezingabonakaliswanga",
  "Cash sale entries after local invoice replacement": "Imibhalo yentengiso yemali emva kokutshintshwa kwe-invoyisi yasekhaya",
  "Paid local invoices": "Ii-invoyisi ezihlawulweyo zasekhaya",
  "Counted once, using their payment date": "Zibalwa kanye, kusetyenziswa umhla wentlawulo yazo",
  "Expense book": "Incwadi yeendleko",
  "Dated costs; completeness is not established": "Iindleko ezinemihla; ukupheleliswa akuqinisekiswanga",
  "Unavailable quantities": "Ubungakanani obungafumanekiyo",
  "These entries contribute no inferred weight or count": "Le mibhalo ayinegalelo kubunzima okanye kwinani eliqikelelweyo",
  "Unavailable dates · all available records": "Imihla engafumanekiyo · zonke iirekhodi ezikhoyo",
  "Cannot be allocated to a reporting period": "Ayinakwabelwa kwixesha lengxelo",
  "Possible double entries": "Imibhalo enokuphindwa",
  "Manual sales and invoices to review; no entry is silently removed": "Iintengiso nee-invoyisi ezibhalwe ngesandla ezifuna ukuhlolwa; akukho mbhalo ususwa ngokuthula",
  "Future-dated entries": "Imibhalo enemihla yexesha elizayo",
  "Included when inside the calendar selection, as in Records; check these dates": "Iyabandakanywa xa ingaphakathi kolu khetho lwekhalenda, njengakwiiRekhodi; hlola le mihla",

  // At a glance
  "{n} harvest entries contain {harvest}. Recorded sale quantities: {sold}.": "Imibhalo yesivuno: {n}, equlethe {harvest}. Ubungakanani bentengiso oburekhodiweyo: {sold}.",
  "Harvests and sales may refer to different picking dates, stored produce or bought-in stock. Their difference is not measured household consumption, donations or losses.": "Izivuno neentengiso zinokubhekisa kwimihla eyahlukileyo yokuvuna, kwimveliso egciniweyo okanye kwimpahla ethengiweyo. Umahluko wazo asisosisetyenziswa sekhaya, izipho okanye ilahleko eyalinganiswayo.",
  "Money received: {received}. Costs recorded: {costs}.": "Imali efunyenweyo: {received}. Iindleko ezirekhodiweyo: {costs}.",
  "unavailable amount in the selected receipts": "isixa esingafumanekiyo kwimali efunyenweyo ekhethiweyo",
  "unavailable amount in the selected costs": "isixa esingafumanekiyo kwiindleko ezikhethiweyo",
  "Recorded cash margin: {margin}. This is receipts minus logged expenses, not full accounting profit or a bank balance.": "Imali eseleyo ebhaliweyo: {margin}. Le yimali efunyenweyo ukususa iindleko ezirekhodiweyo, hayi inzuzo epheleleyo yeeakhawunti okanye ibhalansi yebhanki.",
  "{n} local invoices are currently marked unpaid. They do not enter money received.": "Ii-invoyisi zasekhaya ezingu-{n} zimakishwe njengezingahlawulwanga okwangoku. Azibalwa kwimali efunyenweyo.",

  // What needs a closer look
  "No dated entries are available for this period. Choose another period or record the activity; no result is inferred.": "Akukho mibhalo inemihla ikhoyo kweli xesha. Khetha elinye ixesha okanye urekhode umsebenzi; akukho siphumo siqikelelwayo.",
  "{n} available records have no usable event date and cannot enter period totals. Review the source records.": "Iirekhodi ezikhoyo ezi-{n} azinawo umhla wesiganeko osebenzisekayo kwaye azinakungena kwiitotali zexesha. Hlola iirekhodi zomthombo.",
  "{n} harvest or sale entries have no usable quantity. Their weights and counts remain unavailable.": "Imibhalo yesivuno okanye yentengiso engu-{n} ayinabungakanani busebenzisekayo. Ubunzima namanani abo ahlala engafumaneki.",
  "{n} income entries need a possible-duplicate check. {note}": "Imibhalo yengeniso engu-{n} ifuna ukuhlolwa ukuba ingaba iphindiwe. {note}",
  "Possibly the same sale — a paid invoice is already counted as income.": "Isenokuba yintengiso enye kanye — i-invoyisi ehlawulweyo sele ibalwe njengengeniso.",
  "{n} entries have future dates within this calendar selection. They remain included, as in Records; review their dates before sharing.": "Imibhalo engu-{n} inemihla yexesha elizayo ngaphakathi kolu khetho lwekhalenda. Iyaqhubeka ibandakanyiwe, njengakwiiRekhodi; hlola imihla yayo phambi kokwabelana.",
  "Record household use, donations, losses and stock movements separately before making a food-use balance. Those observations are not supplied by these books.": "Rekhoda ngokwahlukileyo ukusetyenziswa kwekhaya, izipho, ilahleko kunye nokuhamba kwestokhwe phambi kokwenza ibhalansi yokusetyenziswa kokutya. Ezo zinto ziqwalaselweyo azinikezelwa zezi ncwadi.",
  "Achieved yield per area needs a matching crop, measured growing area and crop-cycle dates. The current map or plan alone does not provide that comparison.": "Isivuno esifunyenweyo kwindawo nganye sifuna isityalo esihambelanayo, indawo yokutyala elinganisiweyo nemihla yomjikelo wesityalo. Imephu okanye isicwangciso sangoku sodwa asiniki oko kuthelekiswa.",
  "Check missing costs, unpaid invoices and supporting slips before sharing the report. Untagged costs are never allocated to crop profit.": "Hlola iindleko ezingabhalwanga, ii-invoyisi ezingahlawulwanga neerisithi ezixhasayo phambi kokwabelana ngengxelo. Iindleko ezingaphawulwanga azisoze zabelwe kwinzuzo yesityalo.",

  // Metrics
  "Sale quantities": "Ubungakanani bentengiso",
  "Dated records in this period": "Iirekhodi ezinemihla kweli xesha",
  "Produce names": "Amagama emveliso",
  "As recorded; not a biodiversity score": "Njengoko kurekhodiwe; asisosikori sohlukeno lwezinto eziphilayo",
  "Money received": "Imali efunyenweyo",
  "{sales} sale entries + {invoices} paid invoices": "Imibhalo yentengiso: {sales} + ii-invoyisi ezihlawulweyo: {invoices}",
  "{n} expense entries; completeness unknown": "Imibhalo yeendleko: {n}; ukupheleliswa akwaziwa",
  "Recorded cash margin": "Imali eseleyo ebhaliweyo",
  "Recorded receipts minus costs; not accounting profit": "Imali efunyenweyo erekhodiweyo ukususa iindleko; asiyonzuzo yeeakhawunti",
  "Unpaid invoices now": "Ii-invoyisi ezingahlawulwanga ngoku",
  "{n} local invoices; current snapshot": "Ii-invoyisi zasekhaya: {n}; imeko yangoku",

  // Production table
  "Units stay separate. A sale quantity follows its cash/payment date and may come from an earlier harvest. No food-use residual is calculated.": "Iiyunithi zihlala zahlukile. Ubungakanani bentengiso balandela umhla wayo wemali/wentlawulo kwaye bunokuvela kwisivuno sangaphambili. Akukho sisele sokusetyenziswa kokutya esibaliweyo.",
  "Harvest recorded": "Isivuno esirekhodiweyo",
  "Sold quantities": "Ubungakanani obuthengisiweyo",
  "No harvest entries": "Akukho mibhalo yesivuno",
  "No sale quantities": "Akukho bungakanani bentengiso",
  "{harvests} harvest / {sales} sale entries": "Imibhalo yesivuno: {harvests} / yentengiso: {sales}",
  "Only dated entries in the selected period. The report keeps recorded names and units.": "Imibhalo enemihla kuphela ekwixesha elikhethiweyo. Ingxelo igcina amagama neeyunithi ezirekhodiweyo.",

  // Cash record detail
  "{crop} · sale": "{crop} · intengiso",
  "Invoice {no}": "I-invoyisi {no}",
  "Sales book": "Incwadi yentengiso",
  "Paid local invoice": "I-invoyisi ehlawulweyo yasekhaya",
  "Review possible duplicate": "Hlola ukuba ingaba iphindiwe",
  "Paid invoice totals replace their linked sales once. Possible manual duplicates remain included until reviewed. Buyer and supplier contact details are omitted.": "Itotali ye-invoyisi ehlawulweyo itshintsha iintengiso zayo ezixhunyiweyo kanye. Imibhalo ebhalwe ngesandla enokuphindwa ihlala ibandakanyiwe de ihlolwe. Iinkcukacha zonxibelelwano zomthengi nomthengisi azibandakanywanga.",
  "Entry": "Umbhalo",
  "Money in": "Imali engenayo",
  "Money out": "Imali ephumayo",
  "Check": "Hlola",

  // Unpaid invoices
  "Local invoices issued on or before {date}, currently marked unpaid. This is not restricted to the selected cash period and is not an independently confirmed receivable balance.": "Ii-invoyisi zasekhaya ezikhutshwe ngomhla we-{date} okanye ngaphambi kwawo, ezimakishwe njengezingahlawulwanga okwangoku. Oku akukhawulelwanga kwixesha lemali elikhethiweyo kwaye asisosixa esiqinisekiswe ngokuzimeleyo sokufunyanwa.",
  "Issued": "Ikhutshiwe",

  // Costs table
  "All logged categories are included. Missing labour, depreciation, stock and other costs are not estimated.": "Zonke iindidi ezirekhodiweyo ziqukiwe. Umsebenzi, ukwehla kwexabiso lezixhobo, istokhwe nezinye iindleko ezingabhalwanga aziqikelelwanga.",
  "Recorded costs": "Iindleko ezirekhodiweyo",

  // Month by month
  "The same local-calendar series as Records, restricted to this selection. No entries means no recorded result. The current month is incomplete. Any future-dated entries in this selection are included and must be checked. Recorded cash margin is not a bank balance or full profit.": "Uluhlu olufanayo lwekhalenda lasekuhlaleni njengeeRekhodi, lukhawulelwe kolu khetho. Ukungabikho kwemibhalo kuthetha ukuba akukho siphumo sirekhodiweyo. Inyanga yangoku ayipheleli. Nayiphi na imibhalo enemihla yexesha elizayo kolu khetho iyabandakanywa kwaye kufuneka ihlolwe. Imali eseleyo ebhaliweyo asiyibhalansi yebhanki okanye inzuzo epheleleyo.",
  "Cash margin": "Imali eseleyo",

  // Chart
  "Showing {shown} of {total} recorded produce names with known weight, largest totals first. Every name and unit remains in the tables. These are recorded totals, not a performance ranking.": "Kubonisiwe amagama emveliso ayi-{shown} kwayi-{total} arekhodiweyo anobunzima obaziwayo, kuqala iitotali ezinkulu. Igama ngalinye neyunithi zihlala kwiitafile. Ezi ziitotali ezirekhodiweyo, asingulandelelwano lokusebenza.",

  // Added by components/FarmReports.tsx
  "The report analysis and tables are an unreviewed isiXhosa draft. Recorded names and units stay as recorded.": "Uhlalutyo lwengxelo neetafile ngumbhalo wesiXhosa ongekahlolwa. Amagama neeyunithi ezirekhodiweyo ziyahlala njengoko zirekhodwe.",
  "Farm records": "Iirekhodi zefama",
  "Farm / business": "Ifama / ishishini",
  "Demonstration farm": "Ifama yomzekelo",
  "My farm": "Ifama yam",
  "Prepared offline from records available on this device. A successful export does not confirm that shared records are current.": "Ilungiselelwe ngaphandle kwe-intanethi ngeerekhodi ezikhoyo kwesi sixhobo. Ukuthunyelwa ngaphandle ngempumelelo akuqinisekisi ukuba iirekhodi ezabelanwayo zikwimeko yangoku.",
  "Prepared offline from records available on this device. Newer shared records may be missing.": "Ilungiselelwe ngaphandle kwe-intanethi ngeerekhodi ezikhoyo kwesi sixhobo. Iirekhodi ezintsha ezabelanwayo zinokungabikho.",
};

export default drafts;
