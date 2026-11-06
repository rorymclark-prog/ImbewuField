import { createElement } from 'react';
import type { GrowerCycleOriginView } from '@/lib/international/grower-cycle';
import { readGrowerCycleIntent } from '@/lib/international/grower-cycle-intent';

/** One readback for saved records and raising batches. Requested weight belongs
 * to the whole demand; repeating it on a batch must not imply another harvest. */
export default function GrowerCycleIntent({ view }: { view: GrowerCycleOriginView | undefined }) {
  const intent = readGrowerCycleIntent(view);
  return createElement('div', { className: 'min-w-0 space-y-1 [overflow-wrap:anywhere]' },
    ...intent.lines.map((text, index) => createElement('p', { key: index, className: 'whitespace-pre-wrap [overflow-wrap:anywhere]' }, text)));
}
