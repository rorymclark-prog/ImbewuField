// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The site report's "Improve this report" checklist: the panel notes, the record statuses and the evidence details
// that lib/report-readiness.ts writes (REPORT_PREPARATION_COPY). The labels, actions and panel controls were drafted
// earlier (g06-reports.ts, g39-merge-reports.ts, g41-merge-waves.ts). Recorded names, source labels, dates, numbers and
// units are never drafted: {placeholders} and "m" / "m²" are kept exactly.
// Terms: ubungqina = evidence, irekhodi = record, umda = boundary, uyilo = design, isikhangeli = browser.
const drafts: Record<string, string> = {
  "; latest saved {date}": "; ugcino lwamva nje {date}",
  "{count} saved design map available": "Kukho imephu yoyilo egciniweyo engu-{count}",
  "{count} saved design maps available": "Kukho iimephu zoyilo ezigciniweyo ezingu-{count}",
  "{count} site photograph saved": "Ifoto yendawo engu-{count} igciniwe",
  "{count} site photographs saved": "Iifoto zendawo ezingu-{count} zigciniwe",
  "{filled} of {total} key checks recorded": "Ukuhlolwa okuphambili okungu-{filled} kwezingu-{total} kurekhodiwe",
  "A fence line does not establish the complete property outline.": "Umgca wothango awubonisi umgca opheleleyo wepropati.",
  "Add the sampling date, location / sample ID, laboratory and results with units. Retain the original PDF or photograph and enter the values the report should use.": "Yongeza umhla wokuthatha isampulu, indawo / i-ID yesampulu, ilebhu neziphumo ezinamayunithi. Gcina i-PDF okanye ifoto yokuqala uze ufake amaxabiso ekufuneka ingxelo iwasebenzise.",
  "Area {area} m²": "Indawo {area} m²",
  "Boundary measurements available": "Ubungakanani bomda buyafumaneka",
  "Boundary not recorded": "Umda awurekhodwanga",
  "Boundary outline saved": "Umgca womda ugciniwe",
  "Checking saved design maps…": "Kuhlolwa iimephu zoyilo ezigciniweyo…",
  "Checking this browser for saved sheets.": "Kuhlolwa esi sikhangeli ukufumana amaphepha agciniweyo.",
  "Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.": "Khetha izityalo zeebhedi zendawo uze urekhode imihla yokutyala. Khangela naziphi na iindawo ezingekabi nasicwangciso.",
  "Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.": "Iileya zemozulu nezomhlaba wommandla zinika imeko jikelele. Azithathi ndawo yoko ukubonileyo kwindawo yakho okanye ezilinganisweni zelebhu.",
  "Design not recorded": "Uyilo alurekhodwanga",
  "Design records saved": "Iirekhodi zoyilo zigciniwe",
  "Document added · enter key results": "Uxwebhu lufakiwe · faka iziphumo eziphambili",
  "Fence lines: {length} m. These may include internal fences.": "Imigca yothango: {length} m. Inokubandakanya uthango lwangaphakathi.",
  "Fence measurements available": "Ubungakanani bothango buyafumaneka",
  "Filename only · original needed": "Igama lefayile kuphela · kufuneka eyokuqala",
  "Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.": "Yenza ingxelo ngolwazi onalo, okanye qala ngokongeza ubungqina obungakumbi. Ubukho beerekhodi akuthethi ukuba ulwazi luhloliwe okanye uyilo lugqityiwe.",
  "No saved map sheets found in this browser for this site. If you saved them on another device, open that device’s report.": "Akukho maphepha emephu agciniweyo afunyenwe kwesi sikhangeli kule ndawo. Ukuba uwagcine kwesinye isixhobo, vula ingxelo yaloo sixhobo.",
  "Planting plan not recorded": "Isicwangciso sokutyala asirekhodwanga",
  "Plantings recorded · review coverage": "Ukutyala kurekhodiwe · phonononga iindawo ezigutyungelweyo",
  "Record your goals, people, current production, water access, soil observations and challenges. Review the full survey before generating.": "Rekhoda iinjongo zakho, abantu, imveliso yangoku, ufikelelo lwamanzi, oko ukubonileyo emhlabeni nemingeni. Phonononga uphando lonke phambi kokuba wenze ingxelo.",
  "Results entered · review source": "Iziphumo zifakiwe · phonononga umthombo",
  "Show the whole site, growing areas, slopes, access and water sources. Include views that explain the conditions on the ground.": "Bonisa yonke indawo, iindawo zokutyala, iithambeka, indlela yokungena nemithombo yamanzi. Bandakanya iinkangeleko ezichaza iimeko zasemhlabeni.",
  "Site evidence updated. Choose Generate new report to include it in the advice.": "Ubungqina bendawo buhlaziyiwe. Khetha u-Yenza ingxelo entsha ukuze bubandakanywe kwingcebiso.",
  "Site photos needed": "Kufuneka iifoto zendawo",
  "Test results not recorded": "Iziphumo zovavanyo azirekhodwanga",
  "The isiXhosa text here is an unreviewed draft. Names, notes and source labels you recorded or typed are shown exactly as you wrote them.": "Umbhalo wesiXhosa apha uyilo olungekahlolwa. Amagama, izaziso neelebhile zemithombo ozirekhodileyo okanye ozibhalileyo ziboniswa kanye ngendlela ozibhale ngayo.",
  "The outline is saved; dimensions are not available in this view.": "Umgca womda ugciniwe; ubungakanani abufumaneki kolu khangelo.",
  "This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.": "Olu luhlu lujonga luchaza indawo yakho yangoku. Ingxelo egciniweyo ihlala iyisifoto sangaphambili; yenza ingxelo entsha ukuze kusetyenziswe ubungqina obuhlaziyiweyo.",
  "Trace the property outline in the Design Map to calculate its area and perimeter.": "Zoba umgca wepropati kwimephu yoyilo ukuze kubalwe indawo yayo nomjikelo wayo.",
  "Use the saved dimensions; record any ground-check corrections in the design.": "Sebenzisa ubungakanani obugciniweyo; rekhoda naziphi na izilungiso zokujonga emhlabeni kuyilo.",
  "Your saved layout is available in the Design Map. ": "Uyilo lwakho olugciniweyo luyafumaneka kwimephu yoyilo. ",
  "Your saved sheets are available in this report{latest}. Open them to review or include them in the full PDF.": "Amaphepha akho agciniweyo ayafumaneka kule ngxelo{latest}. Wavule ukuze uwaphonononge okanye uwabandakanye kwi-PDF epheleleyo.",
  "perimeter {perimeter} m": "umjikelo {perimeter} m",
};

export default drafts;
