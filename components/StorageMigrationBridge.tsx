'use client';

import { useEffect } from 'react';
import { importLegacyLocalStorageSnapshot } from '@/lib/map-sync';

const LEGACY_ORIGINS = [
  'https://permamap-sa.vercel.app',
  'https://fieldproof.vercel.app',
];

interface StorageExportMessage {
  type: 'imbewu-storage-export-v1';
  snapshot?: Record<string, string>;
  updatedAt?: Record<string, number>;
}

function isStorageExportMessage(value: unknown): value is StorageExportMessage {
  return !!value && typeof value === 'object' && (value as StorageExportMessage).type === 'imbewu-storage-export-v1';
}

export default function StorageMigrationBridge() {
  useEffect(() => {
    if (window.location.pathname === '/sync-export') return;
    const currentOrigin = window.location.origin;
    const sources = LEGACY_ORIGINS.filter((origin) => origin !== currentOrigin);
    if (sources.length === 0) return;

    const onMessage = (event: MessageEvent) => {
      if (!sources.includes(event.origin) || !isStorageExportMessage(event.data)) return;
      importLegacyLocalStorageSnapshot(event.data.snapshot ?? {}, event.data.updatedAt ?? {});
    };

    window.addEventListener('message', onMessage);
    const frames = sources.map((origin) => {
      const frame = document.createElement('iframe');
      frame.src = `${origin}/sync-export?target=${encodeURIComponent(currentOrigin)}`;
      frame.title = 'ImbewuField storage migration';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
      document.body.appendChild(frame);
      return frame;
    });

    return () => {
      window.removeEventListener('message', onMessage);
      frames.forEach((frame) => frame.remove());
    };
  }, []);

  return null;
}
