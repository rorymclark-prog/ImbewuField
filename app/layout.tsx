import type { Metadata } from 'next';
import { Newsreader, Public_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { LanguageProvider } from '@/lib/i18n';
import ChatWidget from '@/components/ChatWidget';
import SampleModeBanner from '@/components/SampleModeBanner';

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
  metadataBase: new URL('https://fieldproof.vercel.app'),
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable + ' ' + publicSans.variable}>
      <body className="h-screen overflow-hidden bg-paper text-ink font-sans">
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              {children}
              <ChatWidget />
              <SampleModeBanner />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
