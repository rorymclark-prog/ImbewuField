'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useSiteProgress } from '@/lib/site-progress';
import type { SavedPlace } from '@/lib/saved-places';

export interface HomeHeroCardProps {
  /** null until the places effect has run — render the DEFAULT variant (today's
   *  analyse-CTA) so first paint is unchanged and returning users never see a
   *  welcome flash. */
  places: SavedPlace[] | null;
  mainSite: SavedPlace | null; // resolveMainSite(places) — parent already computes it
  firstName: string | null;    // user?.displayName?.split(' ')[0] — parent has it
}

// Shared green-card shell — identical background/backgroundImage/borderRadius/boxShadow
// across all three variants so the card never visually jumps when the variant swaps.
const SHELL_STYLE: CSSProperties = {
  display: 'block',
  background: '#1F4D2B',
  backgroundImage:
    'repeating-radial-gradient(ellipse at 60% 40%, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 40px), ' +
    'repeating-radial-gradient(ellipse at 20% 80%, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 60px)',
  borderRadius: 20,
  padding: '22px 20px 20px',
  // u-card's "lit from above" inset highlight, tuned down for a saturated dark surface
  // (the primitive's 0.7-alpha white highlight is calibrated for the light --surface card
  // and would read as a glare here) + the original ambient throw + a longer soft shadow
  // for a touch more considered depth.
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 4px 20px rgba(31,77,43,0.35), 0 20px 40px -24px rgba(15,30,18,0.5)',
};

const PILL_STYLE: CSSProperties = {
  background: '#E4DCC6',
  color: '#1F4D2B',
  borderRadius: 100,
  padding: '8px 16px',
  fontSize: 13,
  letterSpacing: '-0.01em',
  boxShadow: '0 2px 8px rgba(15,30,18,0.22)',
  transition: 'transform 150ms var(--ease-out, cubic-bezier(0.16,1,0.3,1)), box-shadow 200ms var(--ease-out, cubic-bezier(0.16,1,0.3,1))',
};

// The Lima "sprouting leaf" mark used next to the Lima-suggests overline (DEFAULT +
// CONTINUE variants share it — same brand marker, same overline copy).
function LimaMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, flexShrink: 0 }}>
      <path d="M12 21V11" />
      <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
      <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
    </svg>
  );
}

function Overline({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <LimaMark />
      <span className="uppercase tracking-widest font-sans" style={{ fontSize: 12, color: 'rgba(234,243,226,0.65)', letterSpacing: '0.12em' }}>
        {children}
      </span>
    </div>
  );
}

// Gentle fade/settle on first mount (u-anim-sheet-style timing, but no off-screen slide —
// this card renders inline, it isn't a modal). `jsx global` so the keyframes are defined
// once regardless of which of the variant branches below actually renders.
function HeroEntranceStyle() {
  return (
    <style jsx global>{`
      @keyframes imfHeroSettle {
        from { opacity: 0; transform: scale(0.985); }
        to { opacity: 1; transform: scale(1); }
      }
      .imf-hero-settle { animation: imfHeroSettle 260ms var(--ease-spring, cubic-bezier(0.175, 0.885, 0.32, 1.1)); }
      @media (prefers-reduced-motion: reduce) {
        .imf-hero-settle { animation: none; }
      }
    `}</style>
  );
}

export default function HomeHeroCard({ places, mainSite, firstName }: HomeHeroCardProps) {
  const { t } = useLanguage();

  // Hooks run unconditionally, before any early return, so the null-until-mounted
  // pattern stays hydration-safe (progress is null on SSR and on the very first
  // client render, matching each other exactly).
  const coords = mainSite ? { lat: mainSite.lat, lon: mainSite.lon } : null;
  const progress = useSiteProgress(coords);

  // ── DEFAULT — pre-hydration paint (places === null). This is today's exact
  // analyse-CTA markup: the whole card is one Link, so returning users never see
  // a flash of the welcome, and the SSR/first-client-render output matches. ──
  if (places === null) {
    return (
      <Link href="/farmer" className="imf-hero-settle" style={{ ...SHELL_STYLE, textDecoration: 'none' }}>
        <HeroEntranceStyle />
        <Overline>{t('homeLimaSuggests')}</Overline>

        <h2 className="u-display-sm" style={{ color: '#F7F2E9', marginBottom: 6 }}>
          {t('homeSurveyNew')}
        </h2>

        <p className="font-sans" style={{ fontSize: 14, color: 'rgba(234,243,226,0.78)', lineHeight: 1.5, marginBottom: 18 }}>
          {t('homeSurveyDesc')}
        </p>

        <span className="inline-flex items-center font-sans font-semibold transition-all active:scale-[0.97]" style={PILL_STYLE}>
          <span className="flex items-center gap-1.5">{t('homeOpenMap')}<ArrowRight size={14} /></span>
        </span>
      </Link>
    );
  }

  // ── WELCOME — first-run, no saved sites. Two actions max. ──
  if (places.length === 0) {
    return (
      <div className="imf-hero-settle" style={SHELL_STYLE}>
        <HeroEntranceStyle />
        <div className="u-display-sm" style={{ color: 'rgba(234,243,226,0.88)', marginBottom: 2 }}>
          {firstName ? t('homeGreeting').replace('{name}', firstName) : t('welcomeTitle')}
        </div>

        <h2 className="u-display-sm" style={{ color: '#F7F2E9', marginBottom: 6 }}>
          {t('welcomeHeroTitle')}
        </h2>

        <p className="font-sans" style={{ fontSize: 14, color: 'rgba(234,243,226,0.78)', lineHeight: 1.5, marginBottom: 18 }}>
          {t('welcomeHeroSub')}
        </p>

        <Link
          href="/farmer?guided=1"
          className="font-sans font-semibold transition-all active:scale-[0.97]"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', minHeight: 52,
            background: '#E4DCC6', color: '#1F4D2B',
            borderRadius: 100, fontSize: 15, letterSpacing: '-0.01em',
            textDecoration: 'none', marginBottom: 12,
            boxShadow: '0 2px 8px rgba(15,30,18,0.22)',
          }}
        >
          <MapPin size={18} strokeWidth={1.8} />
          {t('welcomeFindLand')}
        </Link>

        <Link
          href="/example"
          className="font-sans"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
            fontSize: 14, color: 'rgba(234,243,226,0.78)', textDecoration: 'none',
          }}
        >
          <Eye size={15} strokeWidth={1.7} />
          {t('welcomeShowExample')}
        </Link>
      </div>
    );
  }

  // ── CONTINUE — returner with at least one saved site. ──
  if (mainSite) {
    const pct = progress?.pct;

    return (
      <div className="imf-hero-settle" style={SHELL_STYLE}>
        <HeroEntranceStyle />
        <Overline>{t('homeLimaSuggests')}</Overline>

        <h2 className="u-display-sm" style={{ color: '#F7F2E9', marginBottom: 12 }}>
          {t('continueSiteTitle').replace('{site}', mainSite.name)}
        </h2>

        {pct != null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(234,243,226,0.25)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#F7C97E', borderRadius: 2 }} />
            </div>
            <div className="font-sans" style={{ fontSize: 12, color: 'rgba(234,243,226,0.78)', marginTop: 6 }}>
              {t('continueSitePct').replace('{pct}', String(pct))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href={`/farmer?site=${mainSite.id}`}
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, textDecoration: 'none' }}
          >
            <span className="inline-flex items-center font-sans font-semibold transition-all active:scale-[0.97]" style={PILL_STYLE}>
              <span className="flex items-center gap-1.5">{t('continueSiteCta')}<ArrowRight size={14} /></span>
            </span>
          </Link>

          <Link
            href="/farmer?guided=1&new=1"
            className="font-sans"
            style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 44,
              fontSize: 14, color: 'rgba(234,243,226,0.78)', textDecoration: 'none',
            }}
          >
            {t('startNewSite')}
          </Link>
        </div>
      </div>
    );
  }

  // Defensive fallback — places.length > 0 but the parent's resolveMainSite() somehow
  // returned null (should not happen; resolveMainSite always yields a site for a
  // non-empty list). Render the same safe DEFAULT shell rather than nothing.
  return (
    <Link href="/farmer" className="imf-hero-settle" style={{ ...SHELL_STYLE, textDecoration: 'none' }}>
      <HeroEntranceStyle />
      <Overline>{t('homeLimaSuggests')}</Overline>

      <h2 className="u-display-sm" style={{ color: '#F7F2E9', marginBottom: 6 }}>
        {t('homeSurveyNew')}
      </h2>

      <p className="font-sans" style={{ fontSize: 14, color: 'rgba(234,243,226,0.78)', lineHeight: 1.5, marginBottom: 18 }}>
        {t('homeSurveyDesc')}
      </p>

      <span className="inline-flex items-center font-sans font-semibold transition-all active:scale-[0.97]" style={PILL_STYLE}>
        <span className="flex items-center gap-1.5">{t('homeOpenMap')}<ArrowRight size={14} /></span>
      </span>
    </Link>
  );
}
