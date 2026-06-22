// Sample farm records so anyone can test the assistant's finance/crop answers
// without signing in or capturing real data. Stored in localStorage; clearly
// labelled as sample data in the UI.

export interface DemoProduction { crop: string; kg: number; loggedAt: string }
export interface DemoSale { crop: string; kg: number; amount: number; buyer: string; soldAt: string }
export interface DemoProject {
  programme: string; funder: string; ngo: string;
  contractValue: number; disbursed: number; currency: string;
  garden: string; plotSizeM2: number; supervisor: string;
  startDate: string; endDate: string;
  obligations: string[];
  milestones: { name: string; due: string; status: string }[];
}

const PKEY = 'imbewu_demo_production';
const SKEY = 'imbewu_demo_sales';
const JKEY = 'imbewu_demo_project';

const SAMPLE_PRODUCTION: DemoProduction[] = [
  { crop: 'Spinach', kg: 120, loggedAt: '2026-04-12' },
  { crop: 'Tomatoes', kg: 85, loggedAt: '2026-03-28' },
  { crop: 'Maize', kg: 240, loggedAt: '2026-05-02' },
  { crop: 'Green beans', kg: 60, loggedAt: '2026-04-20' },
  { crop: 'Cabbage', kg: 95, loggedAt: '2026-05-10' },
  { crop: 'Carrots', kg: 48, loggedAt: '2026-05-18' },
  { crop: 'Sweet potato', kg: 70, loggedAt: '2026-06-01' },
];

const SAMPLE_SALES: DemoSale[] = [
  { crop: 'Spinach', kg: 90, amount: 1800, buyer: 'Local market', soldAt: '2026-04-15' },
  { crop: 'Tomatoes', kg: 65, amount: 1950, buyer: 'Spaza shops', soldAt: '2026-04-02' },
  { crop: 'Maize', kg: 180, amount: 1620, buyer: 'Co-op', soldAt: '2026-05-08' },
  { crop: 'Green beans', kg: 45, amount: 1350, buyer: 'Local market', soldAt: '2026-04-25' },
  { crop: 'Cabbage', kg: 80, amount: 1200, buyer: 'Restaurant', soldAt: '2026-05-14' },
];

const SAMPLE_PROJECT: DemoProject = {
  programme: 'Imbewu Food Gardens — Phase 2',
  funder: 'Tutuwa Community Foundation',
  ngo: 'ImbewuField NGO',
  contractValue: 18000,
  disbursed: 12000,
  currency: 'R',
  garden: 'Ezakheni Community Garden',
  plotSizeM2: 450,
  supervisor: 'Nomsa Dlamini',
  startDate: '2026-01-15',
  endDate: '2026-10-15',
  obligations: [
    'Keep at least 400 m² under organic production',
    'Submit monthly production & sales logs',
    'Attend the 9-month permaculture training',
    'Supply 60 kg/month to the school feeding scheme',
  ],
  milestones: [
    { name: 'Soil prep & first planting', due: '2026-02', status: 'done' },
    { name: 'Water harvesting installed', due: '2026-04', status: 'done' },
    { name: 'Mid-term yield review', due: '2026-06', status: 'in progress' },
    { name: 'Final harvest & report', due: '2026-10', status: 'pending' },
  ],
};

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-farmdata-changed'));
}

export function loadSampleFarmData() {
  try {
    localStorage.setItem(PKEY, JSON.stringify(SAMPLE_PRODUCTION));
    localStorage.setItem(SKEY, JSON.stringify(SAMPLE_SALES));
    localStorage.setItem(JKEY, JSON.stringify(SAMPLE_PROJECT));
  } catch {}
  notify();
}

export function clearSampleFarmData() {
  try { localStorage.removeItem(PKEY); localStorage.removeItem(SKEY); localStorage.removeItem(JKEY); } catch {}
  notify();
}

export function getLocalProduction(): DemoProduction[] {
  if (typeof window === 'undefined') return [];
  try { const v = JSON.parse(localStorage.getItem(PKEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function getLocalSales(): DemoSale[] {
  if (typeof window === 'undefined') return [];
  try { const v = JSON.parse(localStorage.getItem(SKEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function getLocalProject(): DemoProject | null {
  if (typeof window === 'undefined') return null;
  try { const v = localStorage.getItem(JKEY); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function hasSampleData(): boolean {
  return getLocalProduction().length > 0 || getLocalSales().length > 0 || !!getLocalProject();
}
