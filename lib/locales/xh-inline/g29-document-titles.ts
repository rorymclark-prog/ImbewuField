// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
//
// Browser tab titles. The Next.js metadata titles are static English (server-rendered, and
// tests/page-titles.test.ts pins them), so components/DocumentTitle.tsx translates document.title
// in the browser when the reader's language is isiXhosa. A title written "<Page> — ImbewuField"
// is split at the shared " — ImbewuField" suffix and only the page part is keyed here; titles
// with another shape are keyed whole. A page part with no draft is left in English.
const drafts: Record<string, string> = {
  // page parts (before " — ImbewuField")
  "Field journal": "Incwadi yemihla",
  "My Records": "Iirekhodi zam",
  "Design studio": "Isitudiyo soyilo",
  "What's new": "Okutsha",
  "Example farm": "Umzekelo wefama",
  "Tips and help": "Iingcebiso noncedo",
  "Farm-gate prices": "Amaxabiso asefama",
  "Printable plan": "Isicwangciso esinokushicilelwa",
  "Permaculture manual": "Isikhokelo se-permaculture",
  "Map": "Imephu",
  "Planting calendar": "Ikhalenda lokutyala",
  "Study": "Izifundo",
  "Saved on this phone": "Kugcinwe kule fowuni",
  "Example production": "Umzekelo wemveliso",
  "Example gardens": "Umzekelo weegadi",
  "Your design learning folder": "Ifolda yakho yokufunda uyilo",
  // whole titles
  "ImbewuField — permaculture planning for South African farmers": "ImbewuField — ucwangciso lwe-permaculture lwabafama baseMzantsi Afrika",
  "ImbewuField — partner deck": "ImbewuField — iislayidi zamaqabane",
  "ImbewuField for NGOs and funders": "ImbewuField yee-NGO nabaxhasi-mali",
  "Permaculture design lesson — teaching preview": "Isifundo soyilo lwe-permaculture — umboniso wokufundisa",
  "Design a working homestead — teaching preview": "Yila ikhaya elisebenzayo — umboniso wokufundisa",
  "Read the scale, check the space — design practice": "Funda isikali, ujonge indawo — uziqhelise ngoyilo",
  "Worked design demonstration — teaching preview": "Umzekelo woyilo osetyenzwe ngokupheleleyo — ukujonga kwangaphambili kokufundisa",
  "The busy yard — design practice case": "Iyadi exakekileyo — imeko yokuziqhelisa ngoyilo",
  "Farm Finance lesson — ImbewuField teaching preview": "Isifundo seMali yefama — ImbewuField umboniso wokufundisa",
  "Farm Finance — ImbewuField teaching preview": "Imali yefama — ImbewuField umboniso wokufundisa",
  "Farm Finance practical project — teaching preview": "Iprojekthi yokwenza yeMali yefama — umboniso wokufundisa",
  "ACT Teach the Teachers | two-day facilitator refresher": "ACT Fundisa Abafundisi | uhlaziyo lwabaququzeleli lweentsuku ezimbini",
};

export default drafts;
