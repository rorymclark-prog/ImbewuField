'use client';

import { useEffect, useState } from 'react';

// Phone-only gate shared by the Design Studio's mobile-specific chrome: the palette bottom
// sheet (DesignPalette.tsx) and the auto-collapsing header/wizard (app/design/page.tsx).
//
// Width-only would miss a phone rotated to landscape to see a wide site plan — a normal field
// posture, and literally the scenario commit 6d5a5c8's (reverted) fix was written to address —
// so this also catches short-but-wide viewports by height. 1280x800 desktop matches neither
// clause; 390x844 portrait phone matches the width clause; an ~844x390 landscape phone matches
// the height clause.
const PHONE_MEDIA_QUERY = '(max-width: 700px), (max-height: 560px)';

export function usePhoneViewport(): boolean {
  // Starts false (not the server-vs-client mismatch dance — this hook is 'use client'-only and
  // always runs after mount) so SSR/first paint is stable; the effect below corrects it
  // synchronously-enough that there is no visible flash on a real device.
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(PHONE_MEDIA_QUERY);
    setIsPhone(mql.matches);
    const onChange = () => setIsPhone(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
