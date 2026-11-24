import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GeoINT — Cakrapala Earth Intelligence',
  description:
    'Global real-time Earth Intelligence in 3D: NASA GIBS daily satellite imagery, USGS earthquakes, NASA FIRMS active wildfires, NOAA/GDACS tropical cyclones, and live ADS-B air traffic.',
  openGraph: {
    title: 'GeoINT — Cakrapala Earth Intelligence',
    description:
      'Global real-time Earth Intelligence in interactive 3D powered by NASA, USGS, NOAA, and open aviation telemetry.',
    url: 'https://cakrapala.com/osint',
    siteName: 'Cakrapala Aerospace',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Cakrapala GeoINT Earth Intelligence',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GeoINT — Cakrapala Earth Intelligence',
    description: 'Global real-time Earth Intelligence in interactive 3D.',
    images: ['/banner.png'],
  },
};

export default function OsintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
