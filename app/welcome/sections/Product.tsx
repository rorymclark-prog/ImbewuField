'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import ElementArt from '../ElementArt';

/**
 * Product — "how it works", then the proof. Two halves in one file:
 *
 *   1. The four-step flow (Analyse → Map boundary → Design → Report), unchanged in
 *      substance from the original build — it still answers "what do I actually do".
 *   2. "This is not a mockup" — a bento of the app's own real screens, because a
 *      farm-planning claim is easiest to believe once you've seen the farm. This is
 *      the "product-as-proof" content the file header used to flag as pending.
 *
 * WHY REAL SCREENSHOTS, NOT NEW ART: four of public/marketing/shot-*.png (design,
 * map, report, home) reappear below — already committed and shown on /partners (see
 * components/partners/Screenshot.tsx's header comment and app/partners/page.tsx's
 * SHOTS/FEATURED_SHOT). They are the sample farm — Ubhejane Crèche, KwaZulu-Natal —
 * running at imbewufield.vercel.app, the same one app/pitch/page.tsx's live slides
 * embed. Using next/image here (rather than /partners' plain <img>) is a genuine
 * speed win: these files are large (shot-map.png is 460KB+) and next/image serves
 * them resized to the small tile they're actually shown at. Captions below restate
 * facts already public on /pitch and /partners in fresh wording — nothing here is a
 * new number or claim.
 *
 * ELEMENT ART: two small hand-drawn pieces (tap_point, raised_bed) mark the "This is
 * not a mockup" heading — a water point and a planted bed, the two concrete things
 * step 2 and step 3 above just described in words. Neither appears in Hero's set or
 * in Audiences' three tiles (herb_spiral, nursery_table, market_stall), so nothing
 * on this one scroll repeats.
 *
 * MOTION: one scroll-reveal, applied only to the proof bento (the four-step grid
 * above it stays static) — this section's whole point is a screen you're seeing for
 * the first time, so a brief settle-into-place as it scrolls into view earns its
 * keep more than it would on the numbered steps. useRevealOnScroll below is the
 * "tiny IntersectionObserver hook" the research brief allows inside this file: SSR
 * output and a no-JS visitor both get the fully visible bento outright (visibility
 * never depends on JS running) — the reveal is a client-only progressive
 * enhancement that only ever arms itself for a tile confirmed off-screen at mount,
 * so an already-visible tile can never flash hidden and reappear. It reuses
 * tailwind.config.ts's existing `fade-up` keyframe (0.2s, opacity + 8px translate)
 * rather than inventing a new one, and prefers-reduced-motion skips it outright.
 * This is this file's one animation toward the research brief's page-wide 2–4 total.
 *
 * Split out of app/welcome/page.tsx (now a thin shell) — see that file's header
 * comment for this route's shared constraints (no <header>, no auth, no client data
 * fetching — this file's client-side state is limited to the reveal above, purely
 * presentational, nothing fetched or persisted).
 */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
  );
}

interface Step {
  title: string;
  body: string;
}

// Grounded in design/DESIGN.md's "core flow" (Analyse → Map boundary → Design →
// Report) and app/pitch/page.tsx's species/report facts.
const STEPS: Step[] = [
  {
    title: 'Tell Lima about your land',
    body: "A short Q&A about your site, your goals and your family's needs, with the field guide built into the app.",
  },
  {
    title: 'Map your boundary',
    body: 'Drop a pin, walk the edges with GPS, and mark your water sources — all on your own satellite image.',
  },
  {
    title: 'Design your garden',
    body: 'Lay out beds, orchard, water systems and habitat to scale, on that same satellite image, from a 197-species catalogue.',
  },
  {
    title: 'Get your plan',
    body: 'Weather-aware task lists keep the season on track, and a report you can act on and show — cover, planting calendar, bill of quantities.',
  },
];

interface ProofShot {
  src: string;
  alt: string;
  label: string;
  caption: string;
}

// The featured shot — a full farm design at high zoom on the satellite basemap, the
// single most legible "this is what the app actually produces" image — gets its own
// larger slot, same choice app/partners/page.tsx already made with the same file.
const FEATURED_SHOT: ProofShot = {
  src: '/marketing/shot-design.png',
  alt: 'A complete farm design on a satellite map, showing zoned beds for daily garden, staple crops and natural habitat, each planted from the species catalogue',
  label: 'Farm design studio',
  caption: 'A real farm, laid out zone by zone on its own satellite ground — daily garden, staple beds and natural habitat, from the 197-species catalogue.',
};

const SUPPORTING_SHOTS: ProofShot[] = [
  {
    src: '/marketing/shot-map.png',
    alt: 'Satellite map with contour lines showing a farm site and its boundary marker',
    label: 'Site map',
    caption: 'Contour lines on a satellite view, for choosing and walking a new boundary.',
  },
  {
    src: '/marketing/shot-report.png',
    alt: 'Site report showing rainfall, soil texture, frost risk, elevation and the site’s mapped land parcels',
    label: 'AI site report',
    caption: 'Rainfall, soil, frost risk and elevation for the exact site — generated once and saved, so reading it again costs nothing.',
  },
  {
    src: '/marketing/shot-home.png',
    alt: 'ImbewuField home screen showing the day’s weather, a heat warning, and Lima’s suggested next step',
    label: "Today's plan",
    caption: "Today's weather, a heat warning when it matters, and Lima's next suggested step.",
  },
];

/**
 * A tiny, progressive-enhancement scroll reveal. The server-rendered (and no-JS)
 * state is always fully visible — a public marketing page must never depend on JS
 * to become visible. Once mounted, IF the element is confirmed off-screen at that
 * moment AND the visitor hasn't asked for reduced motion, it arms a fade-and-settle
 * for the next time it scrolls into view; an element already on screen at mount is
 * left alone rather than replayed, so nothing ever flashes hidden then reappears.
 */
function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let firstCallback = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (firstCallback) {
          firstCallback = false;
          if (!entry.isIntersecting) setPending(true); // off-screen now — arm the reveal
          return; // already on screen — leave it visible, nothing to animate
        }
        if (entry.isIntersecting) {
          setPending(false);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, pending };
}

function ProofTile({ shot, featured = false, delayMs = 0 }: { shot: ProofShot; featured?: boolean; delayMs?: number }) {
  return (
    <figure
      className="m-0 flex flex-col gap-2.5"
      style={delayMs ? { animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' } : undefined}
    >
      <div
        className={`w-full flex items-center justify-center overflow-hidden rounded-2xl border bg-card p-3 ${
          featured ? 'h-[300px] sm:h-[380px] lg:h-[440px]' : 'h-[260px] sm:h-[300px]'
        }`}
        style={{ borderColor: '#E2D8C4' }}
      >
        <Image
          src={shot.src}
          alt={shot.alt}
          width={375}
          height={812}
          className="h-full w-auto rounded-[14px]"
          style={{ objectFit: 'contain' }}
          priority={featured}
        />
      </div>
      <figcaption className="text-center px-1">
        <span className="block font-display font-semibold text-[15px] text-ink">{shot.label}</span>
        <span className="block mt-1 text-[13px] leading-snug text-ink-muted">{shot.caption}</span>
      </figcaption>
    </figure>
  );
}

export default function Product() {
  const { ref: proofRef, pending } = useRevealOnScroll<HTMLDivElement>();
  const revealClass = pending ? 'opacity-0 translate-y-2' : 'animate-fade-up';

  return (
    <section id="how-it-works" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
            Four steps, on the same map, all season.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-2.5 rounded-2xl p-5 bg-card border" style={{ borderColor: '#E2D8C4' }}>
              <span className="font-display font-semibold text-[32px] leading-none text-ochre">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-1 font-display font-semibold text-[17px] leading-snug text-ink">{s.title}</h3>
              <p className="text-[14px] leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>

        {/* ── Product as proof ────────────────────────────────────────────── */}
        <div className="mt-16 sm:mt-24">
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3" aria-hidden="true">
              <ElementArt name="tap_point" size={40} rotate={-8} />
              <ElementArt name="raised_bed" size={40} rotate={7} />
            </div>
            <span className="mt-3 block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
              Live &middot; the actual app
            </span>
            <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
              This is not a mockup.
            </h2>
            <p className="mt-3 text-[15px] sm:text-[16px] leading-relaxed text-ink-muted">
              Every screen below is running live at imbewufield.vercel.app &mdash; the sample
              farm, Ubhejane Crèche in KwaZulu-Natal, open to anyone, no account needed.
            </p>
          </div>

          <div ref={proofRef} className="mt-10">
            <div className={`max-w-sm mx-auto ${revealClass}`}>
              <ProofTile shot={FEATURED_SHOT} featured />
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
              {SUPPORTING_SHOTS.map((shot, i) => (
                <div key={shot.src} className={revealClass}>
                  <ProofTile shot={shot} delayMs={pending ? 0 : (i + 1) * 80} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
