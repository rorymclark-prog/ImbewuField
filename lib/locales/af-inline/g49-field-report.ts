// Unreviewed Afrikaans machine drafts keyed by the exact English (see index.ts).
// The mentor field report and the organisation field implementation report that lib/field-report.ts
// builds (buildFieldReport with language 'af'), and the saved-visit lines of lib/field-teams.ts
// (fieldVisitReportLines, the FIELD_FOCUS labels and the visit-report headings of components/FieldTeams.tsx).
// Recorded data (participant, garden and mentor names, site locations, dates, counts, coordinates, typed
// notes, actions, outcomes and guidance) is never drafted here: it is passed into the {placeholders}.
// Words shared with the other reports (Participant, Status, Date, Mentor, Action, Completed, Overdue, ...)
// and the FIELD_PROGRAMMES names are drafted once in earlier shards and are not repeated.
// Placeholders, digits, the "|" separators and symbols are kept exactly.
// Terms: besoek = visit, opvolg = follow-up, deelnemer = participant, aangeteken = recorded,
// tuin = garden, terrein = site, toewysing = assignment, riglyne = guidance, bewyse = evidence.
const drafts: Record<string, string> = {
  // Names the report falls back to
  "Site not recorded": "Terrein nie aangeteken nie",
  "All authorised participants": "Alle gemagtigde deelnemers",
  "first recorded visit": "eerste aangetekende besoek",
  "latest recorded visit": "jongste aangetekende besoek",
  // Titles
  "Field implementation report": "Veldimplementeringsverslag",
  "Mentor field report": "Mentor se veldverslag",
  // Metrics
  "Visits recorded": "Besoeke aangeteken",
  "Completed visit records in this selection": "Voltooide besoekrekords in hierdie keuse",
  "Assigned people visited": "Toegewysde mense wat besoek is",
  "Current assignments; not unique garden sites": "Huidige toewysings; nie unieke tuinterreine nie",
  "Open actions": "Oop aksies",
  "{n} due or overdue as of {today}": "{n} met sperdatum op of voor {today}",
  "Completed actions": "Voltooide aksies",
  "Latest status of actions from these visits": "Jongste status van aksies uit hierdie besoeke",
  // Support coverage
  "Support coverage": "Ondersteuningsdekking",
  "Currently assigned participants, with visits inside the selected period. No recorded visit does not establish that no support happened elsewhere.": "Deelnemers wat tans toegewys is, met besoeke binne die gekose tydperk. Die afwesigheid van 'n aangetekende besoek bewys nie dat daar nêrens anders ondersteuning was nie.",
  "Garden / site": "Tuin / terrein",
  "Visits": "Besoeke",
  "Latest selected visit": "Jongste gekose besoek",
  "No visit in selection": "Geen besoek in die keuse nie",
  // Open follow-up actions
  "Open follow-up actions": "Oop opvolgaksies",
  "Actions arising from visits in this selection, at their latest recorded status on {today}, earliest due dates first. Earlier visits outside the filter may have other open actions.": "Aksies uit besoeke in hierdie keuse, by hul jongste aangetekende status op {today}, vroegste sperdatums eerste. Vroeëre besoeke buite die filter kan ander oop aksies hê.",
  "Agreed action": "Ooreengekome aksie",
  "Due / review": "Sperdatum / hersiening",
  "Not scheduled": "Nie geskeduleer nie",
  "Scheduled": "Geskeduleer",
  // Practical-skill observations
  "Recorded practical-skill observations": "Aangetekende waarnemings van praktiese vaardighede",
  "Each row is an observation during a visit. Repeat checks are not new people or proof of sustained adoption. Self-reported course confidence is a separate source.": "Elke ry is 'n waarneming tydens 'n besoek. Herhaalde kontroles is nie nuwe mense of bewys van volgehoue aanvaarding nie. Selfgerapporteerde kursusvertroue is 'n aparte bron.",
  "Practical skill": "Praktiese vaardigheid",
  "Recorded observation": "Aangetekende waarneming",
  "Demonstrated during this visit": "Tydens hierdie besoek gedemonstreer",
  "Needs further support": "Het verdere ondersteuning nodig",
  "Not assessed": "Nie beoordeel nie",
  // Completed support actions
  "Completed support actions": "Voltooide ondersteuningsaksies",
  "Latest completion dates may fall after the selected visit period. This is a current status review, not a historical action snapshot.": "Die jongste voltooiingsdatums kan ná die gekose besoektydperk val. Dit is 'n hersiening van die huidige status, nie 'n historiese momentopname van aksies nie.",
  "Recorded outcome": "Aangetekende uitkoms",
  "No action text recorded": "Geen aksieteks aangeteken nie",
  "Outcome not recorded": "Uitkoms nie aangeteken nie",
  // Visit evidence log
  "Visit evidence log": "Besoekbewyslogboek",
  "Internal saved visit details for the authorised mentor and organisation, including original notes and any recorded location. Review named records and private observations before sharing a PDF.": "Interne gestoorde besoekbesonderhede vir die gemagtigde mentor en organisasie, insluitend oorspronklike notas en enige aangetekende ligging. Hersien benoemde rekords en private waarnemings voordat jy 'n PDF deel.",
  "Participant / site": "Deelnemer / terrein",
  "Support areas": "Ondersteuningsareas",
  "Saved visit evidence": "Gestoorde besoekbewyse",
  "Not classified": "Nie geklassifiseer nie",
  // Assignments and guidance
  "Assignments & organisation guidance": "Toewysings en organisasie se riglyne",
  "Current team guidance, separate from dated visit evidence. It is not a record of the guidance that existed at a past visit.": "Huidige riglyne vir die span, apart van gedateerde besoekbewyse. Dit is nie 'n rekord van die riglyne wat tydens 'n vorige besoek bestaan het nie.",
  "Service location / programme": "Dienspunt / program",
  "Recorded guidance": "Aangetekende riglyne",
  "No guidance recorded": "Geen riglyne aangeteken nie",
  // Support review
  "Support review": "Ondersteuningshersiening",
  "{visits} recorded visits reached {visited} of {assigned} currently assigned participants in this selection.": "{visits} aangetekende besoeke het {visited} van die {assigned} deelnemers wat tans in hierdie keuse toegewys is, bereik.",
  "{unvisited} current assignments have no recorded visit in this selection. {open} actions remain open, including {due} due or overdue.": "{unvisited} huidige toewysings het geen aangetekende besoek in hierdie keuse nie. {open} aksies bly oop, waarvan {due} se sperdatum bereik of verby is.",
  "Service delivery, observed skills and subsequent garden outcomes are separate evidence. This report does not infer employment attendance, payroll approval or livelihood impact.": "Dienslewering, waargenome vaardighede en daaropvolgende tuinuitkomste is aparte bewyse. Hierdie verslag lei nie werksbywoning, betaalstaatgoedkeuring of impak op lewensbestaan af nie.",
  // Scope
  "Programme focus: {programme}. Prepared {today}.": "Programfokus: {programme}. Voorberei op {today}.",
  "The participant denominator is current team membership; visit records use the selected date range. Past assignments may differ.": "Die deelnemernoemer is die huidige spanlidmaatskap; besoekrekords gebruik die gekose datumreeks. Vorige toewysings kan verskil.",
  "Actions and assignments use the latest available records as of {today}. This does not reconstruct their status at the end of a historical period.": "Aksies en toewysings gebruik die jongste beskikbare rekords vanaf {today}. Dit herskep nie hul status aan die einde van 'n historiese tydperk nie.",
  "DEMONSTRATION RECORDS: fictional field visits and illustrative results.": "DEMONSTRASIEREKORDS: fiktiewe veldbesoeke en illustratiewe resultate.",
  // Decisions
  "Decisions for the next visit": "Besluite vir die volgende besoek",
  "Review current assignments without a selected visit and agree which people need support first.": "Hersien huidige toewysings sonder 'n gekose besoek en kom ooreen watter mense eerste ondersteuning nodig het.",
  "Give open actions a responsible person and review date. Record the outcome when an action is completed.": "Gee oop aksies 'n verantwoordelike persoon en hersieningsdatum. Teken die uitkoms aan wanneer 'n aksie voltooi is.",
  "Check a named practical skill against an observed task. Record later application separately before claiming adoption.": "Toets 'n benoemde praktiese vaardigheid teen 'n waargenome taak. Teken latere toepassing apart aan voordat jy aanvaarding beweer.",
  "Keep private observations in the authorised team. A downloaded PDF does not inherit the app’s access controls.": "Hou private waarnemings binne die gemagtigde span. 'n Afgelaaide PDF erf nie die app se toegangsbeheer nie.",
  // Sources
  "Sources & evidence limits": "Bronne en bewysperke",
  "Source: saved records in this authorised field-team workspace. Other support may be unrecorded. Repeat visits and focus areas cannot be added as unique people or gardens.": "Bron: gestoorde rekords in hierdie gemagtigde veldspan-werkruimte. Ander ondersteuning kan onaangeteken wees. Herhaalde besoeke en fokusareas kan nie as unieke mense of tuine bymekaargetel word nie.",
  "Photograph coverage: {loaded} / {recorded} recorded. Photographs are included only when loaded and explicitly selected; counts do not verify a claim.": "Fotodekking: {loaded} / {recorded} aangeteken. Foto's word slegs ingesluit wanneer dit gelaai en uitdruklik gekies is; getalle bevestig nie 'n bewering nie.",
  "loaded count unavailable": "gelaaide getal nie beskikbaar nie",
  "{n} loaded for selection": "{n} vir keuse gelaai",
  "Training attendance, self-reported confidence and observed practical skills are separate evidence. Use the full report for saved visit details and organisation guidance.": "Opleidingsbywoning, selfgerapporteerde vertroue en waargenome praktiese vaardighede is aparte bewyse. Gebruik die volledige verslag vir gestoorde besoekbesonderhede en organisasie se riglyne.",
  "Source: saved records in this field-team workspace, filtered by participant and visit date. Work recorded in other systems is outside this report.": "Bron: gestoorde rekords in hierdie veldspan-werkruimte, gefiltreer volgens deelnemer en besoekdatum. Werk wat in ander stelsels aangeteken is, val buite hierdie verslag.",
  "Visit photographs are included only when loaded from their saved visit and explicitly selected. Photograph counts do not establish that a claim was verified.": "Besoekfoto's word slegs ingesluit wanneer dit vanaf hul gestoorde besoek gelaai en uitdruklik gekies is. Fotogetalle bewys nie dat 'n bewering geverifieer is nie.",
  "Photograph coverage: {loaded} / {recorded} recorded. Open the saved visits to load further photographs.": "Fotodekking: {loaded} / {recorded} aangeteken. Maak die gestoorde besoeke oop om meer foto's te laai.",
  "Several visits can concern one participant or one shared garden. Focus areas can overlap within a visit; adding focus counts does not produce a unique visit total.": "Verskeie besoeke kan een deelnemer of een gedeelde tuin betref. Fokusareas kan binne 'n besoek oorvleuel; die optel van fokusgetalle lewer nie 'n unieke besoektotaal nie.",
  "Training attendance and learner feedback belong in the facilitator delivery report. They do not substitute for an observed practical skill or a follow-up garden check.": "Opleidingsbywoning en leerderterugvoer hoort in die fasiliteerder se leweringsverslag. Dit vervang nie 'n waargenome praktiese vaardigheid of 'n opvolgtuinkontrole nie.",
  // Comparison with the preceding range
  "Historical fieldwork comparison": "Historiese veldwerkvergelyking",
  "Earlier {earlierFrom} to {earlierTo}; selected {from} to {to}. Equal numbers of calendar days. Current assignments and corrected visit records apply to both periods. This is delivery coverage, not a matched outcome comparison. Open/completed action status is current and is not compared historically. Zero recorded visits does not establish no support.": "Vroeër {earlierFrom} tot {earlierTo}; gekies {from} tot {to}. Gelyke getalle kalenderdae. Huidige toewysings en reggestelde besoekrekords geld vir albei tydperke. Dit is leweringsdekking, nie 'n gepaarde uitkomsvergelyking nie. Oop/voltooide aksiestatus is huidig en word nie histories vergelyk nie. Nul aangetekende besoeke bewys nie dat daar geen ondersteuning was nie.",
  "Saved visits": "Gestoorde besoeke",
  "Current assigned people visited": "Huidige toegewysde mense wat besoek is",
  // Chart
  "Support delivered by recorded focus": "Ondersteuning gelewer volgens aangetekende fokus",
  "A visit can cover several focus areas. These bars must not be added as unique visits.": "'n Besoek kan verskeie fokusareas dek. Hierdie stawe mag nie as unieke besoeke bymekaargetel word nie.",
  // The saved-visit lines (fieldVisitReportLines)
  "{date} | {farmer} | Mentor: {mentor}": "{date} | {farmer} | Mentor: {mentor}",
  "Site location: {location}": "Terreinligging: {location}",
  "Location: {latitude}, {longitude}": "Ligging: {latitude}, {longitude}",
  "Support areas: {areas}": "Ondersteuningsareas: {areas}",
  "Practical skill: {skill} | {result}": "Praktiese vaardigheid: {skill} | {result}",
  "Action completed: {date}": "Aksie voltooi: {date}",
  "Completion evidence: {evidence}": "Voltooiingsbewyse: {evidence}",
  "Support requested: {text}": "Ondersteuning aangevra: {text}",
  "Observations / issues: {text}": "Waarnemings / kwessies: {text}",
  "Visit notes: {text}": "Besoeknotas: {text}",
  "Original notes before AI cleanup: {text}": "Oorspronklike notas voor AI-opruiming: {text}",
  "Agreed action: {text}": "Ooreengekome aksie: {text}",
  "Responsible person: {name}": "Verantwoordelike persoon: {name}",
  "Not yet assigned": "Nog nie toegewys nie",
  "Follow-up: {date}": "Opvolg: {date}",
  "Not yet scheduled": "Nog nie geskeduleer nie",
  "Visit photos: {n}": "Besoekfoto's: {n}",
  // FIELD_FOCUS (lib/field-teams.ts), worded as the visit form's own tags are
  "Garden establishment & upkeep": "Tuinvestiging en -onderhoud",
  "Water access & repairs": "Watertoegang en herstelwerk",
  "Soil health & compost": "Grondgesondheid en kompos",
  "Seedlings & seed saving": "Saailinge en saadbewaring",
  "Crop care & protection": "Gewassorg en -beskerming",
  "Harvest & food distribution": "Oes en kosverspreiding",
  "Practical skills & coaching": "Praktiese vaardighede en afrigting",
  "Records & livelihood support": "Rekords en lewensbestaanondersteuning",
  // The single saved-visit report and the footer labels the screen gives the PDFs
  "Field visit report": "Veldbesoekverslag",
  "Visit details": "Besoekbesonderhede",
  "Visit photographs": "Besoekfoto's",
  "Visit photographs opened for this report": "Besoekfoto's wat vir hierdie verslag oopgemaak is",
  "Field support records": "Veldondersteuningsrekords",
};
export default drafts;
