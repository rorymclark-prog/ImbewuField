// Unreviewed Afrikaans machine drafts keyed by the exact English (see index.ts).
// The site report's "Improve this report" checklist: the panel notes, the record statuses and the evidence details
// that lib/report-readiness.ts writes (REPORT_PREPARATION_COPY). The labels, actions and panel controls were drafted
// earlier (g06-reports.ts, g39-merge-reports.ts, g41-merge-waves.ts). Recorded names, source labels, dates, numbers and
// units are never drafted: {placeholders} and "m" / "m²" are kept exactly.
// Terms: bewyse = evidence, rekord = record, grens = boundary, ontwerp = design, ontwerpkaart = Design Map, blaaier = browser.
const drafts: Record<string, string> = {
  "; latest saved {date}": "; laaste gestoor {date}",
  "{count} saved design map available": "{count} gestoorde ontwerpkaart beskikbaar",
  "{count} saved design maps available": "{count} gestoorde ontwerpkaarte beskikbaar",
  "{count} site photograph saved": "{count} terreinfoto gestoor",
  "{count} site photographs saved": "{count} terreinfoto's gestoor",
  "{filled} of {total} key checks recorded": "{filled} van {total} sleutelkontroles aangeteken",
  "A fence line does not establish the complete property outline.": "'n Heininglyn bepaal nie die volledige eiendomsomtrek nie.",
  "Add the sampling date, location / sample ID, laboratory and results with units. Retain the original PDF or photograph and enter the values the report should use.": "Voeg die monsternemingsdatum, ligging / monster-ID, laboratorium en resultate met eenhede by. Hou die oorspronklike PDF of foto en voer die waardes in wat die verslag moet gebruik.",
  "Area {area} m²": "Oppervlakte {area} m²",
  "Boundary measurements available": "Grensmetings beskikbaar",
  "Boundary not recorded": "Grens nie aangeteken nie",
  "Boundary outline saved": "Grensomtrek gestoor",
  "Checking saved design maps…": "Gestoorde ontwerpkaarte word nagegaan…",
  "Checking this browser for saved sheets.": "Hierdie blaaier word nagegaan vir gestoorde blaaie.",
  "Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.": "Kies gewasse vir die terrein se beddings en teken plantdatums aan. Gaan enige areas na wat nog geen plan het nie.",
  "Climate and regional soil layers provide context. They do not replace your site observations or laboratory measurements.": "Klimaat- en streeksgrondlae gee agtergrond. Dit vervang nie jou terreinwaarnemings of laboratoriummetings nie.",
  "Design not recorded": "Ontwerp nie aangeteken nie",
  "Design records saved": "Ontwerprekords gestoor",
  "Document added · enter key results": "Dokument bygevoeg · voer sleutelresultate in",
  "Fence lines: {length} m. These may include internal fences.": "Heininglyne: {length} m. Dit kan interne heinings insluit.",
  "Fence measurements available": "Heiningmetings beskikbaar",
  "Filename only · original needed": "Slegs lêernaam · oorspronklike nodig",
  "Generate with the information you have, or add more evidence first. Records present do not mean the information has been checked or the design is finished.": "Genereer met die inligting wat jy het, of voeg eers meer bewyse by. Rekords wat teenwoordig is, beteken nie dat die inligting nagegaan is of die ontwerp klaar is nie.",
  "No saved map sheets found in this browser for this site. If you saved them on another device, open that device’s report.": "Geen gestoorde kaartblaaie is in hierdie blaaier vir hierdie terrein gevind nie. As jy dit op 'n ander toestel gestoor het, maak daardie toestel se verslag oop.",
  "Planting plan not recorded": "Plantplan nie aangeteken nie",
  "Plantings recorded · review coverage": "Aanplantings aangeteken · hersien dekking",
  "Record your goals, people, current production, water access, soil observations and challenges. Review the full survey before generating.": "Teken jou doelwitte, mense, huidige produksie, watertoegang, grondwaarnemings en uitdagings aan. Hersien die volledige opname voordat jy genereer.",
  "Results entered · review source": "Resultate ingevoer · hersien bron",
  "Show the whole site, growing areas, slopes, access and water sources. Include views that explain the conditions on the ground.": "Wys die hele terrein, groeigebiede, hellings, toegang en waterbronne. Sluit aansigte in wat die toestande op die grond verduidelik.",
  "Site evidence updated. Choose Generate new report to include it in the advice.": "Terreinbewyse opgedateer. Kies Genereer nuwe verslag om dit by die raad in te sluit.",
  "Site photos needed": "Terreinfoto's nodig",
  "Test results not recorded": "Toetsresultate nie aangeteken nie",
  "The Afrikaans text here is an unreviewed draft. Names, notes and source labels you recorded or typed are shown exactly as you wrote them.": "Die Afrikaanse teks hier is 'n onhersiene konsep. Name, notas en bronetikette wat jy aangeteken of getik het, word presies soos jy dit geskryf het gewys.",
  "The isiXhosa text here is an unreviewed draft. Names, notes and source labels you recorded or typed are shown exactly as you wrote them.": "Die isiXhosa-teks hier is 'n onhersiene konsep. Name, notas en bronetikette wat jy aangeteken of getik het, word presies soos jy dit geskryf het gewys.",
  "The outline is saved; dimensions are not available in this view.": "Die omtrek is gestoor; afmetings is nie in hierdie aansig beskikbaar nie.",
  "This checklist describes your current site. The saved report remains an earlier snapshot; generate a new report to use updated evidence.": "Hierdie kontrolelys beskryf jou huidige terrein. Die gestoorde verslag bly 'n vroeër momentopname; genereer 'n nuwe verslag om opgedateerde bewyse te gebruik.",
  "Trace the property outline in the Design Map to calculate its area and perimeter.": "Trek die eiendomsomtrek in die ontwerpkaart na om sy oppervlakte en omtrek te bereken.",
  "Use the saved dimensions; record any ground-check corrections in the design.": "Gebruik die gestoorde afmetings; teken enige regstellings uit grondkontroles in die ontwerp aan.",
  "Your saved layout is available in the Design Map. ": "Jou gestoorde uitleg is in die ontwerpkaart beskikbaar. ",
  "Your saved sheets are available in this report{latest}. Open them to review or include them in the full PDF.": "Jou gestoorde blaaie is in hierdie verslag beskikbaar{latest}. Maak dit oop om dit te hersien of by die volledige PDF in te sluit.",
  "perimeter {perimeter} m": "omtrek {perimeter} m",
};

export default drafts;
