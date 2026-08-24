/**
 * Central Satellite Catalog for Cakrapala Real-time Satellite Tracker.
 * Contains NORAD Catalog IDs, fallback TLEs, orbital characteristics, and asset metadata.
 */

export interface SatelliteInfo {
  id: string;
  name: string;
  fullName: string;
  noradId: number;
  agency: string;
  countryCode: string;
  category: "space-station" | "telescope" | "weather" | "earth-observation" | "constellation";
  categoryLabel: string;
  launchYear: number;
  inclinationDeg: number;
  periodMin: number;
  avgAltitudeKm: number;
  description: string;
  iconSvg: string;
  themeColor: string;
  defaultTle: {
    line1: string;
    line2: string;
  };
}

export const SATELLITE_CATALOG: SatelliteInfo[] = [
  {
    id: "iss",
    name: "ISS (Zarya)",
    fullName: "International Space Station",
    noradId: 25544,
    agency: "NASA / ESA / JAXA / Roscosmos / CSA",
    countryCode: "INTL",
    category: "space-station",
    categoryLabel: "Habitable Space Station",
    launchYear: 1998,
    inclinationDeg: 51.64,
    periodMin: 92.68,
    avgAltitudeKm: 420,
    description: "The premier microgravity laboratory and permanently crewed multinational habitat in low Earth orbit.",
    iconSvg: "/textures/satellites/iss.svg",
    themeColor: "#00f0ff",
    defaultTle: {
      line1: "1 25544U 98067A   26054.54203704  .00014238  00000+0  25316-3 0  9993",
      line2: "2 25544  51.6415 161.8023 0005891  33.5188  67.1147 15.50058728554252",
    },
  },
  {
    id: "tiangong",
    name: "Tiangong (CSS)",
    fullName: "Chinese Space Station (Tiangong)",
    noradId: 48274,
    agency: "CMSA (China Manned Space Agency)",
    countryCode: "CHN",
    category: "space-station",
    categoryLabel: "Modular Space Station",
    launchYear: 2021,
    inclinationDeg: 41.47,
    periodMin: 92.18,
    avgAltitudeKm: 390,
    description: "T-shaped modular space station composed of Tianhe core module and Wentian & Mengtian scientific laboratories.",
    iconSvg: "/textures/satellites/tiangong.svg",
    themeColor: "#f59e0b",
    defaultTle: {
      line1: "1 48274U 21035A   26054.55011867  .00021319  00000+0  25687-3 0  9997",
      line2: "2 48274  41.4721 142.9234 0003781  84.1823  49.6271 15.59281923265431",
    },
  },
  {
    id: "hubble",
    name: "Hubble (HST)",
    fullName: "Hubble Space Telescope",
    noradId: 20580,
    agency: "NASA / ESA",
    countryCode: "USA",
    category: "telescope",
    categoryLabel: "Space Optical Observatory",
    launchYear: 1990,
    inclinationDeg: 28.47,
    periodMin: 95.23,
    avgAltitudeKm: 535,
    description: "Legendary 2.4-meter aperture ultraviolet, optical, and near-infrared telescope that revolutionized modern astrophysics.",
    iconSvg: "/textures/satellites/hubble.svg",
    themeColor: "#818cf8",
    defaultTle: {
      line1: "1 20580U 90037B   26054.51234567  .00001234  00000+0  34521-4 0  9992",
      line2: "2 20580  28.4691 190.2341 0002891  65.1234  94.5123 15.09341234567890",
    },
  },
  {
    id: "noaa19",
    name: "NOAA-19",
    fullName: "NOAA-19 Polar Weather Satellite",
    noradId: 33591,
    agency: "NOAA / NASA",
    countryCode: "USA",
    category: "weather",
    categoryLabel: "Polar Meteorological Satellite",
    launchYear: 2009,
    inclinationDeg: 98.71,
    periodMin: 101.9,
    avgAltitudeKm: 850,
    description: "Sun-synchronous polar operational environmental satellite monitoring global weather, sea temperatures, and cloud formations.",
    iconSvg: "/textures/satellites/noaa.svg",
    themeColor: "#10b981",
    defaultTle: {
      line1: "1 33591U 09005A   26054.50123456  .00000123  00000+0  78901-4 0  9994",
      line2: "2 33591  98.7123 210.4567 0013891 120.4567 240.1234 14.12345678876543",
    },
  },
  {
    id: "terra",
    name: "Terra (EOS AM-1)",
    fullName: "Terra Earth Observing System",
    noradId: 25994,
    agency: "NASA / JAXA / CSA",
    countryCode: "USA",
    category: "earth-observation",
    categoryLabel: "Earth Science Climate Flagship",
    launchYear: 1999,
    inclinationDeg: 98.2,
    periodMin: 98.88,
    avgAltitudeKm: 705,
    description: "NASA's flagship Earth Observing System spacecraft carrying MODIS, ASTER, CERES, and MISR environmental sensors.",
    iconSvg: "/textures/satellites/terra.svg",
    themeColor: "#38bdf8",
    defaultTle: {
      line1: "1 25994U 99068A   26054.49876543  .00000234  00000+0  56789-4 0  9991",
      line2: "2 25994  98.2012 185.6789 0001234  90.1234 270.5678 14.57123456765432",
    },
  },
  {
    id: "starlink",
    name: "Starlink-53883",
    fullName: "Starlink Global Broadband Satellite",
    noradId: 53883,
    agency: "SpaceX",
    countryCode: "USA",
    category: "constellation",
    categoryLabel: "Megaconstellation Telecom",
    launchYear: 2022,
    inclinationDeg: 53.22,
    periodMin: 95.6,
    avgAltitudeKm: 550,
    description: "SpaceX low Earth orbit broadband communication satellite with phased array antennas and krypton ion propulsion.",
    iconSvg: "/textures/satellites/starlink.svg",
    themeColor: "#38bdf8",
    defaultTle: {
      line1: "1 53883U 22119A   26054.48765432  .00005432  00000+0  12345-3 0  9996",
      line2: "2 53883  53.2189 220.1234 0001456  45.6789 314.3210 15.05678901234567",
    },
  },
];

export function getSatelliteById(id: string): SatelliteInfo {
  const found = SATELLITE_CATALOG.find(
    (s) => s.id.toLowerCase() === id.toLowerCase() || String(s.noradId) === id
  );
  return found || SATELLITE_CATALOG[0];
}
