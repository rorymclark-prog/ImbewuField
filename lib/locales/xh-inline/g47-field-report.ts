// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The mentor field report and the organisation field implementation report that lib/field-report.ts
// builds (buildFieldReport with language 'xh'), and the saved-visit lines of lib/field-teams.ts
// (fieldVisitReportLines, the FIELD_FOCUS labels and the visit-report headings of components/FieldTeams.tsx).
// Recorded data (participant, garden and mentor names, site locations, dates, counts, coordinates, typed
// notes, actions, outcomes and guidance) is never translated here: it is passed into the {placeholders}.
// Words shared with the other reports (Participant, Status, Date, Mentor, Action, Completed, Overdue, ...)
// and the FIELD_PROGRAMMES names are drafted once in earlier shards and are not repeated.
const drafts: Record<string, string> = {
  // Names the report falls back to
  "Site not recorded": "Indawo ayirekhodwanga",
  "All authorised participants": "Bonke abathathi-nxaxheba abagunyazisiweyo",
  "first recorded visit": "utyelelo lokuqala olurekhodiweyo",
  "latest recorded visit": "utyelelo lwamva nje olurekhodiweyo",
  // Titles
  "Field implementation report": "Ingxelo yokuphunyezwa kwasentsimini",
  "Mentor field report": "Ingxelo yomcebisi yasentsimini",
  // Metrics
  "Visits recorded": "Utyelelo olurekhodiweyo",
  "Completed visit records in this selection": "Iirekhodi zotyelelo ezigqityiweyo kolu khetho",
  "Assigned people visited": "Abantu abanikiweyo abatyelelweyo",
  "Current assignments; not unique garden sites": "Izabelo zangoku; ayizizo iindawo zeegadi ezahlukeneyo",
  "Open actions": "Izenzo ezivulekileyo",
  "{n} due or overdue as of {today}": "{n} ezimele zenziwe okanye ezidlulelwe lixesha ukusukela ngomhla we-{today}",
  "Completed actions": "Izenzo ezigqityiweyo",
  "Latest status of actions from these visits": "Imeko yamva nje yezenzo ezivela kolu tyelelo",
  // Support coverage
  "Support coverage": "Ukugubungela kwenkxaso",
  "Currently assigned participants, with visits inside the selected period. No recorded visit does not establish that no support happened elsewhere.": "Abathathi-nxaxheba abanikiweyo ngoku, kunye notyelelo olwenzeke kwixesha elikhethiweyo. Ukungabikho kotyelelo olurekhodiweyo akuqinisekisi ukuba akukho nkxaso yenzeke kwenye indawo.",
  "Garden / site": "Igadi / indawo",
  "Visits": "Utyelelo",
  "Latest selected visit": "Utyelelo lwamva nje olukhethiweyo",
  "No visit in selection": "Akukho tyelelo kolu khetho",
  // Open follow-up actions
  "Open follow-up actions": "Izenzo zokulandelela ezivulekileyo",
  "Actions arising from visits in this selection, at their latest recorded status on {today}, earliest due dates first. Earlier visits outside the filter may have other open actions.": "Izenzo ezivela kutyelelo olukolu khetho, ngemeko yazo yamva nje erekhodiweyo ngomhla we-{today}, kuqala imihla ekufuneka ngayo eyokuqala. Utyelelo lwangaphambili olungaphandle kwesihluzi lunokuba nezinye izenzo ezivulekileyo.",
  "Agreed action": "Isenzo esivunyelwene ngaso",
  "Due / review": "Umhla ekufuneka ngawo / wokuhlola",
  "Not scheduled": "Akukacwangciswa",
  "Scheduled": "Kucwangcisiwe",
  // Practical-skill observations
  "Recorded practical-skill observations": "Okuqatshelweyo okurekhodiweyo ngezakhono ezisebenzayo",
  "Each row is an observation during a visit. Repeat checks are not new people or proof of sustained adoption. Self-reported course confidence is a separate source.": "Umqolo ngamnye ngowokuqwalasela ngexesha lotyelelo. Ukuhlolwa okuphindaphindiweyo akubabantu abatsha okanye ubungqina bokwamkelwa okuqhubekayo. Ukuzithemba kwekhosi okuzixelelwe ngumntu ngokwakhe ngumthombo owahlukileyo.",
  "Practical skill": "Isakhono esisebenzayo",
  "Recorded observation": "Okuqatshelweyo okurekhodiweyo",
  "Demonstrated during this visit": "Sibonisiwe ngexesha lolu tyelelo",
  "Needs further support": "Sidinga enye inkxaso",
  "Not assessed": "Akuvavanywanga",
  // Completed support actions
  "Completed support actions": "Izenzo zenkxaso ezigqityiweyo",
  "Latest completion dates may fall after the selected visit period. This is a current status review, not a historical action snapshot.": "Imihla yamva nje yokugqitywa isenokuwela emva kwexesha lotyelelo elikhethiweyo. Oku kukuphonononga imeko yangoku, hayi umfanekiso wembali wezenzo.",
  "Recorded outcome": "Isiphumo esirekhodiweyo",
  "No action text recorded": "Akukho mbhalo wesenzo orekhodiweyo",
  "Outcome not recorded": "Isiphumo asirekhodwanga",
  // Visit evidence log
  "Visit evidence log": "Ilogu yobungqina botyelelo",
  "Internal saved visit details for the authorised mentor and organisation, including original notes and any recorded location. Review named records and private observations before sharing a PDF.": "Iinkcukacha zangaphakathi zotyelelo ezigciniweyo zomcebisi nombutho ogunyazisiweyo, kuquka amanqaku okuqala nayo nayiphi na indawo erekhodiweyo. Phonononga iirekhodi ezinamagama namanqaku abucala phambi kokwabelana nge-PDF.",
  "Participant / site": "Umthathi-nxaxheba / indawo",
  "Support areas": "Iinkalo zenkxaso",
  "Saved visit evidence": "Ubungqina botyelelo olugciniweyo",
  "Not classified": "Ayihlelwanga",
  // Assignments and guidance
  "Assignments & organisation guidance": "Izabelo nolwalathiso lombutho",
  "Current team guidance, separate from dated visit evidence. It is not a record of the guidance that existed at a past visit.": "Ulwalathiso lweqela langoku, olwahlukileyo kubungqina botyelelo obunemihla. Alurekhodi lwalathiso olwalukhona kutyelelo lwangaphambili.",
  "Service location / programme": "Indawo yenkonzo / inkqubo",
  "Recorded guidance": "Ulwalathiso olurekhodiweyo",
  "No guidance recorded": "Akukho lwalathiso lurekhodiweyo",
  // Support review
  "Support review": "Uphononongo lwenkxaso",
  "{visits} recorded visits reached {visited} of {assigned} currently assigned participants in this selection.": "Utyelelo olurekhodiweyo olungu-{visits} lufikelele kubathathi-nxaxheba abangu-{visited} kwabangu-{assigned} abanikiweyo ngoku kolu khetho.",
  "{unvisited} current assignments have no recorded visit in this selection. {open} actions remain open, including {due} due or overdue.": "Izabelo zangoku ezingu-{unvisited} azinabo utyelelo olurekhodiweyo kolu khetho. Izenzo ezingu-{open} zisavulekile, kuquka ezingu-{due} ezimele zenziwe okanye ezidlulelwe lixesha.",
  "Service delivery, observed skills and subsequent garden outcomes are separate evidence. This report does not infer employment attendance, payroll approval or livelihood impact.": "Ukuhanjiswa kwenkonzo, izakhono ezibonwayo neziphumo zegadi ezilandelayo bubungqina obahlukeneyo. Le ngxelo ayigqibi ngobukho emsebenzini, ukuvunywa kwemivuzo okanye impembelelo kwindlela yokuziphilisa.",
  // Scope
  "Programme focus: {programme}. Prepared {today}.": "Ugxininiso lwenkqubo: {programme}. Kulungiselelwe ngomhla we-{today}.",
  "The participant denominator is current team membership; visit records use the selected date range. Past assignments may differ.": "Inani elisisiseko labathathi-nxaxheba ngamalungu eqela langoku; iirekhodi zotyelelo zisebenzisa uluhlu lweentsuku olukhethiweyo. Izabelo zangaphambili zinokwahluka.",
  "Actions and assignments use the latest available records as of {today}. This does not reconstruct their status at the end of a historical period.": "Izenzo nezabelo zisebenzisa iirekhodi zamva nje eziyafumaneka ukusukela ngomhla we-{today}. Oku akuyakhi ngokutsha imeko yazo ekupheleni kwexesha langaphambili.",
  "DEMONSTRATION RECORDS: fictional field visits and illustrative results.": "IIREKHODI ZOMZEKELO: utyelelo lwasentsimini oluqanjiweyo neziphumo ezibonisayo.",
  // Decisions
  "Decisions for the next visit": "Izigqibo zotyelelo olulandelayo",
  "Review current assignments without a selected visit and agree which people need support first.": "Phonononga izabelo zangoku ezingenalo utyelelo olukhethiweyo nivumelane ukuba ngoobani abantu abafuna inkxaso kuqala.",
  "Give open actions a responsible person and review date. Record the outcome when an action is completed.": "Nika izenzo ezivulekileyo umntu onoxanduva nomhla wokuhlola. Rekhoda isiphumo xa isenzo sigqityiwe.",
  "Check a named practical skill against an observed task. Record later application separately before claiming adoption.": "Hlola isakhono esisebenzayo esinikiweyo ngomsebenzi owuqwalaselileyo. Rekhoda ukusetyenziswa kamva ngokwahlukileyo phambi kokuba uthi kwamkelwe.",
  "Keep private observations in the authorised team. A downloaded PDF does not inherit the app’s access controls.": "Gcina amanqaku abucala kwiqela eligunyazisiweyo. I-PDF ekhutshelweyo ayilifumani lawulo lofikelelo lwe-app.",
  // Sources
  "Sources & evidence limits": "Imithombo nemida yobungqina",
  "Source: saved records in this authorised field-team workspace. Other support may be unrecorded. Repeat visits and focus areas cannot be added as unique people or gardens.": "Umthombo: iirekhodi ezigciniweyo kule ndawo yokusebenzela yeqela lasentsimini eligunyazisiweyo. Enye inkxaso isenokungabhalwanga. Utyelelo oluphindaphindiweyo neenkalo zogxininiso azinakudityaniswa njengabantu okanye iigadi ezahlukeneyo.",
  "Photograph coverage: {loaded} / {recorded} recorded. Photographs are included only when loaded and explicitly selected; counts do not verify a claim.": "Ukugubungela kweefoto: {loaded} / {recorded} ezirekhodiweyo. Iifoto ziquka kuphela xa zilayishiwe kwaye zikhethwe ngokucacileyo; amanani awaqinisekisi isibango.",
  "loaded count unavailable": "inani elilayishiweyo alifumaneki",
  "{n} loaded for selection": "{n} zilayishelwe ukhetho",
  "Training attendance, self-reported confidence and observed practical skills are separate evidence. Use the full report for saved visit details and organisation guidance.": "Ubukho koqeqesho, ukuzithemba okuzixelelwe ngumntu ngokwakhe nezakhono ezisebenzayo ezibonwayo bubungqina obahlukeneyo. Sebenzisa ingxelo epheleleyo ukuze ufumane iinkcukacha zotyelelo olugciniweyo nolwalathiso lombutho.",
  "Source: saved records in this field-team workspace, filtered by participant and visit date. Work recorded in other systems is outside this report.": "Umthombo: iirekhodi ezigciniweyo kule ndawo yokusebenzela yeqela lasentsimini, ezihluzwe ngumthathi-nxaxheba nomhla wotyelelo. Umsebenzi orekhodwe kwezinye iinkqubo awukho kule ngxelo.",
  "Visit photographs are included only when loaded from their saved visit and explicitly selected. Photograph counts do not establish that a claim was verified.": "Iifoto zotyelelo ziquka kuphela xa zilayishwe kutyelelo lwazo olugciniweyo kwaye zikhethwe ngokucacileyo. Amanani eefoto awaqinisekisi ukuba isibango saqinisekiswa.",
  "Photograph coverage: {loaded} / {recorded} recorded. Open the saved visits to load further photographs.": "Ukugubungela kweefoto: {loaded} / {recorded} ezirekhodiweyo. Vula utyelelo olugciniweyo ukuze ulayishe ezinye iifoto.",
  "Several visits can concern one participant or one shared garden. Focus areas can overlap within a visit; adding focus counts does not produce a unique visit total.": "Utyelelo oluninzi lunokunxulumana nomthathi-nxaxheba omnye okanye igadi enye eyabelwanayo. Iinkalo zogxininiso zinokudibana ngaphakathi kotyelelo olunye; ukudibanisa amanani ogxininiso akuveli ngenani lotyelelo oluhlukeneyo.",
  "Training attendance and learner feedback belong in the facilitator delivery report. They do not substitute for an observed practical skill or a follow-up garden check.": "Ubukho koqeqesho noluvo lwabafundi zibekwa kwingxelo yokuhanjiswa komququzeleli. Aluthatheli indawo yesakhono esisebenzayo esibonwayo okanye uhlolo lwegadi olulandelayo.",
  // Comparison with the preceding range
  "Historical fieldwork comparison": "Uthelekiso lomsebenzi wasentsimini wembali",
  "Earlier {earlierFrom} to {earlierTo}; selected {from} to {to}. Equal numbers of calendar days. Current assignments and corrected visit records apply to both periods. This is delivery coverage, not a matched outcome comparison. Open/completed action status is current and is not compared historically. Zero recorded visits does not establish no support.": "Ngaphambili {earlierFrom} ukuya ku-{earlierTo}; ekhethiweyo {from} ukuya ku-{to}. Inani elilinganayo leentsuku zekhalenda. Izabelo zangoku neerekhodi zotyelelo ezilungisiweyo zisebenza kula maxesha omabini. Oku kukugubungela kokuhanjiswa, hayi uthelekiso lweziphumo ezifanayo. Imeko yezenzo ezivulekileyo/ezigqityiweyo yeyangoku kwaye ayithelekiswa ngokwembali. Akukho tyelelo lurekhodiweyo aluqinisekisi ukuba akukho nkxaso.",
  "Saved visits": "Utyelelo olugciniweyo",
  "Current assigned people visited": "Abantu abanikiweyo ngoku abatyelelweyo",
  // Chart
  "Support delivered by recorded focus": "Inkxaso ehanjisiweyo ngokwegxininiso elirekhodiweyo",
  "A visit can cover several focus areas. These bars must not be added as unique visits.": "Utyelelo olunye lunokuquka iinkalo ezininzi zogxininiso. Ezi bhari akufuneki zidityaniswe njengotyelelo oluhlukeneyo.",
  // The saved-visit lines (fieldVisitReportLines)
  "{date} | {farmer} | Mentor: {mentor}": "{date} | {farmer} | Umcebisi: {mentor}",
  "Site location: {location}": "Indawo yesiza: {location}",
  "Location: {latitude}, {longitude}": "Indawo: {latitude}, {longitude}",
  "Support areas: {areas}": "Iinkalo zenkxaso: {areas}",
  "Practical skill: {skill} | {result}": "Isakhono esisebenzayo: {skill} | {result}",
  "Action completed: {date}": "Isenzo sigqityiwe: {date}",
  "Completion evidence: {evidence}": "Ubungqina bokugqitywa: {evidence}",
  "Support requested: {text}": "Inkxaso ecelweyo: {text}",
  "Observations / issues: {text}": "Okuqatshelweyo / iingxaki: {text}",
  "Visit notes: {text}": "Amanqaku otyelelo: {text}",
  "Original notes before AI cleanup: {text}": "Amanqaku okuqala phambi kokucocwa yi-AI: {text}",
  "Agreed action: {text}": "Isenzo esivunyelwene ngaso: {text}",
  "Responsible person: {name}": "Umntu onoxanduva: {name}",
  "Not yet assigned": "Akukabelwa mntu",
  "Follow-up: {date}": "Ukulandelela: {date}",
  "Not yet scheduled": "Akukacwangciswa",
  "Visit photos: {n}": "Iifoto zotyelelo: {n}",
  // FIELD_FOCUS (lib/field-teams.ts), worded as the visit form's own tags are
  "Garden establishment & upkeep": "Ukuseka & ukugcina igadi",
  "Water access & repairs": "Ukufumana amanzi & ukulungisa",
  "Soil health & compost": "Impilo yomhlaba & umgquba",
  "Seedlings & seed saving": "Izithole zezityalo & ukugcina imbewu",
  "Crop care & protection": "Ukunyamekela & ukukhusela izityalo",
  "Harvest & food distribution": "Isivuno & ukwabiwa kokutya",
  "Practical skills & coaching": "Izakhono ezisebenzayo & uqeqesho",
  "Records & livelihood support": "Iirekhodi & inkxaso yokuziphilisa",
  // The single saved-visit report and the footer labels the screen gives the PDFs
  "Field visit report": "Ingxelo yotyelelo lwasentsimini",
  "Visit details": "Iinkcukacha zotyelelo",
  "Visit photographs": "Iifoto zotyelelo",
  "Visit photographs opened for this report": "Iifoto zotyelelo ezivulelwe le ngxelo",
  "Field support records": "Iirekhodi zenkxaso yasentsimini",
};
export default drafts;
