import type { UserRole } from './db/types';

export type FieldMember = { id: string; name: string; role: UserRole };
export type FieldTeam = { mentorId: string; location: string; farmerIds: string[]; guidance: string; updatedAt: string };
export type FieldVisit = { id: string; mentorId: string; farmerId: string; date: string; notes: string };
export type FieldWorkspace = { people: FieldMember[]; teams: FieldTeam[]; visits: FieldVisit[]; canManage: boolean; selfId: string; sample: boolean };
export const validFieldId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);

// A location is descriptive. Explicit membership, never a matching place name,
// determines which farmers are returned to a mentor.
export function validFieldTeam(value: unknown): value is FieldTeam {
  if (!value || typeof value !== 'object') return false;
  const t = value as FieldTeam;
  return validFieldId(t.mentorId) && typeof t.location === 'string' && t.location.trim().length > 0 && t.location.length <= 160
    && Array.isArray(t.farmerIds) && t.farmerIds.length <= 250 && t.farmerIds.every(validFieldId)
    && new Set(t.farmerIds).size === t.farmerIds.length && typeof t.guidance === 'string' && t.guidance.length <= 4000;
}
export function projectFieldWorkspace(data: FieldWorkspace, uid: string, manage: boolean): FieldWorkspace {
  const teams = manage ? data.teams : data.teams.filter(t => t.mentorId === uid);
  const ids = new Set(teams.flatMap(t => [t.mentorId, ...t.farmerIds]));
  return { ...data, canManage: manage, selfId: uid, teams, people: manage ? data.people : data.people.filter(p => ids.has(p.id)),
    visits: manage ? data.visits : data.visits.filter(v => v.mentorId === uid && ids.has(v.farmerId)) };
}
export function freshFieldWorkspace(): FieldWorkspace {
  return { sample: true, canManage: true, selfId: 'sample-organisation', people: [
    { id: 'sample-mentor', name: 'Sample mentor', role: 'mentor' },
    { id: 's1', name: 'Nomvula Dlamini (sample)', role: 'farmer' },
    { id: 's2', name: 'Sipho Nkosi (sample)', role: 'student' },
    { id: 's3', name: 'Thandi Mokoena (sample)', role: 'farmer' },
    { id: 's4', name: 'Bongani Zulu (sample)', role: 'student' },
  ], teams: [{ mentorId: 'sample-mentor', location: 'Ubhejane demonstration group', farmerIds: ['s1', 's2'], guidance: 'Review each farmer’s current crop plan during the next visit. Record their support request and agree a follow-up date. This is fictional demonstration guidance.', updatedAt: '2026-09-01' }], visits: [] };
}
