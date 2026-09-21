import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mata Bumi — Cakrapala OSINT',
  description:
    'Sistem Pengamatan & Kesadaran Situasi Global Terbuka (Open Source Intelligence) Cakrapala. Memantau gempa bumi, kebakaran hutan, badai tropis, lalu lintas udara ADS-B, lalu lintas laut AIS, kamera publik, dan citra satelit NASA GIBS secara real-time 3D.',
  openGraph: {
    title: 'Mata Bumi — Cakrapala OSINT',
    description:
      'Sistem Pengamatan & Kesadaran Situasi Global Terbuka (OSINT) Cakrapala. Pantauan bumi real-time 3D interaktif berbasis CesiumJS.',
    url: 'https://cakrapala.com/osint',
    siteName: 'Cakrapala Aerospace',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Cakrapala OSINT Mata Bumi',
      },
    ],
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mata Bumi — Cakrapala OSINT',
    description:
      'Sistem Pengamatan & Kesadaran Situasi Global Terbuka (OSINT) Cakrapala. Pantauan bumi real-time 3D interaktif.',
    images: ['/banner.png'],
  },
};

export default function OsintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
