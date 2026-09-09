// Server-only acknowledgement receipt. The receipt and record commit in the SAME
// transaction, so losing the HTTP response cannot create a second history/evidence row.
import { createHash } from 'node:crypto';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';
type Receipt = { ref: DocumentReference; fingerprint: string };
export function fieldOperationReceipt(db: Firestore, actor: string, org: string, lane: string, body: Record<string, unknown>): Receipt | null {
  if (body.clientOperationId === undefined) return null;
  if (typeof body.clientOperationId !== 'string' || !/^[a-zA-Z0-9_-]{20,80}$/.test(body.clientOperationId)) throw Object.assign(Error('Invalid saved-operation identifier.'), { status: 400 });
  const id = createHash('sha256').update(JSON.stringify([actor, org, lane, body.clientOperationId])).digest('hex');
  return { ref: db.collection('field_operation_receipts').doc(id), fingerprint: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}
export async function readFieldReceipt(tx: Transaction, receipt: Receipt | null): Promise<{ updatedAt: string } | null> {
  if (!receipt) return null;
  const snap = await tx.get(receipt.ref);
  if (!snap.exists) return null;
  if (snap.data()?.fingerprint !== receipt.fingerprint) throw Object.assign(Error('This saved-operation identifier was already used for different content.'), { status: 409 });
  return { updatedAt: snap.data()!.updatedAt };
}
export function writeFieldReceipt(tx: Transaction, receipt: Receipt | null, updatedAt: string) {
  if (receipt) tx.create(receipt.ref, { fingerprint: receipt.fingerprint, updatedAt });
}
