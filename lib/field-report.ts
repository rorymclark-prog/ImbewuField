import { FIELD_FOCUS, fieldFocusLabel, fieldProgrammeLabel, fieldSkillResultLabel, fieldVisitReportLines, summariseFieldWork, type FieldFocus, type FieldWorkspace } from './field-teams';
import type { ReportChart, ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';
import { previousReportDateRange } from './programme-report';
import { inlineTemplate } from './xh-inline';

export function buildFieldReport(data: FieldWorkspace, options: { from?: string; to?: string; farmerId?: string; today: string; organisation?: boolean; loadedPhotoCount?: number; comparePrevious?: boolean; language?: string }) {
  if (data.visitCursor) throw Error('Load the complete authorised visit history before creating a field report.');
  const { from = '', to = '', farmerId = '', today } = options;
  const lang = options.language ?? 'en';
  /** A fixed sentence or label in the reader's language ('xh' reads lib/locales/xh-inline/g47-field-report.ts); English and every other language are the original text, byte for byte. Names, codes, figures, dates and recorded text stay as recorded. */
  const t = (english: string, vars: Record<string, string | number> = {}) => inlineTemplate(lang, english, null, vars);
  const summary = summariseFieldWork(data, from, to, farmerId, today);
  const openActions = [...summary.open].sort((a, b) => (a.followUpDate || '9999').localeCompare(b.followUpDate || '9999') || a.date.localeCompare(b.date));
  const recordedPhotos = summary.visits.reduce((count, visit) => count + (visit.photoCount ?? visit.photos?.length ?? 0), 0);
  const name = (id: string) => data.people.find(person => person.id === id)?.name || t('Former team member');
  const garden = (id: string) => data.people.find(person => person.id === id)?.gardenName || t('Site not recorded');
  const programme = [...new Set(data.teams.filter(team => !farmerId || team.farmerIds.includes(farmerId)).map(team => fieldProgrammeLabel(team.programme || 'general', lang)))].join(' / ') || t('Garden mentoring');
  const scope = `${farmerId ? name(farmerId) : t('All authorised participants')} · ${t('{from} to {to}', { from: from || t('first recorded visit'), to: to || t('latest recorded visit') })}`;
  const metrics: ReportMetric[] = [
    { label: t('Visits recorded'), value: String(summary.visits.length), detail: t('Completed visit records in this selection') },
    { label: t('Assigned people visited'), value: `${summary.visited} / ${summary.assigned.length}`, detail: t('Current assignments; not unique garden sites') },
    { label: t('Open actions'), value: String(summary.open.length), detail: t('{n} due or overdue as of {today}', { n: summary.due.length, today }) },
    { label: t('Completed actions'), value: String(summary.completed.length), detail: t('Latest status of actions from these visits') },
  ];
  const tables: ReportTable[] = [
    { title: t('Support coverage'), note: t('Currently assigned participants, with visits inside the selected period. No recorded visit does not establish that no support happened elsewhere.'), columns: [t('Participant'), t('Garden / site'), t('Visits'), t('Latest selected visit')], columnWeights: [1.3, 1.5, .6, 1], rows: summary.assigned.map(id => {
      const visits = summary.visits.filter(visit => visit.farmerId === id);
      return [name(id), garden(id), String(visits.length), visits[0]?.date || t('No visit in selection')];
    }) },
    { title: t('Open follow-up actions'), note: t('Actions arising from visits in this selection, at their latest recorded status on {today}, earliest due dates first. Earlier visits outside the filter may have other open actions.', { today }), columns: [t('Participant'), t('Agreed action'), t('Responsible person'), t('Due / review'), t('Status')], columnWeights: [1.2, 2.3, 1.1, 1, 1], rows: openActions.map(visit => [name(visit.farmerId), visit.agreedAction!, visit.responsiblePerson || t('Owner needed'), visit.followUpDate || t('Date needed'), !visit.followUpDate ? t('Not scheduled') : visit.followUpDate < today ? t('Overdue') : visit.followUpDate === today ? t('Due today') : t('Scheduled')]) },
    { title: t('Recorded practical-skill observations'), note: t('Each row is an observation during a visit. Repeat checks are not new people or proof of sustained adoption. Self-reported course confidence is a separate source.'), columns: [t('Visit date'), t('Participant'), t('Practical skill'), t('Recorded observation')], rows: summary.visits.filter(visit => visit.practicalSkill?.trim()).map(visit => [visit.date, name(visit.farmerId), visit.practicalSkill!, fieldSkillResultLabel(visit.skillResult, lang)]) },
    { title: t('Completed support actions'), note: t('Latest completion dates may fall after the selected visit period. This is a current status review, not a historical action snapshot.'), columns: [t('Participant'), t('Action'), t('Completed'), t('Recorded outcome')], rows: summary.completed.map(visit => [name(visit.farmerId), visit.agreedAction || t('No action text recorded'), visit.actionCompletedOn!, visit.actionOutcome || t('Outcome not recorded')]) },
    { title: t('Visit evidence log'), note: t('Internal saved visit details for the authorised mentor and organisation, including original notes and any recorded location. Review named records and private observations before sharing a PDF.'), columns: [t('Date'), t('Participant / site'), t('Support areas'), t('Saved visit evidence')], columnWeights: [.8, 1.2, 1, 2.8], rows: summary.visits.map(visit => [visit.date, `${name(visit.farmerId)} · ${garden(visit.farmerId)}`, (visit.focus || []).map(focus => fieldFocusLabel(focus, lang)).join('; ') || t('Not classified'), fieldVisitReportLines(visit, name(visit.farmerId), name(visit.mentorId), lang).join('\n')]), includeInSummary: false },
    { title: t('Assignments & organisation guidance'), note: t('Current team guidance, separate from dated visit evidence. It is not a record of the guidance that existed at a past visit.'), columns: [t('Mentor'), t('Service location / programme'), t('Recorded guidance')], rows: data.teams.filter(team => !farmerId || team.farmerIds.includes(farmerId)).map(team => [name(team.mentorId), `${team.location} · ${fieldProgrammeLabel(team.programme || 'general', lang)}`, team.guidance || t('No guidance recorded')]), includeInSummary: false },
  ];
  const photoCoverage = options.loadedPhotoCount === undefined ? t('loaded count unavailable') : t('{n} loaded for selection', { n: options.loadedPhotoCount });
  const sections: ReportSection[] = [
    { title: t('Support review'), lines: [
      t('{visits} recorded visits reached {visited} of {assigned} currently assigned participants in this selection.', { visits: summary.visits.length, visited: summary.visited, assigned: summary.assigned.length }),
      t('{unvisited} current assignments have no recorded visit in this selection. {open} actions remain open, including {due} due or overdue.', { unvisited: summary.unvisited, open: summary.open.length, due: summary.due.length }),
      t('Service delivery, observed skills and subsequent garden outcomes are separate evidence. This report does not infer employment attendance, payroll approval or livelihood impact.'),
    ] },
    { title: t('Scope & reporting basis'), lines: [scope, t('Programme focus: {programme}. Prepared {today}.', { programme, today }),
      t('The participant denominator is current team membership; visit records use the selected date range. Past assignments may differ.'),
      t('Actions and assignments use the latest available records as of {today}. This does not reconstruct their status at the end of a historical period.', { today }),
      ...(data.sample ? [t('DEMONSTRATION RECORDS: fictional field visits and illustrative results.')] : []),
    ] },
    { title: t('Decisions for the next visit'), lines: [
      t('Review current assignments without a selected visit and agree which people need support first.'),
      t('Give open actions a responsible person and review date. Record the outcome when an action is completed.'),
      t('Check a named practical skill against an observed task. Record later application separately before claiming adoption.'),
      t('Keep private observations in the authorised team. A downloaded PDF does not inherit the app’s access controls.'),
    ] },
    { title: t('Sources & evidence limits'), summaryLines: [
      t('Source: saved records in this authorised field-team workspace. Other support may be unrecorded. Repeat visits and focus areas cannot be added as unique people or gardens.'),
      t('Photograph coverage: {loaded} / {recorded} recorded. Photographs are included only when loaded and explicitly selected; counts do not verify a claim.', { loaded: photoCoverage, recorded: recordedPhotos }),
      t('Training attendance, self-reported confidence and observed practical skills are separate evidence. Use the full report for saved visit details and organisation guidance.'),
    ], lines: [
      t('Source: saved records in this field-team workspace, filtered by participant and visit date. Work recorded in other systems is outside this report.'),
      t('Visit photographs are included only when loaded from their saved visit and explicitly selected. Photograph counts do not establish that a claim was verified.'),
      t('Photograph coverage: {loaded} / {recorded} recorded. Open the saved visits to load further photographs.', { loaded: photoCoverage, recorded: recordedPhotos }),
      t('Several visits can concern one participant or one shared garden. Focus areas can overlap within a visit; adding focus counts does not produce a unique visit total.'),
      t('Training attendance and learner feedback belong in the facilitator delivery report. They do not substitute for an observed practical skill or a follow-up garden check.'),
    ] },
  ];
  const earlier=options.comparePrevious?previousReportDateRange(from,to):null;
  if(earlier){
    const before=summariseFieldWork(data,earlier.from,earlier.to,farmerId,today);
    tables.unshift({title:t('Historical fieldwork comparison'),keepAllRowsInSummary:true,note:t('Earlier {earlierFrom} to {earlierTo}; selected {from} to {to}. Equal numbers of calendar days. Current assignments and corrected visit records apply to both periods. This is delivery coverage, not a matched outcome comparison. Open/completed action status is current and is not compared historically. Zero recorded visits does not establish no support.',{earlierFrom:earlier.from,earlierTo:earlier.to,from,to}),columns:[t('Recorded measure'),t('Earlier period'),t('Selected period'),t('Recorded change')],rows:[[t('Saved visits'),before.visits.length,summary.visits.length],[t('Current assigned people visited'),before.visited,summary.visited]].map(([label,b,a])=>[String(label),String(b),String(a),`${Number(a)-Number(b)>0?'+':''}${Number(a)-Number(b)}`])});
  }
  // summariseFieldWork words each bar with the English FIELD_FOCUS label; the same label in the reader's language.
  const focusKeys = Object.keys(FIELD_FOCUS) as FieldFocus[];
  const chart: ReportChart | undefined = summary.focus.length ? { title: t('Support delivered by recorded focus'), note: t('A visit can cover several focus areas. These bars must not be added as unique visits.'), rows: summary.focus.map(row => { const key = focusKeys.find(candidate => FIELD_FOCUS[candidate] === row.label); return key ? { ...row, label: fieldFocusLabel(key, lang) } : row; }) } : undefined;
  return { title: options.organisation ? t('Field implementation report') : t('Mentor field report'), scope, metrics, tables, sections, chart,
    filename: `ImbewuField-${options.organisation ? 'field-implementation' : 'mentor-field'}-${from || 'all'}-${to || today}-${farmerId ? 'selected-participant' : 'all-participants'}${earlier?'-compared':''}` };
}
