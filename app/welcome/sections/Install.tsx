/**
 * Install — "get it on your phone", the section the page could not do its job without.
 *
 * WHY THIS IS INSTRUCTIONS AND NOT A BUTTON. ImbewuField is a PWA: there is no Play Store
 * or App Store listing to link to, and nothing in this repo registers a
 * `beforeinstallprompt` handler, so there is no in-page "Install" button to offer and no
 * honest way to fake one. Installing really is the browser's own Add-to-Home-Screen flow,
 * which is buried two menus deep and which almost nobody finds unaided — so the page names
 * the steps per platform instead of gesturing at "install the app" and leaving a farmer
 * to hunt. If an install-prompt handler is ever added, this section is where its button
 * belongs, with these steps kept as the fallback for browsers that never fire the event.
 *
 * THE THIRD CARD IS NOT FILLER. "You do not have to install anything" is the honest lede
 * for the many visitors on a borrowed or nearly-full phone: the app runs in the browser
 * and works offline either way (the service worker caches on first visit, install or no
 * install). Saying so removes the only real objection this section can raise.
 *
 * SOURCED, not invented: manifest.json declares display 'standalone', start_url '/home',
 * name 'ImbewuField' — so a home-screen launch really does open full-screen at /home under
 * that name. The offline claim is the same one Hero's fact chips already make, from the
 * service worker in public/sw.js (see project docs on the offline pack). No storage-size,
 * data-cost or device-spec numbers are quoted here: this repo has no measurement of any of
 * them, and a made-up megabyte figure on the front door is exactly the kind of claim a
 * funder checks.
 *
 * Split out of app/welcome/page.tsx (a thin shell) — see that file's header comment for
 * this route's shared constraints (server component only, no auth, no client fetching).
 */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-sans font-semibold uppercase tracking-[0.14em] text-forest">
      {children}
    </span>
  );
}

interface InstallRoute {
  device: string;
  browser: string;
  steps: string[];
}

// Menu labels are the ones the browsers themselves use, so the words on this page match the
// words on the phone. Chrome/Android and Safari/iOS are the two that cover this app's users;
// anything else falls under the "use it in the browser" card below rather than a longer list.
const ROUTES: InstallRoute[] = [
  {
    device: 'Android phone',
    browser: 'Chrome',
    steps: [
      'Open imbewufield.vercel.app in Chrome.',
      'Tap the ⋮ menu, top right.',
      'Tap “Add to Home screen”, then “Install”.',
    ],
  },
  {
    device: 'iPhone or iPad',
    browser: 'Safari',
    steps: [
      'Open imbewufield.vercel.app in Safari.',
      'Tap the Share button at the bottom.',
      'Scroll down, tap “Add to Home Screen”, then “Add”.',
    ],
  },
];

export default function Install() {
  return (
    <section id="install" className="px-5 sm:px-8 lg:px-10 py-14 sm:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <SectionEyebrow>Get it on your phone</SectionEyebrow>
          <h2 className="mt-3 font-display font-semibold text-[26px] sm:text-[32px] leading-[1.2] tracking-[-0.02em] text-ink">
            No app store. No download.
          </h2>
          <p className="mt-3 font-sans text-[15px] sm:text-[16px] leading-relaxed text-ink/70">
            ImbewuField installs straight from your browser in three taps, then opens from your
            home screen like any other app — and keeps working when the signal does not.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-3">
          {ROUTES.map(({ device, browser, steps }) => (
            <div
              key={device}
              className="rounded-2xl bg-white/70 border p-5 sm:p-6"
              style={{ borderColor: '#E2D8C4' }}
            >
              <h3 className="font-display font-semibold text-[17px] leading-snug text-ink">
                {device}
              </h3>
              <p className="mt-0.5 font-sans text-[13px] text-ink/55">Using {browser}</p>
              <ol className="mt-4 space-y-2.5">
                {steps.map((step, i) => (
                  <li key={step} className="flex gap-3 font-sans text-[14px] leading-relaxed text-ink/75">
                    <span
                      aria-hidden="true"
                      className="flex-shrink-0 grid place-items-center w-5 h-5 mt-0.5 rounded-full bg-forest/10 text-forest text-[11px] font-semibold tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          {/* The objection-remover: a borrowed phone, or one with no room left, is still enough. */}
          <div className="rounded-2xl bg-forest/[0.06] border border-forest/20 p-5 sm:p-6">
            <h3 className="font-display font-semibold text-[17px] leading-snug text-ink">
              Or use it in the browser
            </h3>
            <p className="mt-0.5 font-sans text-[13px] text-ink/55">Nothing to install</p>
            <p className="mt-4 font-sans text-[14px] leading-relaxed text-ink/75">
              Everything works without installing — the same maps, the same records, and the same
              offline behaviour once you have opened it. Installing only adds the home-screen icon
              and a full screen without the browser bars.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
