'use client';

// Master kill switch for the NGO/funder dashboard v2 surfaces (platform admin panel, the
// consent-aware dashboard wiring, and aggregate reporting UI added in phases 2-4 of the
// NGO/funder build). Defaults OFF so each phase ships dark — the underlying API routes and
// Firestore rules exist, but nothing new renders and no client reads happen — until Rory
// deliberately flips it on. Same two-switch pattern as lib/community/flag.ts, kept as its own
// file rather than shared: this flag has nothing to do with the community layer and the two
// must be independently toggleable.
//
// Turn ON in production: set NEXT_PUBLIC_NGO_DASHBOARD_V2_ENABLED=true in Vercel env vars, redeploy.
// Turn OFF in production: remove the var (or set it to anything else), redeploy.
// Preview on one device without a redeploy: in that browser's devtools console run
//   localStorage.setItem('imbewufield_ngo_dashboard_v2_preview', '1')
// then reload. This affects only that browser, not real users. Revert with
//   localStorage.removeItem('imbewufield_ngo_dashboard_v2_preview')
//
// Note: this is purely the client-side gate for UI. The rules-side kill switch
// (app_config/ngo_dashboard_v2.enabled, checked by ngoDashboardV2On() in firestore.rules) is a
// separate mechanism that gates Firestore reads/writes directly — the two don't read each other,
// by design (defense in depth, same as community/renders).

const PREVIEW_KEY = 'imbewufield_ngo_dashboard_v2_preview';

export function ngoDashboardV2Enabled(): boolean {
  if (process.env.NEXT_PUBLIC_NGO_DASHBOARD_V2_ENABLED === 'true') return true;
  if (typeof window !== 'undefined' && window.localStorage.getItem(PREVIEW_KEY) === '1') return true;
  return false;
}
