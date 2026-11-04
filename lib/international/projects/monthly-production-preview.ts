import { sanitiseProductionRecords, type DatedProductionRecord } from '@/lib/production-records';

type MonthlyProductionRow = Pick<DatedProductionRecord, 'label' | 'quantity' | 'unit' | 'status'> & {
  month: string;
};

export type MonthlyProductionPreview =
  | { status: 'held' }
  | { status: 'ready'; rows: MonthlyProductionRow[] };

/** Read only a detached canonical receipt. Validate one row at a time so the
 * ordinary editor's last-wins deduplication cannot hide conflicting evidence. */
export function previewMonthlyProduction(
  records: unknown,
  siteId: string,
): MonthlyProductionPreview {
  if (!siteId || (records !== undefined && !Array.isArray(records))) return { status: 'held' };
  const selected: DatedProductionRecord[] = [];
  for (const raw of records ?? []) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { status: 'held' };
    if (raw.siteId !== siteId) continue;
    const [row] = sanitiseProductionRecords([raw]);
    if (!row || row.id !== raw.id || row.label !== raw.label) return { status: 'held' };
    selected.push(row);
  }
  if (sanitiseProductionRecords(selected).length !== selected.length) return { status: 'held' };

  const rows = selected.filter(row => row.provenance !== 'fictional-example')
    .map(({ date, label, quantity, unit, status }) => ({
      month: `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`,
      label, quantity, unit, status,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
  return { status: 'ready', rows };
}
