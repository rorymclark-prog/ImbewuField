'use client';

import { useEffect, useState } from 'react';

/**
 * Registers /sw.js and surfaces a small non-blocking toast once a NEW worker
 * has taken control of the page. Deliberately never auto-reloads: the owner
 * values reliability over auto-magic, and a manual "Refresh" tap sidesteps
 * any reload-loop risk entirely (there is nothing here that can retrigger
 * itself — only a user click calls location.reload()).
 */
export default function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // If a controller already exists when this mounts, this device has an
    // installed worker from a previous visit — any later controllerchange is
    // therefore a real update, not the device's very first-ever install.
    let hadControllerBefore = Boolean(navigator.serviceWorker.controller);

    let registration: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        // Registration can fail (e.g. private browsing, unsupported browser) —
        // the app must keep working without offline/update support either way.
      });

    // Browsers only check for a changed sw.js on navigation, or roughly every
    // 24h — nudge that check whenever the tab regains focus so updates are
    // caught sooner without polling constantly in the background.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        registration?.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const onControllerChange = () => {
      if (hadControllerBefore) {
        setUpdateAvailable(true);
      }
      hadControllerBefore = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

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
      <span>New version available.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#fff',
          color: '#1f2937',
          border: 'none',
          borderRadius: '0.375rem',
          padding: '0.25rem 0.75rem',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Refresh
      </button>
    </div>
  );
}
