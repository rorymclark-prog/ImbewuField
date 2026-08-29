import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import ElementArt from '../ElementArt';

/**
 * Hero — the first thing a stranger lands on at /welcome: the one-sentence claim,
 * the primary CTA, and the element-art collage that makes the claim concrete.
 *
 * Split out of app/welcome/page.tsx (now a thin shell that renders this alongside
 * Audiences, Product and TrustFooter) so each section can be worked on on its own —
 * see page.tsx's header comment for the route-level constraints every section here
 * shares: no <header> tag, no client data fetching, not linked from nav.
 */

const HERO_FACTS = ['Works offline', '11 languages', 'Installs on entry-level Android', 'POPIA consent per farmer'];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
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
            {HERO_FACTS.map((f) => (
              <span
                key={f}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-sans font-semibold text-ink-muted bg-card border"
                style={{ borderColor: '#E2D8C4' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <div
          className="grid grid-cols-3 gap-3 sm:gap-5 max-w-[420px] mx-auto lg:mx-0"
          aria-hidden="true"
        >
          <div className="flex items-center justify-center">
            <ElementArt name="tree_indigenous" size={104} rotate={-5} priority />
          </div>
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
    </section>
  );
}
