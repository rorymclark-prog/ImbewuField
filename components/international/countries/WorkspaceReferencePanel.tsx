'use client';

import { useState, type FormEvent } from 'react';
import { createWorkspacePlanningReference, resolveWorkspacePlanningReference, validWorkspacePlanningId, type WorkspacePlanningReference } from '@/lib/international/workspace-context';

export interface WorkspaceReferencePanelProps {
  workspaceId: string | null;
  reference: WorkspacePlanningReference | null;
  /** Return true only after the updated existing crop plan reaches its device store. */
  onReference: (reference: WorkspacePlanningReference | null) => boolean;
}

/** Remount on workspace changes so one workspace's unfinished acknowledgement
 * cannot become another workspace's consent. */
export default function WorkspaceReferencePanel(props: WorkspaceReferencePanelProps) {
  return <WorkspaceReferenceEditor key={props.workspaceId ?? 'no-workspace'} {...props} />;
}

function WorkspaceReferenceEditor({ workspaceId, reference, onReference }: WorkspaceReferencePanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const valid = validWorkspacePlanningId(workspaceId);
  const selected = !!resolveWorkspacePlanningReference([reference], workspaceId);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = createWorkspacePlanningReference(workspaceId, confirmed);
    if (!next) { setFailed(true); setStatus('Confirm the reference basis for this unmapped workspace first.'); return; }
    if (!onReference(next)) { setFailed(true); setStatus('The reference choice could not be saved. Please try again; your previous saved choice remains in place.'); return; }
    setConfirmed(false); setFailed(false);
    setStatus('Reference choice saved with this device’s crop plan. This does not confirm a farm country or local farming approval.');
  }

  function revoke() {
    if (!onReference(null)) { setFailed(true); setStatus('The reference choice could not be removed. Please try again.'); return; }
    setConfirmed(false); setFailed(false); setStatus('Reference choice removed. Your saved sowing entries remain in the crop plan.');
  }

  return <section aria-label="Unmapped workspace reference basis" className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 font-sans text-[var(--text-primary)]">
    <h2 className="font-display text-lg font-semibold">Planning without a mapped site</h2>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">The existing planner uses South African reference assumptions. You can explicitly use that reference basis for this unmapped workspace. It does not establish your farm’s country, local planting suitability or permission to grow a crop outside South Africa.</p>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">The choice stays with this device’s crop plan and this workspace only. It never applies to a mapped site, another workspace, currency, language or measurement units.</p>
    <p className="mt-2 text-sm text-[var(--text-secondary)]">Sample mode keeps this choice inside its temporary demonstration.</p>
    {!valid ? <p className="mt-3 text-sm">Open a local design or virtual-bed workspace to choose its reference basis.</p>
      : selected ? <div className="mt-3 space-y-2">
        <p className="text-sm font-semibold">South African reference planning selected for this unmapped workspace.</p>
        <button type="button" onClick={revoke} className="min-h-11 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold">Remove reference choice</button>
      </div> : <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I choose South African reference planning for this unmapped workspace.</label>
        <button type="submit" disabled={!confirmed} className="min-h-11 rounded-xl bg-[var(--color-forest-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save reference choice</button>
      </form>}
    {status && <p role={failed ? 'alert' : 'status'} className="mt-3 text-sm">{status}</p>}
  </section>;
}
