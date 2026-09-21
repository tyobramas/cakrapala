import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GEOSINT — Cakrapala Earth Intelligence',
  description:
    'Cakrapala Global Situational Awareness & Earth Intelligence (OSINT). Monitor real-time earthquakes, active wildfires, tropical cyclones, ADS-B air traffic, AIS vessels, public webcams, and NASA GIBS satellite imagery in interactive 3D.',
  openGraph: {
    title: 'GEOSINT — Cakrapala Earth Intelligence',
    description:
      'Cakrapala Global Situational Awareness & Earth Intelligence (OSINT). Interactive 3D CesiumJS globe.',
    url: 'https://cakrapala.com/osint',
    siteName: 'Cakrapala Aerospace',
    images: [
      {
        url: '/banner.png',
        width: 1200,
        height: 630,
        alt: 'Cakrapala GEOSINT Earth Intelligence',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GEOSINT — Cakrapala Earth Intelligence',
    description:
      'Cakrapala Global Situational Awareness & Earth Intelligence (OSINT). Interactive 3D globe.',
    images: ['/banner.png'],
  },
};

export default function OsintLayout({ children }: { children: React.ReactNode }) {
  return children;
}
