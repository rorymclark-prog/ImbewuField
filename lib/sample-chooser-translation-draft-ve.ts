/** Source-paired Tshivenda machine draft for the public sample chooser shell only. */
export interface SampleChooserTshivendaPair {
  sourceEnglish: string;
  tshivendaDraft: string;
  reviewStatus: 'machine-draft' | 'hold';
}

const draft = (sourceEnglish: string, tshivendaDraft: string): SampleChooserTshivendaPair => ({
  sourceEnglish,
  tshivendaDraft,
  reviewStatus: 'machine-draft',
});
const hold = (sourceEnglish: string): SampleChooserTshivendaPair => ({
  sourceEnglish,
  tshivendaDraft: sourceEnglish,
  reviewStatus: 'hold',
});

const role = (
  label: string,
  labelVe: string,
  title: string,
  titleVe: string | null,
  subtitle: string,
  subtitleVe: string | null,
) => ({
  label: draft(label, labelVe),
  title: titleVe === null ? hold(title) : draft(title, titleVe),
  subtitle: subtitleVe === null ? hold(subtitle) : draft(subtitle, subtitleVe),
});

export const TSHIVENDA_SAMPLE_CHOOSER_DRAFT = {
  eyebrow: draft('EXPLORE', 'Vhonani'),
  heading: draft('Choose a view', 'Khethani fhethu ha u shuma'),
  intro: hold('Explore each workspace. Use Tour in the menu to return here.'),
  sectionLabel: hold('All views'),
  sectionHeading: hold('Choose your workspace'),
  indexLabel: hold('View index'),
  roles: {
    ngo: role(
      'Organisation', 'Dzangano',
      'Run a programme', null,
      'Explore gardens, assessments, reports and the organisation Control centre.', null,
    ),
    funder: role(
      'Funder', 'Mulambedzi',
      'Review what is shared', null,
      'See the same programme through its published summaries.', null,
    ),
    farmer: role(
      'Farmer', 'Mulimi',
      'Explore Ubhejane Crèche', 'Vhonani Ubhejane Crèche',
      'Open the farm map, crop plan, harvests and example sales.', null,
    ),
    mentor: role(
      'Mentor', 'Mueletshedzi',
      'Support a grower', 'Thusani mulimi',
      'Explore assigned farmers, organisation guidance, visits and reports.', null,
    ),
    student: role(
      'Student', 'Mugudi',
      'Try the learning workspace', 'Lingedzani fhethu ha ngudo',
      'Explore the existing course and progress.', 'Vhonani khoso i re hone na mvelaphanḓa.',
    ),
  },
} as const;

export type SampleChooserTshivendaRole = keyof typeof TSHIVENDA_SAMPLE_CHOOSER_DRAFT.roles;

/** Held wording always falls back to its exact English source. */
export function resolveSampleChooserTshivendaDraft(pair: SampleChooserTshivendaPair, language: string): string {
  return language === 've' && pair.reviewStatus === 'machine-draft' ? pair.tshivendaDraft : pair.sourceEnglish;
}
