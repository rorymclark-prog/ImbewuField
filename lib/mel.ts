import type { UserRole } from './db/types';

export const MEL_STAGES = ['baseline', 'course_before', 'course_after', 'midpoint', 'closeout', 'app_midpoint', 'app_closeout'] as const;
export type MelStage = typeof MEL_STAGES[number];
export type MelQuestion = { id: string; en: string; zu: string; kind: 'choice' | 'number' | 'text'; options?: { value: string; en: string; zu: string }[]; max?: number; private?: boolean };
export type MelTemplate = { version: 1; stage: MelStage; en: string; zu: string; timing: string; questions: MelQuestion[] };
export type MelAssessment = { id: string; orgId: string; project: string; title: string; stage: MelStage; version: 1; participantIds: string[]; due: string; state: 'draft' | 'open' | 'closed'; published: boolean; createdAt: string; updatedAt: string; action: string; actionOwner: string; actionDue: string; actionDone: boolean };
export type MelResponse = { assessmentId: string; participantId: string; orgId: string; version: 1; answers: Record<string, string>; language: 'en' | 'zu'; submittedAt: string; consent: true };
export type MelPermission = { manage?: boolean; analyse?: boolean; people?: boolean; training?: boolean };
export type OrgControls = { funderAccess?: boolean };

export function melCan(role: UserRole, permission: MelPermission | null, action: keyof MelPermission) {
  if (role === 'admin') return true;
  if (role !== 'ngo' && role !== 'mentor') return false;
  return permission?.[action] ?? role === 'ngo';
}

// Use the same effective capabilities in the service and access inspector. Stored
// checkboxes alone are misleading after a member changes from staff to farmer.
export function programmeCapabilities(role: UserRole, permission: MelPermission | null) {
  const organisation = role === 'ngo' || role === 'admin';
  const manage = organisation && melCan(role, permission, 'manage');
  const brand = organisation && melCan(role, permission, 'people');
  const record = melCan(role, permission, 'training');
  const analyse = melCan(role, permission, 'analyse');
  return { manage, brand, record, analyse, read: record || analyse };
}

export function memberAccessSummary(role: UserRole, permission: MelPermission | null) {
  const evidence = programmeCapabilities(role, permission);
  return [
    { id: 'manage', label: 'Create and manage assessments', allowed: melCan(role, permission, 'manage') },
    { id: 'analyse', label: 'Read private assessment analysis', allowed: evidence.analyse },
    { id: 'training', label: 'Record training and attendance', allowed: evidence.record },
    { id: 'evidence', label: 'Read training evidence', allowed: evidence.read },
    { id: 'publish', label: 'Manage milestones and approve training for funders', allowed: evidence.manage && (evidence.read || evidence.brand) },
    { id: 'people', label: 'Manage people and mentor assignments', allowed: evidence.brand },
    { id: 'branding', label: 'Edit organisation names and logos', allowed: evidence.brand },
    { id: 'visits', label: 'Record visits for assigned farmers', allowed: role === 'mentor' },
  ];
}

// A tenant can delegate its own work. Platform administration, funder identities and
// moving people between tenants remain outside the tenant's authority.
export function canChangeOrgRole(actor: { id: string; role: UserRole; orgId: string | null }, target: { id: string; role: UserRole; orgId: string | null }, next: UserRole) {
  return (actor.role === 'ngo' || actor.role === 'admin') && !!actor.orgId && actor.orgId === target.orgId && actor.id !== target.id
    && ['farmer', 'student', 'mentor', 'ngo'].includes(target.role)
    && ['farmer', 'student', 'mentor', 'ngo'].includes(next);
}

export function validAnswers(template: MelTemplate, input: unknown): input is Record<string, string> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const entries = Object.entries(input);
  if (!entries.length || entries.length > template.questions.length) return false;
  return entries.every(([id, value]) => {
    const q = template.questions.find(q => q.id === id);
    if (!q || typeof value !== 'string' || value.length > 1200) return false;
    // Skipping is allowed. Missing answers are never converted to zero or disagreement.
    if (!value.trim()) return true;
    if (q.kind === 'choice') return q.options?.some(o => o.value === value) ?? false;
    if (q.kind === 'number') return /^(?:\d+\.?\d*|\.\d+)$/.test(value) && Number.isFinite(+value) && +value >= 0 && +value <= (q.max ?? 10000000);
    return true;
  });
}

export type MelMetric = { id: string; en: string; zu: string; n: number; missing: number; mean?: number; choices?: { value: string; en: string; zu: string; count: number }[]; suppressed?: boolean };
export function analyseAssessment(a: MelAssessment, template: MelTemplate, input: readonly MelResponse[], funder = false) {
  const eligible = new Set(a.participantIds);
  const unique = new Map<string, MelResponse>();
  for (const r of input) {
    if (r.assessmentId !== a.id || r.orgId !== a.orgId || r.version !== a.version || !eligible.has(r.participantId) || !r.consent) continue;
    const old = unique.get(r.participantId);
    if (!old || old.submittedAt < r.submittedAt) unique.set(r.participantId, r);
  }
  const responses = [...unique.values()];
  // Small cohorts and text cannot become an accidental named staff complaint in a
  // funder export. Five is this product's conservative disclosure floor, not a claim
  // that all groups above five are anonymous.
  const metrics: MelMetric[] = template.questions.filter(q => q.kind !== 'text' && (!funder || !q.private)).map(q => {
    const values = responses.map(r => r.answers[q.id]).filter(v => typeof v === 'string' && v.trim() && validAnswers({ ...template, questions: [q] }, { [q.id]: v }));
    const base = { id: q.id, en: q.en, zu: q.zu, n: values.length, missing: responses.length - values.length };
    if (funder && values.length < 5) return { ...base, n: 0, missing: 0, suppressed: true };
    if (q.kind === 'number') return { ...base, ...(values.length ? { mean: values.reduce((sum, v) => sum + +v, 0) / values.length } : {}) };
    const choices = (q.options ?? []).map(o => ({ ...o, count: values.filter(v => v === o.value).length }));
    // Suppress the entire distribution, including complements, if a small cell
    // would expose one person's answer by subtraction.
    if (funder && choices.some(c => c.count > 0 && c.count < 5)) return { ...base, n: 0, missing: 0, suppressed: true };
    return { ...base, choices };
  });
  return { assigned: eligible.size, completed: responses.length, responseRate: eligible.size ? responses.length / eligible.size : null, metrics };
}

export function matchedChange(before: MelAssessment, after: MelAssessment, beforeRows: readonly MelResponse[], afterRows: readonly MelResponse[], questionId: string) {
  if (before.orgId !== after.orgId || before.project !== after.project || before.version !== after.version) return { n: 0, change: null };
  const values = (a: MelAssessment, rows: readonly MelResponse[]) => new Map(rows.filter(r => r.assessmentId === a.id && r.orgId === a.orgId && r.version === a.version && r.consent && a.participantIds.includes(r.participantId)).filter(r => typeof r.answers[questionId] === 'string' && r.answers[questionId].trim() && Number.isFinite(+r.answers[questionId])).map(r => [r.participantId, +r.answers[questionId]]));
  const b = values(before, beforeRows), e = values(after, afterRows);
  const deltas = [...e].filter(([id]) => b.has(id)).map(([id, value]) => value - b.get(id)!);
  return { n: deltas.length, change: deltas.length ? deltas.reduce((s, v) => s + v, 0) / deltas.length : null };
}
