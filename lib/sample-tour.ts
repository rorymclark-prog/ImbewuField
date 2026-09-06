import type { UserRole } from './db/types';

// A sample is an isolated teaching workspace, never an alternative permission grant.
export function sampleRolesFor(role: UserRole | null): string[] {
  if (!role || role === 'admin' || role === 'ngo') return ['ngo', 'funder', 'farmer', 'mentor', 'student'];
  return [role];
}

/** Unknown signed-in identities fail closed; anonymous visitors can explore public samples. */
export function sampleChoicesForAccount(role: UserRole | null, signedIn: boolean, ready: boolean): string[] {
  if (!ready || (signedIn && !role)) return [];
  return sampleRolesFor(role);
}

export const FARM_TOUR = [
  { id: 'map', minutes: 2, title: 'Find the garden', href: '/farmer', task: 'Open the saved sample pin. Explore the map layers and garden boundary.' },
  { id: 'design', minutes: 3, title: 'Try the Design Studio', href: '/design?lat=-27.72623&lon=31.96304', task: 'Select a bed or tree, move it and try Undo. Edits affect only this sample.' },
  { id: 'assessment', minutes: 2, title: 'Review the site assessment', href: '/farmer?openSurvey=1', task: 'Review the completed example, change a water or site answer, then save.' },
  { id: 'evidence', minutes: 2, title: 'Explore the evidence pack', href: '/samples/farm#evidence', task: 'Review the illustrative photos, fictional soil result and completed household interview.' },
  { id: 'crops', minutes: 2, title: 'Read the crop plan', href: '/facilitator/crops', task: 'Compare vegetable beds and staple plots. Inspect the planting calendar.' },
  { id: 'money', minutes: 2, title: 'Follow the harvest and money', href: '/records', task: 'Compare sample income, costs and returns per square metre. These are invented transactions.' },
  { id: 'report', minutes: 2, title: 'Make a report', href: '/samples/farm#report', task: 'Download the branded farm evidence report, including your saved edits and illustrative photos.' },
] as const;

export function cleanTourProgress(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && FARM_TOUR.some(s => s.id === x)))] : [];
}

export interface ProductTourStep {
  id: string;
  minutes: number;
  title: string;
  href: string;
  task: string;
  /** A presentation hint inside the existing sandbox; never an account permission. */
  role?: UserRole;
  secondaryLabel?: string;
  secondaryHref?: string;
}

// The original farm checklist remains available to existing consumers. This broader
// route follows the work from a grower's garden through support and programme evidence.
// Minutes are suggested exploration time, not a measured completion guarantee.
export const PRODUCT_TOUR: readonly ProductTourStep[] = [
  {
    id: 'garden', minutes: 1, title: 'Start with a garden', href: '/farmer',
    task: 'Find the example garden on the map. Zoom in to see its boundary, then explore the soil, climate and water panels.',
  },
  {
    id: 'planning', minutes: 2, title: 'Plan the growing season',
    href: '/design?lat=-27.72623&lon=31.96304',
    task: 'Select a bed or tree in Design Studio, move it and try Undo. Then open the crop plan to compare vegetable beds, staple plots and planting months.',
    secondaryLabel: 'Open the crop plan', secondaryHref: '/facilitator/crops',
  },
  {
    id: 'learning', minutes: 2, title: 'Learn and find guidance', href: '/student', role: 'student',
    task: 'Open Seeds and Seed Sovereignty and try a lesson, narrated slide or quiz. Then open Ask Lima, review the example problem photo and tap its follow-up question. This prepared conversation demonstrates the help without running live AI.',
    secondaryLabel: 'Explore Ask Lima', secondaryHref: '/farmer?panel=Ask',
  },
  {
    id: 'business', minutes: 2, title: 'Record the work and the sale', href: '/records?tab=charts',
    task: 'Compare harvests, sales and expenses in Charts. Open an invoice and find Saved, Share PDF and Print. See how the farmer keeps a digital record; you do not need to send anything to a buyer.',
    secondaryLabel: 'Explore an invoice', secondaryHref: '/invoice',
  },
  {
    id: 'mentor', minutes: 2, title: 'Support a group of growers', href: '/mentor', role: 'mentor',
    task: 'Open an assigned grower. Review their learning progress, organisation guidance and visit notes, then find the follow-up and reporting tools.',
  },
  {
    id: 'organisation', minutes: 2, title: 'Follow the whole programme', href: '/ngo', role: 'ngo',
    task: 'Choose Assessments to review stages and response counts. Then look at Training & progress and Reports: these bring monitoring, evaluation and learning records together for the programme team.',
  },
  {
    id: 'funder', minutes: 2, title: 'See progress as a funder', href: '/funder', role: 'funder',
    task: 'Review Cohort totals and charts, then choose Progress & milestones. Compare recorded progress with targets and open the shared assessments or reports. All figures here are demonstration records.',
  },
  {
    id: 'report', minutes: 1, title: 'Turn site evidence into a report', href: '/samples/farm#report',
    task: 'Choose Download sample evidence report for a branded PDF with the example assessment, visit notes, photos and illustrative soil result. It is separate from the full site report, which uses your saved site and available evidence.',
    secondaryLabel: 'Explore full site reports', secondaryHref: '/farmer?panel=Reports',
  },
  {
    id: 'next', minutes: 1, title: 'Shape it for your programme', href: '/feedback',
    task: 'Choose Request a feature to see how you can describe a change that would help your programme. Explore the form only: sending it contacts the real developer. Customisation scope and pricing are agreed together.',
  },
];

export function cleanProductTourProgress(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(PRODUCT_TOUR.map(step => step.id));
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && valid.has(id)))];
}

/** Resume the first untried stop, without inventing completion from page visits. */
export function nextProductTourStep(progress: unknown): ProductTourStep | undefined {
  const done = new Set(cleanProductTourProgress(progress));
  return PRODUCT_TOUR.find(step => !done.has(step.id));
}
