'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isDifferentBuild } from '@/lib/pwa-update';

interface BuildInfo {
  sha?: string | null;
}

const UPDATE_CHECK_MS = 60_000;
const UPDATE_RELOAD_TIMEOUT_MS = 1_200;

/**
 * Registers /sw.js and surfaces a small non-blocking toast once a NEW worker
 * has taken control of the page. Deliberately never auto-reloads: the owner
 * values reliability over auto-magic, and a manual "Refresh" tap sidesteps
 * any reload-loop risk entirely (there is nothing here that can retrigger
 * itself — only a user click calls location.reload()).
 */
export default function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [nextBuildSha, setNextBuildSha] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  // This is the build the currently-running JS first observed. A later API response with a
  // different SHA means Vercel has deployed new code even if Chrome missed the SW lifecycle event.
  const loadedBuildShaRef = useRef<string | null>(null);

  const markUpdateAvailable = useCallback((sha?: string | null) => {
    if (sha) setNextBuildSha(sha);
    setUpdateAvailable(true);
  }, []);

  const checkBuild = useCallback(async () => {
    try {
      const res = await fetch(`/api/build-info?update-check=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json() as BuildInfo;
      const latestSha = data.sha?.trim() || null;
      if (!loadedBuildShaRef.current) {
        loadedBuildShaRef.current = latestSha;
      } else if (isDifferentBuild(loadedBuildShaRef.current, latestSha)) {
        markUpdateAvailable(latestSha);
      }
    } catch {
      // Update checks must never interrupt normal app use.
    }
  }, [markUpdateAvailable]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supportsServiceWorker = 'serviceWorker' in navigator;

    // If a controller already exists when this mounts, this device has an
    // installed worker from a previous visit — any later controllerchange is
    // therefore a real update, not the device's very first-ever install.
    let hadControllerBefore = supportsServiceWorker && Boolean(navigator.serviceWorker.controller);

    let cancelled = false;
    const cleanup: Array<() => void> = [];

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onStateChange = () => {
        if (worker.state === 'installed' && hadControllerBefore) markUpdateAvailable();
      };
      worker.addEventListener('statechange', onStateChange);
      cleanup.push(() => worker.removeEventListener('statechange', onStateChange));
      onStateChange();
    };

    if (supportsServiceWorker) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          if (cancelled) return;
          registrationRef.current = reg;
          if (reg.waiting && hadControllerBefore) markUpdateAvailable();
          watchInstallingWorker(reg.installing);
          const onUpdateFound = () => watchInstallingWorker(reg.installing);
          reg.addEventListener('updatefound', onUpdateFound);
          cleanup.push(() => reg.removeEventListener('updatefound', onUpdateFound));
          void reg.update().catch(() => {});
        })
        .catch(() => {
          // Registration can fail (e.g. private browsing) — the build-SHA check
          // below still provides the manual refresh prompt while the app keeps working.
        });
    }

    // Browsers only check for a changed sw.js on navigation, or roughly every
    // 24h — nudge that check whenever the tab regains focus so updates are
    // caught sooner without polling constantly in the background.
    const checkForUpdates = () => {
      if (document.visibilityState === 'visible') {
        if (supportsServiceWorker) void registrationRef.current?.update().catch(() => {});
        void checkBuild();
      }
    };
    document.addEventListener('visibilitychange', checkForUpdates);
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('online', checkForUpdates);
    const timer = window.setInterval(checkForUpdates, UPDATE_CHECK_MS);
    void checkBuild();

    const onControllerChange = () => {
      if (hadControllerBefore) {
        markUpdateAvailable();
      }
      hadControllerBefore = true;
    };
    if (supportsServiceWorker) navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkForUpdates);
      window.removeEventListener('focus', checkForUpdates);
      window.removeEventListener('online', checkForUpdates);
      if (supportsServiceWorker) navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      cleanup.forEach((fn) => fn());
      registrationRef.current = null;
    };
  }, [checkBuild, markUpdateAvailable]);

  const refreshToUpdate = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const registration = registrationRef.current ?? await navigator.serviceWorker.getRegistration('/');
        // Normally /sw.js calls skipWaiting itself. This message also handles an older waiting
        // worker from a previous build before that behavior existed.
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        // Chromium can leave update() pending while a dev server recompiles, and some installed
        // PWAs do the same on a weak connection. Never let that block the user's explicit reload.
        await Promise.race([
          registration?.update().catch(() => {}) ?? Promise.resolve(),
          new Promise<void>((resolve) => window.setTimeout(resolve, UPDATE_RELOAD_TIMEOUT_MS)),
        ]);
      }
    } finally {
      window.location.reload();
    }
  }, [refreshing]);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1f2937',
        color: '#fff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontSize: '0.875rem',
      }}
    >
      <span>New version{nextBuildSha ? ` ${nextBuildSha}` : ''} available.</span>
      <button
        onClick={refreshToUpdate}
        disabled={refreshing}
        style={{
          background: '#fff',
          color: '#1f2937',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.25rem 0.75rem',
          cursor: refreshing ? 'wait' : 'pointer',
          fontWeight: 600,
          opacity: refreshing ? 0.7 : 1,
        }}
      >
        {refreshing ? 'Refreshing…' : 'Refresh update'}
      </button>
    </div>
  );
}
