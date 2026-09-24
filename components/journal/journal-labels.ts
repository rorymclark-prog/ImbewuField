import type { JournalCategory } from '@/lib/field-journal';

const ZULU_CATEGORY_LABELS: Record<JournalCategory, string> = {
  planting: 'Ukutshala',
  harvest: 'Ukuvuna',
  weather: 'Isimo sezulu',
  pest: 'Izinambuzane / izifo',
  maintenance: 'Ukunakekela',
  training: 'Isivakashi / ukuqeqesha',
  other: 'Okunye',
};

export function journalCategoryLabel(key: JournalCategory): string {
  return ZULU_CATEGORY_LABELS[key];
}

export function formatZuluMonth(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return 'Usuku alwaziwa';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return 'Usuku alwaziwa';
  // Browser locale packs can fall back to English for zu-ZA, even when Node has Zulu month names.
  const names = ['Januwari', 'Februwari', 'Mashi', 'Ephreli', 'Meyi', 'Juni', 'Julayi', 'Agasti', 'Septhemba', 'Okthoba', 'Novemba', 'Disemba'];
  return `${names[month - 1]} ${match[1]}`;
}

export function formatZuluJournalDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) return value;
  const days = ['Son', 'Mso', 'Bil', 'Tha', 'Sin', 'Hla', 'Mgq'];
  const months = ['Jan', 'Feb', 'Mas', 'Eph', 'Mey', 'Jun', 'Jul', 'Aga', 'Sep', 'Okt', 'Nov', 'Dis'];
  return `${days[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}
