import type { RecordUnit } from '@/lib/farm-records';
import { useLanguage } from '@/lib/i18n';
import { recordsFill, recordsQuantityLabel } from '@/lib/records-regional-drafts';

/** Separate lines preserve units and give count records room on a narrow phone. */
export default function RecordQuantitySummary({ totals, compact = false }: {
  totals: readonly { unit: RecordUnit; quantity: number }[];
  compact?: boolean;
}) {
  const { lang } = useLanguage();
  if (totals.length === 0) return <span className="text-sm font-sans font-normal">{recordsFill(lang, 'No quantity recorded')}</span>;
  return <div className="flex flex-col gap-1 min-w-0" data-record-quantity-summary>
    {totals.map((row, index) => <span key={row.unit} className="block break-words" style={{ fontSize: compact ? (index === 0 ? 16 : 13) : (index === 0 ? 22 : 15), lineHeight: 1.3, fontWeight: index === 0 ? 700 : 500 }}>
      {recordsQuantityLabel({ quantity: row.quantity, unit: row.unit, kg: row.unit === 'kg' ? row.quantity : null }, lang)}
    </span>)}
  </div>;
}
