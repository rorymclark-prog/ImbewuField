/** Source-paired Sesotho machine draft for the public sample chooser shell only. */
export interface SampleChooserSesothoPair {
  sourceEnglish: string;
  sesothoDraft: string;
  reviewStatus: 'machine-draft' | 'hold';
}

const draft = (sourceEnglish: string, sesothoDraft: string): SampleChooserSesothoPair => ({
  sourceEnglish,
  sesothoDraft,
  reviewStatus: 'machine-draft',
});
const hold = (sourceEnglish: string): SampleChooserSesothoPair => ({
  sourceEnglish,
  sesothoDraft: sourceEnglish,
  reviewStatus: 'hold',
});

const role = (label: string, labelSt: string, title: string, titleSt: string, subtitle: string, subtitleSt: string | null) => ({
  label: draft(label, labelSt),
  title: draft(title, titleSt),
  subtitle: subtitleSt === null ? hold(subtitle) : draft(subtitle, subtitleSt),
});

export const SESOTHO_SAMPLE_CHOOSER_DRAFT = {
  eyebrow: draft('EXPLORE', 'LEKOLA'),
  heading: draft('Choose a view', 'Khetha pono'),
  intro: draft('Explore each workspace. Use Tour in the menu to return here.', 'Lekola sebaka ka seng sa mosebetsi. Sebelisa Tour lenaneng ho khutlela mona.'),
  sectionLabel: draft('All views', 'Libaka tsohle'),
  sectionHeading: draft('Choose your workspace', 'Khetha sebaka sa hao sa mosebetsi'),
  indexLabel: draft('View index', 'Lenane la libaka'),
  roles: {
    ngo: role(
      'Organisation', 'Mokgatlo',
      'Run a programme', 'Tsamaisa lenaneo',
      'Explore gardens, assessments, reports and the organisation Control centre.',
      null,
    ),
    funder: role(
      'Funder', 'Motshehetsi',
      'Review what is shared', 'Hlahloba se arolelanoang',
      'See the same programme through its published summaries.',
      'Bona lenaneo lona leo ka likakaretso tsa lona tse phatlalalitsoeng.',
    ),
    farmer: role(
      'Farmer', 'Molemi',
      'Explore Ubhejane Crèche', 'Lekola Ubhejane Crèche',
      'Open the farm map, crop plan, harvests and example sales.',
      'Bula ' + "'mapa" + ' oa polasi, moralo oa lijalo, kotulo le mehlala ea thekiso.',
    ),
    mentor: role(
      'Mentor', 'Moeletsi',
      'Support a grower', 'Tšehetsa molemi',
      'Explore assigned farmers, organisation guidance, visits and reports.',
      'Lekola balemi bao u ba abetsoeng, tataiso ea mokhatlo, maeto le litlaleho.',
    ),
    student: role(
      'Student', 'Moithuti',
      'Try the learning workspace', 'Leka sebaka sa ho ithuta',
      'Explore the existing course and progress.',
      'Lekola thupelo e teng le tsoelo-pele.',
    ),
  },
} as const;

export type SampleChooserRole = keyof typeof SESOTHO_SAMPLE_CHOOSER_DRAFT.roles;

/** Held wording always falls back to its exact English source. */
export function resolveSampleChooserDraft(pair: SampleChooserSesothoPair, language: string): string {
  return language === 'st' && pair.reviewStatus === 'machine-draft' ? pair.sesothoDraft : pair.sourceEnglish;
}
