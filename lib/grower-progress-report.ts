import { activeAccountLocalStorageKey } from './account-local-storage';
import { cropByKey } from './crop-catalog';
import { inspectJournalGrowerLink, inspectJournalNurseryFieldPlanting, inspectJournalRowsForWrite, normaliseGrowerJournalLink, type JournalEntry } from './field-journal';
import { JOURNAL_LEGACY_KEY, readJournalStorage } from './journal-storage';
import { captureJournalObservationContext, journalObservationContextIsCurrent, revokeJournalObservationContext } from './length-unit-preference';
import type { GrowerCycleContext } from './international/grower-cycle';
import { projectGrowerCycles, type GrowerCycleEventKind } from './international/grower-cycle-projection';
import { growerPlanningScopeKey } from './international/grower-planning';
import { buildProvisionalCycleEvidence } from './international/provisional-crop-export';

type JournalRows = readonly JournalEntry[] | null;

function readJournalCopy() {
  const state = readJournalStorage();
  if (state.status === 'sample') {
    const key = activeAccountLocalStorageKey(JOURNAL_LEGACY_KEY);
    return { sample: true, address: key, token: null, raw: window.localStorage.getItem(key) ?? '[]' };
  }
  return { sample: false, address: null, token: state.token, raw: state.status === 'ready' ? state.journalRaw : null };
}

/** Take a read-only copy. A missing or held journal must not look like an empty one. */
export function captureGrowerReportJournal(sample: boolean) {
  const context = captureJournalObservationContext();
  const release = () => revokeJournalObservationContext(context);
  const actorIsCurrent = () => journalObservationContextIsCurrent(context);
  try {
    if (!actorIsCurrent()) { release(); return null; }
    const before = readJournalCopy();
    const rows: JournalRows = before.raw === null ? null : inspectJournalRowsForWrite(before.raw)?.entries ?? null;
    if (!actorIsCurrent() || before.sample !== sample) { release(); return null; }
    return {
      rows,
      isCurrent() {
        try {
          if (!actorIsCurrent()) return false;
          const after = readJournalCopy();
          return actorIsCurrent() && before.sample === after.sample && before.address === after.address
            && before.token === after.token && before.raw === after.raw;
        } catch { return false; }
      },
      release,
    };
  } catch { release(); return null; }
}

const eventLabel: Record<GrowerCycleEventKind, string> = {
  'nursery-start': 'Nursery start',
  'field-entry': 'Field entry',
  'first-pick': 'First pick',
  'picking-end': 'Picking ends before',
  'field-clear': 'Field-clear boundary',
  'next-entry': 'Next field-entry boundary',
};

function html(value: string | number): string {
  return String(value).replace(/[&<>"']/g, character =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
}

/** Export only the selected planting, even if a book contains several sites
 * with identically named beds. A retained note must match its exact event. */
export function buildGrowerProgressReport(
  plantings: unknown, contexts: readonly GrowerCycleContext[], selection: unknown,
  journal: JournalRows, sample: boolean,
): string | null {
  const link = normaliseGrowerJournalLink(selection);
  if (!link) return null;
  const scope = growerPlanningScopeKey(link.scope);
  const matches = contexts.filter(context => growerPlanningScopeKey(context.scope) === scope);
  if (matches.length !== 1) return null;
  const context = matches[0];
  const cycle = projectGrowerCycles(plantings, context).ownCycles.find(row => row.plantingId === link.plantingId);
  if (!cycle || cycle.bedId !== link.bedId
    || !cycle.plannedEvents.some(event => event.kind === link.eventKind && event.date === link.plannedDate)) return null;
  const bed = context.beds.find(row => row.id === cycle.bedId);
  const crop = cropByKey(cycle.cropKey);
  if (!bed || !crop) return null;
  const snapshot = cycle.assessment.snapshot;
  const provisional = snapshot.profile.provisionalOrigin ? buildProvisionalCycleEvidence(snapshot) : null;
  if (snapshot.profile.provisionalOrigin && !provisional) return null;
  const observations = (journal ?? []).flatMap(entry => {
    const result = inspectJournalGrowerLink(entry);
    if (result.status !== 'linked') return [];
    const saved = result.link;
    if (growerPlanningScopeKey(saved.scope) !== scope || saved.plantingId !== cycle.plantingId || saved.bedId !== cycle.bedId
      || !cycle.plannedEvents.some(event => event.kind === saved.eventKind && event.date === saved.plannedDate)) return [];
    const fieldPlanting = inspectJournalNurseryFieldPlanting(entry);
    return [{ observed: entry.date, planned: saved.plannedDate, event: eventLabel[saved.eventKind], notes: entry.notes,
      planted: fieldPlanting.status === 'observed' ? fieldPlanting.observation.plantsPlanted : null }];
  }).sort((a, b) => a.observed.localeCompare(b.observed));
  const inputs = snapshot.profile.inputs;
  const inputRows = ([
    ['Establishment method', inputs.establishment],
    ['Nursery duration', inputs.nurseryDays],
    ['Field entry to first pick', inputs.fieldEntryToFirstHarvestDays],
  ] as const).map(([label, input]) => {
    if (input.state !== 'provided') return `<li>${label}: unknown.</li>`;
    const value = input.unit === 'days' ? `${input.value} days` : input.value === 'direct' ? 'Direct sowing' : 'Transplanting';
    const provenance = input.provenance;
    const basis = provenance.kind === 'external-reference' ? `Reference entered by grower: ${provenance.reference}`
      : provenance.kind === 'grower-record' ? `Grower record: ${provenance.reference}` : 'Grower estimate';
    return `<li>${label}: ${html(value)} · ${html(basis)}.</li>`;
  }).join('');
  const plan = cycle.plannedEvents.map(event => `<tr><th scope="row">${eventLabel[event.kind]}</th><td>${html(event.date)}</td></tr>`).join('');
  const records = observations.map(entry => `<article><h3>${html(entry.event)}</h3><p>Observed <strong>${html(entry.observed)}</strong> · planned ${html(entry.planned)} (UTC)</p>${entry.planted === null ? '' : `<p>Plants recorded as planted: ${html(entry.planted)}</p>`}<p class="notes">${html(entry.notes)}</p></article>`).join('');
  const title = `${sample ? 'DEMO · ' : ''}${crop.name} progress report`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${html(title)}</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#1d2e23;background:#f6f7f3}
body{margin:0}main{max-width:48rem;margin:auto;padding:2rem 1.25rem;overflow-wrap:anywhere}
header{border-bottom:3px solid #427052;padding-bottom:1rem}h1{font-family:Georgia,serif;line-height:1.1;margin:.3em 0}
h2{font-size:1.22rem;margin:0}h3{font-size:1rem;margin:0}section{margin:1.35rem 0}
p{margin:.42em 0}table{border-collapse:collapse;width:100%;margin-top:.6rem}
th,td{text-align:left;border-bottom:1px solid #c6cfc4;padding:.43rem .3rem}
td{font-variant-numeric:tabular-nums}article{border-left:3px solid #7c9e87;padding:.45rem .85rem;margin:.8rem 0;background:#fff}
.notes{white-space:pre-wrap}.quiet{color:#425248}li{margin:.35rem 0}
@page{margin:16mm}@media print{:root{background:#fff}main{padding:0}h2,h3{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><main>
<header><p>ImbewuField · One saved crop cycle</p><h1>${html(title)}</h1><p>${html(bed.label || 'Measured bed')}</p>
${sample ? '<p><strong>Demonstration only.</strong> The plan and observations are examples.</p>' : ''}</header>
<section><h2>Saved site measurement</h2><p>Bed area used in the plan: <strong>${html(cycle.assessment.capacity.measuredAreaM2)} m²</strong>. From the saved design.</p></section>
<section><h2>Planned work</h2><p class="quiet">Saved estimates. Dates use the UTC calendar. End and next-entry boundaries do not record an activity.</p>
<table aria-label="Planned work"><thead><tr><th scope="col">Activity or boundary</th><th scope="col">Planned date</th></tr></thead><tbody>${plan}</tbody></table></section>
<section><h2>Recorded work</h2><p class="quiet">Grower-entered notes linked to this crop cycle.</p>
${records || (journal === null ? '<p>Journal unavailable for this report. Recorded work is unknown.</p>' : '<p>No journal observations matched the current plan. Recorded work is unknown.</p>')}</section>
<section><h2>Planning evidence and limits</h2>
<ul>${inputRows}</ul>
${provisional ? `<h3>Reviewed sources, assumptions and limits</h3><ul>${provisional.lines.map(line => `<li>${html(line)}</li>`).join('')}</ul>`
  : '<p>A reviewed regional source is unavailable in this report.</p>'}
<p>Actual harvest, costs and water use are unknown in this report.</p></section>
</main></body></html>`;
}
