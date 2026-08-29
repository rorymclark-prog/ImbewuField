'use client';

/**
 * /pitch — the partner-meeting slide deck, served by the app itself.
 *
 * WHY IN-APP AND NOT A POWERPOINT: the strongest thing this product can show a
 * funder is that it is real and running. Slides 4 and 6 are live same-origin
 * iframes of the actual app in sample mode — the presenter can tap around the
 * sample farm mid-meeting. A .pptx can only screenshot that. Print (P key)
 * gives the email-ahead PDF from the same source of truth, so the deck and the
 * app can never drift apart.
 *
 * SAMPLE MODE: entered once on mount, before any live slide can render. The
 * iframes are same-origin, so they read the same sessionStorage flag and serve
 * the Ubhejane Crèche sandbox with no account — the exact flow /partners
 * promises visitors. If storage refuses the flag (private browsing), the live
 * slides show a pointer card instead of a broken frame.
 *
 * Facts on these slides are the concept note's verified set: 197 species,
 * 33 lessons / 10 modules, ten SA languages plus English, R150/participant/
 * cycle, Pilot R75,000 / Founding R145,000. The backups claim was re-verified
 * against the live project (PITR enabled + daily schedule) before shipping.
 * Change a number here only with its source in hand.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { enterSampleMode } from '@/lib/sample-mode';

const DECK_W = 1280;
const DECK_H = 720;

// QR for https://imbewufield.vercel.app (33×33 modules incl. quiet zone),
// generated offline with segno at error level M. Stroke-drawn: each h-run is a
// 1-unit-high line, so the path wants stroke, not fill.
const QR_VIEW = 33;
const QR_D =
  'M2 2.5h7m3 0h1m1 0h1m2 0h1m2 0h3m1 0h7m-29 1h1m5 0h1m1 0h4m1 0h2m1 0h1m3 0h1m1 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m1 0h2m1 0h1m4 0h1m3 0h1m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m3 0h3m1 0h1m1 0h2m1 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h3m3 0h1m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m2 0h4m1 0h1m1 0h1m2 0h2m1 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-19 1h2m1 0h1m2 0h3m-18 1h3m1 0h2m5 0h2m1 0h4m7 0h2m-28 1h2m2 0h1m2 0h2m1 0h3m3 0h1m2 0h1m2 0h5m1 0h1m-29 1h4m2 0h1m1 0h3m2 0h1m1 0h4m1 0h1m1 0h1m3 0h2m-27 1h3m1 0h1m1 0h1m1 0h2m3 0h2m2 0h3m2 0h1m4 0h1m-28 1h1m1 0h1m1 0h3m2 0h1m1 0h2m2 0h2m1 0h1m1 0h1m1 0h1m2 0h3m-29 1h2m6 0h3m1 0h1m4 0h3m2 0h2m1 0h2m1 0h1m-27 1h2m1 0h2m4 0h1m2 0h3m2 0h2m1 0h4m1 0h2m-29 1h1m1 0h2m4 0h1m2 0h5m2 0h1m2 0h2m1 0h2m-26 1h2m4 0h1m1 0h6m4 0h4m1 0h3m1 0h1m-23 1h1m1 0h3m3 0h2m3 0h1m1 0h1m2 0h1m-24 1h1m3 0h6m1 0h1m1 0h1m3 0h1m2 0h1m1 0h1m-21 1h1m8 0h1m1 0h1m1 0h4m2 0h2m3 0h1m1 0h1m-28 1h1m2 0h1m1 0h1m1 0h1m1 0h1m4 0h13m-20 1h3m1 0h2m2 0h1m3 0h1m3 0h2m1 0h2m-29 1h7m2 0h2m6 0h1m1 0h2m1 0h1m1 0h1m1 0h2m-28 1h1m5 0h1m1 0h1m3 0h4m4 0h1m3 0h1m2 0h2m-29 1h1m1 0h3m1 0h1m2 0h2m4 0h1m2 0h1m1 0h9m-29 1h1m1 0h3m1 0h1m1 0h2m1 0h4m2 0h1m1 0h1m4 0h2m1 0h1m-28 1h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m3 0h1m1 0h1m1 0h1m2 0h1m1 0h2m1 0h1m-29 1h1m5 0h1m1 0h1m3 0h4m4 0h2m2 0h2m1 0h1m-28 1h7m2 0h2m2 0h2m3 0h6m1 0h1m1 0h1';

function Qr({ size, dark }: { size: number; dark: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${QR_VIEW} ${QR_VIEW}`}
      shapeRendering="crispEdges"
      aria-label="QR code for imbewufield.vercel.app"
      role="img"
    >
      <rect width={QR_VIEW} height={QR_VIEW} fill="#F6F3EA" rx="1.5" />
      <path d={QR_D} stroke={dark} strokeWidth="1" fill="none" />
    </svg>
  );
}

/* ---------------------------------------------------------------- frames -- */

// A phone bezel around the live app at its real 375×812 viewport, scaled to
// fit the slide. The iframe renders at true size (so the app lays out exactly
// as on a device) and the whole bezel is transform-scaled.
function PhoneFrame({ src, mounted, scale }: { src: string; mounted: boolean; scale: number }) {
  const w = 375;
  const h = 812;
  return (
    <div
      className="live-embed"
      style={{ width: (w + 24) * scale, height: (h + 24) * scale, position: 'relative' }}
    >
      <div
        style={{
          width: w + 24,
          height: h + 24,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: '#101614',
          borderRadius: 56,
          padding: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ width: w, height: h, borderRadius: 44, overflow: 'hidden', background: '#F6F3EA', position: 'relative' }}>
          {mounted ? (
            <iframe
              src={src}
              title="ImbewuField — live sample farm"
              width={w}
              height={h}
              style={{ border: 0, width: w, height: h, display: 'block' }}
            />
          ) : null}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
              width: 110, height: 26, borderRadius: 13, background: '#101614',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// A minimal browser-chrome frame for the desktop-shaped live view.
function DesktopFrame({ src, mounted, w, h, scale }: { src: string; mounted: boolean; w: number; h: number; scale: number }) {
  const bar = 40;
  return (
    <div className="live-embed" style={{ width: w * scale, height: (h + bar) * scale, position: 'relative' }}>
      <div
        style={{
          width: w,
          height: h + bar,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#101614',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ height: bar, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#3c4a41' }} />
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#3c4a41' }} />
          <span style={{ width: 11, height: 11, borderRadius: 6, background: '#3c4a41' }} />
          <span
            style={{
              marginLeft: 14, flex: 1, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.08)',
              color: 'rgba(242,238,225,0.75)', fontSize: 12.5, lineHeight: '24px', paddingLeft: 12,
              fontFamily: 'var(--font-sans), system-ui, sans-serif', letterSpacing: 0.2,
            }}
          >
            imbewufield.vercel.app/funder
          </span>
        </div>
        <div style={{ width: w, height: h, background: '#F6F3EA' }}>
          {mounted ? (
            <iframe
              src={src}
              title="ImbewuField — live funder view"
              width={w}
              height={h}
              style={{ border: 0, width: w, height: h, display: 'block' }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// What the printed PDF shows where a live frame sits on screen: a pointer, not
// a stale screenshot pretending to be live.
function PrintCard({ path, note }: { path: string; note: string }) {
  return (
    <div className="print-fallback">
      <div className="print-fallback-inner">
        <span className="pf-badge">Live in the app</span>
        <span className="pf-url">imbewufield.vercel.app{path}</span>
        <span className="pf-note">{note}</span>
      </div>
    </div>
  );
}

function StorageNote() {
  return (
    <div className="storage-note">
      This browser refused session storage, so the live frame is off — open{' '}
      <strong>imbewufield.vercel.app</strong> directly for the demo.
    </div>
  );
}

/* ----------------------------------------------------------------- slides -- */

type Slide = { key: string; theme: 'forest' | 'paper'; body: React.ReactNode };

export default function PitchPage() {
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const [sampleOk, setSampleOk] = useState<boolean | null>(null);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  const touchX = useRef<number | null>(null);

  // Enter sample mode ONCE, on mount, before any live slide can be visited —
  // the iframes are same-origin and read the same sessionStorage flag.
  useEffect(() => {
    setSampleOk(enterSampleMode());
    document.title = 'ImbewuField — partner deck';
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Deep links: /pitch#6 starts on slide 6 (1-based in the hash, human-shaped).
  useEffect(() => {
    const fromHash = parseInt(window.location.hash.replace('#', ''), 10);
    if (Number.isFinite(fromHash) && fromHash >= 1 && fromHash <= SLIDE_COUNT) {
      setIdx(fromHash - 1);
    }
  }, []);

  useEffect(() => {
    setVisited((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
    try {
      window.history.replaceState(null, '', `#${idx + 1}`);
    } catch {
      /* history can be picky inside webviews; the deck works without the hash */
    }
  }, [idx]);

  useEffect(() => {
    const fit = () =>
      setScale(Math.min((window.innerWidth - 24) / DECK_W, (window.innerHeight - 24) / DECK_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const go = useCallback((delta: number) => {
    setIdx((i) => Math.max(0, Math.min(SLIDE_COUNT - 1, i + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          go(1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          go(-1);
          break;
        case 'Home':
          e.preventDefault();
          setIdx(0);
          break;
        case 'End':
          e.preventDefault();
          setIdx(SLIDE_COUNT - 1);
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.();
          break;
        case 'p':
        case 'P':
          window.print();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const slides: Slide[] = useMemo(() => {
    const live = (i: number) => visited.has(i) && sampleOk !== false;
    return [
      // 1 ── title
      {
        key: 'title',
        theme: 'forest',
        body: (
          <div className="sl center">
            <div className="eyebrow">For programme partners · 2026</div>
            <h1 className="display" style={{ fontSize: 118, margin: '18px 0 0' }}>
              ImbewuField
            </h1>
            <p className="lede" style={{ maxWidth: 760, margin: '26px auto 0' }}>
              Farm planning, training and proof of work — for South African smallholder
              programmes.
            </p>
            <div className="hairline" style={{ margin: '54px auto 0' }} />
            <div className="meta-row">
              <span>imbewufield.vercel.app</span>
              <span className="dot">·</span>
              <span>Rory Michael Clark</span>
              <span className="dot">·</span>
              <span>Imbewu Yoshintso NPC</span>
            </div>
          </div>
        ),
      },
      // 2 ── the gap
      {
        key: 'gap',
        theme: 'paper',
        body: (
          <div className="sl">
            <div className="eyebrow">The problem</div>
            <h2 className="display h2">The field and the report never meet.</h2>
            <div className="cols3">
              <div>
                <h3 className="klabel">In the field</h3>
                <p>
                  Plans live in notebooks. Training is a once-off workshop. Advice arrives in
                  English only.
                </p>
              </div>
              <div>
                <h3 className="klabel">In the office</h3>
                <p>
                  M&amp;E is rebuilt from paper, months after the season. What was planted,
                  taught and picked — nobody can say per garden, per week.
                </p>
              </div>
              <div>
                <h3 className="klabel">In between</h3>
                <p>Funders pay for outcomes they can only see at year end, if at all.</p>
              </div>
            </div>
            <p className="kicker">
              The record should be made where the work happens — on the farmer&rsquo;s own
              phone, in her own language, with or without signal.
            </p>
          </div>
        ),
      },
      // 3 ── four jobs
      {
        key: 'jobs',
        theme: 'paper',
        body: (
          <div className="sl">
            <div className="eyebrow">What it is</div>
            <h2 className="display h2">One app, four jobs.</h2>
            <div className="cards4">
              <div className="card">
                <h3 className="klabel">Map her land</h3>
                <p>
                  Beds, orchard, water and habitat drawn on her own satellite image — from a
                  catalogue of 197 species suited to South African conditions.
                </p>
              </div>
              <div className="card">
                <h3 className="klabel">Plan the season</h3>
                <p>
                  A planting calendar and weather-aware task lists keep the plan moving week by
                  week.
                </p>
              </div>
              <div className="card">
                <h3 className="klabel">Teach as she works</h3>
                <p>A 33-lesson course in 10 modules — English plus ten South African languages.</p>
              </div>
              <div className="card">
                <h3 className="klabel">Prove the work</h3>
                <p>
                  Every completed task and harvest is a timestamped record that rolls up to
                  programme dashboards.
                </p>
              </div>
            </div>
            <p className="factstrip">
              Works offline&ensp;·&ensp;Installs on entry-level Android&ensp;·&ensp;POPIA consent
              per farmer
            </p>
          </div>
        ),
      },
      // 4 ── live farmer map
      {
        key: 'live-farmer',
        theme: 'forest',
        body: (
          <div className="sl split">
            <div className="split-copy">
              <div className="eyebrow">Live · the actual app</div>
              <h2 className="display h2">This is not a mockup.</h2>
              <ul className="bullets">
                <li>
                  The sample farm — Ubhejane Crèche, KwaZulu-Natal — running live from
                  imbewufield.vercel.app.
                </li>
                <li>Her beds, orchard and water on her real satellite image.</li>
                <li>Everything here keeps working once the signal is gone.</li>
              </ul>
              <p className="foot">Try it on your own phone — no account needed.</p>
              {sampleOk === false ? <StorageNote /> : null}
            </div>
            <div className="split-frame">
              {sampleOk === false ? null : (
                <PhoneFrame src="/farmer?panel=Overview" mounted={live(3)} scale={0.78} />
              )}
              <PrintCard
                path="/farmer"
                note="The sample farm, Ubhejane Crèche — live on any phone, no account needed."
              />
            </div>
          </div>
        ),
      },
      // 5 ── field constraints
      {
        key: 'field',
        theme: 'paper',
        body: (
          <div className="sl">
            <div className="eyebrow">Design constraints</div>
            <h2 className="display h2">Built for the actual field.</h2>
            <div className="cards4">
              <div className="card">
                <h3 className="klabel">No signal, no problem</h3>
                <p>The planner and downloaded lessons open with zero bars. Updates wait for town.</p>
              </div>
              <div className="card">
                <h3 className="klabel">Airtime is money</h3>
                <p>Maps and artwork are cached once — not re-downloaded on every visit.</p>
              </div>
              <div className="card">
                <h3 className="klabel">Her language</h3>
                <p>English plus isiZulu, isiXhosa, Afrikaans, Sesotho and six more.</p>
              </div>
              <div className="card">
                <h3 className="klabel">Her data, protected</h3>
                <p>
                  Per-farmer POPIA consent, organisation-scoped access, daily backups with
                  point-in-time recovery.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      // 6 ── live funder view
      {
        key: 'live-funder',
        theme: 'forest',
        body: (
          <div className="sl split">
            <div className="split-copy" style={{ maxWidth: 420 }}>
              <div className="eyebrow">Live · the funder view</div>
              <h2 className="display h2">Numbers an M&amp;E team can stand behind.</h2>
              <ul className="bullets">
                <li>A portfolio of gardens — training progress, harvests and sales in one view.</li>
                <li>Drill into any garden, down to a single gardener.</li>
                <li>Built from the farmers&rsquo; own timestamped records — not year-end surveys.</li>
              </ul>
              <p className="chip">
                Showing sample data — your programme sees only its own farmers, and only what
                each farmer agreed to share.
              </p>
              {sampleOk === false ? <StorageNote /> : null}
            </div>
            <div className="split-frame">
              {sampleOk === false ? null : (
                <DesktopFrame src="/funder" mounted={live(5)} w={1180} h={760} scale={0.585} />
              )}
              <PrintCard
                path="/funder"
                note="The cohort and gardens dashboards, with sample data — live in any browser."
              />
            </div>
          </div>
        ),
      },
      // 7 ── economics
      {
        key: 'economics',
        theme: 'paper',
        body: (
          <div className="sl center">
            <div className="eyebrow">Programme economics</div>
            <h2 className="display h2">Priced per participant, so the invoice scales with enrolment.</h2>
            <div className="bigfig">
              <span className="r">R150</span>
              <span className="per">
                per participant · per full growing cycle
                <br />
                (about 8 months — R18.75 per participant per month)
              </span>
            </div>
            <div className="rows">
              <div className="row">
                <span>300 participants</span>
                <span className="leader" />
                <span>R45,000</span>
              </div>
              <div className="row">
                <span>750 participants</span>
                <span className="leader" />
                <span>R112,500</span>
              </div>
            </div>
            <p className="kicker" style={{ marginTop: 40 }}>
              Same per-head rate at any size — change the participant count and the price
              follows. No tiers, no lock-in.
            </p>
          </div>
        ),
      },
      // 8 ── two doors
      {
        key: 'doors',
        theme: 'paper',
        body: (
          <div className="sl">
            <div className="eyebrow">Two ways in</div>
            <h2 className="display h2">Two doors, one per-head rate.</h2>
            <div className="doors">
              <div className="door">
                <h3 className="klabel">Pilot Season</h3>
                <div className="price">R75,000</div>
                <div className="line">
                  <span>300 participants × R150 × 1 cycle</span>
                  <span>R45,000</span>
                </div>
                <div className="line">
                  <span>Onboarding, facilitator training &amp; setup</span>
                  <span>R30,000</span>
                </div>
                <p>
                  One organisation, one full cycle, full feature set from day one. Prove the
                  model on one season&rsquo;s real data before scaling.
                </p>
              </div>
              <div className="door">
                <h3 className="klabel">Founding Deployment</h3>
                <div className="price">R145,000</div>
                <div className="line">
                  <span>750 participants × R150 × 1 cycle</span>
                  <span>R112,500</span>
                </div>
                <div className="line">
                  <span>Setup &amp; priority feature delivery</span>
                  <span>R32,500</span>
                </div>
                <p>
                  Founding partners set the feature roadmap: what your M&amp;E team needs next
                  gets built next.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      // 9 ── try it
      {
        key: 'try',
        theme: 'forest',
        body: (
          <div className="sl center">
            <div className="eyebrow">Right now, from your seat</div>
            <h2 className="display h2">See it working today — no account needed.</h2>
            <div className="qr-wrap">
              <Qr size={252} dark="#163820" />
            </div>
            <p className="url">imbewufield.vercel.app</p>
            <p className="lede" style={{ maxWidth: 720, margin: '10px auto 0' }}>
              Open the link and take the sample-farm tour — Ubhejane Crèche, KwaZulu-Natal.
              Programme materials for field teams: imbewufield.vercel.app/partners
            </p>
          </div>
        ),
      },
      // 10 ── close
      {
        key: 'close',
        theme: 'forest',
        body: (
          <div className="sl center">
            <h2 className="display" style={{ fontSize: 76, fontStyle: 'italic', fontWeight: 500 }}>
              &ldquo;Imbewu&rdquo; is the seed.
            </h2>
            <div className="hairline" style={{ margin: '46px auto 0' }} />
            <div className="meta-col">
              <span>Rory Michael Clark — Founder</span>
              <span>rorymclark@gmail.com</span>
              <span>imbewufield.vercel.app&ensp;·&ensp;/partners for programme materials</span>
            </div>
            <div className="eyebrow" style={{ marginTop: 44 }}>
              Imbewu Yoshintso NPC · South Africa
            </div>
          </div>
        ),
      },
    ];
  }, [visited, sampleOk]);

  return (
    <div className="pitch-stage">
      <div
        className="deck-frame"
        style={{ width: DECK_W, height: DECK_H, ['--deck-scale' as never]: scale }}
      >
        {slides.map((s, i) => (
          <section
            key={s.key}
            className={`pitch-slide theme-${s.theme}${i === idx ? ' active' : ''}`}
            aria-hidden={i !== idx}
          >
            {s.body}
          </section>
        ))}
      </div>

      <div className="pitch-ui counter" aria-live="polite">
        {idx + 1} / {SLIDE_COUNT}
      </div>
      <div className="pitch-ui navbtns">
        <button type="button" aria-label="Previous slide" onClick={() => go(-1)} disabled={idx === 0}>
          ‹ Back
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => go(1)}
          disabled={idx === SLIDE_COUNT - 1}
        >
          Next ›
        </button>
      </div>
      <div className="pitch-ui hints">ImbewuField&ensp;·&ensp;← → move · F fullscreen · P print / PDF</div>

      <div
        className="touch-zones"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start == null || end == null) return;
          if (end - start < -48) go(1);
          if (end - start > 48) go(-1);
        }}
      />

      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx global>{`
        .pitch-stage {
          position: fixed;
          inset: 0;
          background: #0c1a11;
          display: grid;
          place-items: center;
          overflow: hidden;
          z-index: 40;
        }
        .deck-frame {
          position: relative;
          transform: scale(var(--deck-scale, 1));
          transform-origin: center center;
        }
        .pitch-slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.35s ease;
          overflow: hidden;
          border-radius: 6px;
        }
        .pitch-slide.active {
          opacity: 1;
          visibility: visible;
        }
        @media (prefers-reduced-motion: reduce) {
          .pitch-slide {
            transition: none;
          }
        }
        .theme-forest {
          background: radial-gradient(1100px 700px at 22% 8%, #1f4d2b 0%, #163820 58%, #122e1b 100%);
          color: #f2eee1;
        }
        .theme-paper {
          background: #f6f3ea;
          color: #1c2a20;
        }
        .sl {
          position: absolute;
          inset: 0;
          padding: 72px 88px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .sl.center {
          text-align: center;
          align-items: center;
        }
        .display {
          font-family: var(--font-display), Georgia, 'Times New Roman', serif;
          font-weight: 600;
          letter-spacing: -0.015em;
          line-height: 1.04;
          text-wrap: balance;
          margin: 0;
        }
        .h2 {
          font-size: 54px;
          margin: 16px 0 0;
        }
        .sl,
        .sl p,
        .sl li {
          font-family: var(--font-sans), system-ui, sans-serif;
        }
        .eyebrow {
          font-size: 15px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 600;
          opacity: 0.72;
        }
        .lede {
          font-size: 25px;
          line-height: 1.5;
          font-weight: 400;
          opacity: 0.95;
        }
        .hairline {
          width: 84px;
          height: 2px;
          background: currentColor;
          opacity: 0.35;
        }
        .meta-row {
          margin-top: 22px;
          font-size: 18px;
          letter-spacing: 0.02em;
          opacity: 0.85;
          display: flex;
          gap: 14px;
          justify-content: center;
        }
        .meta-col {
          margin-top: 26px;
          font-size: 21px;
          line-height: 1.75;
          display: flex;
          flex-direction: column;
          opacity: 0.92;
        }
        .dot {
          opacity: 0.5;
        }
        .cols3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 44px;
          margin-top: 52px;
        }
        .cols3 p,
        .card p {
          font-size: 19.5px;
          line-height: 1.55;
          margin: 10px 0 0;
        }
        .klabel {
          font-size: 15px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
          margin: 0;
          color: inherit;
        }
        .theme-paper .klabel {
          color: #1f4d2b;
        }
        .kicker {
          margin: 56px 0 0;
          font-family: var(--font-display), Georgia, serif;
          font-style: italic;
          font-size: 26px;
          line-height: 1.45;
          color: #1f4d2b;
        }
        .theme-forest .kicker {
          color: #e8e2cf;
        }
        .cards4 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px 28px;
          margin-top: 44px;
        }
        .card {
          border: 1px solid rgba(31, 77, 43, 0.22);
          border-radius: 14px;
          padding: 24px 26px;
          background: rgba(255, 255, 255, 0.5);
        }
        .factstrip {
          margin: 36px 0 0;
          font-size: 18px;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: #1f4d2b;
        }
        .split {
          flex-direction: row;
          align-items: center;
          gap: 64px;
        }
        .split-copy {
          flex: 1;
          max-width: 480px;
        }
        .split-frame {
          flex: none;
          display: grid;
          place-items: center;
        }
        .bullets {
          margin: 30px 0 0;
          padding: 0 0 0 22px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          font-size: 20.5px;
          line-height: 1.5;
        }
        .foot {
          margin-top: 34px;
          font-size: 17.5px;
          opacity: 0.8;
        }
        .chip {
          margin-top: 30px;
          font-size: 15.5px;
          line-height: 1.5;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(242, 238, 225, 0.1);
          border: 1px solid rgba(242, 238, 225, 0.25);
        }
        .storage-note {
          margin-top: 22px;
          font-size: 15.5px;
          line-height: 1.5;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px dashed rgba(242, 238, 225, 0.4);
        }
        .bigfig {
          margin-top: 46px;
          display: flex;
          align-items: baseline;
          gap: 26px;
          justify-content: center;
        }
        .bigfig .r {
          font-family: var(--font-display), Georgia, serif;
          font-size: 120px;
          font-weight: 600;
          color: #1f4d2b;
          line-height: 1;
        }
        .bigfig .per {
          text-align: left;
          font-size: 19px;
          line-height: 1.5;
          opacity: 0.85;
        }
        .rows {
          margin: 44px auto 0;
          width: 620px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .row {
          display: flex;
          align-items: baseline;
          gap: 14px;
          font-size: 21px;
          font-variant-numeric: tabular-nums;
        }
        .leader {
          flex: 1;
          border-bottom: 1.5px dotted rgba(28, 42, 32, 0.35);
          transform: translateY(-5px);
        }
        .doors {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 42px;
        }
        .door {
          border: 1.5px solid rgba(31, 77, 43, 0.3);
          border-radius: 16px;
          padding: 30px 32px;
          background: rgba(255, 255, 255, 0.55);
        }
        .door .price {
          font-family: var(--font-display), Georgia, serif;
          font-size: 56px;
          font-weight: 600;
          color: #1f4d2b;
          margin: 10px 0 18px;
        }
        .door .line {
          display: flex;
          justify-content: space-between;
          font-size: 17.5px;
          padding: 7px 0;
          border-top: 1px solid rgba(31, 77, 43, 0.16);
          font-variant-numeric: tabular-nums;
        }
        .door p {
          margin: 18px 0 0;
          font-size: 17.5px;
          line-height: 1.5;
        }
        .qr-wrap {
          margin-top: 40px;
          padding: 14px;
          background: #f6f3ea;
          border-radius: 18px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        }
        .url {
          margin: 26px 0 0;
          font-size: 30px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .pitch-ui {
          position: fixed;
          z-index: 60;
          color: rgba(242, 238, 225, 0.8);
          font-family: var(--font-sans), system-ui, sans-serif;
          font-size: 13.5px;
          letter-spacing: 0.04em;
          user-select: none;
        }
        .counter {
          right: 22px;
          bottom: 64px;
          font-variant-numeric: tabular-nums;
        }
        .hints {
          left: 22px;
          bottom: 20px;
          opacity: 0.55;
        }
        .navbtns {
          right: 18px;
          bottom: 18px;
          display: flex;
          gap: 8px;
        }
        .navbtns button {
          appearance: none;
          border: 1px solid rgba(242, 238, 225, 0.35);
          background: rgba(12, 26, 17, 0.6);
          color: #f2eee1;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 14px;
          font-family: inherit;
          cursor: pointer;
          min-height: 40px;
        }
        .navbtns button:disabled {
          opacity: 0.35;
          cursor: default;
        }
        .navbtns button:focus-visible {
          outline: 2px solid #f2eee1;
          outline-offset: 2px;
        }
        .touch-zones {
          position: fixed;
          inset: 0 0 auto 0;
          height: 56px;
          z-index: 55;
        }
        .print-fallback {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          .pitch-stage {
            position: static;
            display: block;
            background: #ffffff;
            overflow: visible;
          }
          .deck-frame {
            transform: none;
            width: auto;
            height: auto;
          }
          .pitch-slide {
            position: relative;
            opacity: 1 !important;
            visibility: visible !important;
            width: ${DECK_W}px;
            height: ${DECK_H}px;
            page-break-after: always;
            break-after: page;
            border-radius: 0;
            zoom: 0.845;
          }
          .pitch-ui,
          .touch-zones,
          .live-embed,
          .storage-note {
            display: none !important;
          }
          .print-fallback {
            display: grid;
            place-items: center;
            width: 470px;
            height: 470px;
          }
          .print-fallback-inner {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: center;
            text-align: center;
            border: 1.5px dashed rgba(242, 238, 225, 0.5);
            border-radius: 18px;
            padding: 44px 36px;
            max-width: 430px;
          }
          .pf-badge {
            font-size: 13px;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            font-weight: 700;
            opacity: 0.75;
          }
          .pf-url {
            font-size: 24px;
            font-weight: 600;
          }
          .pf-note {
            font-size: 16px;
            line-height: 1.5;
            opacity: 0.85;
          }
        }
      `}</style>
    </div>
  );
}

const SLIDE_COUNT = 10;
