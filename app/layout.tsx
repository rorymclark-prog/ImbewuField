import type { Metadata, Viewport } from 'next';
import { Newsreader, Public_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { LanguageProvider } from '@/lib/i18n';
import BackControlProvider from '@/components/BackControl';
import ChatWidget from '@/components/ChatWidget';
import PWAUpdateNotifier from '@/components/PWAUpdateNotifier';
import SampleModeBanner from '@/components/SampleModeBanner';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable + ' ' + publicSans.variable}>
      <body className="h-screen overflow-hidden bg-paper text-ink font-sans">
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <AccountOnboardingGates />
              <BackControlProvider>{children}</BackControlProvider>
              <ChatWidget />
              <PWAUpdateNotifier initialBuildSha={loadedBuildSha} />
              <SampleModeBanner />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
