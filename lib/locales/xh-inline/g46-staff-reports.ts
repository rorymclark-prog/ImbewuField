// Unreviewed isiXhosa machine drafts keyed by the exact English (see index.ts).
// The facilitator delivery report that lib/training-report.ts builds (buildTrainingReport with language
// 'xh'). Recorded data (session, project and facilitator names, dates, counts, the recorded summaries and
// next steps, survey wording kept by the MEL templates) is never translated here: it is passed into the
// {placeholders}. Words shared with the MEL evidence report (Question, Withheld, Evidence review, ...) are
// drafted once in g45-mel-report.ts; terms already drafted in another shard (Date, Facilitator,
// Attendances, Not recorded, Evidence coverage, Linked assessment, Earlier period, ...) are not repeated.
const drafts: Record<string, string> = {
  // The footer label the screen gives the PDF
  "Training delivery records": "Iirekhodi zokuhanjiswa kweqeqesho",
  // Metrics
  "Sessions recorded": "Iiseshoni ezirekhodiweyo",
  "Saved sessions in this selection": "Iiseshoni ezigciniweyo kolu khetho",
  "{n} registered session places; repeats included": "Izikhundla zeseshoni ezibhalisiweyo ezi-{n}; ukuphindwa kuqukiwe",
  "Identified learners": "Abafundi abachongiweyo",
  "{n} guest attendances counted separately": "Ubukho bendwendwe obu-{n} bubalwa ngokwahlukileyo",
  "Session feedback": "Uluvo lweseshoni",
  "Responses / eligible present register entries; repeats included": "Iimpendulo / amangeniso erejista afanelekileyo abakhoyo; ukuphindwa kuqukiwe",
  // Session delivery table
  "Session delivery": "Ukuhanjiswa kweseshoni",
  "One row per saved session. Facilitator names are recorded text; they are not verified staff identities. Present / registered describes session places, not unique learners.": "Umqolo omnye kwiseshoni nganye egciniweyo. Amagama abaququzeleli ngumbhalo orekhodiweyo; ayizizo izazisi zabasebenzi eziqinisekisiweyo. Abakhoyo / ababhalisiweyo bachaza izikhundla zeseshoni, hayi abafundi abahlukeneyo.",
  "Session / project": "Iseshoni / iprojekthi",
  "Present / registered": "Abakhoyo / ababhalisiweyo",
  "Feedback responses": "Iimpendulo zoluvo",
  // Participant feedback table
  "Participant feedback": "Uluvo lwabathathi-nxaxheba",
  "Counts are session responses to the existing feedback questions. The same learner can respond after several sessions. Written feedback is excluded from this default aggregate export. This is experience feedback, not a skills test.": "Amanani ziimpendulo zeeseshoni kwimibuzo yoluvo esele ikhona. Umfundi omnye unokuphendula emva kweeseshoni ezininzi. Uluvo olubhaliweyo alufakwanga kule ngxelo ekhutshelweyo yentsumo emiselweyo. Oku luluvo ngamava, hayi uvavanyo lwezakhono.",
  "Recorded responses": "Iimpendulo ezirekhodiweyo",
  "Answered / eligible": "Ephenduliweyo / efanelekileyo",
  "No answer": "Akukho mpendulo",
  "No distribution available": "Akukho sasazo sifumanekayo",
  "No responses": "Akukho mpendulo",
  // Evidence coverage table
  "Signatures and certificates relate to attendance. They do not establish assessed competence or qualification. Photograph counts do not establish consent to share an image.": "Utyikityo neesatifikethi zinxulumene nobukho. Aziqinisekisi ubuchule obuvavanyiweyo okanye imfundo. Amanani eefoto awaqinisekisi imvume yokwabelana ngomfanekiso.",
  "Session": "Iseshoni",
  "Signed / present": "Batyikityile / abakhoyo",
  "Attendance certificates": "Iisatifikethi zobukho",
  "Recorded photos": "Iifoto ezirekhodiweyo",
  // Assessment links table
  "Assessment links & follow-up": "Unxulumaniso novavanyo nokulandelela",
  "A link identifies where to review assessment evidence; it does not merge the assessment population with these session totals. Follow-up notes are as recorded and have no inferred owner or due date.": "Unxulumaniso lubonisa apho kuphononongwa khona ubungqina bovavanyo; aludibanisi abantu bovavanyo nezi ntsumo zeeseshoni. Amanqaku okulandelela anjengoko erekhodiwe kwaye akanamnini okanye mhla uqikelelwayo.",
  "Recorded next steps": "Amanyathelo alandelayo arekhodiweyo",
  "Linked assessment · title unavailable": "Uvavanyo oluqhagamshelweyo · isihloko asifumaneki",
  "No link recorded": "Akukho nxulumano lurekhodiweyo",
  "No next step recorded": "Akukho nyathelo lilandelayo lirekhodiweyo",
  // Session narrative table
  "Session narrative evidence": "Ubungqina bebali leseshoni",
  "Saved session summaries. These are reports by the delivery team, not independent verification.": "Izishwankathelo zeeseshoni ezigciniweyo. Ziingxelo zeqela lokuhanjiswa, hayi ukuqinisekiswa okuzimeleyo.",
  "Recorded summary": "Isishwankathelo esirekhodiweyo",
  // Scope and sections
  "first saved session": "iseshoni yokuqala egciniweyo",
  "Delivery review": "Uphononongo lokuhanjiswa",
  "{sessions} saved sessions record {attendances} attendances across {registered} registered session places. A repeat attendance is another session place, not a new learner.": "Iiseshoni ezigciniweyo ezi-{sessions} zirekhoda ubukho obu-{attendances} kwizikhundla zeseshoni ezibhalisiweyo ezi-{registered}. Ubukho obuphindiweyo sesinye isikhundla seseshoni, hayi umfundi omtsha.",
  "{learners} distinct registered participant IDs are represented. {guests} guest attendances are excluded from that unique-learner count because their identity across sessions is not established.": "Ii-ID zabathathi-nxaxheba ababhalisiweyo abahlukeneyo ezi-{learners} ziyamelwa. Ubukho bendwendwe obu-{guests} abufakwanga kuloo ntsumo yabafundi abahlukeneyo kuba isazisi sazo kwiiseshoni asimiselwanga.",
  "{completed} session feedback responses are available for {assigned} eligible present register entries. The report does not turn satisfaction or a certificate of attendance into demonstrated competence.": "Iimpendulo zoluvo lweeseshoni ezi-{completed} ziyafumaneka kumangeniso erejista afanelekileyo abakhoyo angu-{assigned}. Ingxelo ayiguquli ukwaneliseka okanye isatifikethi sobukho sibe bubuchule obubonisiweyo.",
  "Prepared {today} from saved records. Unsaved session edits are excluded.": "Kulungiselelwe {today} ukusuka kwiirekhodi ezigciniweyo. Utshintsho lweeseshoni olungagcinwanga alufakwanga.",
  "Session records are restricted to the selected record-owning account. A typed facilitator name is not used to infer ownership.": "Iirekhodi zeeseshoni zinqunyelwe kwi-akhawunti ekhethiweyo ephethe iirekhodi. Igama lomququzeleli elibhaliweyo alisetyenziswa ukuqikelela ubunini.",
  "All record-owning accounts represented in the authorised session source are included.": "Zonke ii-akhawunti ezibambe iirekhodi ezimelwe kumthombo weeseshoni ogunyazisiweyo ziqukiwe.",
  "This is an internal facilitator delivery report. Named registers, signatures, contact details and written participant feedback are excluded from this aggregate export.": "Le yingxelo yangaphakathi yokuhanjiswa komququzeleli. Iirejista ezinamagama, utyikityo, iinkcukacha zonxibelelwano noluvo olubhaliweyo lwabathathi-nxaxheba azifakwanga kule ngxelo ekhutshelweyo yentsumo.",
  "Registration and attendance are session measures. Completion of a multi-session course needs its own agreed requirements and evidence.": "Ukubhaliswa nobukho zizilinganiso zeseshoni. Ukugqitywa kwekhosi yeeseshoni ezininzi kufuna iimfuno zayo ezivunyiweyo nobungqina.",
  "Learning, application & next decisions": "Ukufunda, ukusebenzisa nezigqibo ezilandelayo",
  "Review the existing before/after assessments using matched consenting participants. Separate reported confidence from observed practical performance.": "Phonononga uvavanyo lwangaphambi/lwasemva olukhoyo usebenzisa abathathi-nxaxheba abavumileyo abahambelanayo. Yahlula ukuzithemba okubikiweyo kwintsebenzo esebenzayo eqwalaselweyo.",
  "Use mentor skill observations and later garden checks to establish application. Intending to try a practice after training does not establish that it was adopted.": "Sebenzisa uqwalaselo lwezakhono lomcebisi nokukhangela igadi kamva ukuqinisekisa ukusetyenziswa. Ukujonga ukuzama inkqubo emva koqeqesho akuqinisekisi ukuba yamkelwe.",
  "Agree an owner, review date and evidence of completion for follow-up actions in the programme action or visit register.": "Vumelanani ngomnini, umhla wophononongo nobungqina bokugqitywa kwizenzo zokulandelela kwirejista yezenzo zenkqubo okanye yotyelelo.",
  "Use feedback about explanation, practice and language to decide what to change in the next session. Record whether that change helped.": "Sebenzisa uluvo malunga nenkcazelo, ukuziqhelisa nolwimi ukugqiba ukuba utshintsha ntoni kwiseshoni elandelayo. Rekhoda ukuba utshintsho lunceda na.",
  "Source: saved training records available to the current account. Session dates set the reporting period. Published and internal records are not interchangeable access scopes.": "Umthombo: iirekhodi zoqeqesho ezigciniweyo ezifumaneka kwi-akhawunti yangoku. Imihla yeeseshoni imisela ixesha lokuxela. Iirekhodi ezipapashiweyo neziphakathi azinakuhlaliselana ngobubanzi bokufikelela.",
  "Registered participant IDs are deduplicated across selected sessions. Guest attendances are reported separately; a guest name or code does not prove a unique person across sessions.": "Ii-ID zabathathi-nxaxheba ababhalisiweyo azibalwa kabini kwiiseshoni ezikhethiweyo. Ubukho bendwendwe bubikwa ngokwahlukileyo; igama okanye ikhowudi yendwendwe ayiqinisekisi umntu oyedwa kwiiseshoni.",
  "Feedback uses the existing instrument and consenting responses from present participants. Several responses from one learner across sessions remain several session responses.": "Uluvo lusebenzisa isixhobo esikhoyo neempendulo ezivumileyo zabathathi-nxaxheba abakhoyo. Iimpendulo ezininzi zomfundi omnye kwiiseshoni zihlala ziimpendulo ezininzi zeeseshoni.",
  "Attendance, course progress, self-reported learning, observed competence and sustained application are distinct evidence. This report makes no attribution or household-impact claim.": "Ubukho, inkqubela yekhosi, ukufunda okuzibikwa ngokwakho, ubuchule obuqwalaselweyo nokusetyenziswa okuqhubekayo bubungqina obahlukileyo. Le ngxelo ayenzi bango lokuchaza unobangela okanye lempembelelo yekhaya.",
  // Comparison table
  "Historical training delivery comparison": "Uthelekiso lokuhanjiswa kweqeqesho lwakudala",
  "Earlier {earlierFrom} to {earlierTo}; selected {from} to {to}. Equal numbers of calendar days, using saved records and the same project/record-owner filters. Period populations may differ. Repeated attendances and guest entries are not new identified learners. Recorded zeros do not establish no delivery. This is not a competence or impact comparison.": "Ngaphambili {earlierFrom} ukuya ku-{earlierTo}; ekhethiweyo {from} ukuya ku-{to}. Inani elilinganayo leentsuku zekhalenda, kusetyenziswa iirekhodi ezigciniweyo nezihluzi zeprojekthi/zomnini-rekhodi ezifanayo. Abantu bamaxesha banokwahluka. Ubukho obuphindiweyo namangeniso endwendwe ayizo bafundi abatsha abachongiweyo. Iizero ezirekhodiweyo aziqinisekisi ukuba akubangakho kuhanjiswa. Oku akuthelekiso lobuchule okanye lempembelelo.",
  "Recorded measure": "Isilinganiso esirekhodiweyo",
};
export default drafts;
