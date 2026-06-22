import type { Metadata } from 'next';
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import ChatWidget from '@/components/ChatWidget';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fieldproof.vercel.app'),
  title: 'ImbewuField — permaculture planning for South African farmers',
  description: 'Tap any spot in South Africa for a full, location-specific permaculture plan — climate, soil, water, planting calendar and AI garden design, in your language.',
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
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="h-screen overflow-hidden">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <ChatWidget />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
