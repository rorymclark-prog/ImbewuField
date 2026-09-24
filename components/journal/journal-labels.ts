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
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat('zu-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
