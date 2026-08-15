'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isDifferentBuild } from '@/lib/pwa-update';
import { visibleNotes } from '@/lib/release-notes';

interface BuildInfo {
  sha?: string | null;
  /** The new build's own release notes — see the comment in app/api/build-info/route.ts. */
  notes?: unknown;
}

interface PWAUpdateNotifierProps {
  /** SHA baked into the HTML/JS currently running, not the first network response after mount. */
  initialBuildSha?: string | null;
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
export default function PWAUpdateNotifier({ initialBuildSha = null }: PWAUpdateNotifierProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [nextBuildSha, setNextBuildSha] = useState<string | null>(null);
  // Null until the server tells us; the local copy is the offline/older-server fallback.
  const [nextBuildNotes, setNextBuildNotes] = useState<string[] | null>(null);
  // IT WAS SITTING ON TOP OF THE APP'S OWN CONTROLS. Fixed, bottom-centre, 432x254, z-index 9999
  // — exactly where the Design Studio puts its Snap/Tidy confirm panel. Rory reported "snap to
  // neighbour still doesn't work" three times; it worked perfectly, computed the right answer and
  // rendered "✓ Snap to neighbour", and this banner was over the button. Verified by hit-testing
  // the confirm's own centre: the topmost element there was this div.
  //
  // A notice must never outrank the work. It now shrinks to a small pill after a few seconds and
  // can be dismissed outright — the update itself is not urgent (nothing breaks if you refresh in
  // ten minutes), so the full card is a courtesy, not a claim on the screen.
  // Default to compact pill so it never obstructs primary actions on mount.
  const [expanded, setExpanded] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  // Seeded by the server-rendered layout, so a deployment that lands before the first network
  // check cannot be mistaken for the build whose JavaScript is already running in this tab.
  const loadedBuildShaRef = useRef<string | null>(initialBuildSha?.trim() || null);

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
        // Only trust a well-formed list of strings — this text goes straight on screen, and the
        // fallback (our own bundle's notes) is a perfectly good answer if the shape is off.
        const served = Array.isArray(data.notes)
          ? data.notes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
          : [];
        setNextBuildNotes(served.length > 0 ? served : null);
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

  // Long enough to read the headline and the first note or two, short enough that it is out of the
  // way before anyone reaches for a control underneath it.
  useEffect(() => {
    if (!updateAvailable || !expanded) return;
    const t = window.setTimeout(() => setExpanded(false), 9000);
    return () => window.clearTimeout(t);
  }, [updateAvailable, expanded]);

  // Allow forcing the update notice on any screen during testing (?force-update=1 or ?show-update=1).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('force-update') || params.has('show-update')) {
      setUpdateAvailable(true);
      if (params.get('force-update') === 'expand' || params.get('expand') === '1') {
        setExpanded(true);
      }
    }
  }, []);

  // A new build un-dismisses so the update is visible, keeping compact pill mode.
  useEffect(() => {
    if (!nextBuildSha) return;
    setDismissed(false);
  }, [nextBuildSha]);

  if (!updateAvailable || dismissed) return null;
  // The NEW build's notes when the server could supply them; ours only as a fallback (a
  // service-worker-triggered update never hits /api/build-info, and an offline tab cannot ask).
  const notes = nextBuildNotes ?? visibleNotes();
  const VISIBLE_NOTES_CAP = 2;
  const displayedNotes = showAllNotes ? notes : notes.slice(0, VISIBLE_NOTES_CAP);
  const remainingNotesCount = notes.length - VISIBLE_NOTES_CAP;

  // Spaced clear of the fixed bottom navigation (calc(var(--bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 0.5rem))
  // and horizontally centered to avoid colliding with the Lima floating button at bottom-left.
  const containerBottomStyle = 'calc(var(--bottom-nav-height, 60px) + env(safe-area-inset-bottom, 0px) + 0.5rem)';

  if (!expanded) {
    // The whole notice, reduced to something that cannot cover a button: a small pill clear of bottom nav.
    return (
      <div
        className="no-print pwa-update-notifier"
        role="status"
        style={{
          position: 'fixed',
          bottom: containerBottomStyle,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#1f2937',
          color: '#fff',
          borderRadius: 999,
          padding: '4px 6px 4px 12px',
          fontSize: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          maxWidth: 'min(92vw, 24rem)',
        }}
      >
        <button
          type="button"
          onClick={refreshToUpdate}
          disabled={refreshing}
          style={{ background: 'transparent', border: 'none', color: '#fff', font: 'inherit', fontWeight: 700, cursor: refreshing ? 'wait' : 'pointer', padding: '4px 2px' }}
        >
          {refreshing ? 'Refreshing…' : `Update ready${nextBuildSha ? ` · ${nextBuildSha}` : ''}`}
        </button>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="What changed"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', padding: '4px 6px', font: 'inherit' }}
        >
          ⌃
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss until the next build"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', padding: '4px 8px', font: 'inherit' }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className="no-print pwa-update-notifier"
      role="status"
      style={{
        position: 'fixed',
        bottom: containerBottomStyle,
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1f2937',
        color: '#fff',
        padding: '0.75rem 1rem',
        borderRadius: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '0.5rem',
        maxWidth: 'min(92vw, 27rem)',
        zIndex: 10000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        fontSize: '0.875rem',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
        <span style={{ flex: 1 }}>New version{nextBuildSha ? ` ${nextBuildSha}` : ''} available.</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse update notice"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.7, cursor: 'pointer', padding: '2px 4px', font: 'inherit', lineHeight: 1 }}
        >
          ⌃
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss until the next build"
          style={{ background: 'transparent', border: 'none', color: '#fff', opacity: 0.6, cursor: 'pointer', padding: '2px 4px', font: 'inherit', lineHeight: 1 }}
        >
          ✕
        </button>
      </span>
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
      {/* WHAT you are refreshing into. Show at most 2 notes capped by default, with an honest "and X more" expansion. */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              fontSize: '0.78rem',
              lineHeight: 1.35,
              opacity: 0.85,
            }}
          >
            {displayedNotes.map((n) => (
              <li key={n} style={{ display: 'flex', gap: '0.4rem' }}>
                <span aria-hidden style={{ opacity: 0.6 }}>·</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
          {remainingNotesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllNotes((prev) => !prev)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: '2px 0 0 0',
                textAlign: 'left',
                font: 'inherit',
                textDecoration: 'underline',
              }}
            >
              {showAllNotes ? 'show less' : `and ${remainingNotesCount} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
