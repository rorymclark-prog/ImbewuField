import type { Metadata } from 'next';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import Hero from './sections/Hero';
import Audiences from './sections/Audiences';
import Product from './sections/Product';
import Install from './sections/Install';
import TrustFooter from './sections/TrustFooter';

/**
 * /welcome — the public front door: the page a smallholder farmer, an NGO programme
 * manager or a funder lands on having never heard of ImbewuField before. Deliberately
 * outside the signed-in app shell, same convention as app/partners and app/pitch:
 *   - No semantic `header` element. tests/menu-button-coverage.test.ts requires every
 *     `header` tag to carry a MenuButton (the signed-in nav drawer's opener) — wrong for
 *     an anonymous visitor, so the top bar below is a plain div, exactly like /partners.
 *   - No useAuth()/redirect, no Firebase import, no client data fetching anywhere in
 *     this file or the sections it renders — every one of them is a pure server
 *     component that renders the same thing for everyone, instantly, logged in or not.
 *   - Not linked from TabBar or NavDrawer — reached by a direct link, same as /partners.
 *
 * This file is a thin shell: the top bar plus the four content sections below, split
 * one component per file under ./sections/ so each can be worked on without the others
 * changing underfoot. In reading order: Hero (the claim + primary CTA), Audiences
 * (farmer / NGO / funder), Product (how it works), TrustFooter (consent/POPIA stance,
 * closing CTA, footer). ElementArt.tsx (the hand-drawn permaculture-element renderer)
 * lives alongside this file since Hero is currently its only caller.
 *
 * COPY SOURCE: every claim, number and framing in the sections below is reused from
 * app/pitch/page.tsx (the partner deck) and app/partners/page.tsx (the existing
 * NGO/funder showcase, whose own header comment records what each of its numbers was
 * checked against) — nothing here is invented. Spot-checked again directly against
 * source while writing this route: lib/species-catalog.ts SPECIES.length === 197;
 * lib/i18n.tsx APP_LANGS has 11 entries (English + 10); lib/consent.ts CONSENT_SCOPES
 * lists exactly the six sharing categories the privacy section names (sales, expenses,
 * production, training, surveys, location); components/ConsentPanel.tsx's own header
 * comment is the source for "sharing starts off, and stopping is one button." See each
 * section file's own header comment for the sourcing notes specific to its content.
 *
 * Deliberately excluded for lack of a real source in this repo: testimonials, partner
 * names/logos, and programme pricing (that stays on /pitch and /partners, where the
 * figures already live and are kept current) — see TrustFooter's links out to /pitch
 * instead of repeating numbers here.
 */

export const metadata: Metadata = {
  title: 'ImbewuField — farm planning for South African smallholder programmes',
  description:
    'Map your land, plan your season, learn in your language and prove the work — farm planning, training and proof of work for South African smallholder farmers, NGOs and funders.',
  openGraph: {
    title: 'ImbewuField',
    description:
      'Farm planning, training and proof of work for South African smallholder programmes — on your own phone, in your own language, with or without signal.',
    type: 'website',
    siteName: 'ImbewuField',
  },
};

export default function WelcomePage() {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden font-sans bg-paper text-ink">
      {/* Top bar — a div, not a semantic header: see the file-header comment. */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 py-4 border-b"
        style={{ borderColor: '#E2D8C4' }}
      >
        <BrandLogo />
        <nav className="hidden md:flex items-center gap-6 text-sm font-sans font-semibold text-ink-muted">
          <a href="#audiences" className="hover:text-forest transition-colors">Who it&rsquo;s for</a>
          <a href="#how-it-works" className="hover:text-forest transition-colors">How it works</a>
          <a href="#privacy" className="hover:text-forest transition-colors">Privacy</a>
        </nav>
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-sans font-semibold text-card bg-forest hover:bg-forest-light transition-colors"
        >
          Sign in / Get started
        </Link>
      </div>

      <main className="flex-1 overflow-y-auto">
        <Hero />
        <Audiences />
        <Product />
        <Install />
        <TrustFooter />
      </main>
    </div>
  );
}
