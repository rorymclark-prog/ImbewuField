import type { DeviceStore, DeviceRow } from './field-device-store';
import { fieldUrl, writeIdentity, overlayFieldWrites, queuedResult, type FieldWrite } from './field-request-model';
export type FieldClientOptions = { store: DeviceStore; scope: string; assertCurrent(): void; online(): boolean; send(url: string, body?: Record<string, any>): Promise<any>; now?: () => number; changed?(synced: boolean): void };
export function createFieldClient(options: FieldClientOptions) {
  const { store, scope, assertCurrent } = options, now = options.now ?? Date.now;
  const cacheKey = (url: string) => `${scope}|cache|${url}`;
  const all = async () => { assertCurrent(); const rows = await store.all(scope); assertCurrent(); return rows; };
  const writes = async () => (await all()).filter(row => row.kind === 'write');
  function durableError(error: unknown) { return Error(`Could not save on this device. Keep the form open. ${error instanceof Error ? error.message : ''}`); }
  async function saveRow(row: DeviceRow) { assertCurrent(); await store.change(row.key, () => { assertCurrent(); return row; }); assertCurrent(); }
  async function cacheRead(url: string, value: any) {
    try { await saveRow({ key: cacheKey(url), scope, kind: 'cache', value: { url, data: value, savedAt: now() } }); } catch { /* A live read can work even when device storage is unavailable. */ }
  }
  async function read(raw: string) {
    const url = fieldUrl(raw); assertCurrent();
    let data: any, cached = false, savedAt = now();
    if (options.online()) {
      try { data = await options.send(url); assertCurrent(); await cacheRead(url, data); }
      catch (error) {
        assertCurrent();
        const status = (error as any)?.status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          // Never mask an explicit access refusal with a formerly authorised copy.
          const path = new URL(url, 'https://field.local').pathname;
          for (const row of await all()) if (row.kind === 'cache' && new URL(row.value.url, 'https://field.local').pathname === path) await store.change(row.key, () => undefined);
          throw error;
        }
      }
    }
    if (data === undefined) {
      const row = await store.get(cacheKey(url)); assertCurrent();
      if (!row) {
        // New queued records have their evidence on the device before any remote photo GET.
        if (new URL(url, 'https://field.local').searchParams.get('mode') === 'photos') {
          const pending = (await writes()).map(r => r.value as FieldWrite);
          const withPhotos = overlayFieldWrites(url, {}, pending);
          if (Array.isArray(withPhotos.photos)) return { ...withPhotos, _device: { cached: true, pending: true } };
        }
        throw Error('This information is not saved on this device yet. Open it with a connection or use Offline & sync to prepare it.');
      }
      data = row.value.data; cached = true; savedAt = row.value.savedAt;
    }
    const pending = (await writes().catch(error=>{assertCurrent();if(cached)throw error;return [];})).map(r => r.value as FieldWrite);
    return { ...overlayFieldWrites(url, data, pending), _device: { cached, savedAt, pending: pending.some(w=>{const a=new URL(w.url,'https://field.local'),b=new URL(url,'https://field.local');return a.pathname===b.pathname&&a.searchParams.get('org')===b.searchParams.get('org');}) } };
  }
  async function syncOne(key: string) {
    assertCurrent(); if (!options.online()) return;
    let claimed = false;
    const row = await store.change(key, current => {
      assertCurrent(); if (!current || current.scope !== scope) return current;
      const w = current.value as FieldWrite;
      if (w.state === 'review' || w.state === 'sending' && w.leaseUntil > now()) return current;
      claimed = true; return { ...current, value: { ...w, state: 'sending', leaseUntil: now() + 60000 } };
    });
    if (!claimed || !row) return;
    const write = row.value as FieldWrite;
    try {
      assertCurrent(); const result = await options.send(write.url, { ...write.body, clientOperationId: write.operationId }); assertCurrent();
      if (result.saved !== true) throw Error('The server did not confirm this save.');
      // Store the acknowledged record locally before removing the durable queue item.
      // A lost acknowledgement is safe: the server recognises this operation ID on retry.
      const confirmed = structuredClone(write); confirmed.acknowledged = true;
      confirmed.body.expectedSubmittedAt = result.updatedAt ?? confirmed.body.expectedSubmittedAt;
      confirmed.body.expectedUpdatedAt = result.updatedAt ?? result.visit?.updatedAt ?? confirmed.body.expectedUpdatedAt;
      if (result.visit) Object.assign(confirmed.body, result.visit);
      for (const cached of await all()) if (cached.kind === 'cache') {
        const a = new URL(cached.value.url, 'https://field.local'), b = new URL(write.url, 'https://field.local');
        if (a.pathname === b.pathname && a.searchParams.get('org') === b.searchParams.get('org')) {
          await saveRow({ ...cached, value: { ...cached.value, data: overlayFieldWrites(cached.value.url, cached.value.data, [confirmed]) } });
        }
      }
      const evidence=confirmed.body.action==='session'?confirmed.body.session:confirmed.body.action==='visit'?confirmed.body:null;
      if(evidence&&Array.isArray(evidence.photos)){
        const photoUrl=new URL(write.url,'https://field.local');photoUrl.searchParams.set('mode','photos');photoUrl.searchParams.set('id',evidence.id);
        const normal=fieldUrl(photoUrl.pathname+photoUrl.search);
        await saveRow({key:cacheKey(normal),scope,kind:'cache',value:{url:normal,data:{photos:evidence.photos},savedAt:now()}});
      }
      await store.change(key, current => { assertCurrent(); return current?.value.operationId === write.operationId ? undefined : current; });
      options.changed?.(true);
      return result;
    } catch (error) {
      // The row remains under its ORIGINAL owner even if the user switches accounts.
      const status = (error as any)?.status;
      await store.change(key, current => current?.value.operationId === write.operationId ? { ...current, value: { ...current.value,
        state: status >= 400 && status < 500 && ![408,429].includes(status) ? 'review' : 'waiting', leaseUntil: 0,
        error: error instanceof Error ? error.message : 'Waiting for a connection.' } } : current);
      options.changed?.(false);
    }
  }
  async function request(raw: string, body?: Record<string, any>) {
    const url = fieldUrl(raw); assertCurrent();
    if (!body) return read(url);
    const type = writeIdentity(url, body);
    if (!type) {
      if (!options.online()) throw Error('This action needs a connection. Your field records can still be saved on this device.');
      const result = await options.send(url, body); assertCurrent(); return result;
    }
    const key = `${scope}|write|${url}|${type.resource}`;
    if (new TextEncoder().encode(JSON.stringify(body)).length > 1550000) throw Error('This entry is too large. Use smaller photos or split the register.');
    try {
      await store.change(key, previous => {
        assertCurrent(); const old = previous?.value as FieldWrite | undefined;
        if (old?.state === 'sending' && old.leaseUntil > now()) throw Error('This record is sending. Wait for it to finish before saving another edit.');
        if (old?.state === 'review') throw Error('This saved entry needs review in Offline & sync before it can be replaced.');
        const value: FieldWrite = { url, body: { ...body, ...(old ? { expectedUpdatedAt: old.body.expectedUpdatedAt, expectedSubmittedAt: old.body.expectedSubmittedAt } : {}) },
          operationId: crypto.randomUUID(), label: type.label, createdAt: old?.createdAt ?? now(), state: 'waiting', leaseUntil: 0 };
        return { key, scope, kind: 'write', value };
      });
    } catch (e) { throw durableError(e); }
    options.changed?.(false);
    const acknowledgement = options.online() ? await syncOne(key) : undefined;
    assertCurrent(); const remaining = await store.get(key); assertCurrent();
    if (remaining) {
      if (remaining.value.state === 'review') throw Error(`Saved on this device; server confirmation needs review: ${remaining.value.error} Open Offline & sync to review it.`);
      return queuedResult(remaining.value);
    }
    // The UI needs the canonical visit shape immediately; then a fresh GET refreshes it.
    const queued = queuedResult({ body } as FieldWrite);
    return { ...queued, ...acknowledgement, saved: true, queued: false };
  }
  async function sync() { for (const row of await writes()) { assertCurrent(); if (!options.online()) break; await syncOne(row.key); } }
  return { request, sync, writes };
}
