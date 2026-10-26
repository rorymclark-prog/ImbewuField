import { FIELD_FOCUS, FIELD_PROGRAMMES, fieldVisitReportLines, summariseFieldWork, type FieldWorkspace } from './field-teams';
import type { ReportChart, ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';
import { previousReportDateRange } from './programme-report';

export function buildFieldReport(data: FieldWorkspace, options: { from?: string; to?: string; farmerId?: string; today: string; organisation?: boolean; loadedPhotoCount?: number; comparePrevious?: boolean }) {
  if (data.visitCursor) throw Error('Load the complete authorised visit history before creating a field report.');
  const { from = '', to = '', farmerId = '', today } = options;
  const summary = summariseFieldWork(data, from, to, farmerId, today);
  const openActions = [...summary.open].sort((a, b) => (a.followUpDate || '9999').localeCompare(b.followUpDate || '9999') || a.date.localeCompare(b.date));
  const recordedPhotos = summary.visits.reduce((count, visit) => count + (visit.photoCount ?? visit.photos?.length ?? 0), 0);
  const name = (id: string) => data.people.find(person => person.id === id)?.name || 'Former team member';
  const garden = (id: string) => data.people.find(person => person.id === id)?.gardenName || 'Site not recorded';
  const programme = [...new Set(data.teams.filter(team => !farmerId || team.farmerIds.includes(farmerId)).map(team => FIELD_PROGRAMMES[team.programme || 'general']))].join(' / ') || 'Garden mentoring';
  const scope = `${farmerId ? name(farmerId) : 'All authorised participants'} · ${from || 'first recorded visit'} to ${to || 'latest recorded visit'}`;
  const metrics: ReportMetric[] = [
    { label: 'Visits recorded', value: String(summary.visits.length), detail: 'Completed visit records in this selection' },
    { label: 'Assigned people visited', value: `${summary.visited} / ${summary.assigned.length}`, detail: 'Current assignments; not unique garden sites' },
    { label: 'Open actions', value: String(summary.open.length), detail: `${summary.due.length} due or overdue as of ${today}` },
    { label: 'Completed actions', value: String(summary.completed.length), detail: 'Latest status of actions from these visits' },
  ];
  const tables: ReportTable[] = [
    { title: 'Support coverage', note: 'Currently assigned participants, with visits inside the selected period. No recorded visit does not establish that no support happened elsewhere.', columns: ['Participant', 'Garden / site', 'Visits', 'Latest selected visit'], columnWeights: [1.3, 1.5, .6, 1], rows: summary.assigned.map(id => {
      const visits = summary.visits.filter(visit => visit.farmerId === id);
      return [name(id), garden(id), String(visits.length), visits[0]?.date || 'No visit in selection'];
    }) },
    { title: 'Open follow-up actions', note: `Actions arising from visits in this selection, at their latest recorded status on ${today}, earliest due dates first. Earlier visits outside the filter may have other open actions.`, columns: ['Participant', 'Agreed action', 'Responsible person', 'Due / review', 'Status'], columnWeights: [1.2, 2.3, 1.1, 1, 1], rows: openActions.map(visit => [name(visit.farmerId), visit.agreedAction!, visit.responsiblePerson || 'Owner needed', visit.followUpDate || 'Date needed', !visit.followUpDate ? 'Not scheduled' : visit.followUpDate < today ? 'Overdue' : visit.followUpDate === today ? 'Due today' : 'Scheduled']) },
    { title: 'Recorded practical-skill observations', note: 'Each row is an observation during a visit. Repeat checks are not new people or proof of sustained adoption. Self-reported course confidence is a separate source.', columns: ['Visit date', 'Participant', 'Practical skill', 'Recorded observation'], rows: summary.visits.filter(visit => visit.practicalSkill?.trim()).map(visit => [visit.date, name(visit.farmerId), visit.practicalSkill!, visit.skillResult === 'demonstrated' ? 'Demonstrated during this visit' : visit.skillResult === 'needs-support' ? 'Needs further support' : 'Not assessed']) },
    { title: 'Completed support actions', note: 'Latest completion dates may fall after the selected visit period. This is a current status review, not a historical action snapshot.', columns: ['Participant', 'Action', 'Completed', 'Recorded outcome'], rows: summary.completed.map(visit => [name(visit.farmerId), visit.agreedAction || 'No action text recorded', visit.actionCompletedOn!, visit.actionOutcome || 'Outcome not recorded']) },
    { title: 'Visit evidence log', note: 'Internal saved visit details for the authorised mentor and organisation, including original notes and any recorded location. Review named records and private observations before sharing a PDF.', columns: ['Date', 'Participant / site', 'Support areas', 'Saved visit evidence'], columnWeights: [.8, 1.2, 1, 2.8], rows: summary.visits.map(visit => [visit.date, `${name(visit.farmerId)} · ${garden(visit.farmerId)}`, (visit.focus || []).map(focus => FIELD_FOCUS[focus]).join('; ') || 'Not classified', fieldVisitReportLines(visit, name(visit.farmerId), name(visit.mentorId)).join('\n')]), includeInSummary: false },
    { title: 'Assignments & organisation guidance', note: 'Current team guidance, separate from dated visit evidence. It is not a record of the guidance that existed at a past visit.', columns: ['Mentor', 'Service location / programme', 'Recorded guidance'], rows: data.teams.filter(team => !farmerId || team.farmerIds.includes(farmerId)).map(team => [name(team.mentorId), `${team.location} · ${FIELD_PROGRAMMES[team.programme || 'general']}`, team.guidance || 'No guidance recorded']), includeInSummary: false },
  ];
  const sections: ReportSection[] = [
    { title: 'Support review', lines: [
      `${summary.visits.length} recorded visits reached ${summary.visited} of ${summary.assigned.length} currently assigned participants in this selection.`,
      `${summary.unvisited} current assignments have no recorded visit in this selection. ${summary.open.length} actions remain open, including ${summary.due.length} due or overdue.`,
      'Service delivery, observed skills and subsequent garden outcomes are separate evidence. This report does not infer employment attendance, payroll approval or livelihood impact.',
    ] },
    { title: 'Scope & reporting basis', lines: [scope, `Programme focus: ${programme}. Prepared ${today}.`,
      'The participant denominator is current team membership; visit records use the selected date range. Past assignments may differ.',
      `Actions and assignments use the latest available records as of ${today}. This does not reconstruct their status at the end of a historical period.`,
      ...(data.sample ? ['DEMONSTRATION RECORDS: fictional field visits and illustrative results.'] : []),
    ] },
    { title: 'Decisions for the next visit', lines: [
      'Review current assignments without a selected visit and agree which people need support first.',
      'Give open actions a responsible person and review date. Record the outcome when an action is completed.',
      'Check a named practical skill against an observed task. Record later application separately before claiming adoption.',
      'Keep private observations in the authorised team. A downloaded PDF does not inherit the app’s access controls.',
    ] },
    { title: 'Sources & evidence limits', summaryLines: [
      'Source: saved records in this authorised field-team workspace. Other support may be unrecorded. Repeat visits and focus areas cannot be added as unique people or gardens.',
      `Photograph coverage: ${options.loadedPhotoCount === undefined ? 'loaded count unavailable' : `${options.loadedPhotoCount} loaded for selection`} / ${recordedPhotos} recorded. Photographs are included only when loaded and explicitly selected; counts do not verify a claim.`,
      'Training attendance, self-reported confidence and observed practical skills are separate evidence. Use the full report for saved visit details and organisation guidance.',
    ], lines: [
      'Source: saved records in this field-team workspace, filtered by participant and visit date. Work recorded in other systems is outside this report.',
      'Visit photographs are included only when loaded from their saved visit and explicitly selected. Photograph counts do not establish that a claim was verified.',
      `Photograph coverage: ${options.loadedPhotoCount === undefined ? 'loaded count unavailable' : `${options.loadedPhotoCount} loaded for selection`} / ${recordedPhotos} recorded. Open the saved visits to load further photographs.`,
      'Several visits can concern one participant or one shared garden. Focus areas can overlap within a visit; adding focus counts does not produce a unique visit total.',
      'Training attendance and learner feedback belong in the facilitator delivery report. They do not substitute for an observed practical skill or a follow-up garden check.',
    ] },
  ];
  const earlier=options.comparePrevious?previousReportDateRange(from,to):null;
  if(earlier){
    const before=summariseFieldWork(data,earlier.from,earlier.to,farmerId,today);
    tables.unshift({title:'Historical fieldwork comparison',keepAllRowsInSummary:true,note:`Earlier ${earlier.from} to ${earlier.to}; selected ${from} to ${to}. Equal numbers of calendar days. Current assignments and corrected visit records apply to both periods. This is delivery coverage, not a matched outcome comparison. Open/completed action status is current and is not compared historically. Zero recorded visits does not establish no support.`,columns:['Recorded measure','Earlier period','Selected period','Recorded change'],rows:[['Saved visits',before.visits.length,summary.visits.length],['Current assigned people visited',before.visited,summary.visited]].map(([label,b,a])=>[String(label),String(b),String(a),`${Number(a)-Number(b)>0?'+':''}${Number(a)-Number(b)}`])});
  }
  const chart: ReportChart | undefined = summary.focus.length ? { title: 'Support delivered by recorded focus', note: 'A visit can cover several focus areas. These bars must not be added as unique visits.', rows: summary.focus } : undefined;
  return { title: options.organisation ? 'Field implementation report' : 'Mentor field report', scope, metrics, tables, sections, chart,
    filename: `ImbewuField-${options.organisation ? 'field-implementation' : 'mentor-field'}-${from || 'all'}-${to || today}-${farmerId ? 'selected-participant' : 'all-participants'}${earlier?'-compared':''}` };
}
