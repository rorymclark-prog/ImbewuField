import type { UserRole } from './db/types';

export type FieldMember = { id: string; name: string; role: UserRole; gardenName?: string; gardenType?: string; gardenAreaM2?: number };
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
  const workspace: FieldWorkspace = { sample: true, canManage: true, selfId: 'sample-organisation', people: [
    { id: 'sample-mentor', name: 'Sibusiso Ndlovu (sample)', role: 'mentor' },
    { id: 'sample-mentor-coast', name: 'Nosipho Khumalo (sample)', role: 'mentor' },
    { id: 'sample-mentor-midlands', name: 'Helen Botha (sample)', role: 'mentor' },
    { id: 's1', name: 'Nomvula Dlamini (sample)', role: 'farmer' },
    { id: 's2', name: 'Sipho Nkosi (sample)', role: 'student' },
    { id: 's3', name: 'Thandi Mokoena (sample)', role: 'farmer' },
    { id: 's4', name: 'Bongani Zulu (sample)', role: 'student' },
  ], teams: [{ mentorId: 'sample-mentor', location: 'Ubhejane demonstration group', farmerIds: ['s1', 's2'], guidance: 'Review each farmer’s current crop plan during the next visit. Record their support request and agree a follow-up date. This is fictional demonstration guidance.', updatedAt: '2026-09-01' },
    { mentorId: 'sample-mentor-coast', location: 'Coastal school and crèche gardens', farmerIds: ['s3'], guidance: 'Check the school garden log and arrange a practical learning visit. Fictional demo guidance.', updatedAt: '2026-09-01' },
    { mentorId: 'sample-mentor-midlands', location: 'Midlands community and commercial gardens', farmerIds: ['s4'], guidance: 'Review the harvest records and confirm the next group training date. Fictional demo guidance.', updatedAt: '2026-09-01' }], visits: [] };
  // Each sample garden has one coordinator. These are not live assignments or
  // additions to the separate national garden register / KZN funder portfolio.
  const kinds = ['Crèche', 'School', 'Homestead', 'Community', 'Commercial'];
  const names = ['Nomvula', 'Sipho', 'Thandi', 'Bongani', 'Zanele', 'Musa', 'Lindiwe', 'Sanele', 'Grace', 'Petrus', 'Andile', 'Sindi', 'Philani', 'Lerato', 'Nolwazi'];
  const regions = ['Valley', 'Coastal', 'Midlands'];
  workspace.teams.forEach((team, group) => {
    while (team.farmerIds.length < 15) {
      const index = team.farmerIds.length;
      const id = `sample-garden-${group + 1}-${index + 1}`;
      team.farmerIds.push(id);
      workspace.people.push({ id, name: `${names[index]} ${['Mthembu', 'Khumalo', 'Dlamini'][group]} (sample)`, role: 'farmer' });
    }
    team.farmerIds.forEach((id, index) => {
      const person = workspace.people.find(p => p.id === id)!;
      person.gardenType = `${kinds[index % kinds.length]} garden`;
      person.gardenName = `${regions[group]} ${kinds[index % kinds.length]} Garden ${index + 1}`;
      person.gardenAreaM2 = [300, 1200, 180, 3000, 4046.8564224][index % kinds.length];
    });
  });
  return workspace;
}
