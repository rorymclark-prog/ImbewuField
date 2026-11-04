import Link from 'next/link';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { SiteContextResolution } from '@/lib/international/site-context';

export default function PlannerSupportHold({ resolution, beds, plantings, unmapped = false }: {
  resolution: SiteContextResolution;
  unmapped?: boolean;
  beds: readonly PlanBed[];
  plantings: readonly Planting[];
}) {
  return <section aria-label="Planning support" className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h1 className="font-display text-xl font-semibold">{unmapped ? 'Choose a reference basis for this unmapped workspace' : resolution.status === 'confirmed' ? 'Local crop planning is not available for this country yet' : 'Confirm the site country before crop planning'}</h1>
    <p className="mt-2 text-sm">The existing automatic planner uses South African source assumptions. Country details alone cannot approve a new region. Local calendars, forecasts, crop instructions and their PDF/calendar exports are unavailable here until the planning basis is reviewed.</p>
    <p className="mt-2 text-sm">Your saved sowing entries and mapped measurements remain stored. You can review those entries, keep actual production records and manage your own nursery equipment below. The catalogue nursery forecast is unavailable here. For a saved measured growing space, use Automatic plan from your estimates to review proposed seedling requirements from your own dates and inputs.</p>
    <p className="mt-2 text-sm"><Link href="/international" className="underline">Review international evidence and readiness</Link></p>
    <details className="mt-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Saved sowing entries · {plantings.length}</summary>
      <p className="mb-2 text-sm text-[var(--text-secondary)]">Saved entries, not a local planting recommendation or observed harvest. No new harvest date, yield or nursery timing is calculated in this view.</p>
      <ul className="space-y-2 text-sm">{plantings.map(planting => <li key={planting.id} className="rounded-lg border border-[var(--border)] p-2">
        <strong>{cropByKey(planting.cropKey)?.name ?? planting.cropKey}</strong> · {beds.find(bed => bed.id === planting.bedId)?.label ?? 'Saved bed'} · saved sowing month: {MONTHS_SHORT[planting.sowMonth - 1] ?? 'Unknown'}
      </li>)}</ul>
      {!plantings.length && <p className="text-sm">No saved sowing entries for these beds.</p>}
    </details>
  </section>;
}
