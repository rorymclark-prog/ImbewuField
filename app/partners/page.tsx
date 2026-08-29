import type { Metadata } from 'next';
import {
  Satellite, CalendarDays, Sprout, BarChart3, FileText, GraduationCap,
  WifiOff, Languages, Users, Camera, Smartphone, Mail, Building2, ArrowRight,
} from 'lucide-react';
import Screenshot from '@/components/partners/Screenshot';

// Public showcase page for NGOs and funders — "the place an organisation lands to see what the
// app does and get it onto phones" (Rory, briefing this page). Deliberately outside the signed-in
// app shell:
//   • No semantic header tag — same convention app/login and app/gate already use for pages the
//     drawer menu must not open into (see tests/menu-button-coverage.test.ts's own comment on
//     this). A plain top bar div covers the branding job without claiming a menu door that would
//     just dump an anonymous visitor into a sign-in wall.
//   • No useAuth()/redirect — this route carries no auth check of its own, so it never bounces
//     a signed-out visitor anywhere.
//   • Not linked from TabBar or NavDrawer — reached only by a direct link, exactly as briefed.
//
// Every factual claim below was checked against the current code, not assumed from a brief:
//   - 197-species catalogue: lib/species-catalog.ts, SPECIES.length, enforced at 197 by
//     tests/species-catalog.test.ts. That catalogue powers farm design (Design Studio's planting
//     palette — components/design/SpeciesPicker.tsx), not the separate seasonal sow-window
//     planner (lib/crop-catalog.ts, 29 crops), so the copy below names it as the design/planting
//     catalogue rather than folding it into "crop planning".
//   - Course: lib/course-modules.ts COURSE_MODULES has 10 entries (TOTAL_MODULES, and
//     tests/course-gating.test.ts's own "sanity check: the shipped curriculum is 10 modules").
//     Lessons: summed COURSE_MODULES[].lessons across all 10 modules = 33, not 45 — counted
//     directly rather than trusting a remembered figure.
//   - Languages: lib/i18n.tsx's APP_LANGS array has 11 entries (English + 10 South African
//     languages); the file's own comment calls this "all eleven languages".
//   - Satellite farm design, production/sales/expense records, AI site reports and offline course
//     downloads are each cited inline below, next to the copy that makes the claim.

export const metadata: Metadata = {
  title: 'ImbewuField for NGOs and funders',
  description:
    'The field operating system for funded smallholder and community-farming programmes — farm design, seasonal planning, practical learning, mentor oversight and funder-ready evidence.',
  openGraph: {
    title: 'ImbewuField for NGOs and funders',
    description:
      'Farm design, seasonal planning, practical learning, mentor oversight and funder-ready evidence — in one app, in 11 languages.',
    type: 'website',
    siteName: 'ImbewuField',
  },
};

const PWA_URL = 'https://imbewufield.vercel.app';

interface Feature {
  Icon: typeof Satellite;
  title: string;
  body: string;
}

// One card per verified capability — see the file-header comment above for where each was
// checked. Kept to short, literal statements rather than superlatives.
const FEATURES: Feature[] = [
  {
    Icon: Satellite,
    title: 'Satellite-based farm design',
    body: 'Trace a boundary on a satellite view of the real farm, then lay out beds, water systems, earthworks and structures directly on that ground — not a generic template.',
  },
  {
    Icon: CalendarDays,
    title: 'Seasonal crop planning',
    body: 'A season-by-season task board — prep, sow, transplant, harvest — built from each crop’s real planting window for South African rainfall patterns.',
  },
  {
    Icon: Sprout,
    title: 'A 197-species planting catalogue',
    body: 'Every plant on offer in farm design is a real, sourced species — indigenous fruit trees, exotic fruit and nut trees, shrubs, groundcovers and climbers — each with its own water need, mature size and use.',
  },
  {
    Icon: BarChart3,
    title: 'Production, sales & expense records',
    body: 'Farmers log kilograms produced, kilograms sold, and money in and out — building a real financial picture of the farm, season over season.',
  },
  {
    Icon: FileText,
    title: 'AI site reports',
    body: 'A location-specific report — climate, soil, water and a garden design — generated for the exact spot a farm sits on, and saved so it can be reread without regenerating it.',
  },
  {
    Icon: GraduationCap,
    title: 'A 10-module training course',
    body: 'Ten modules, 33 lessons, covering permaculture ethics, reading the landscape, water harvesting, soil health, seeds, plant guilds, food forests, livestock and market gardening — each lesson with a short quiz.',
  },
  {
    Icon: WifiOff,
    title: 'Offline course downloads',
    body: 'A whole course module — text, images and audio — downloads in town, so the lesson still works back on a homestead with no signal at all.',
  },
  {
    Icon: Languages,
    title: '11 languages',
    body: 'English plus ten South African languages: isiZulu, isiXhosa, Afrikaans, Sesotho, Sepedi, Setswana, Xitsonga, Tshivenḍa, siSwati and isiNdebele.',
  },
];

interface Shot {
  src: string;
  alt: string;
  label: string;
  caption: string;
}

// The featured shot — a full farm design at high zoom on the satellite basemap, with zones
// (daily garden, orchard, staple beds, natural habitat) laid out and planted. It is the single
// most legible "this is what the app actually produces" image, so it gets its own full-width
// slot above the smaller grid rather than being sized the same as an app-chrome screenshot.
const FEATURED_SHOT: Shot = {
  src: '/marketing/shot-design.png',
  alt: 'A complete farm design on a satellite map, zoomed in on zoned beds — daily garden, orchard, staple crops and natural habitat — each planted with mapped species',
  label: 'Farm design studio',
  caption: 'A full farm laid out zone by zone — daily garden, orchard, staple beds and natural habitat — on real satellite ground.',
};

const SHOTS: Shot[] = [
  {
    src: '/marketing/shot-home.png',
    alt: 'ImbewuField home screen showing the farm’s weather forecast, a heat warning, and the next suggested step',
    label: 'Home',
    caption: 'Today’s weather, a heat warning, and what to do next on this farm.',
  },
  {
    src: '/marketing/shot-map.png',
    alt: 'Satellite map with contour lines showing a farm site and its boundary marker',
    label: 'Site map',
    caption: 'A satellite view with contour lines, for choosing and orienting a new site.',
  },
  {
    src: '/marketing/shot-report.png',
    alt: 'AI-generated site report showing rainfall, soil texture, frost risk and elevation, plus the site’s mapped land parcels',
    label: 'AI site report',
    caption: 'Rainfall, soil, frost risk and elevation for the exact site — plus its mapped land parcels.',
  },
  {
    src: '/marketing/shot-finance.png',
    alt: 'Cash flow screen showing money in against money out, month by month, as a chart',
    label: 'Farm finances',
    caption: 'Money in and out, month by month, from what the farmer has actually recorded.',
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
  );
}

export default function PartnersPage() {
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden font-sans bg-paper text-ink">
      {/* Top bar — deliberately a div, not a semantic header tag: see the file-header comment. */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-8 py-4 border-b" style={{ borderColor: '#E2D8C4' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center rounded-[10px] w-9 h-9 flex-shrink-0 bg-forest">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V11" />
              <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
              <path d="M12 11c0-3.5 2.5-6 6.5-6 0 4-2.5 6-6.5 6Z" />
            </svg>
          </div>
          <span className="font-display font-semibold text-[17px] text-ink">ImbewuField</span>
        </div>
        <a
          href="#get-app"
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-sans font-semibold text-card bg-forest hover:bg-forest-light transition-colors"
        >
          Get the app
        </a>
      </div>

      <main className="flex-1 overflow-y-auto">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 lg:px-10 pt-14 pb-16 sm:pt-20 sm:pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <SectionEyebrow>For NGOs &amp; funded farming programmes</SectionEyebrow>
            <h1 className="mt-4 font-display font-semibold text-[32px] leading-[1.15] sm:text-[44px] sm:leading-[1.12] tracking-[-0.02em] text-ink">
              The field operating system for funded smallholder and community-farming programmes
            </h1>
            <p className="mt-5 font-display text-[19px] sm:text-[21px] leading-[1.5] text-ink-muted">
              Farm design, seasonal planning, practical learning, mentor oversight and funder-ready evidence &mdash; all in one app.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#get-app"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-sans font-semibold text-card bg-forest hover:bg-forest-light transition-colors w-full sm:w-auto justify-center"
              >
                Get the app <ArrowRight size={16} />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-sans font-semibold text-forest border-2 border-forest hover:bg-forest hover:text-card transition-colors w-full sm:w-auto justify-center"
              >
                See what it does
              </a>
            </div>

            {/* Quick-glance, verified numbers — each one is a FEATURES card below. */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
              {['10 modules · 33 lessons', '197-species catalogue', '11 languages'].map((s) => (
                <span
                  key={s}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-sans font-semibold text-ink-muted bg-card border"
                  style={{ borderColor: '#E2D8C4' }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── What it does ─────────────────────────────────────────────────── */}
        <section id="features" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20 bg-card border-t border-b" style={{ borderColor: '#E2D8C4' }}>
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl">
              <SectionEyebrow>What it does</SectionEyebrow>
              <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
                The tools a funded farming programme runs on
              </h2>
            </div>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl p-5 flex flex-col gap-3 bg-paper border"
                  style={{ borderColor: '#E2D8C4' }}
                >
                  <div className="flex items-center justify-center rounded-xl w-10 h-10 flex-shrink-0" style={{ background: 'rgba(31,77,43,0.10)' }}>
                    <Icon size={19} strokeWidth={1.7} className="text-forest" />
                  </div>
                  <h3 className="font-display font-semibold text-[16px] leading-snug text-ink">{title}</h3>
                  <p className="text-[14px] leading-relaxed text-ink-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Screenshots ──────────────────────────────────────────────────── */}
        <section id="screenshots" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl mx-auto text-center">
              <SectionEyebrow>Inside the app</SectionEyebrow>
              <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
                The claims above, on screen
              </h2>
            </div>

            <div className="mt-10 max-w-md mx-auto">
              <Screenshot {...FEATURED_SHOT} featured />
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {SHOTS.map((shot) => (
                <Screenshot key={shot.src} {...shot} />
              ))}
            </div>
          </div>
        </section>

        {/* ── For funders & NGOs ───────────────────────────────────────────── */}
        <section id="funders" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20" style={{ background: 'rgba(31,77,43,0.06)' }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-14 items-start">
            <div>
              <SectionEyebrow>For funders &amp; NGOs</SectionEyebrow>
              <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
                Evidence without an enumerator visit
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                Every farmer&rsquo;s record rolls up automatically. Mentors and facilitators see every farm in the programme from one screen; NGO and funder accounts see production, sales, training completion and photographic evidence for every gardener &mdash; without a field visit to collect it.
              </p>
            </div>
            <div className="flex flex-col gap-5">
              {[
                { Icon: Users, title: 'Mentors see every farm', body: 'Course progress, module assignments and visit notes for every trainee, from one screen — not a spreadsheet stitched together after the fact.' },
                { Icon: BarChart3, title: 'Funders get the numbers', body: 'Kilograms produced, kilograms sold, and money in and out, rolled up per farmer and across the programme.' },
                { Icon: Camera, title: 'Photographic evidence, not a claim', body: 'Produce photos travel with the harvest record they belong to, so a reviewer sees the crop as well as the figure.' },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4 rounded-2xl p-5 bg-card border" style={{ borderColor: '#E2D8C4' }}>
                  <div className="flex items-center justify-center rounded-xl w-10 h-10 flex-shrink-0" style={{ background: 'rgba(31,77,43,0.10)' }}>
                    <Icon size={19} strokeWidth={1.7} className="text-forest" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-[16px] leading-snug text-ink">{title}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Get the app ──────────────────────────────────────────────────── */}
        <section id="get-app" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20 bg-forest">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl">
              <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em]" style={{ color: '#9FD4AE' }}>
                Get the app
              </span>
              <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-card">
                On your phone in under a minute
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed" style={{ color: '#D9E8DC' }}>
                ImbewuField is a Progressive Web App &mdash; no app store, no download size. Open it once and add it to the home screen, and it opens like any other app from then on.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-10 items-start">
              <div>
                <a
                  href={PWA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full px-7 py-4 text-[16px] font-sans font-semibold bg-card text-forest hover:bg-white transition-colors"
                >
                  <Smartphone size={18} />
                  Open imbewufield.vercel.app
                </a>

                <div className="mt-9">
                  <h3 className="font-display font-semibold text-[15px]" style={{ color: '#9FD4AE' }}>
                    On Android (Chrome)
                  </h3>
                  <ol className="mt-3 flex flex-col gap-2.5">
                    {[
                      'Open imbewufield.vercel.app in Chrome.',
                      'Tap ⋮ (top right), then “Add to Home screen”.',
                      'Tap “Add” — the ImbewuField icon appears on the home screen.',
                    ].map((step, i) => (
                      <li key={step} className="flex items-start gap-3 text-[14px] leading-relaxed" style={{ color: '#EAF3E2' }}>
                        <span
                          className="flex-shrink-0 flex items-center justify-center rounded-full font-sans font-bold text-[12px] w-5 h-5 mt-0.5 bg-card text-forest"
                        >
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-4 text-[13px]" style={{ color: '#9FD4AE' }}>
                    On iPhone: open the link in Safari, tap Share, then &ldquo;Add to Home Screen&rdquo;.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-2xl p-6 bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/marketing/qr-imbewufield.svg"
                  alt="QR code linking to imbewufield.vercel.app"
                  width={168}
                  height={168}
                  className="w-[168px] h-[168px]"
                />
                <span className="text-[13px] font-sans font-semibold text-center text-ink-muted">
                  Scan to open ImbewuField
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <section id="contact" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-16">
          <div className="max-w-2xl mx-auto text-center">
            <SectionEyebrow>Contact</SectionEyebrow>
            <h2 className="mt-3 font-display font-semibold text-[24px] sm:text-[28px] leading-[1.2] tracking-[-0.02em] text-ink">
              Talk to us about a programme
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
              ImbewuField is built and maintained by Imbewu Yoshintso NPC. For partnership, funding or pilot enquiries, get in touch directly.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="mailto:rorymclark@gmail.com"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-sans font-semibold text-card bg-forest hover:bg-forest-light transition-colors"
              >
                <Mail size={16} />
                rorymclark@gmail.com
              </a>
              <span className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-sans font-semibold text-ink-muted bg-card border" style={{ borderColor: '#E2D8C4' }}>
                <Building2 size={16} />
                Imbewu Yoshintso NPC
              </span>
            </div>
          </div>
        </section>

        <footer className="px-5 sm:px-8 py-6 border-t text-center" style={{ borderColor: '#E2D8C4' }}>
          <p className="text-[12px] text-ink-faint">
            &copy; 2026 Imbewu Yoshintso NPC &middot; ImbewuField
          </p>
        </footer>
      </main>
    </div>
  );
}
