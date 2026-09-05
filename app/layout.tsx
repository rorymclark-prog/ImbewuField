import type { Metadata, Viewport } from 'next';
import { Newsreader, Public_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { LanguageProvider } from '@/lib/i18n';
import BackControlProvider from '@/components/BackControl';
import AppConfirmProvider from '@/components/AppConfirm';
import ChatWidget from '@/components/ChatWidget';
import PWAUpdateNotifier from '@/components/PWAUpdateNotifier';
import SampleModeBanner from '@/components/SampleModeBanner';
import PhotoViewer from '@/components/PhotoViewer';
import AccountOnboardingGates from '@/components/AccountOnboardingGates';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://imbewufield.vercel.app'),
  title: 'ImbewuField — permaculture planning for South African farmers',
  description: 'Tap any spot in South Africa for a full, location-specific permaculture plan — climate, soil, water, planting calendar and AI garden design, in your language.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ImbewuField',
  },
  icons: {
    apple: '/icon-192.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'ImbewuField',
    description: 'Permaculture planning for South African farmers — climate, soil, water, planting calendars and AI garden design, in your language.',
    type: 'website',
    locale: 'en_ZA',
    siteName: 'ImbewuField',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImbewuField',
    description: 'Permaculture planning for South African farmers, in your language.',
  },
};

// viewportFit: 'cover' is the actual root cause behind "content cut off at the bottom of the
// screen" reports on notched/home-indicator phones — WITHOUT this, every env(safe-area-inset-*)
// call anywhere in the app (there are dozens already, e.g. DesignPalette.tsx's tool row,
// TabBar.tsx, Map.tsx's sheets) always evaluates to 0px, because Safari only exposes the
// safe-area env() variables once the viewport meta declares viewport-fit=cover. Those call
// sites were written correctly; this was the one missing piece that silently made all of them
// no-ops. Fixes it app-wide in one place rather than padding every affected component by a
// guessed pixel amount.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const loadedBuildSha = (
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  ''
).slice(0, 7) || null;

// lib/theme.tsx only sets data-theme/.dark on <html> from inside a useEffect, which cannot run
// until after React hydrates. Until then the server-rendered <html> carries neither attribute, so
// every load paints bare :root first — which is always earth-light, regardless of what the farmer
// picked. On a fast desktop that gap is invisible; on the cheap, often-3G Android phones this app
// targets, hydration can lag long enough for a farmer who chose dark mode to see the light theme
// flash on-screen on every single page load. This blocking inline script mirrors ThemeProvider's
// own mount logic (same localStorage keys, same defaults) and runs before first paint, so the
// stored theme is already applied by the time anything is visible; the later useEffect then just
// re-confirms the same values. suppressHydrationWarning on <html> is required because this script
// mutates the DOM (the "dark" class) before React hydrates, which React would otherwise flag as a
// mismatch against the server-rendered markup.
const THEME_INIT_SCRIPT = `(function(){try{
  var t=localStorage.getItem('fp-theme');
  var m=localStorage.getItem('fp-mode');
  var theme=(t==='earth'||t==='slate')?t:'earth';
  var mode=(m==='light'||m==='dark'||m==='system')?m:'system';
  var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark=mode==='dark'||(mode==='system'&&prefersDark);
  var root=document.documentElement;
  root.setAttribute('data-theme',theme);
  if(isDark)root.classList.add('dark');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable + ' ' + publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* No bg-paper/text-ink here: those Tailwind classes are a class selector, which beats
          the plain-element `html, body { background: var(--bg-0); color: var(--text-primary) }`
          rule in globals.css on specificity alone regardless of source order — exactly the
          footgun documented at that rule's --border sibling. That silently froze the whole
          app's root paint to the earth-light hexes in every theme/mode, so a farmer in dark
          mode could see a light flash through any uncovered edge (iOS rubber-band overscroll,
          a sheet that doesn't fill the viewport). Let the token rule apply instead. */}
      <body className="h-screen overflow-hidden font-sans">
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              {/* AppConfirm replaces window.confirm app-wide: embedded webviews suppress native
                  dialogs and auto-return false, silently killing (or inverting) every
                  confirm-gated flow. Inside LanguageProvider so translated surfaces can pass
                  t() labels; wraps ChatWidget too so any surface can ask. */}
              <AppConfirmProvider>
                <AccountOnboardingGates />
                <BackControlProvider>{children}</BackControlProvider>
                <ChatWidget />
                <PWAUpdateNotifier initialBuildSha={loadedBuildSha} />
                <SampleModeBanner />
                <PhotoViewer />
              </AppConfirmProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
