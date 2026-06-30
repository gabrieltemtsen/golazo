import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/components/wallet/WalletProvider';

const geistSans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://golazo-ball.vercel.app';
const OG_DESC =
  'Back a result with CRC, watch the crowd-odds move live, split the pot if you nailed it. Built on the Circles trust graph on Gnosis Chain.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  icons: { icon: '/icon.png', apple: '/icon.png' },
  title: 'Golazo — World Cup prediction pools on Circles',
  description:
    'Stake your Circles (CRC) on the World Cup 2026 knockouts. No house, no fixed odds — every pool is split among the crowd that called it right. Invite a friend, earn an on-chain bounty when they join.',
  openGraph: {
    title: 'Golazo ⚽ — parimutuel World Cup pools on Circles',
    description: OG_DESC,
    type: 'website',
    url: SITE_URL,
    siteName: 'Golazo',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Golazo — call the knockouts, split the pot. World Cup 2026 pools staked in Circles.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Golazo ⚽ — parimutuel World Cup pools on Circles',
    description: OG_DESC,
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
