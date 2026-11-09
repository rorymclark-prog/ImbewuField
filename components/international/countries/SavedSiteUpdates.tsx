'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { subscribeUserPlaces, type PlacesSyncState } from '@/lib/user-sync';

type Delivery = { state: PlacesSyncState; retry: () => void };
const SiteUpdatesContext = createContext<Delivery | null>(null);
const noChange = () => {};

function usePlacesDelivery(enabled: boolean, onPlaces: () => void): Delivery {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [delivery, setDelivery] = useState<{ uid: string | null; state: PlacesSyncState }>({ uid: null, state: 'unavailable' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (!uid) { setDelivery({ uid: null, state: 'unavailable' }); return; }
    const stop = subscribeUserPlaces(uid, {
      onPlaces: () => {
        if (!active) return;
        onPlaces();
        window.dispatchEvent(new CustomEvent('permamap-places-changed'));
      },
      onState: state => { if (active) setDelivery({ uid, state }); },
    });
    const offline = () => { if (active) setDelivery({ uid, state: 'offline' }); };
    window.addEventListener('offline', offline);
    window.addEventListener('online', retry);
    return () => {
      active = false; stop();
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', retry);
    };
  }, [enabled, uid, onPlaces, attempt, retry]);
  const state = delivery.uid === uid ? delivery.state : uid ? 'syncing' : 'unavailable';
  return { state, retry };
}

/** One account-bound places subscription keeps tasks, reports and records current
 * even while the map is closed. It never starts shape/water/design reconciliation. */
export function SavedSiteUpdatesProvider({ children }: { children: ReactNode }) {
  const delivery = usePlacesDelivery(true, noChange);
  return <SiteUpdatesContext.Provider value={delivery}>{children}</SiteUpdatesContext.Provider>;
}

/** Standalone previews retain their own subscription; normal routes share the
 * provider rather than opening another cloud listener for every status line. */
export default function SavedSiteUpdates({ onPlaces = noChange }: { onPlaces?: () => void }) {
  const shared = useContext(SiteUpdatesContext);
  const local = usePlacesDelivery(!shared, onPlaces);
  useEffect(() => {
    if (!shared) return;
    window.addEventListener('permamap-places-changed', onPlaces);
    return () => window.removeEventListener('permamap-places-changed', onPlaces);
  }, [!!shared, onPlaces]);
  const { state, retry } = shared ?? local;
  return <div aria-live="polite" className="flex-shrink-0 px-3 py-1 font-sans text-xs text-[var(--text-secondary)] md:px-5">
    {state === 'live' ? 'Saved-site account updates are being checked. Each cloud save is confirmed separately.'
      : state === 'syncing' ? 'Checking saved-site account updates…'
        : state === 'offline' ? 'Saved-site updates are offline. Country changes on another device may not have arrived.'
          : 'Country details are available from this device. Live account updates are unavailable.'}
    {state === 'offline' && <button type="button" onClick={retry} className="ml-2 min-h-11 underline">Retry site updates</button>}
  </div>;
}
