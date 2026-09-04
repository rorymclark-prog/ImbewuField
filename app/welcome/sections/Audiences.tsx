import Link from 'next/link';
import { Check, Sprout, Users, BarChart3, ArrowRight } from 'lucide-react';
import ElementArt from '../ElementArt';

/**
 * Audiences — "who it's for": one bento tile each for the farmer, the NGO/programme
 * and the funder, so every visitor finds their own outcome without reading past it,
 * and leaves toward their own next step rather than the same door as everyone else.
 *
 * Split out of app/welcome/page.tsx (now a thin shell) — see that file's header
 * comment for this route's shared constraints.
 *
 * EACH TILE IS FOUR THINGS, IN ORDER: an icon + role label (who this is), one bold
 * outcome line (the five-second takeaway — what THEY get), the supporting facts as
 * feature→benefit sentences (what it does, so what happens for you), and one
 * named door (a single link to that role's own next step) — never a generic
 * "learn more". That last part is new: the farmer, NGO and funder bullets already
 * existed, but only the funder card had anywhere to go. Now:
 *   - Farmer  → /home        (sign in and start mapping — same destination as
 *                              Hero's primary CTA, just named for what a farmer
 *                              specifically does there)
 *   - NGO     → /partners    (the existing public NGO/funded-programme showcase
 *                              — built for this exact audience, never linked from
 *                              /welcome before this change)
 *   - Funder  → /pitch       (the partner deck, where pricing actually lives —
 *                              see page.tsx's header comment on why numbers are
 *                              deliberately not repeated here)
 * These are secondary, in-card text links (icon + label, no filled background) on
 * purpose: the page keeps exactly one primary CTA (Hero's Sign in / Get started); a
 * filled pill here would compete with it.
 *
 * ELEMENT ART: one small hand-drawn piece per tile, in the top-right corner, chosen
 * to mean something rather than just decorate — herb_spiral (a garden you design)
 * for the farmer, nursery_table (many seedlings raised together) for the programme
 * that grows many farmers at once, market_stall (the sale itself) for the funder
 * card whose facts are about production and sales. None of the three repeat Hero's
 * set (tree_indigenous, banana_circle, beehive, chicken_coop, keyhole_bed, jojo_5000)
 * — Hero is one scroll above, so reusing its exact pieces here would read as the
 * same image twice rather than three deliberate choices.
 *
 * COPY: same facts as before — nothing here is a new number or claim — reworded
 * from capability statements into feature→benefit sentences per the research brief.
 * Checked again against source while rewriting: app/pitch/page.tsx ("one app, four
 * jobs" + the live-funder slide's "production, sales and training completion" +
 * "built from the farmers' own timestamped records — not year-end surveys") and
 * app/partners/page.tsx (FEATURES + the funders section). Pricing stays off this
 * page and behind the /pitch link, per page.tsx's header comment.
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
  art: string;
  artRotate: number;
  title: string;
  outcome: string;
  bullets: string[];
  cta: { href: string; label: string };
}

// Grounded in app/pitch/page.tsx ("one app, four jobs" + field constraints + the
// live-funder slide) and app/partners/page.tsx (FEATURES + the funders section) —
// see app/welcome/page.tsx's header comment for what each number was checked
// against. Every bullet below restates a fact that already existed on this page;
// none is new.
const AUDIENCES: Audience[] = [
  {
    Icon: Sprout,
    art: 'herb_spiral',
    artRotate: -6,
    title: 'For farmers',
    outcome: 'Know what to plant, when to plant it — and prove you did.',
    bullets: [
      "Map beds, orchard, water and habitat on your own satellite image, from a 197-species catalogue — so nothing gets planted twice, or forgotten.",
      "A weather-aware planting calendar and task list keeps the season moving, so the plan doesn't live only in your head.",
      'Learn a 33-lesson course in your own language, offline, so training never waits for signal.',
      'Every finished task and harvest becomes a timestamped record, so the proof is already there when someone asks for it.',
    ],
    cta: { href: '/home', label: 'Start mapping your land' },
  },
  {
    Icon: Users,
    art: 'nursery_table',
    artRotate: 5,
    title: 'For NGOs & programmes',
    outcome: 'See the whole programme without a field visit.',
    bullets: [
      "See every farm in the programme from one screen, so a site visit isn't the only way to know how a season is going.",
      'Build and send your own surveys, so answers arrive without chasing paper forms.',
      'Track course progress and farm-visit notes per participant, so you always know who needs a visit next.',
      "Every farmer's record rolls up automatically, so the M&E report is ready before the season ends — not rebuilt from paper, months later.",
    ],
    cta: { href: '/partners', label: 'See the programme tools' },
  },
  {
    Icon: BarChart3,
    art: 'market_stall',
    artRotate: 4,
    title: 'For funders',
    outcome: 'Evidence you can defend to your own board.',
    bullets: [
      "Numbers are built from farmers' own timestamped records, so you're never funding a year-end survey.",
      'Production, sales and training completion roll up per participant and across the programme, so you see outcomes, not just spend.',
      'Photographic evidence travels with the harvest record it documents, so a number on a page is never just a claim.',
      "Priced per participant, so the invoice scales exactly with who you're funding — see the partner deck for figures.",
    ],
    cta: { href: '/pitch', label: 'Open the partner deck' },
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
          {AUDIENCES.map(({ Icon, art, artRotate, title, outcome, bullets, cta }) => (
            <div
              key={title}
              className="relative flex flex-col gap-4 rounded-2xl p-6 bg-paper border overflow-hidden"
              style={{ borderColor: '#E2D8C4' }}
            >
              <div className="pointer-events-none absolute top-3 right-3" aria-hidden="true">
                <ElementArt name={art} size={40} rotate={artRotate} />
              </div>

              <div className="flex items-center gap-3 pr-11">
                <div className="flex items-center justify-center rounded-xl w-11 h-11 flex-shrink-0" style={{ background: 'rgba(31,77,43,0.10)' }}>
                  <Icon size={20} strokeWidth={1.7} className="text-forest" />
                </div>
                <h3 className="font-display font-semibold text-[19px] leading-snug text-ink">{title}</h3>
              </div>

              <p className="font-display italic text-[16px] leading-snug text-ink">{outcome}</p>

              <ul className="flex flex-col gap-3">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-muted">
                    <Check size={15} strokeWidth={2.2} className="mt-0.5 flex-shrink-0 text-forest" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={cta.href}
                className="group/cta mt-auto pt-1 inline-flex w-fit items-center gap-1.5 text-[13.5px] font-sans font-semibold text-forest hover:text-forest-light transition-colors"
              >
                {cta.label}
                <ArrowRight size={14} strokeWidth={2.2} className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
