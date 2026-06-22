// Sample farm records so anyone can test the assistant's finance/crop answers
// without signing in or capturing real data. Stored in localStorage; clearly
// labelled as sample data in the UI.

export interface DemoProduction { crop: string; kg: number; loggedAt: string }
export interface DemoSale { crop: string; kg: number; amount: number; buyer: string; soldAt: string }

const PKEY = 'imbewu_demo_production';
const SKEY = 'imbewu_demo_sales';

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

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-farmdata-changed'));
}

export function loadSampleFarmData() {
  try {
    localStorage.setItem(PKEY, JSON.stringify(SAMPLE_PRODUCTION));
    localStorage.setItem(SKEY, JSON.stringify(SAMPLE_SALES));
  } catch {}
  notify();
}

export function clearSampleFarmData() {
  try { localStorage.removeItem(PKEY); localStorage.removeItem(SKEY); } catch {}
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

export function hasSampleData(): boolean {
  return getLocalProduction().length > 0 || getLocalSales().length > 0;
}
