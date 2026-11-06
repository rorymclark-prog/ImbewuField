'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { getFirebase } from './firebase/init';
import { activeAccountUid } from './account-local-storage';
import { isSampleMode, SAMPLE_MODE_EVENT } from './sample-mode';
import { currentPlanningSupport } from './international/planning-support';
import { canonicalCoordinateSiteId } from './site-id';
import type { LocationData } from './types';
import type { LocalAdviceMode } from './local-advice-types';
import type { LocalAdviceClientSnapshot } from './local-advice-client';

export function readLocalAdviceActor() {
  const owner = activeAccountUid(), tokenUid = getFirebase()?.auth.currentUser?.uid ?? null, sample = isSampleMode();
  return { owner, tokenUid, sample, key: JSON.stringify([owner, tokenUid, sample]) };
}

/** This is a device-side freshness check, never server country authority. The
 * route independently reads only the authenticated caller's saved places. */
export function useLocalAdviceContext(location: LocationData | null, source: unknown | (() => unknown), mode: LocalAdviceMode = 'personal-site') {
  const { loading } = useAuth();
  const [, refresh] = useState(0);
  const version = useRef(0);
  const live = useRef({ location, source, mode, loading });
  live.current = { location, source, mode, loading };

  function read() {
    try {
      const value = live.current;
      const { owner, tokenUid, sample, key: actorKey } = readLocalAdviceActor();
      let adviceContext: LocalAdviceClientSnapshot['adviceContext'];
      if (value.loading) return { actorKey, snapshot: null };
      if (value.mode === 'general-help') adviceContext = { mode: 'general-help' };
      else {
        const loc = value.location;
        const siteId = loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)
          ? canonicalCoordinateSiteId(`site:${loc.lat.toFixed(5)},${loc.lon.toFixed(5)}`) : null;
        if (sample || !owner || owner !== tokenUid || !siteId) return { actorKey, snapshot: null };
        const support = currentPlanningSupport(siteId);
        if (support.mode !== 'south-african-site' || !support.allowCataloguePlanning) return { actorKey, snapshot: null };
        adviceContext = { mode: 'personal-site', siteId, countryFingerprint: support.fingerprint };
      }
      const key = JSON.stringify([actorKey, version.current, adviceContext, value.location, typeof value.source === 'function' ? value.source() : value.source]);
      return { actorKey, snapshot: { key, adviceContext } satisfies LocalAdviceClientSnapshot };
    } catch { return { actorKey: 'unavailable', snapshot: null }; }
  }
  const current = read();
  useEffect(() => {
    function invalidate() { ++version.current; refresh(n => n + 1); }
    // A withdrawal and restoration still retires the original request: comparing
    // only the final country value would miss that intervening event.
    const events = ['permamap-places-changed', 'imbewu-farmdata-changed', 'imbewu-reports-changed', SAMPLE_MODE_EVENT, 'storage'];
    for (const event of events) window.addEventListener(event, invalidate);
    return () => { ++version.current; for (const event of events) window.removeEventListener(event, invalidate); };
  }, []);
  return { ...current, isCurrent: (snapshot: LocalAdviceClientSnapshot) => read().snapshot?.key === snapshot.key };
}
