// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The text files a learner downloads from the Study pathways (finance practice worksheet, the
// guided design example, the design learning folder); the supplied card text, labels and prompts
// they carry already have drafts in g20/g26.
const drafts: Record<string, string> = {
  // Farm Finance practice worksheet (lib/finance-project.ts projectDraftText)
  "IMBEWUFIELD FARM FINANCE PRACTICE": "IMBEWUFIELD UKUZIQHELANISA NGEMALI YEFAMA",
  "Synthetic classroom case. This is not a farm record, financial advice or a submitted assessment.": "Imeko eyilelwe eklasini. Le asiyiyo irekhodi yefama, asingcebiso yemali, kwaye asingovavanyo olungeniswe.",
  "Case: {title} ({id})": "Imeko: {title} ({id})",
  "Practice period: {start} to {end}": "Ixesha lokuziqhelanisa: {start} ukuya ku-{end}",
  "[Not yet entered]": "[Ayikafakwa]",

  // Guided design example record (lib/design-worked.ts workedHandoverText)
  "metres": "iimitha",
  "Units: {unit}. {axis}.": "Iiyunithi: {unit}. {axis}.",
  "Teaching frame: {width} × {height} m. Not a land-rights record or fixed physical print scale.": "Isakhelo sokufundisa: {width} × {height} m. Asiyiyo irekhodi yamalungelo omhlaba okanye isikali esimiselweyo sokushicilela.",
  "Keep the downloaded diagrams alongside this record. This is the guided example, not your personal learning folder.": "Gcina imizobo ekhutshelweyo kunye nale rekhodi. Lo ngumzekelo okhokelweyo, ayiyo ifolda yakho yokufunda.",
  "SOURCE CARDS": "AMAKHADI OMTHOMBO",
  "MODEL GEOMETRY — all coordinates supplied fictional inputs": "IMILINGANISELO YEMODELI — zonke ii-koordinethi ngamanani aqanjiweyo anikiweyo",
  "{id} — {label}: x={x}, y={y}, width={width}, height={height} m.": "{id} — {label}: x={x}, y={y}, ububanzi={width}, ubude={height} m.",
  "{id} — {label}: x={x}, y={y} m (reference point).": "{id} — {label}: x={x}, y={y} m (indawo yesalathiso).",
  "FAIR COMPARISON": "UTHELEKISO OLUNOBULUNGISA",
  "Unknown:": "Okungaziwayo:",
  "PROVISIONAL CHOICE": "UKHETHO LWEXESHANA",
  "CONNECTED WORK, COST AND CARE": "UMSEBENZI OQHAGAMSHELENEYO, IINDLEKO NOKUKHATHALELA",
  "Before work:": "Phambi komsebenzi:",
  "{revision}: {phase}; {quantity}; cost {cost}; {care}.": "{revision}: {phase}; {quantity}; indleko {cost}; {care}.",
  "Cost detail:": "Iinkcukacha zendleko:",
  "Next discussion:": "Ingxoxo elandelayo:",
  "REVISION": "UHLAZIYO",
  "OBSERVATION PLAN — no outcomes supplied": "ISICWANGCISO SOKUJONGA — akukho zimveliso zinikiweyo",
  "Facilitator, practitioner, learner and language review are still required. This preview awards no assessed progress.": "Uphononongo lomququzeleli, lochwephesha, lomfundi nololwimi lusafuneka. Esi sikhangelo sokuqala asinikeli nkqubela phambili ehlolwayo.",

  // Design learning folder (lib/design-portfolio.ts portfolioText)
  "Paper or drawing references below are not attachments. Keep a separate copy of those sources.": "Izalathiso zamaphepha okanye imizobo ezingezantsi aziziqhoboshelo. Gcina ikopi eyahlukileyo yemithombo leyo.",
  "For discussion with a reviewer:": "Yokuxoxwa nomhloli:",
  // Alt text of the illustration on the design case and worked-example pages
  "Illustrative homestead planning scene; this image is not a measured picture of the practice case": "Umzobo ocacisa ucwangciso lwekhaya; lo mzobo awubonisi imilinganiselo yokwenyani yemeko yokuziqhelanisa",
  "Illustrated growers discussing a paper plan; it is contextual only and not the fictional classroom site": "Umzobo wabalimi bexoxa ngesicwangciso sephepha; ubonisa imeko kuphela, awuyiyo indawo eyilelwe yeklasi",
};

export default drafts;
