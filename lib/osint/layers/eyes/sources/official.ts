// lib/osint/layers/eyes/sources/official.ts
// ─────────────────────────────────────────────────────────────────────────────
// Official Government Public Webcam & Traffic Camera Registry
//
// ETHICAL & COMPLIANCE RULES:
//   1. ONLY official cameras from public government portals (Dishub, Diskominfo,
//      Department of Transportation, Transport for London).
//   2. STRICTLY PROHIBITED: Port-scanned feeds, Shodan/Insecam, private cameras,
//      or default credential targets.
//   3. All cameras MUST have a verified 'sourcePage' URL confirming their public broadcast.
//   4. Centralized Takedown: Any camera can be instantly disabled by toggling `enabled: false`.
//   5. Due to strict SAMEORIGIN / CORS policies on government servers, streamType
//      'external' or 'embed' opens the official public page in a new tab without proxying.
// ─────────────────────────────────────────────────────────────────────────────

import type { BBox, OsintEntity } from '@/lib/osint/types';

export interface OfficialWebcamEntry {
  id: string;
  name: string;
  city: string;
  provinceOrState: string;
  country: string;
  lat: number;
  lon: number;
  viewDirectionDeg?: number;
  operator: string;
  streamType: 'snapshot' | 'hls' | 'mjpeg' | 'embed' | 'external';
  url: string;
  sourcePage: string;
  verifiedDate: string; // YYYY-MM-DD
  enabled: boolean; // Takedown flag
  notes?: string;
}

export const OFFICIAL_WEBCAMS: OfficialWebcamEntry[] = [
  // ── DKI Jakarta (Diskominfo DKI Jakarta / Smart City) ──
  {
    id: 'dki-monas',
    name: 'Kawasan Silang Monas',
    city: 'Jakarta Pusat',
    provinceOrState: 'DKI Jakarta',
    country: 'Indonesia',
    lat: -6.175392,
    lon: 106.827153,
    viewDirectionDeg: 180,
    operator: 'Diskominfo DKI Jakarta',
    streamType: 'external',
    url: 'https://smartcity.jakarta.go.id/id/cctv/',
    sourcePage: 'https://smartcity.jakarta.go.id/id/cctv/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera pengawas publik Smart City Jakarta kawasan Monas',
  },
  {
    id: 'dki-bundaran-hi',
    name: 'Bundaran Hotel Indonesia',
    city: 'Jakarta Pusat',
    provinceOrState: 'DKI Jakarta',
    country: 'Indonesia',
    lat: -6.195045,
    lon: 106.823015,
    viewDirectionDeg: 0,
    operator: 'Diskominfo DKI Jakarta',
    streamType: 'external',
    url: 'https://smartcity.jakarta.go.id/id/cctv/',
    sourcePage: 'https://smartcity.jakarta.go.id/id/cctv/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera pemantau lalu lintas Bundaran HI',
  },
  {
    id: 'dki-semanggi',
    name: 'Simpang Susun Semanggi',
    city: 'Jakarta Selatan',
    provinceOrState: 'DKI Jakarta',
    country: 'Indonesia',
    lat: -6.219722,
    lon: 106.814722,
    viewDirectionDeg: 270,
    operator: 'Diskominfo DKI Jakarta',
    streamType: 'external',
    url: 'https://smartcity.jakarta.go.id/id/cctv/',
    sourcePage: 'https://smartcity.jakarta.go.id/id/cctv/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Pemantauan persimpangan Semanggi Jakarta',
  },

  // ── Kota Bandung (Diskominfo & Dishub Kota Bandung) ──
  {
    id: 'bdg-gedung-sate',
    name: 'Kawasan Gedung Sate (Diponegoro)',
    city: 'Bandung',
    provinceOrState: 'Jawa Barat',
    country: 'Indonesia',
    lat: -6.902484,
    lon: 107.618641,
    viewDirectionDeg: 180,
    operator: 'Diskominfo Kota Bandung (Pelindung)',
    streamType: 'external',
    url: 'https://pelindung.bandung.go.id/',
    sourcePage: 'https://pelindung.bandung.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera pemantauan lingkungan Pelindung Bandung',
  },
  {
    id: 'bdg-cikapayang-dago',
    name: 'Simpang Cikapayang Dago (Ir. H. Djuanda)',
    city: 'Bandung',
    provinceOrState: 'Jawa Barat',
    country: 'Indonesia',
    lat: -6.899211,
    lon: 107.613589,
    viewDirectionDeg: 340,
    operator: 'Dishub Kota Bandung (ATCS)',
    streamType: 'external',
    url: 'https://atcs-dishub.bandung.go.id/',
    sourcePage: 'https://atcs-dishub.bandung.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera ATCS lalu lintas Cikapayang Dago',
  },
  {
    id: 'bdg-simpang-lima',
    name: 'Simpang Lima Asia Afrika',
    city: 'Bandung',
    provinceOrState: 'Jawa Barat',
    country: 'Indonesia',
    lat: -6.923835,
    lon: 107.616335,
    viewDirectionDeg: 90,
    operator: 'Dishub Kota Bandung (ATCS)',
    streamType: 'external',
    url: 'https://atcs-dishub.bandung.go.id/',
    sourcePage: 'https://atcs-dishub.bandung.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera ATCS kawasan Simpang Lima Asia Afrika',
  },

  // ── Surabaya (Dishub Kota Surabaya / SITS) ──
  {
    id: 'sby-taman-bungkul',
    name: 'Simpang Taman Bungkul (Raya Darmo)',
    city: 'Surabaya',
    provinceOrState: 'Jawa Timur',
    country: 'Indonesia',
    lat: -7.291361,
    lon: 112.738806,
    viewDirectionDeg: 0,
    operator: 'Dishub Kota Surabaya (SITS)',
    streamType: 'external',
    url: 'https://dishub.surabaya.go.id/',
    sourcePage: 'https://dishub.surabaya.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Surabaya Intelligent Transportation System',
  },
  {
    id: 'sby-jembatan-merah',
    name: 'Kawasan Jembatan Merah',
    city: 'Surabaya',
    provinceOrState: 'Jawa Timur',
    country: 'Indonesia',
    lat: -7.235556,
    lon: 112.738333,
    viewDirectionDeg: 210,
    operator: 'Dishub Kota Surabaya (SITS)',
    streamType: 'external',
    url: 'https://dishub.surabaya.go.id/',
    sourcePage: 'https://dishub.surabaya.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera SITS koridor Jembatan Merah Surabaya',
  },

  // ── Semarang (Dishub Kota Semarang) ──
  {
    id: 'smg-simpang-lima',
    name: 'Kawasan Simpang Lima Semarang',
    city: 'Semarang',
    provinceOrState: 'Jawa Tengah',
    country: 'Indonesia',
    lat: -6.990278,
    lon: 110.422778,
    viewDirectionDeg: 0,
    operator: 'Dishub Kota Semarang (ATCS)',
    streamType: 'external',
    url: 'https://dishub.semarangkota.go.id/',
    sourcePage: 'https://dishub.semarangkota.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera ATCS Simpang Lima Semarang',
  },

  // ── D.I. Yogyakarta (Dishub DIY) ──
  {
    id: 'jog-nol-km',
    name: 'Titik Nol Kilometer Malioboro',
    city: 'Yogyakarta',
    provinceOrState: 'D.I. Yogyakarta',
    country: 'Indonesia',
    lat: -7.801389,
    lon: 110.364722,
    viewDirectionDeg: 0,
    operator: 'Dishub DIY (MAM)',
    streamType: 'external',
    url: 'https://mam.jogjaprov.go.id/',
    sourcePage: 'https://mam.jogjaprov.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera publik Nol Kilometer Malioboro',
  },

  // ── Kota Denpasar (Dishub Kota Denpasar) ──
  {
    id: 'dps-dewa-ruci',
    name: 'Simpang Dewa Ruci (Kuta / By Pass)',
    city: 'Denpasar / Badung',
    provinceOrState: 'Bali',
    country: 'Indonesia',
    lat: -8.718056,
    lon: 115.183889,
    viewDirectionDeg: 90,
    operator: 'Dishub Kota Denpasar (ATCS)',
    streamType: 'external',
    url: 'https://atcs.denpasarkota.go.id/',
    sourcePage: 'https://atcs.denpasarkota.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera ATCS simpang patung Dewa Ruci Bali',
  },
  {
    id: 'dps-sanur',
    name: 'Simpang By Pass Sanur (Hang Tuah)',
    city: 'Denpasar',
    provinceOrState: 'Bali',
    country: 'Indonesia',
    lat: -8.675556,
    lon: 115.260278,
    viewDirectionDeg: 120,
    operator: 'Dishub Kota Denpasar (ATCS)',
    streamType: 'external',
    url: 'https://atcs.denpasarkota.go.id/',
    sourcePage: 'https://atcs.denpasarkota.go.id/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'Kamera ATCS Sanur Hang Tuah Denpasar',
  },

  // ── London, UK (Transport for London JamCams) ──
  {
    id: 'lon-trafalgar',
    name: 'Trafalgar Square / Whitehall',
    city: 'London',
    provinceOrState: 'Greater London',
    country: 'United Kingdom',
    lat: 51.508056,
    lon: -0.128056,
    viewDirectionDeg: 180,
    operator: 'Transport for London (TfL)',
    streamType: 'snapshot',
    url: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.02001.jpg',
    sourcePage: 'https://www.tfl.gov.uk/traffic/status/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'TfL JamCams snapshot publik resmi (OGL License)',
  },
  {
    id: 'lon-tower-bridge',
    name: 'Tower Bridge Approach',
    city: 'London',
    provinceOrState: 'Greater London',
    country: 'United Kingdom',
    lat: 51.505556,
    lon: -0.075278,
    viewDirectionDeg: 0,
    operator: 'Transport for London (TfL)',
    streamType: 'snapshot',
    url: 'https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.03701.jpg',
    sourcePage: 'https://www.tfl.gov.uk/traffic/status/',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'TfL JamCams Tower Bridge publik resmi (OGL License)',
  },

  // ── Washington State, USA (WSDOT) ──
  {
    id: 'sea-i5-downtown',
    name: 'I-5 at Downtown Seattle (James St)',
    city: 'Seattle',
    provinceOrState: 'Washington',
    country: 'United States',
    lat: 47.603833,
    lon: -122.327667,
    viewDirectionDeg: 330,
    operator: 'Washington State DOT',
    streamType: 'external',
    url: 'https://wsdot.wa.gov/travel/traffic-cameras-travel-alerts/cameras',
    sourcePage: 'https://wsdot.wa.gov/travel/traffic-cameras-travel-alerts/cameras',
    verifiedDate: '2026-09-21',
    enabled: true,
    notes: 'WSDOT Highway Traffic Camera public portal',
  },
];

/**
 * Returns active official webcams, optionally filtered by viewport bounding box.
 */
export function getOfficialWebcams(bbox?: BBox): OsintEntity[] {
  const active = OFFICIAL_WEBCAMS.filter((c) => c.enabled);
  const filtered = bbox
    ? active.filter(
        (c) =>
          c.lon >= bbox[0] &&
          c.lon <= bbox[2] &&
          c.lat >= bbox[1] &&
          c.lat <= bbox[3],
      )
    : active;

  return filtered.map((c) => ({
    id: `eyes:official:${c.id}`,
    layer: 'eyes',
    kind: 'static',
    label: `${c.name} (${c.city})`,
    position: { lat: c.lat, lon: c.lon, altM: 0 },
    headingDeg: c.viewDirectionDeg,
    severity: 0, // Eyes layer does not use severity
    observedAt: `${c.verifiedDate}T00:00:00Z`,
    source: c.operator,
    raw: {
      provider: 'official',
      city: c.city,
      provinceOrState: c.provinceOrState,
      country: c.country,
      operator: c.operator,
      streamType: c.streamType,
      url: c.url,
      sourcePage: c.sourcePage,
      isActive: true,
      isOfficial: true,
      lastUpdated: c.verifiedDate,
    },
  }));
}
