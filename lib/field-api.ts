'use client';
import { fieldVisitDocumentId } from './field-teams';
import { getFirebase } from './firebase/init';
import { paidApiHeaders } from './api-client-auth';
import { isSampleMode } from './sample-mode';
import { fieldIdentity, fieldScope } from './field-session';
import { fieldDeviceStore } from './field-device-store';
import { createFieldClient } from './field-api-core';
import { FIELD_CHANGED, FIELD_SYNCED } from './field-request-model';
export function currentFieldClient() {
  const actor = getFirebase()?.auth.currentUser, identity = fieldIdentity();
  if (!actor || !identity || identity.uid !== actor.uid || isSampleMode()) throw Error('Sign in and open your workspace before saving fieldwork on this device.');
  const scope = fieldScope(identity);
  const assertCurrent = () => { if (isSampleMode() || getFirebase()?.auth.currentUser?.uid !== actor.uid || !fieldIdentity() || fieldScope(fieldIdentity()!) !== scope) throw Error('The account or organisation changed. Reopen your workspace.'); };
  return createFieldClient({ store: fieldDeviceStore, scope, assertCurrent,
    online: () => typeof navigator !== 'undefined' && navigator.onLine,
    changed: synced => { window.dispatchEvent(new Event(FIELD_CHANGED)); if (synced) window.dispatchEvent(new Event(FIELD_SYNCED)); },
    async send(url, body) {
      assertCurrent();
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('Connection timed out. Your saved entry remains on this device.')); }, 15000); });
      try {
        return await Promise.race([timeout, (async () => {
          const headers = await paidApiHeaders(actor); assertCurrent();
          if (controller.signal.aborted) throw Error('Connection timed out.');
          const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { ...headers, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: controller.signal });
          assertCurrent(); const data = await response.json();
          if (!response.ok) throw Object.assign(Error(data.error ?? 'This request could not be completed.'), { status: response.status });
          return data;
        })()]);
      } finally { clearTimeout(timer); }
    },
  });
}
export function fieldApi(raw: string, body?: unknown) {
  const url = new URL(raw, 'https://field.local'), identity = fieldIdentity();
  if (['/api/field-teams','/api/programme-evidence','/api/production-sites','/api/assessments'].includes(url.pathname) && !url.searchParams.get('org') && identity?.org) url.searchParams.set('org', identity.org);
  if (url.origin !== 'https://field.local') throw Error('Choose an app fieldwork service.');
  const payload=body as Record<string, any> | undefined;
  const normalised=payload?.action==='visit' && url.pathname==='/api/field-teams' && identity ? {...payload,id:fieldVisitDocumentId(identity.uid,payload.id)} : payload;
  return currentFieldClient().request(url.pathname + url.search, normalised);
}
