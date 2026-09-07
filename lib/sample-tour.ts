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
    id: 'garden', minutes: 1, title: 'Start with a garden', href: '/samples/gardens',
    task: 'Browse the example garden photos, layouts and grower profiles. The next stops use one editable demonstration farm.',
    secondaryLabel: 'Open the example on the map', secondaryHref: '/farmer?site=demo-place-ubhejane',
  },
  {
    id: 'planning', minutes: 2, title: 'Plan the growing season',
    href: '/design?lat=-27.72623&lon=31.96304&simple=1',
    task: 'Start on Planting in Design Studio. Select a bed or tree, move it and try Undo. Then open the crop plan to compare vegetable beds, staple plots and planting months.',
    secondaryLabel: 'Open the crop plan', secondaryHref: '/facilitator/crops',
  },
  {
    id: 'learning', minutes: 2, title: 'Learn and find guidance', href: '/student', role: 'student',
    task: 'Open Seeds and Seed Sovereignty and try a lesson, narrated slide or quiz. Then open Ask Lima, review the example problem photo and tap its follow-up question. This prepared conversation demonstrates the help without running live AI.',
    secondaryLabel: 'Explore Ask Lima', secondaryHref: '/farmer?panel=Ask',
  },
  {
    id: 'business', minutes: 2, title: 'Record the work and the sale', href: '/records?tab=charts',
    task: 'Compare harvests, sales and expenses in Charts. Open invoices, choose Saved and open an existing invoice to find Share PDF and Print. See how the farmer keeps a digital record; you do not need to send anything to a buyer.',
    secondaryLabel: 'Explore an invoice', secondaryHref: '/invoice',
  },
  {
    id: 'mentor', minutes: 2, title: 'Support a group of growers', href: '/mentor', role: 'mentor',
    task: 'Review Field team for assignments, organisation guidance and visit records. Choose Trainees and open a learner to see their progress, then find Messages for follow-up.',
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
    task: 'Choose Download sample evidence report for a branded PDF with the example assessment, visit notes, photos and illustrative soil result. Then explore Saved sites & reports: choose a site to see which photos, tests, survey answers and design work would improve its full report.',
    secondaryLabel: 'Explore saved sites & reports', secondaryHref: '/reports',
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

export interface TourFeature { title: string; text: string; }

/** Small, page-specific explanations shown over the page they describe. */
export const PRODUCT_TOUR_FEATURES: Record<string, readonly TourFeature[]> = {
  garden: [
    { title: 'Choose a garden', text: 'Open a garden card to see its grower, photographs and growing areas. Use the map to explore where it is.' },
    { title: 'Follow the same farm', text: 'The next stops connect a garden design with its studies, harvests, sales and programme reports.' },
  ],
  planning: [
    { title: 'See the ground beneath your plan', text: 'The Base step holds the site image. In Glossy, use Underlay to switch between your photo, satellite and plain paper.' },
    { title: 'Move something and try Undo', text: 'Select a tree or bed and drag it. Undo restores the previous position. The Layers panel controls which items you can select and move.' },
    { title: 'Place an entrance', text: 'Choose a Gate in Structures. Drag its green move handle to position it; the gold end handle changes its length. The finished map shows the gate open and leaves an opening in the fence.' },
    { title: 'Make a finished Design Map', text: 'Open Glossy, choose a sheet and its underlay, then create a Design Map. Inspect the result full screen and use Export & Share for your selected sheets.' },
  ],
  learning: [
    { title: 'Your studies start here', text: 'Use Start studying or Continue learning to open your next module. Illustrated cards show the topics and your progress.' },
    { title: 'Open an illustrated lesson', text: 'Open Seeds and Seed Sovereignty to try a finished module. Choose a lesson picture or title to read, listen, watch slides and answer a quiz.' },
    { title: 'Take the course home', text: 'Open Study offline while you have signal. Choose the download quality and save the course or a single module to this phone.' },
  ],
  business: [
    { title: 'Four pages in your farm book', text: 'Picked records harvests; Sold records sales; Spent holds costs; Charts brings the figures together. Switch tabs to follow the work from crop to cash.' },
    { title: 'Keep the paperwork together', text: 'Open Invoice, then Saved, to inspect a document. In Spent, open a receipt to see the purchase details behind a cost.' },
    { title: 'See a useful summary', text: 'In Picked, open Records for a lender to view harvest, income and cost history and export the summary.' },
  ],
  mentor: [
    { title: 'Meet your field team', text: 'My field team & reports brings assigned growers and visit records together. Open a group to inspect the work.' },
    { title: 'Follow learning and visits', text: 'Use Trainees for individual learning progress, Training & evidence for course records, and Messages for follow-up.' },
  ],
  organisation: [
    { title: 'See the programme together', text: 'Compare groups, gardens and recorded activity. Open Assessments to review the survey stages and responses.' },
    { title: 'Follow progress into reports', text: 'Training & progress shows learner activity. Reports brings the programme evidence together for review and sharing.' },
  ],
  funder: [
    { title: 'Look beyond attendance', text: 'Explore cohort totals and charts, then Progress & milestones for the wider programme record.' },
    { title: 'Inspect the evidence', text: 'Open shared assessments and reports to see the records supporting the totals and the work still to be completed.' },
  ],
  report: [
    { title: 'Start with a saved site', text: 'Saved sites & reports connects each site to its reports. Choose a site to create a report from its current information.' },
    { title: 'Make the next report stronger', text: 'Review the site checklist for photographs, soil and water tests, survey answers and design work. Download the evidence report to see the finished document.' },
  ],
  next: [
    { title: 'Tell us what your programme needs', text: 'Request a feature lets you describe the change and add a screenshot. Sending this form contacts the developer, so submit only when you are ready.' },
  ],
};
