'use client';

import { useEffect } from 'react';
import { readLocalStorageSnapshot, readLocalStorageUpdatedAt } from '@/lib/map-sync';

const ALLOWED_TARGETS = new Set([
  'https://imbewufield.vercel.app',
  'https://permamap-sa.vercel.app',
  'https://fieldproof.vercel.app',
]);

export default function SyncExportPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target') ?? '';
    if (!ALLOWED_TARGETS.has(target)) return;

    window.parent?.postMessage({
      type: 'imbewu-storage-export-v1',
      snapshot: readLocalStorageSnapshot(),
      updatedAt: readLocalStorageUpdatedAt(),
    }, target);
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      ImbewuField sync bridge
    </main>
  );
}
