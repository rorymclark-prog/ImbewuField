import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, Building2, DatabaseBackup, Mail,
} from 'lucide-react';

/**
 * TrustFooter — the closing arc of /welcome: the POPIA-consent stance that makes the
 * data promise concrete, a closing CTA that recaps the hero's choice, and the site
 * footer. This is where impact-number proof (as it's sourced and added) belongs too.
 *
 * Split out of app/welcome/page.tsx (now a thin shell) — see that file's header
 * comment for this route's shared constraints.
 */

interface PrivacyPoint {
  Icon: typeof ShieldCheck;
  title: string;
  body: string;
}

// Grounded in components/ConsentPanel.tsx's header comment (off by default, one
// button to stop) and app/pitch/page.tsx's field-constraints slide (org-scoped
// access, daily backups with point-in-time recovery — re-verified against the
// live project before that slide shipped).
const PRIVACY_POINTS: PrivacyPoint[] = [
  {
    Icon: ShieldCheck,
    title: 'Off until she says otherwise',
    body: 'No pre-ticked box and no default sharing. A farmer who never opens her sharing settings shares nothing.',
  },
  {
    Icon: Building2,
    title: 'Organisation-scoped',
    body: "A programme sees only its own farmers — never another programme's.",
  },
  {
    Icon: DatabaseBackup,
    title: 'Backed up daily',
    body: "Daily backups, with point-in-time recovery, so a farmer's record is never one mistake from gone.",
  },
];

export default function TrustFooter() {
  return (
    <>
      {/* ── Data & consent ─────────────────────────────────────────────── */}
      <section id="privacy" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20 bg-forest">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-start">
          <div>
            <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em]" style={{ color: '#9FD4AE' }}>
              Data &amp; consent
            </span>
            <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-card">
              Farmers control what a funder sees.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: '#D9E8DC' }}>
              Sharing starts switched off. A farmer chooses, category by category &mdash; sales,
              spending, harvests, training, survey answers, even how precisely her farm location
              shows &mdash; what her programme can see. A programme sees only its own farmers,
              and only what each farmer agreed to share.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            {PRIVACY_POINTS.map(({ Icon, title, body }) => (
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

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 lg:px-10 py-14 sm:py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-semibold text-[24px] sm:text-[28px] leading-[1.2] tracking-[-0.02em] text-ink">
            See your own land, mapped.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            Sign in to map your first site, or open the partner deck to bring ImbewuField to
            your programme.
          </p>
          <div className="mt-7">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
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
        </div>
      </section>

      <footer className="px-5 sm:px-8 py-8 border-t" style={{ borderColor: '#E2D8C4' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[13px] text-ink-faint">
            <span className="font-display font-semibold text-[15px] text-ink">ImbewuField</span>
            <span>&middot; Imbewu Yoshintso NPC</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] font-sans font-semibold text-ink-muted">
            <Link href="/pitch" className="hover:text-forest transition-colors">
              Partner &amp; funder deck
            </Link>
            <a href="mailto:rorymclark@gmail.com" className="inline-flex items-center gap-1.5 hover:text-forest transition-colors">
              <Mail size={14} />
              rorymclark@gmail.com
            </a>
          </div>
        </div>
        <p className="max-w-6xl mx-auto mt-6 text-[12px] text-ink-faint">
          &copy; 2026 Imbewu Yoshintso NPC &middot; ImbewuField
        </p>
      </footer>
    </>
  );
}
