'use client';

// Master kill switch for the community layer (profiles, map pins, trade board,
// messaging). Defaults OFF so the feature ships dark — nothing renders, no
// Firestore reads/writes happen — until this deliberately returns true.
//
// Turn ON in production: set NEXT_PUBLIC_COMMUNITY_ENABLED=true in Vercel env vars, redeploy.
// Turn OFF in production: remove the var (or set it to anything else), redeploy.
// Preview on one device without a redeploy: in that browser's devtools console run
//   localStorage.setItem('imbewufield_community_preview', '1')
// then reload. This affects only that browser, not real users. Revert with
//   localStorage.removeItem('imbewufield_community_preview')

const PREVIEW_KEY = 'imbewufield_community_preview';

export function communityEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_COMMUNITY_ENABLED === 'true') return true;
  if (typeof window !== 'undefined' && window.localStorage.getItem(PREVIEW_KEY) === '1') return true;
  return false;
}
