import Link from 'next/link';
import { Check, Sprout, Users, BarChart3 } from 'lucide-react';

/**
 * Audiences — "who it's for": one card each for the farmer, the NGO/programme and
 * the funder, so every visitor finds their own outcome without reading past it.
 *
 * Split out of app/welcome/page.tsx (now a thin shell) — see that file's header
 * comment for this route's shared constraints.
 */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
  );
}

interface Audience {
  Icon: typeof Sprout;
  title: string;
  bullets: React.ReactNode[];
}

// Grounded in app/pitch/page.tsx ("one app, four jobs" + field constraints) and
// app/partners/page.tsx (FEATURES + the funders section) — see app/welcome/page.tsx's
// header comment for what each number was checked against.
const AUDIENCES: Audience[] = [
  {
    Icon: Sprout,
    title: 'For farmers',
    bullets: [
      'Map your beds, orchard, water and habitat on your own satellite image, from a catalogue of 197 species suited to South African conditions.',
      'Follow a planting calendar and weather-aware task lists that keep the season moving, week by week.',
      "Learn as you go — a 33-lesson course, in English or one of ten South African languages, that still opens with no signal.",
      "Every completed task and harvest becomes a timestamped record — proof of the work you've done.",
    ],
  },
  {
    Icon: Users,
    title: 'For NGOs & programmes',
    bullets: [
      'See every farm in the programme from one screen — training progress, harvests and sales, down to a single gardener.',
      "Build your own surveys and see who's answered, without chasing paper forms.",
      'Track course progress, module assignments and farm-visit notes for every participant.',
      'Every record rolls up automatically — not rebuilt from paper, months after the season.',
    ],
  },
  {
    Icon: BarChart3,
    title: 'For funders',
    bullets: [
      "Real numbers, built from farmers' own timestamped records — not a year-end survey.",
      'Production, sales and training completion for every participant, rolled up across the programme.',
      'Photographic evidence travels with the harvest record it belongs to.',
      <>
        Priced per participant, so the invoice scales with enrolment — the figures are in the{' '}
        <Link href="/pitch" className="underline decoration-1 underline-offset-2 hover:text-forest">
          partner deck
        </Link>
        .
      </>,
    ],
  },
];

export default function Audiences() {
  return (
    <section id="audiences" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20 bg-card border-t border-b" style={{ borderColor: '#E2D8C4' }}>
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
          <SectionEyebrow>Who it&rsquo;s for</SectionEyebrow>
          <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
            One app. Three roles. One shared record.
          </h2>
          <p className="mt-4 text-[15px] sm:text-[16px] leading-relaxed text-ink-muted">
            The record a farmer makes in the field is the same record her programme and her
            funder see &mdash; nobody rebuilds it from paper, months after the season.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {AUDIENCES.map(({ Icon, title, bullets }) => (
            <div key={title} className="rounded-2xl p-6 flex flex-col gap-4 bg-paper border" style={{ borderColor: '#E2D8C4' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-xl w-11 h-11 flex-shrink-0" style={{ background: 'rgba(31,77,43,0.10)' }}>
                  <Icon size={20} strokeWidth={1.7} className="text-forest" />
                </div>
                <h3 className="font-display font-semibold text-[19px] text-ink">{title}</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {bullets.map((b, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                    <Check size={15} strokeWidth={2.2} className="mt-0.5 flex-shrink-0 text-forest" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
