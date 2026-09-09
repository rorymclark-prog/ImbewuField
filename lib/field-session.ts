// Bound by AuthProvider before its account subtree mounts. No credentials are persisted here.
export type FieldIdentity = { uid: string; org: string; role: string };
let identity: FieldIdentity | null = null;
export function bindFieldIdentity(next: FieldIdentity | null) { identity = next; }
export function fieldIdentity() { return identity; }
export function fieldScope(value: FieldIdentity) { return JSON.stringify([value.uid, value.org, value.role]); }
