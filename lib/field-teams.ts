import type { UserRole } from './db/types';
import { validEvidenceImage } from './invoice-logo';

export type FieldMember = { id: string; name: string; role: UserRole; photoUrl?: string | null; gardenName?: string; gardenType?: string; gardenAreaM2?: number };
export const FIELD_PROGRAMMES = { general: 'General garden support', 'act-sef-food-security': 'ACT · SEF food security' } as const;
export type FieldProgramme = keyof typeof FIELD_PROGRAMMES;
export const FIELD_FOCUS = { garden: 'Garden establishment & upkeep', water: 'Water access & repairs', soil: 'Soil health & compost', seedlings: 'Seedlings & seed saving', crops: 'Crop care & protection', harvest: 'Harvest & food distribution', learning: 'Practical skills & coaching', records: 'Records & livelihood support' } as const;
export type FieldFocus = keyof typeof FIELD_FOCUS;
export type FieldTeam = { programme?: FieldProgramme; mentorId: string; location: string; farmerIds: string[]; guidance: string; updatedAt: string };
export type FieldVisitPhoto = { image: string; caption: string };
export type VisitPhoto = FieldVisitPhoto;
const sampleVisitImage = (value: unknown) => value === '/demo/harvest.webp';
export function validVisitPhotos(value: unknown): value is VisitPhoto[] {
  return Array.isArray(value) && value.length <= 3 && value.every(p => p && typeof p.image === 'string'
    && p.image.length <= 150000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(p.image)
    && typeof p.caption === 'string' && p.caption.length <= 200);
}
export type FieldVisit = {
  id: string; mentorId: string; farmerId: string; date: string; notes: string; originalNotes?: string;
  // Optional fields keep existing visit notes readable without a migration.
  supportRequested?: string; observations?: string; agreedAction?: string;
  responsiblePerson?: string; followUpDate?: string; location?: string;
  focus?: FieldFocus[]; practicalSkill?: string; skillResult?: 'not-assessed' | 'demonstrated' | 'needs-support';
  actionCompletedOn?: string; actionOutcome?: string;
  latitude?: number | null; longitude?: number | null;
  photos?: FieldVisitPhoto[]; photoCount?: number; updatedAt?: string;
};
export type FieldWorkspace = { visitCursor?: string; people: FieldMember[]; teams: FieldTeam[]; visits: FieldVisit[]; canManage: boolean; selfId: string; sample: boolean };
export const validFieldId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const validVisitDate = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const optionalText = (value: unknown, max: number): value is string | undefined => value===undefined || typeof value==='string' && value.length<=max;

export function validFieldVisit(value: unknown, today: string, allowSampleImages = false): value is FieldVisit {
  if (!value || typeof value!=='object') return false;
  const visit=value as FieldVisit;
  return validFieldId(visit.id) && validFieldId(visit.mentorId) && validFieldId(visit.farmerId)
    && validVisitDate(visit.date) && visit.date<=today && typeof visit.notes==='string' && visit.notes.length<=4000
    && optionalText(visit.originalNotes,4000) && optionalText(visit.supportRequested,2000) && optionalText(visit.observations,4000) && optionalText(visit.agreedAction,2000)
    && (visit.focus===undefined || Array.isArray(visit.focus) && visit.focus.length<=Object.keys(FIELD_FOCUS).length && new Set(visit.focus).size===visit.focus.length && visit.focus.every(key=>Object.hasOwn(FIELD_FOCUS,key)))
    && optionalText(visit.practicalSkill,240) && (visit.skillResult===undefined || ['not-assessed','demonstrated','needs-support'].includes(visit.skillResult))
    && (!visit.skillResult || visit.skillResult==='not-assessed' || !!visit.practicalSkill?.trim())
    && optionalText(visit.actionOutcome,2000)
    && (!visit.actionCompletedOn || validVisitDate(visit.actionCompletedOn) && visit.actionCompletedOn>=visit.date && visit.actionCompletedOn<=today && !!visit.agreedAction?.trim() && !!visit.actionOutcome?.trim())
    && (visit.actionCompletedOn===undefined || typeof visit.actionCompletedOn==='string')
    && ((visit.latitude==null && visit.longitude==null) || typeof visit.latitude==='number' && Number.isFinite(visit.latitude) && Math.abs(visit.latitude)<=90 && typeof visit.longitude==='number' && Number.isFinite(visit.longitude) && Math.abs(visit.longitude)<=180)
    && optionalText(visit.responsiblePerson,120) && optionalText(visit.location,240)
    && !!(visit.notes.trim() || visit.observations?.trim())
    && (!visit.responsiblePerson?.trim() && !visit.followUpDate || !!visit.agreedAction?.trim())
    && (visit.followUpDate===undefined || visit.followUpDate==='' || validVisitDate(visit.followUpDate) && visit.followUpDate>=visit.date)
    && (visit.photos===undefined || Array.isArray(visit.photos) && visit.photos.length<=3 && visit.photos.every(photo=>!!photo && (validEvidenceImage(photo.image) || allowSampleImages && sampleVisitImage(photo.image)) && typeof photo.caption==='string' && !!photo.caption.trim() && photo.caption.length<=240));
}

/** Accept the older API's prefixed IDs without prefixing them again on edit. */
export function fieldVisitDocumentId(mentorId: string, visitId: string): string {
  if (!validFieldId(mentorId) || !validFieldId(visitId)) throw Error('Choose a valid visit record.');
  return visitId.startsWith(`${mentorId}_`) ? visitId : `${mentorId}_${visitId}`;
}
export function canReadFieldVisit(visit: FieldVisit, uid: string, manage: boolean, assignedFarmerIds: ReadonlySet<string>): boolean {
  return manage || visit.mentorId===uid && assignedFarmerIds.has(visit.farmerId);
}
export function fieldVisitReportLines(visit: FieldVisit, farmerName: string, mentorName?: string): string[] {
  return [`${visit.date} | ${farmerName}${mentorName ? ` | Mentor: ${mentorName}` : ''}`,
    ...(visit.location ? [`Site location: ${visit.location}`] : []),
    ...(visit.latitude!=null && visit.longitude!=null ? [`Location: ${visit.latitude.toFixed(5)}, ${visit.longitude.toFixed(5)}`,`Google Maps: https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`] : []),
    ...(visit.focus?.length ? [`Support areas: ${visit.focus.map(key=>FIELD_FOCUS[key]).join('; ')}`] : []),
    ...(visit.practicalSkill ? [`Practical skill: ${visit.practicalSkill} | ${visit.skillResult==='demonstrated'?'Demonstrated during this visit':visit.skillResult==='needs-support'?'Needs further support':'Not assessed'}`] : []),
    ...(visit.actionCompletedOn ? [`Action completed: ${visit.actionCompletedOn}`,`Completion evidence: ${visit.actionOutcome}`] : []),
    ...(visit.supportRequested ? [`Support requested: ${visit.supportRequested}`] : []),
    ...(visit.observations ? [`Observations / issues: ${visit.observations}`] : []),
    ...(visit.notes ? [`Visit notes: ${visit.notes}`] : []),
    ...(visit.originalNotes ? [`Original notes before AI cleanup: ${visit.originalNotes}`] : []),
    ...(visit.agreedAction ? [`Agreed action: ${visit.agreedAction}`,`Responsible person: ${visit.responsiblePerson || 'Not yet assigned'}`,`Follow-up: ${visit.followUpDate || 'Not yet scheduled'}`] : []),
    ...(visit.photoCount || visit.photos?.length ? [`Visit photos: ${visit.photoCount ?? visit.photos?.length ?? 0}`] : []),
  ];
}

// A location is descriptive. Explicit membership, never a matching place name,
// determines which farmers are returned to a mentor.
export function validFieldTeam(value: unknown): value is FieldTeam {
  if (!value || typeof value !== 'object') return false;
  const t = value as FieldTeam;
  return (t.programme===undefined || Object.hasOwn(FIELD_PROGRAMMES,t.programme)) && validFieldId(t.mentorId) && typeof t.location === 'string' && t.location.trim().length > 0 && t.location.length <= 160
    && Array.isArray(t.farmerIds) && t.farmerIds.length <= 250 && t.farmerIds.every(validFieldId)
    && new Set(t.farmerIds).size === t.farmerIds.length && typeof t.guidance === 'string' && t.guidance.length <= 4000;
}
export function projectFieldWorkspace(data: FieldWorkspace, uid: string, manage: boolean): FieldWorkspace {
  const teams = manage ? data.teams : data.teams.filter(t => t.mentorId === uid);
  const ids = new Set(teams.flatMap(t => [t.mentorId, ...t.farmerIds]));
  return { ...data, canManage: manage, selfId: uid, teams, people: manage ? data.people : data.people.filter(p => ids.has(p.id)),
    visits: data.visits.filter(v => canReadFieldVisit(v,uid,manage,ids)) };
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
    team.programme = 'act-sef-food-security';
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
  const followUps=[
    {supportRequested:'Help linking the crop calendar to daily harvest records.',observations:'The planted beds are being used but their labels are missing.',agreedAction:'Label each planted bed and use that label on the next harvest entry.',responsiblePerson:'Nomvula Dlamini',followUpDate:'2026-08-29'},
    {supportRequested:'Help checking whether the harvest and sale records match.',observations:'Soil cover is in place and the learner can record the harvest weight.',agreedAction:'Bring the next sales invoice and compare its kilograms with the harvest record.',responsiblePerson:'Sipho Nkosi',followUpDate:'2026-09-05'},
    {supportRequested:'Help filing a paper invoice after the sale.',observations:'The sale is recorded digitally; its original invoice still needs attaching.',agreedAction:'Attach the paper invoice and confirm whether the buyer has paid.',responsiblePerson:'Thandi Mthembu',followUpDate:'2026-09-08'},
    {supportRequested:'Repair support for the water-storage tap.',observations:'The tap at the storage connection is leaking.',agreedAction:'Arrange the tap repair and add a photograph of the repaired connection.',responsiblePerson:'Sibusiso Ndlovu',followUpDate:'2026-09-10'},
    {supportRequested:'Help separating household food from produce sold.',observations:'Bed labels and the latest production entry are now complete.',agreedAction:'Record household use separately when entering the next harvest.',responsiblePerson:'Nomvula Dlamini',followUpDate:'2026-09-12'},
    {supportRequested:'Materials for the next school garden practical.',observations:'The activity log is current and the coordinator has agreed a session date.',agreedAction:'Confirm materials with the coordinator before the practical session.',responsiblePerson:'Nosipho Khumalo',followUpDate:'2026-09-09'},
    {supportRequested:'Help preparing the month-end records for review.',observations:'Harvest and expense entries are present; some slips are missing.',agreedAction:'Attach the missing expense slips before the group review.',responsiblePerson:'Bongani Zulu',followUpDate:'2026-09-11'},
  ];
  workspace.visits=examples.map((example,index)=>({focus:([['garden','records'],['soil','learning'],['records'],['water'],['harvest','records'],['garden','learning'],['harvest','records']] as FieldFocus[][])[index],...(index===0?{actionCompletedOn:'2026-09-05',actionOutcome:'Bed labels and a linked production entry were checked during the follow-up visit on 5 September.'}:{}),...(index===1?{practicalSkill:'Weigh and record a harvest',skillResult:'demonstrated' as const}:{}),id:`sample-field-visit-${index+1}`,mentorId:workspace.teams[example.group].mentorId,farmerId:workspace.teams[example.group].farmerIds[example.farmer],date:example.date,notes:example.notes,location:workspace.people.find(p=>p.id===workspace.teams[example.group].farmerIds[example.farmer])?.gardenName,...followUps[index],photos:index===0?[{image:'/demo/harvest.webp',caption:'Garden harvest discussed during the visit · AI-generated illustration.'}]:[],photoCount:index===0?1:0}));

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
      programme:team.programme ?? (fresh.teams.some(t=>t.mentorId===team.mentorId)?'act-sef-food-security':'general'),
      location:team.location==='Ubhejane demonstration group'?'Ubhejane garden group':team.location,
      guidance:team.guidance.replace(/ (?:This is fictional demonstration guidance\.|Fictional demo guidance\.)$/,''),
    })),
    visits:[...data.visits.map(visit=>{
      const seed=fresh.visits.find(v=>v.id===visit.id);
      // Only enrich untouched legacy examples; never rewrite a visitor's notes.
      return seed && !visit.updatedAt && visit.notes===seed.notes ? {...seed,...visit} : visit;
    }),...fresh.visits.filter(visit=>!visitIds.has(visit.id)&&data.teams.some(team=>team.mentorId===visit.mentorId&&team.farmerIds.includes(visit.farmerId)))],
  };
}

/** One scoped calculation drives the worklist, coverage cards and exported report. */
export function summariseFieldWork(data: FieldWorkspace, from = '', to = '', farmerId = '', today = new Date().toISOString().slice(0,10)) {
  const assigned = [...new Set(data.teams.flatMap(team=>team.farmerIds))].filter(id=>!farmerId || id===farmerId);
  const visits = data.visits.filter(v=>(!from || v.date>=from) && (!to || v.date<=to) && (!farmerId || v.farmerId===farmerId)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const visited = new Set(visits.map(v=>v.farmerId).filter(id=>assigned.includes(id)));
  const open = visits.filter(v=>v.agreedAction?.trim() && !v.actionCompletedOn);
  const due = open.filter(v=>v.followUpDate && v.followUpDate<=today).sort((a,b)=>a.followUpDate!.localeCompare(b.followUpDate!));
  const completed = visits.filter(v=>v.actionCompletedOn);
  const focus = Object.entries(FIELD_FOCUS).map(([key,label])=>({label,value:visits.filter(v=>v.focus?.includes(key as FieldFocus)).length})).filter(row=>row.value>0);
  return { assigned, visits, visited:visited.size, unvisited:assigned.length-visited.size, open, due, completed, focus };
}
