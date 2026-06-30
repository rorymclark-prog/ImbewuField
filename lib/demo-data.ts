// Sample farm records so anyone can test the assistant's finance/crop answers
// without signing in or capturing real data. Stored in localStorage; clearly
// labelled as sample data in the UI.

import type { SalesLog, ProductionLog, ExpenseLog } from '@/lib/db/types';

// Full sample financing set for the Finances screen, dated relative to today so
// it lands in the month / season / year periods. Lets anyone preview the
// finance dashboard without signing in or capturing data.
export function sampleFinanceLogs(): { sales: SalesLog[]; production: ProductionLog[]; expenses: ExpenseLog[] } {
  const now = new Date();
  const iso = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };
  const S = (id: number, crop: string, kg: number, amount: number, buyer: string, daysAgo: number): SalesLog => ({
    id: `demo-s-${id}`, profile_id: 'demo', garden_id: null, crop, kg, amount, buyer, sold_at: iso(daysAgo), created_at: iso(daysAgo),
  });
  const P = (id: number, crop: string, kg: number, daysAgo: number): ProductionLog => ({
    id: `demo-p-${id}`, profile_id: 'demo', garden_id: null, crop, kg, photo_url: null, logged_at: iso(daysAgo), created_at: iso(daysAgo),
  });
  const E = (id: number, item: string, amount: number, supplier: string, daysAgo: number): ExpenseLog => ({
    id: `demo-e-${id}`, profile_id: 'demo', garden_id: null, item, amount, supplier, spent_at: iso(daysAgo), created_at: iso(daysAgo),
  });

  return {
    sales: [
      S(1, 'Spinach', 25, 500, 'Local market', 2),
      S(2, 'Tomatoes', 18, 540, 'Spaza shops', 4),
      S(3, 'Green beans', 12, 360, 'Restaurant', 8),
      S(4, 'Spinach', 30, 600, 'Local market', 11),
      S(5, 'Cabbage', 22, 330, 'Co-op', 16),
      S(6, 'Maize', 60, 540, 'Co-op', 23),
      S(7, 'Tomatoes', 24, 720, 'Local market', 29),
      S(8, 'Sweet potato', 35, 525, 'Spaza shops', 41),
      S(9, 'Spinach', 28, 560, 'Local market', 52),
      S(10, 'Beetroot', 15, 375, 'Restaurant', 68),
      S(11, 'Maize', 120, 1080, 'Co-op', 96),
      S(12, 'Pumpkin', 40, 600, 'Local market', 134),
    ],
    production: [
      P(1, 'Spinach', 32, 1),
      P(2, 'Tomatoes', 26, 5),
      P(3, 'Green beans', 14, 9),
      P(4, 'Cabbage', 28, 18),
      P(5, 'Maize', 140, 25),
      P(6, 'Sweet potato', 45, 44),
      P(7, 'Beetroot', 20, 70),
      P(8, 'Pumpkin', 55, 120),
    ],
    expenses: [
      E(1, 'Seedlings (spinach + tomato trays)', 220, 'Mayford', 3),
      E(2, 'Compost & manure', 180, 'Local supplier', 12),
      E(3, 'Drip irrigation pipe', 450, 'Agrimark', 27),
      E(4, 'Seed (maize + beans)', 160, 'Mayford', 40),
      E(5, 'Transport to market', 120, 'Taxi', 9),
      E(6, 'Hand tools', 300, 'Builders', 88),
    ],
  };
}

const FINANCE_DEMO_KEY = 'imbewu_finance_demo';

export function isFinanceDemoOn(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(FINANCE_DEMO_KEY) === '1'; } catch { return false; }
}
export function setFinanceDemo(on: boolean): void {
  try {
    if (on) localStorage.setItem(FINANCE_DEMO_KEY, '1');
    else localStorage.removeItem(FINANCE_DEMO_KEY);
  } catch {}
}

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
