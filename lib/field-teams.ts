import type { UserRole } from './db/types';

export type FieldMember = { id: string; name: string; role: UserRole; gardenName?: string; gardenType?: string; gardenAreaM2?: number };
export type FieldTeam = { mentorId: string; location: string; farmerIds: string[]; guidance: string; updatedAt: string };
export type VisitPhoto = { image: string; caption: string };
export function validVisitPhotos(value: unknown): value is VisitPhoto[] {
  return Array.isArray(value) && value.length <= 3 && value.every(p => p && typeof p.image === 'string' && p.image.length <= 150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image) && typeof p.caption === 'string' && p.caption.length <= 200);
}
export type FieldVisit = { id: string; mentorId: string; farmerId: string; date: string; notes: string; originalNotes?: string; photos?: VisitPhoto[]; photoCount?: number };
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
    { id: 'sample-mentor', name: 'Sibusiso Ndlovu', role: 'mentor' },
    { id: 'sample-mentor-coast', name: 'Nosipho Khumalo', role: 'mentor' },
    { id: 'sample-mentor-midlands', name: 'Helen Botha', role: 'mentor' },
    { id: 's1', name: 'Nomvula Dlamini', role: 'farmer' },
    { id: 's2', name: 'Sipho Nkosi', role: 'student' },
    { id: 's3', name: 'Thandi Mokoena', role: 'farmer' },
    { id: 's4', name: 'Bongani Zulu', role: 'student' },
  ], teams: [{ mentorId: 'sample-mentor', location: 'Ubhejane garden group', farmerIds: ['s1', 's2'], guidance: 'Review each farmer’s current crop plan during the next visit. Record their support request and agree a follow-up date.', updatedAt: '2026-09-01' },
    { mentorId: 'sample-mentor-coast', location: 'Coastal school and crèche gardens', farmerIds: ['s3'], guidance: 'Check the school garden log and arrange a practical learning visit.', updatedAt: '2026-09-01' },
    { mentorId: 'sample-mentor-midlands', location: 'Midlands community and commercial gardens', farmerIds: ['s4'], guidance: 'Review the harvest records and confirm the next group training date.', updatedAt: '2026-09-01' }], visits: [] };
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
      workspace.people.push({ id, name: `${names[index]} ${['Mthembu', 'Khumalo', 'Dlamini'][group]}`, role: 'farmer' });
    }
    team.farmerIds.forEach((id, index) => {
      const person = workspace.people.find(p => p.id === id)!;
      person.gardenType = `${kinds[index % kinds.length]} garden`;
      person.gardenName = `${regions[group]} ${kinds[index % kinds.length]} Garden ${index + 1}`;
      person.gardenAreaM2 = [300, 1200, 180, 3000, 4046.8564224][index % kinds.length];
    });
  });
  // Visit outcomes make the mentor's report useful on the first tour. These
  // disposable records refer only to members of the seeded teams above.
  const examples: { group: number; farmer: number; date: string; notes: string }[] = [
    {group:0,farmer:0,date:'2026-08-15',notes:'Walked the planted beds and reviewed the crop calendar. Agreed to mark each bed clearly and enter the next harvest against its bed.'},
    {group:0,farmer:1,date:'2026-08-22',notes:'Checked soil cover and the compost area. The learner demonstrated recording a harvest; next visit will compare the record with the sales invoice.'},
    {group:0,farmer:2,date:'2026-09-01',notes:'Reviewed the harvest notebook and copied the completed sale into the digital records. Follow-up: attach the original paper invoice and check payment status.'},
    {group:0,farmer:5,date:'2026-09-03',notes:'Inspected the water-storage connection and noted a leaking tap. Assigned a repair and asked the farmer to photograph the repaired connection.'},
    {group:0,farmer:0,date:'2026-09-05',notes:'Bed labels are now in place and the latest harvest has a production entry. Agreed to keep produce for household use separate from kilograms sold.'},
    {group:1,farmer:0,date:'2026-08-28',notes:'Reviewed the school garden activity log with the coordinator. Confirmed the next practical session and the materials needed for learners.'},
    {group:2,farmer:0,date:'2026-09-02',notes:'Checked the month-end harvest and expense records. The grower will attach missing slips before the next group review.'},
  ];
  workspace.visits=examples.map((example,index)=>({id:`sample-field-visit-${index+1}`,mentorId:workspace.teams[example.group].mentorId,farmerId:workspace.teams[example.group].farmerIds[example.farmer],date:example.date,notes:example.notes,...(index===0?{photos:[{image:'/demo/harvest.webp',caption:'Garden harvest discussed during the visit · AI-generated illustration.'}]}:{})}));
  return workspace;
}

/** Preserve tour edits while adding visit examples to older empty workspaces. */
export function completeSampleFieldWorkspace(data: FieldWorkspace): FieldWorkspace {
  if (!data.sample) return data;
  const fresh=freshFieldWorkspace();
  const visitIds=new Set(data.visits.map(v=>v.id));
  return {...data,
    people:data.people.map(person=>({...person,name:person.name.replace(/\s*\(sample\)\s*$/i,'')})),
    teams:data.teams.map(team=>({...team,
      location:team.location==='Ubhejane demonstration group'?'Ubhejane garden group':team.location,
      guidance:team.guidance.replace(/ (?:This is fictional demonstration guidance\.|Fictional demo guidance\.)$/,''),
    })),
    visits:[...data.visits,...fresh.visits.filter(visit=>!visitIds.has(visit.id)&&data.teams.some(team=>team.mentorId===visit.mentorId&&team.farmerIds.includes(visit.farmerId)))],
  };
}
