import { createElement, Fragment } from 'react';
import { estimateNumberLabel } from '@/lib/format-figures';
import { growerCycleDemandSnapshotView, growerCycleQuantityEntryView, type GrowerCycleOriginView } from '@/lib/international/grower-cycle';

const paragraph = (text: string) => createElement('p', null, text);

/** One readback for saved records and raising batches. Requested weight belongs
 * to the whole demand; repeating it on a batch must not imply another harvest. */
export default function GrowerCycleIntent({ view }: { view: GrowerCycleOriginView | undefined }) {
  if (view?.status !== 'recorded') return paragraph('Planning purpose not recorded. Original requested weight and harvest window are not recorded.');
  const origin = view.origin;
  if (origin.kind === 'buyer-target') return paragraph('Planning purpose: buyer target.');
  const request = growerCycleDemandSnapshotView({ origin });
  const entered = growerCycleQuantityEntryView({ origin });
  const demand = request.status === 'recorded' ? request.demand : null;
  const weight = demand?.totalKg.state === 'provided' ? demand.totalKg.value : null;
  const window = demand?.harvestWindow.state === 'provided' ? demand.harvestWindow.value : null;
  return createElement('div', { className: 'min-w-0 space-y-1 [overflow-wrap:anywhere]' },
    paragraph(`Planning purpose: ${origin.purpose === 'trial' ? 'trial growing' : 'household food'}.`),
    entered.status === 'recorded' ? createElement('p', null, 'Original entered weight for this whole demand: ',
      createElement('span', { className: 'whitespace-pre-wrap [overflow-wrap:anywhere]' }, `${entered.entry.text} ${entered.entry.unit}`), '.')
      : paragraph('Original entered unit and text are not recorded. They have not been reconstructed from kilograms or cycle capacity.'),
    weight !== null && window ? createElement(Fragment, null,
      paragraph(`Original request for all cycles in this demand: ${estimateNumberLabel(weight)} kg gross across ${window.start} to before ${window.endExclusive} (UTC).`),
      paragraph('Kilograms are the canonical planning equivalent for this whole request.'),
      paragraph('This is the grower-entered planning estimate, not this batch’s output or an observed harvest.'))
      : paragraph('Original requested weight and harvest window are not recorded. They have not been inferred from this cycle.'));
}
