import { MEL_STAGES, analyseAssessment, type MelAssessment, type MelResponse } from './mel';
import { MEL_TEMPLATES } from './mel-templates';

// Fictional assessment exercise, deliberately separate from the garden production
// ledgers: survey participation must never become hectares, harvests or revenue.
export function buildSampleAssessments() {
  return MEL_STAGES.map((stage, index) => {
    const draft = stage === 'closeout' || stage === 'app_closeout';
    const a: MelAssessment = {
      id: `sample-${stage}`, orgId: 'sample-ngo', project: 'Sample learning cohort',
      title: MEL_TEMPLATES[stage].en, stage, version: 1,
      participantIds: draft ? [] : Array.from({ length: 16 }, (_, i) => `sample-person-${i + 1}`),
      due: draft ? '2026-12-01' : index < 3 ? '2026-08-01' : '2026-09-30',
      state: draft ? 'draft' : index < 3 ? 'closed' : 'open',
      published: index === 0 || index === 2,
      createdAt: '2026-07-01', updatedAt: '2026-09-01', action: '', actionOwner: '', actionDue: '', actionDone: false,
    };
    const count = draft ? 0 : index < 3 ? 16 : 12;
    const rows: MelResponse[] = a.participantIds.slice(0, count).map((participantId, i) => ({
      assessmentId: a.id, participantId, orgId: a.orgId, version: 1, consent: true,
      language: i % 2 ? 'zu' : 'en', submittedAt: '2026-08-01',
      // Only skill/experience responses; no invented farming quantities or sales.
      answers: Object.fromEntries(MEL_TEMPLATES[stage].questions.filter(q => q.kind === 'choice').map(q => [q.id, q.options![i < count / 2 ? 0 : Math.min(1, q.options!.length - 1)].value])),
    }));
    return { assessment: a, rows };
  });
}
export type SampleProgrammeControls = {
  funderAccess: boolean; published: string[]; assessments?: ReturnType<typeof buildSampleAssessments>;
  people: { id: string; name: string; role: 'farmer' | 'student' | 'mentor' | 'ngo'; manage: boolean; analyse: boolean; people: boolean }[];
};
export function freshSampleProgramme(): SampleProgrammeControls {
  return { funderAccess: true, published: buildSampleAssessments().filter(x => x.assessment.published).map(x => x.assessment.id), people: [
    { id: 'sample-mentor', name: 'Sample mentor', role: 'mentor', manage: true, analyse: false, people: false },
    { id: 'sample-farmer', name: 'Sample farmer', role: 'farmer', manage: false, analyse: false, people: false },
    { id: 'sample-student', name: 'Sample student', role: 'student', manage: false, analyse: false, people: false },
  ] };
}
export function samplePublishedAssessments(controls: SampleProgrammeControls) {
  if (!controls.funderAccess) return [];
  return sampleAssessments(controls).filter(x => x.assessment.state === 'closed' && controls.published.includes(x.assessment.id)).map(x => ({ ...x.assessment, ...analyseAssessment(x.assessment, MEL_TEMPLATES[x.assessment.stage], x.rows, true) }));
}

export function sampleAssessments(controls: SampleProgrammeControls) {
  return controls.assessments ?? buildSampleAssessments();
}
export function changeSampleAssessment(controls: SampleProgrammeControls, id: string, patch: Partial<MelAssessment>): SampleProgrammeControls {
  const data = sampleAssessments(controls);
  const found = data.find(x => x.assessment.id === id);
  if (!found) throw Error('Sample assessment not found.');
  if (patch.state === 'open' && found.assessment.state !== 'draft') throw Error('Only a draft can be opened.');
  if (patch.state === 'closed' && found.assessment.state !== 'open') throw Error('Only an open assessment can be closed.');
  if (patch.state === 'open' && !patch.participantIds?.length) throw Error('Choose participants first.');
  return { ...controls, assessments: data.map(x => x.assessment.id === id ? { ...x, assessment: { ...x.assessment, ...patch, id, updatedAt: new Date().toISOString() } } : x) };
}
