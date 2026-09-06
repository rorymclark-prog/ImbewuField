'use client';
import { activeAccountLocalStorageKey } from './account-local-storage';

// Lab PDFs must remain readable, without consuming the thumbnail store's small budget.
// The owning account and site are captured before any asynchronous file work begins.
const sampleDocuments = new Map<string, Blob>();
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('imbewu-sample-mode-changed', () => sampleDocuments.clear());
export function evidenceDocumentScope(siteId: string): string {
  const sample = typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1';
  return `${sample ? 'sample' : activeAccountLocalStorageKey('imbewu-lab-documents')}::${encodeURIComponent(siteId)}::`;
}
export function validEvidencePdf(header: string, size: number): boolean {
  return header.startsWith('%PDF-') && Number.isFinite(size) && size > 0 && size <= 10 * 1024 * 1024;
}
async function documentStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('imbewu-lab-documents', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('documents');
    opening.onerror = () => reject(Error('Document storage is unavailable. Keep your original file and try again.'));
    opening.onblocked = () => reject(Error('Close other ImbewuField tabs and try saving the document again.'));
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction('documents', mode);
      const request = run(transaction.objectStore('documents'));
      transaction.oncomplete = () => { const result = request.result; db.close(); resolve(result); };
      transaction.onabort = transaction.onerror = () => { db.close(); reject(Error('The document could not be stored. Keep your original file.')); };
    };
  });
}
export async function saveEvidenceDocument(scope: string, file: File): Promise<string> {
  if (!validEvidencePdf(await file.slice(0, 5).text(), file.size)) throw Error('Choose a PDF up to 10 MB. For a photograph, choose an image instead.');
  const id = crypto.randomUUID();
  if (scope.startsWith('sample::')) sampleDocuments.set(scope + id, file);
  else await documentStore('readwrite', store => store.put(file, scope + id));
  return id;
}
export async function loadEvidenceDocument(siteId: string, id: string): Promise<Blob | null> {
  const scope = evidenceDocumentScope(siteId);
  const file = scope.startsWith('sample::') ? sampleDocuments.get(scope + id) : await documentStore('readonly', store => store.get(scope + id));
  if (scope !== evidenceDocumentScope(siteId)) return null;
  return file instanceof Blob ? file : null;
}
export async function removeEvidenceDocument(scope: string, id: string): Promise<void> {
  if (scope.startsWith('sample::')) sampleDocuments.delete(scope + id);
  else await documentStore('readwrite', store => store.delete(scope + id));
}
