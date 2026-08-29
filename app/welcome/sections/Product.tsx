/**
 * Product — "how it works": the four-step flow (Analyse → Map boundary → Design →
 * Report) that turns the hero's claim into a walk-through. Also the home for
 * product-as-proof content (real screens/report/map motifs) as it's added — see the
 * research brief this route was built against.
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
    body: 'A planting calendar, weather-aware task lists, and a report — cover, planting calendar, bill of quantities — you can act on and show.',
  },
];

export default function Product() {
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
      </div>
    </section>
  );
}
