import { trainingTotals, trainingFeedbackSummary, trainingEvidenceSummary, type TrainingRecord } from './programme-evidence';
import type { MelMetric } from './mel';
import type { ReportMetric, ReportSection, ReportTable } from './programme-report-pdf';
import { previousReportDateRange } from './programme-report';
import { inlineText, inlineTemplate } from './xh-inline';

export function buildTrainingReport(input: readonly TrainingRecord[], options: { project?: string; ownerId?: string; from?: string; to?: string; today: string; assessments?: { id: string; title: string }[]; comparePrevious?: boolean; language?: string }) {
  const { project = '', ownerId = '', from = '', to = '', today } = options;
  const lang = options.language ?? 'en';
  /** A fixed sentence or label in the reader's language ('xh' reads lib/locales/xh-inline/g46-staff-reports.ts, 'af' lib/locales/af-inline/g48-staff-reports.ts); English and every other language are the original text, byte for byte. Names, figures, dates and recorded text stay as recorded. */
  const t = (english: string, vars: Record<string, string | number> = {}) => inlineTemplate(lang, english, null, vars);
  /** A fixed word from the data (a survey question or answer option): its isiXhosa or Afrikaans draft, else as given. */
  const tr = (text: string) => inlineText(lang, text);
  const sessions = [...new Map(input.map(session => [session.id, session])).values()].filter(session => (!project || session.project === project) && (!ownerId || session.ownerId === ownerId) && (!from || session.date >= from) && (!to || session.date <= to) && session.date <= today).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const totals = trainingTotals(sessions, today);
  const stableLearners = new Set(sessions.flatMap(session => session.attendance.filter(person => person.present && !person.id.startsWith('guest-')).map(person => person.id)));
  const guestAttendances = sessions.reduce((count, session) => count + session.attendance.filter(person => person.present && person.id.startsWith('guest-')).length, 0);
  const feedback = sessions.map(session => ({ session, summary: trainingFeedbackSummary(session) }));
  const feedbackCompleted = feedback.reduce((count, row) => count + row.summary.completed, 0), feedbackAssigned = feedback.reduce((count, row) => count + row.summary.assigned, 0);
  const registered = sessions.reduce((count, session) => count + session.registeredCount, 0);
  const metricGroups = new Map<string, { metric: MelMetric; count: number; choices: Map<string, { label: string; count: number }> }>();
  for (const row of feedback) for (const metric of row.summary.metrics) {
    const group = metricGroups.get(metric.id) || { metric, count: 0, choices: new Map() };
    group.count += metric.n;
    for (const choice of metric.choices || []) { const previous = group.choices.get(choice.value); group.choices.set(choice.value, { label: choice.en, count: (previous?.count || 0) + choice.count }); }
    metricGroups.set(metric.id, group);
  }
  const metrics: ReportMetric[] = [
    { label: t('Sessions recorded'), value: String(sessions.length), detail: t('Saved sessions in this selection') },
    { label: t('Attendances'), value: String(totals.attendances), detail: t('{n} registered session places; repeats included', { n: registered }) },
    { label: t('Identified learners'), value: String(stableLearners.size), detail: t('{n} guest attendances counted separately', { n: guestAttendances }) },
    { label: t('Session feedback'), value: `${feedbackCompleted} / ${feedbackAssigned}`, detail: t('Responses / eligible present register entries; repeats included') },
  ];
  const notRecorded = t('Not recorded');
  const tables: ReportTable[] = [
    { title: t('Session delivery'), note: t('One row per saved session. Facilitator names are recorded text; they are not verified staff identities. Present / registered describes session places, not unique learners.'), columns: [t('Date'), t('Session / project'), t('Facilitator'), t('Present / registered'), t('Feedback responses')], columnWeights: [1, 2, 1.3, 1.1, 1.2], rows: sessions.map(session => [session.date, `${session.title} · ${session.project}`, session.facilitator || notRecorded, `${session.presentCount} / ${session.registeredCount}`, `${trainingFeedbackSummary(session).completed} / ${trainingFeedbackSummary(session).assigned}`]) },
    { title: t('Participant feedback'), note: t('Counts are session responses to the existing feedback questions. The same learner can respond after several sessions. Written feedback is excluded from this default aggregate export. This is experience feedback, not a skills test.'), columns: [t('Question'), t('Recorded responses'), t('Answered / eligible'), t('No answer')], columnWeights: [2.1, 2.6, 1.1, 1], rows: [...metricGroups.values()].map(group => [tr(group.metric.en), group.count ? [...group.choices.values()].filter(choice => choice.count > 0).map(choice => `${tr(choice.label)}: ${choice.count}`).join('; ') || t('No distribution available') : t('No responses'), `${group.count} / ${feedbackAssigned}`, String(Math.max(0, feedbackAssigned - group.count))]) },
    { title: t('Evidence coverage'), note: t('Signatures and certificates relate to attendance. They do not establish assessed competence or qualification. Photograph counts do not establish consent to share an image.'), columns: [t('Session'), t('Signed / present'), t('Attendance certificates'), t('Recorded photos')], rows: sessions.map(session => { const evidence = trainingEvidenceSummary(session); return [session.title, `${evidence.signed} / ${session.presentCount}`, String(evidence.certificates), String(session.photoCount)]; }) },
    { title: t('Assessment links & follow-up'), note: t('A link identifies where to review assessment evidence; it does not merge the assessment population with these session totals. Follow-up notes are as recorded and have no inferred owner or due date.'), columns: [t('Session'), t('Linked assessment'), t('Recorded next steps')], rows: sessions.map(session => [session.title, session.assessmentId ? options.assessments?.find(assessment => assessment.id === session.assessmentId)?.title || t('Linked assessment · title unavailable') : t('No link recorded'), session.nextSteps || t('No next step recorded')]) },
    { title: t('Session narrative evidence'), note: t('Saved session summaries. These are reports by the delivery team, not independent verification.'), columns: [t('Date'), t('Session'), t('Recorded summary')], rows: sessions.map(session => [session.date, session.title, session.report || notRecorded]), includeInSummary: false },
  ];
  const scope = `${project || t('All visible projects')} · ${t('{from} to {to}', { from: from || t('first saved session'), to: to || today })}`;
  const sections: ReportSection[] = [
    { title: t('Delivery review'), lines: [
      t('{sessions} saved sessions record {attendances} attendances across {registered} registered session places. A repeat attendance is another session place, not a new learner.', { sessions: sessions.length, attendances: totals.attendances, registered }),
      t('{learners} distinct registered participant IDs are represented. {guests} guest attendances are excluded from that unique-learner count because their identity across sessions is not established.', { learners: stableLearners.size, guests: guestAttendances }),
      t('{completed} session feedback responses are available for {assigned} eligible present register entries. The report does not turn satisfaction or a certificate of attendance into demonstrated competence.', { completed: feedbackCompleted, assigned: feedbackAssigned }),
    ] },
    { title: t('Scope & reporting basis'), lines: [scope, t('Prepared {today} from saved records. Unsaved session edits are excluded.', { today }),
      ownerId ? t('Session records are restricted to the selected record-owning account. A typed facilitator name is not used to infer ownership.') : t('All record-owning accounts represented in the authorised session source are included.'),
      t('This is an internal facilitator delivery report. Named registers, signatures, contact details and written participant feedback are excluded from this aggregate export.'),
      t('Registration and attendance are session measures. Completion of a multi-session course needs its own agreed requirements and evidence.'),
    ] },
    { title: t('Learning, application & next decisions'), lines: [
      t('Review the existing before/after assessments using matched consenting participants. Separate reported confidence from observed practical performance.'),
      t('Use mentor skill observations and later garden checks to establish application. Intending to try a practice after training does not establish that it was adopted.'),
      t('Agree an owner, review date and evidence of completion for follow-up actions in the programme action or visit register.'),
      t('Use feedback about explanation, practice and language to decide what to change in the next session. Record whether that change helped.'),
    ] },
    { title: t('Sources & method'), lines: [
      t('Source: saved training records available to the current account. Session dates set the reporting period. Published and internal records are not interchangeable access scopes.'),
      t('Registered participant IDs are deduplicated across selected sessions. Guest attendances are reported separately; a guest name or code does not prove a unique person across sessions.'),
      t('Feedback uses the existing instrument and consenting responses from present participants. Several responses from one learner across sessions remain several session responses.'),
      t('Attendance, course progress, self-reported learning, observed competence and sustained application are distinct evidence. This report makes no attribution or household-impact claim.'),
    ], references: [{ label: 'FAO · Monitoring, evaluation and learning in farmer field school programmes', url: 'https://www.fao.org/family-farming/detail/en/c/1637407/' }] },
  ];
  const counts={sessions:sessions.length,attendances:totals.attendances,learners:stableLearners.size};
  const earlier=options.comparePrevious?previousReportDateRange(from,to):null;
  if(earlier){
    const before=buildTrainingReport(input,{...options,from:earlier.from,to:earlier.to,comparePrevious:false});
    const labels=[['Sessions recorded','sessions'],['Attendances','attendances'],['Identified learners','learners']] as const;
    tables.unshift({title:t('Historical training delivery comparison'),keepAllRowsInSummary:true,note:t('Earlier {earlierFrom} to {earlierTo}; selected {from} to {to}. Equal numbers of calendar days, using saved records and the same project/record-owner filters. Period populations may differ. Repeated attendances and guest entries are not new identified learners. Recorded zeros do not establish no delivery. This is not a competence or impact comparison.',{earlierFrom:earlier.from,earlierTo:earlier.to,from,to}),columns:[t('Recorded measure'),t('Earlier period'),t('Selected period'),t('Recorded change')],rows:labels.map(([label,key])=>{const b=before.counts[key],a=counts[key];return [tr(label),String(b),String(a),`${a-b>0?'+':''}${a-b}`];})});
  }
  return { title: t('Facilitator delivery report'), scope, counts, sessions: sessions.map(session => ({ date: session.date, title: session.title, project: session.project })), metrics, tables, sections, filename: `ImbewuField-facilitator-delivery-${from || 'all'}-${to || today}-${ownerId ? 'selected-owner' : 'all-owners'}${earlier?'-compared':''}` };
}
