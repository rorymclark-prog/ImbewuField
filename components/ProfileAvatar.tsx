'use client';
import { useState } from 'react';
import { samplePortrait } from '@/lib/sample-media';

/** Reuse a person's own photograph; a missing image must never become someone else's face. */
export default function ProfileAvatar({ id, name, photoUrl, sample = false, size = 52, preview = false }: {
  id: string; name: string; photoUrl?: string | null; sample?: boolean; size?: number; preview?: boolean;
}) {
  const src = sample ? samplePortrait(id) : photoUrl;
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
  return <span style={{ width: size, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '50%', background: '#dce9d4', color: '#214d35', border: '2px solid #fff', boxShadow: '0 0 0 1px #cbd8ca', fontWeight: 700 }}>
    {src && failed !== src ? <img src={src} alt={`Profile of ${name}`} width={size} height={size} loading="lazy" decoding="async" data-photo-preview={preview || undefined} onError={() => setFailed(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
      : <span aria-label={`Profile of ${name}`} role="img">{initials}</span>}
  </span>;
}
