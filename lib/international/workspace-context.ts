/** A no-map workspace can use the existing South African reference planner only
 * after an explicit choice. This records a reference basis, never a farm's country
 * or approval for local agronomy. Mapped sites use their separate site context. */
export interface WorkspacePlanningReference {
  workspaceId: string;
  basis: 'south-african-reference';
  acknowledgedAt: string;
}

export function validWorkspacePlanningId(value: unknown): value is string {
  return typeof value === 'string' && (value === 'virtual-bed'
    || /^design:[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.exec(value)?.[0] === value);
}

/** The on-device copy may retain a cloud design's stable ID even when the
 * picker says "this device". All consumers must address the same workspace. */
export function workspacePlanningIdForDesign(
  design: { designId?: unknown } | null | undefined,
  selectedDesignId?: string | null,
): string | null {
  if (!design) return null;
  const id = selectedDesignId && selectedDesignId !== 'local' ? selectedDesignId
    : typeof design.designId === 'string' && design.designId ? design.designId : 'local';
  const workspaceId = `design:${id}`;
  return validWorkspacePlanningId(workspaceId) ? workspaceId : null;
}

function normaliseReference(value: unknown): WorkspacePlanningReference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Partial<WorkspacePlanningReference>;
  if (!validWorkspacePlanningId(row.workspaceId) || row.basis !== 'south-african-reference'
    || typeof row.acknowledgedAt !== 'string') return null;
  const instant = Date.parse(row.acknowledgedAt);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== row.acknowledgedAt) return null;
  return { workspaceId: row.workspaceId, basis: row.basis, acknowledgedAt: row.acknowledgedAt };
}

/** Corrupt optional data cannot turn a legacy plan into an acknowledged reference
 * workspace. Only that workspace's latest complete acknowledgement survives. */
export function sanitiseWorkspacePlanningReferences(value: unknown): WorkspacePlanningReference[] {
  if (!Array.isArray(value)) return [];
  const references = new Map<string, WorkspacePlanningReference>();
  for (const candidate of value) {
    const reference = normaliseReference(candidate);
    if (!reference) continue;
    const previous = references.get(reference.workspaceId);
    if (!previous || previous.acknowledgedAt < reference.acknowledgedAt) references.set(reference.workspaceId, reference);
  }
  return [...references.values()];
}

export function resolveWorkspacePlanningReference(value: unknown, workspaceId: unknown): WorkspacePlanningReference | null {
  if (!validWorkspacePlanningId(workspaceId)) return null;
  return sanitiseWorkspacePlanningReferences(value).find(reference => reference.workspaceId === workspaceId) ?? null;
}

export function createWorkspacePlanningReference(
  workspaceId: unknown,
  confirmed: boolean,
  acknowledgedAt = new Date().toISOString(),
): WorkspacePlanningReference | null {
  if (confirmed !== true) return null;
  return normaliseReference({ workspaceId, basis: 'south-african-reference', acknowledgedAt });
}

export function replaceWorkspacePlanningReference(value: unknown, reference: WorkspacePlanningReference): WorkspacePlanningReference[] {
  const next = normaliseReference(reference);
  const previous = sanitiseWorkspacePlanningReferences(value);
  return next ? [...previous.filter(row => row.workspaceId !== next.workspaceId), next] : previous;
}

export function removeWorkspacePlanningReference(value: unknown, workspaceId: unknown): WorkspacePlanningReference[] {
  return sanitiseWorkspacePlanningReferences(value).filter(reference => reference.workspaceId !== workspaceId);
}
