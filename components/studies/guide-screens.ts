import { appGuideOfflinePack, type OfflinePack } from '@/lib/offline-pack';

export type GuideScreen = {
  src: string;
  title: string;
  caption: string;
  bytes: number;
};

const screen = (file: string, title: string, caption: string, bytes: number): GuideScreen => ({
  src: `/studies-guides/screens/${file}.png`, title, caption, bytes,
});

// These are captures of the app's sample workspace. A screenshot shows where a control lives;
// the learner's own records and dates will differ from the example.
export const GUIDE_SCREENS: Record<string, readonly GuideScreen[]> = {
  'getting-started': [
    screen('home', 'Home', 'Find Map, My Records and Study from the home page.', 161646),
    screen('sample-farm', 'Sample farm', 'Practise in the example workspace before entering your own records.', 599574),
  ],
  mapping: [
    screen('reports', 'Saved sites', 'Check whether the site is already saved before making a new one.', 65731),
    screen('map-tools', 'Map tools', 'Open Find your land to search, save a place and add a boundary.', 669335),
  ],
  design: [
    screen('design', 'Design Studio', 'Review the saved layout and its layers.', 232813),
    screen('crop-plan', 'Crop plan', 'Open the crop plan from the reviewed design.', 99389),
  ],
  'crop-planning': [
    screen('crop-plan', 'Crop plan', 'Read the beds, crops and months on the calendar.', 99389),
    screen('design', 'Design Studio', 'Return to the map when a bed or plot needs checking.', 232813),
  ],
  harvest: [
    screen('picked', 'Picked', 'Choose the crop and enter the measured kilograms.', 66730),
  ],
  sales: [
    screen('sold', 'Sold', 'Check recent sales before choosing a new sale and invoice.', 80194),
    screen('invoice', 'Invoice', 'Keep the buyer, produce and payment together in one record.', 134665),
  ],
  expenses: [
    screen('spent', 'Spent', 'Look for the payment before adding another cost.', 74810),
    screen('spent-form', 'Money you paid out', 'Enter the checked amount and attach a receipt when you have one.', 85789),
  ],
  invoices: [
    screen('invoice', 'New invoice', 'Choose the invoice type and check whether the buyer has paid.', 134665),
    screen('paper-invoice', 'Paper invoice', 'A past paper copy has its own source and original reference fields.', 134115),
  ],
  'past-sales': [
    screen('paper-invoice', 'Past sale or paper invoice', 'Choose whether the sale is already in My Records.', 134115),
    screen('sold', 'Sold', 'Check the sale list before opening the paper-copy form.', 80194),
  ],
  payments: [
    screen('payment-review', 'Review payment', 'Reopen the same invoice and check its payment status.', 127496),
    screen('invoice', 'Invoice copy', 'Inspect the document before using Share PDF or Print.', 134665),
  ],
  charts: [
    screen('charts', 'Cash flow', 'Check the selected time window before reading the figures.', 71436),
    screen('financial-sheet', 'Financial sheet', 'Follow a figure back to a source entry in My Records.', 103122),
  ],
  exports: [
    screen('financial-sheet', 'Financial sheet', 'Choose the period and Export a checked table.', 103122),
    screen('picked', 'Picked', 'Use the harvest records when preparing a lender summary.', 66730),
  ],
  evidence: [
    screen('sample-farm', 'Site evidence', 'The example site shows where visit notes and pictures are kept.', 599574),
    screen('reports', 'Saved sites and reports', 'Reopen the saved site before checking its report.', 65731),
  ],
  'offline-learning': [
    screen('study-offline', 'Study offline', 'Open this panel and download lessons while you have signal.', 102320),
    screen('studies', 'My Studies', 'Return to the learning page to reopen a saved guide.', 104660),
  ],
};

export function guideScreens(guideId: string): readonly GuideScreen[] {
  return GUIDE_SCREENS[guideId] ?? [];
}

export function guidePackWithScreens(guideId: string): OfflinePack {
  const base = appGuideOfflinePack(guideId);
  const seen = new Set(base.entries.map(item => item.url));
  const screens = guideScreens(guideId)
    .filter(item => !seen.has(item.src) && Boolean(seen.add(item.src)))
    .map(item => ({ url: item.src, bytes: item.bytes, kind: 'image' as const }));
  const entries = [...base.entries, ...screens];
  return { ...base, entries, bytes: entries.reduce((total, item) => total + item.bytes, 0) };
}
