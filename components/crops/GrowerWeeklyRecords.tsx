'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recordQuantity, recordUnit } from '@/lib/farm-records';
import type { GardenReportRead } from '@/lib/international/projects/garden-report-source';
import { getSampleWorkspace, getSandboxSales } from '@/lib/sample-mode';
import { useSampleWorkspace } from '@/lib/use-role-navigation';
import type { WeeklyProductionCycle } from '@/lib/international/grower-weekly-production';
import type { HarvestTarget, PlanBed } from '@/lib/crop-plan';
import BuyerFulfilmentPanel, { type BuyerFulfilmentSave } from './BuyerFulfilmentPanel';
import type { useGrowerOperations } from './useGrowerOperations';

function quantityText(quantity: number, unit: string) {
  return `${quantity.toLocaleString('en-GB', { maximumSignificantDigits: 15 })} ${unit === 'each' ? 'items' : unit}`;
}

export default function GrowerWeeklyRecords({ siteId, operations, fulfilment }: {
  siteId: string;
  operations: ReturnType<typeof useGrowerOperations>;
  fulfilment?: { targetSiteId: string; targets: readonly HarvestTarget[]; save: BuyerFulfilmentSave; beds: readonly PlanBed[]; cycles: readonly WeeklyProductionCycle[] };
}) {
  const workspace = useSampleWorkspace();
  const [checkRevision, setCheckRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    siteId: string; workspace: typeof workspace; revision: number; result: GardenReportRead | null;
  } | null>(null);

  useEffect(() => {
    if (operations.status !== 'ready') return;
    let active = true;
    let receipt: GardenReportRead | null = null;
    const current = () => active && getSampleWorkspace() === workspace;
    void operations.readGardenReport(siteId, current).then(result => {
      if (!current()) {
        result?.release();
        return;
      }
      receipt = result;
      setSnapshot({ siteId, workspace, revision: operations.gardenRevision, result });
    }).catch(() => {
      if (current()) setSnapshot({ siteId, workspace, revision: operations.gardenRevision, result: null });
    });
    return () => {
      active = false;
      receipt?.release();
    };
  }, [siteId, workspace, operations.gardenRevision, operations.status, checkRevision]);

  const matches = snapshot?.siteId === siteId && snapshot.workspace === workspace
    && snapshot.revision === operations.gardenRevision && operations.status === 'ready';
  const current = matches && snapshot?.result?.isCurrent() ? snapshot.result : null;
  const practice = workspace === 'green-horizon' && getSampleWorkspace() === workspace;
  const sales = practice ? getSandboxSales() : [];
  return <><section aria-label="Recorded production and sales" className="grid gap-3 rounded-lg border border-[var(--border)] p-3 text-sm md:grid-cols-2">
    <div>
      <h3 className="font-semibold">Linked harvests</h3>
      {current?.records.harvest.length
        ? <ul className="mt-2 space-y-1">{current.records.harvest.map(row => <li key={row.recordId}>
          Picked {row.observedOn} · {quantityText(row.quantity, row.unit)}
          {row.recordedOn && <span> · entered {row.recordedOn}</span>}
        </li>)}</ul>
        : current && !current.records.incomplete
          ? <p>No linked harvests were found. Link a picked record to a dated cycle in the Task Planner.</p>
          : <p>{operations.status === 'loading' ? 'Checking linked harvests…' : 'Linked harvest quantity is unknown. Saved links could not be checked for this garden.'}</p>}
      {current?.records.incomplete && <p>Some linked records could not be checked.</p>}
      <p>Garden-wide records stay separate from the individual buyer orders.</p>
    </div>
    <div>
      <h3 className="font-semibold">{practice ? 'Recorded practice sales' : 'Recorded sales'}</h3>
      {practice && sales.length > 0 && <ul className="mt-2 space-y-1">{sales.map(row => {
        const quantity = recordQuantity(row), unit = recordUnit(row);
        return <li key={row.id}>{row.sold_at.slice(0, 10)} · {row.crop}
          {quantity !== null && unit ? ` · ${quantityText(quantity, unit)}` : ' · quantity unknown'}
          {row.buyer && <span> · {row.buyer}</span>}
        </li>;
      })}</ul>}
      <p className="mt-1">{fulfilment ? 'Review buyer deliveries in the fulfilment panel.' : 'Buyer delivery remains unknown. Sales stay in their own records.'}</p>
      <Link href="/records" prefetch={false} className="inline-flex min-h-11 items-center underline">View sales in Records</Link>
    </div>
  </section>
    {fulfilment && <BuyerFulfilmentPanel siteId={siteId} {...fulfilment} operations={operations} harvest={current} practice={practice}
      onRecheckHarvest={() => { setSnapshot(null); setCheckRevision(value => value + 1); }} />}
  </>;
}
