import Link from 'next/link';
import { ArrowRight, Languages, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import ElementArt from '../ElementArt';
import HeroVisual from '../HeroVisual';

/**
 * Hero — the first thing a stranger lands on at /welcome: the one-sentence claim,
 * the primary CTA, and the visual that makes the claim concrete.
 *
 * Split out of app/welcome/page.tsx (now a thin shell that renders this alongside
 * Audiences, Product and TrustFooter) so each section can be worked on on its own —
 * see page.tsx's header comment for the route-level constraints every section here
 * shares: no <header> tag, no client data fetching, not linked from nav.
 *
 * THE VISUAL: HeroVisual.tsx — a separate build track's "plan assembling itself"
 * collage, animated from the same hand-drawn elements the design tool draws with —
 * is the art here. It's the single most characteristic thing in ImbewuField's world,
 * so it belongs above the fold, not held for Product's how-it-works section further
 * down. It renders behind a real React error boundary (defined inside HeroVisual.tsx
 * itself, since that file is under active parallel development); StaticHeroCollage
 * below is what the boundary falls back to — the same ElementArt component and the
 * same six pieces this file rendered before HeroVisual existed, just reframed as a
 * plot card instead of a bare grid. That fallback fires on any render failure in the
 * animated file, and is also exactly what ships if HeroVisual.tsx is ever removed —
 * this section never depends on that file existing to render something worth seeing.
 *
 * MOTION BUDGET: HeroVisual's own settle-in sequence is this section's one animation
 * (transform/opacity only, its own prefers-reduced-motion fallback built in — see
 * that file). Deliberately not layering a second, independent entrance animation
 * (e.g. an IntersectionObserver reveal) onto the text column: that technique reveals
 * content as it scrolls into view, and the hero is already the first thing in view on
 * load — it would either fire immediately (doing nothing) or, worse, hide the thesis
 * sentence for a beat on first paint, working against the 5-second-clarity goal.
 * Staying free of 'use client' here also means the part of the hero that actually has
 * to be legible in the first second — the headline, the CTAs — ships as plain static
 * HTML with zero hydration cost; only the decorative visual carries a client boundary.
 */

interface HeroFact {
  Icon: typeof WifiOff;
  label: string;
}

const HERO_FACTS: HeroFact[] = [
  { Icon: WifiOff, label: 'Works offline' },
  { Icon: Languages, label: '11 languages' },
  { Icon: Smartphone, label: 'Installs on entry-level Android' },
  { Icon: ShieldCheck, label: 'POPIA consent per farmer' },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
  );
}

/**
 * The guaranteed-safe visual: the same six hand-drawn elements this section rendered
 * before HeroVisual existed, now framed as a small plot card so it still reads as
 * "a plan" instead of a bare icon row. Passed to HeroVisual as its error-boundary
 * fallback (see this file's header comment) — nothing here depends on the animated
 * file, so it can't inherit a defect from that side of the build. Centered on every
 * breakpoint (no lg:mx-0 override) to match HeroVisual's own unconditional centering,
 * so the hero looks the same regardless of which of the two actually renders.
 */
function StaticHeroCollage() {
  return (
    <div
      className="w-full max-w-[460px] mx-auto rounded-[28px] p-4 sm:p-6"
      style={{
        background: 'linear-gradient(180deg, rgba(31,77,43,0.06), rgba(31,77,43,0.015)), #F3EEDF',
        boxShadow: 'inset 0 0 0 2px rgba(31,77,43,0.14)',
      }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-center">
        <ElementArt name="tree_indigenous" size={104} rotate={-5} priority />
      </div>
      <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="flex items-center justify-center">
          <ElementArt name="banana_circle-v3" size={84} rotate={4} offset={16} />
        </div>
        <div className="flex items-center justify-center">
          <ElementArt name="beehive" size={76} rotate={-3} offset={-6} />
        </div>
        <div className="flex items-center justify-center">
          <ElementArt name="chicken_coop" size={92} rotate={5} offset={4} />
        </div>
        <div className="flex items-center justify-center">
          <ElementArt name="keyhole_bed" size={88} rotate={-4} offset={-10} />
        </div>
        <div className="flex items-center justify-center">
          <ElementArt name="jojo_5000" size={72} rotate={3} offset={10} />
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="px-5 sm:px-8 lg:px-10 pt-14 pb-14 sm:pt-20 sm:pb-16 lg:pt-24 lg:pb-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-12 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <SectionEyebrow>For South African smallholder farmers, NGOs and funders</SectionEyebrow>
          <h1 className="mt-4 font-display font-semibold text-[32px] leading-[1.15] sm:text-[42px] sm:leading-[1.12] lg:text-[48px] lg:leading-[1.08] tracking-[-0.02em] text-ink text-balance">
            Map your land. Plan your season. Prove your work.
          </h1>
          <p className="mt-5 font-display text-[18px] sm:text-[20px] leading-[1.55] text-ink-muted max-w-xl mx-auto lg:mx-0">
            ImbewuField is farm planning, training and proof of work for South African
            smallholder programmes &mdash; on your own phone, in your own language, with or
            without signal.
          </p>
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                href="/home"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-sans font-semibold text-card bg-forest hover:bg-forest-light transition-colors w-full sm:w-auto justify-center"
              >
                Sign in / Get started <ArrowRight size={16} />
              </Link>
              <Link
                href="/pitch"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-sans font-semibold text-forest border-2 border-forest hover:bg-forest hover:text-card transition-colors w-full sm:w-auto justify-center"
              >
                Partner &amp; funder deck
              </Link>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
            {HERO_FACTS.map(({ Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-sans font-semibold text-ink-muted bg-card border"
                style={{ borderColor: '#E2D8C4' }}
              >
                <Icon size={13} strokeWidth={2} className="text-forest" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <HeroVisual fallback={<StaticHeroCollage />} />
        </div>
      </div>
    </section>
  );
}
