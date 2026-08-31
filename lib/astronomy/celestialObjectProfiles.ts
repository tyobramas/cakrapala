/**
 * Scientific Celestial Object Profiles for Stars, Planets, the Moon, and the Sun (English).
 */

import type { ConstellationProfile } from "@/lib/astronomy/constellationProfiles";

export interface CelestialObjectInfo {
  id: string;
  name: string;
  scientificName: string;
  type: string;
  constellation: string;
  magnitude: number;
  distanceLy: string;
  spectralType: string;
  surfaceTemp: string;
  massRadius: string;
  altitudeDeg: number;
  azimuthDeg: number;
  raDec: string;
  description: string;
  funFact: string;
  constellationProfile?: ConstellationProfile;
  riseTime?: string;
  setTime?: string;
}

export const STAR_PROFILES: Record<string, Partial<CelestialObjectInfo>> = {
  Sirius: {
    scientificName: "Alpha Canis Majoris (α CMa / HR 2491)",
    type: "Main-Sequence A-Type Binary Star",
    constellation: "Canis Major (The Greater Dog)",
    distanceLy: "8.60 Light Years (2.64 pc)",
    spectralType: "A1V + DA2 (Sirius B White Dwarf)",
    surfaceTemp: "9,940 K",
    massRadius: "Mass: 2.06 M☉ | Radius: 1.71 R☉",
    description:
      "Sirius is the brightest star in the entire night sky with an apparent visual magnitude of -1.46. It is a binary star system hosting a faint white dwarf companion nicknamed 'The Pup'.",
    funFact:
      "Its heliacal rising historically marked the flooding of the Nile River and the beginning of the new year in Ancient Egypt.",
  },
  Canopus: {
    scientificName: "Alpha Carinae (α Car / HR 2326)",
    type: "Bright Giant Star (A-type)",
    constellation: "Carina (The Keel)",
    distanceLy: "310 Light Years (95 pc)",
    spectralType: "A9II",
    surfaceTemp: "7,400 K",
    massRadius: "Mass: 8.0 M☉ | Radius: 71 R☉",
    description:
      "The second-brightest star in the night sky. It shines with more than 10,000 times the visual luminosity of our Sun.",
    funFact:
      "NASA space probes (such as Voyager and Mariner) frequently utilized Canopus as a primary star tracker for spacecraft attitude navigation.",
  },
  Arcturus: {
    scientificName: "Alpha Boötis (α Boo / HR 5340)",
    type: "Red/Orange Giant Star",
    constellation: "Boötes (The Herdsman)",
    distanceLy: "36.7 Light Years (11.3 pc)",
    spectralType: "K1.5IIIpe",
    surfaceTemp: "4,286 K",
    massRadius: "Mass: 1.08 M☉ | Radius: 25.4 R☉",
    description:
      "The brightest star in the northern celestial hemisphere, radiating a distinct warm golden-orange glow.",
    funFact:
      "Light focused from Arcturus was captured via photoelectric cells to power the opening lights of the 1933 Chicago World's Fair.",
  },
  Vega: {
    scientificName: "Alpha Lyrae (α Lyr / HR 7001)",
    type: "Main-Sequence Blue-White Star",
    constellation: "Lyra (The Harp)",
    distanceLy: "25.04 Light Years (7.68 pc)",
    spectralType: "A0Va",
    surfaceTemp: "9,602 K",
    massRadius: "Mass: 2.13 M☉ | Radius: 2.36 R☉",
    description:
      "The anchor of the Summer Triangle asterism. Vega was the first star other than the Sun to be photographed by humanity (1850).",
    funFact:
      "Around 12,000 BCE, Vega served as Earth's Northern Pole Star and will return to that celestial role around the year 13,727 CE.",
  },
  Altair: {
    scientificName: "Alpha Aquilae (α Aql / HR 7121)",
    type: "Rapidly Rotating Main-Sequence Star",
    constellation: "Aquila (The Eagle)",
    distanceLy: "16.73 Light Years (5.13 pc)",
    spectralType: "A7V",
    surfaceTemp: "7,550 K",
    massRadius: "Mass: 1.79 M☉ | Radius: 1.63 - 2.03 R☉",
    description:
      "The brightest star in the constellation Aquila. Altair spins at an extraordinary speed (286 km/s), flattening its spherical shape into an oblate spheroid.",
    funFact:
      "It completes a full axial rotation in just 9 hours, compared to 25 days for our Sun.",
  },
  Deneb: {
    scientificName: "Alpha Cygni (α Cyg / HR 7924)",
    type: "Blue-White Supergiant",
    constellation: "Cygnus (The Swan)",
    distanceLy: "2,615 Light Years (802 pc)",
    spectralType: "A2Ia",
    surfaceTemp: "8,525 K",
    massRadius: "Mass: 19 M☉ | Radius: 203 R☉",
    description:
      "An intensely luminous blue-white supergiant marking the tail of the celestial Swan. It generates up to 200,000 times the luminosity of the Sun.",
    funFact:
      "Despite being thousands of light years away, Deneb easily shines among the 20 brightest stars visible to the human eye.",
  },
  Betelgeuse: {
    scientificName: "Alpha Orionis (α Ori / HR 1713)",
    type: "Red Supergiant",
    constellation: "Orion (The Hunter)",
    distanceLy: "642.5 Light Years (197 pc)",
    spectralType: "M1-2Ia-ab",
    surfaceTemp: "3,600 K",
    massRadius: "Mass: 16.5 M☉ | Radius: ~764 R☉",
    description:
      "A colossal red supergiant marking the left shoulder of Orion. If placed at the center of our Solar System, its surface would engulf the orbits of Mercury, Venus, Earth, Mars, and Jupiter.",
    funFact:
      "Betelgeuse is nearing the end of its stellar lifespan and is expected to detonate as a spectacular Core-Collapse Supernova within the next 100,000 years.",
  },
  Rigel: {
    scientificName: "Beta Orionis (β Ori / HR 1457)",
    type: "Blue Supergiant",
    constellation: "Orion (The Hunter)",
    distanceLy: "860 Light Years (260 pc)",
    spectralType: "B8Ia",
    surfaceTemp: "12,100 K",
    massRadius: "Mass: 21 M☉ | Radius: 79 R☉",
    description:
      "The brightest star in Orion, marking the hunter's left foot. It radiates immense high-energy ultraviolet and optical flux.",
    funFact:
      "Rigel shines with a staggering 120,000 times the visual luminosity of our Sun.",
  },
  Antares: {
    scientificName: "Alpha Scorpii (α Sco / HR 6134)",
    type: "Red Supergiant",
    constellation: "Scorpius (The Scorpion)",
    distanceLy: "550 Light Years (170 pc)",
    spectralType: "M1.5Iab-Ib",
    surfaceTemp: "3,660 K",
    massRadius: "Mass: 12 M☉ | Radius: 680 R☉",
    description:
      "The fiery heart of the celestial Scorpion. Its name translates from ancient Greek as 'Rival of Ares' (Rival of Mars) due to its striking ruby-red hue.",
    funFact:
      "Antares is among the largest stars visible without optical magnification in the night sky.",
  },
  "Rigil Kent": {
    scientificName: "Alpha Centauri A (α Cen / HR 5459)",
    type: "Solar-Analog Yellow Dwarf Star",
    constellation: "Centaurus",
    distanceLy: "4.37 Light Years (1.34 pc)",
    spectralType: "G2V",
    surfaceTemp: "5,790 K",
    massRadius: "Mass: 1.10 M☉ | Radius: 1.22 R☉",
    description:
      "The closest stellar system to Earth's Solar System. Together with Alpha Centauri B and Proxima Centauri, it represents the primary target for future interstellar exploration.",
    funFact:
      "The starlight you see tonight from Alpha Centauri left the star system just over 4 years ago.",
  },
  Spica: {
    scientificName: "Alpha Virginis (α Vir / HR 4662)",
    type: "Spectroscopic Binary Blue Star",
    constellation: "Virgo (The Maiden)",
    distanceLy: "250 Light Years (77 pc)",
    spectralType: "B1III-IV + B2V",
    surfaceTemp: "25,300 K",
    massRadius: "Mass: 11.4 M☉ | Radius: 7.47 R☉",
    description:
      "A brilliant sapphire-blue binary star marking the ear of wheat held by the mythological Maiden Virgo.",
    funFact:
      "The two stellar components of Spica orbit one another so closely that their mutual gravity distorts them into egg-like ellipsoids with a period of only 4 days.",
  },
  Polaris: {
    scientificName: "Alpha Ursae Minoris (α UMi / HR 424)",
    type: "Classical Cepheid Variable Supergiant (North Star)",
    constellation: "Ursa Minor (The Little Bear)",
    distanceLy: "433 Light Years (133 pc)",
    spectralType: "F7Ib",
    surfaceTemp: "6,015 K",
    massRadius: "Mass: 5.4 M☉ | Radius: 37.5 R☉",
    description:
      "The Northern Pole Star, situated almost precisely above Earth's northern rotational axis. It has guided celestial navigation for millennia.",
    funFact:
      "Polaris appears nearly stationary in the night sky while the entire celestial sphere appears to rotate around it every 24 hours.",
  },
};

export const BODY_PROFILES: Record<string, Partial<CelestialObjectInfo>> = {
  sun: {
    scientificName: "Sol (G-Type Main-Sequence Yellow Dwarf)",
    type: "G-Type Main-Sequence Star (Host Star)",
    constellation: "Ecliptic Path (Center of Solar System)",
    distanceLy: "149.6 Million km (8.3 Light Minutes / 1 AU)",
    spectralType: "G2V",
    surfaceTemp: "5,778 K (Core: ~15,000,000 K)",
    massRadius: "Mass: 1.0 M☉ (1.989 × 10³⁰ kg) | Radius: 696,340 km (109 R⊕)",
    description:
      "The Sun is the host star and gravitational anchor of our Solar System, containing 99.86% of its total mass. It powers life on Earth through hydrogen-to-helium thermonuclear fusion in its core.",
    funFact:
      "Every single second, the Sun converts 600 million tons of hydrogen into helium, releasing 3.8 × 10²⁶ Watts of radiant electromagnetic energy.",
  },
  moon: {
    scientificName: "Luna (Earth's Natural Satellite)",
    type: "Terrestrial Satellite",
    constellation: "Traverses Zodiacal Constellations",
    distanceLy: "384,400 km (1.28 Light Seconds)",
    spectralType: "Reflected Sunlight (Albedo 0.12)",
    surfaceTemp: "-130°C to +120°C",
    massRadius: "Mass: 7.34 × 10²² kg | Radius: 1,737 km (0.27 R⊕)",
    description:
      "The Moon is Earth's only natural satellite and the closest celestial body. It drives ocean tides and stabilizes Earth's axial tilt, enabling long-term climate stability.",
    funFact:
      "The Moon is tidally locked with Earth, meaning the same hemisphere permanently faces us.",
  },
  venus: {
    scientificName: "Venus (The Morning & Evening Star)",
    type: "Terrestrial Planet (Earth's Toxic Twin)",
    constellation: "Ecliptic Planet",
    distanceLy: "~41 - 261 Million km (2.3 - 14.5 Light Minutes)",
    spectralType: "Reflected Sunlight off Sulfuric Acid Clouds (Albedo 0.77)",
    surfaceTemp: "~465°C (Runaway Greenhouse Atmosphere)",
    massRadius: "Mass: 0.815 M⊕ | Radius: 6,051 km (0.95 R⊕)",
    description:
      "The third-brightest natural object in Earth's sky after the Sun and Moon. It possesses a dense carbon dioxide atmosphere with crushing surface pressure equal to 92 Earth atmospheres.",
    funFact:
      "Venus rotates in retrograde (clockwise), meaning the Sun rises in the west and sets in the east.",
  },
  jupiter: {
    scientificName: "Jupiter (The King of Planets)",
    type: "Gas Giant Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~588 - 968 Million km (32 - 53 Light Minutes)",
    spectralType: "Reflected Sunlight off Hydrogen/Helium Clouds",
    surfaceTemp: "-110°C (Cloud Tops)",
    massRadius: "Mass: 317.8 M⊕ (1,898 × 10²⁴ kg) | Radius: 69,911 km (11.2 R⊕)",
    description:
      "The largest planet in the Solar System, featuring the legendary Great Red Spot anticyclonic storm and a vast system of 95 known natural satellites including the four Galilean moons.",
    funFact:
      "Jupiter boasts a colossal magnetosphere that is 20,000 times stronger than Earth's magnetic field.",
  },
  mars: {
    scientificName: "Mars (The Red Planet)",
    type: "Terrestrial Rocky Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~56 - 400 Million km (3.1 - 22 Light Minutes)",
    spectralType: "Iron Oxide Dust (Rust Reflection)",
    surfaceTemp: "-63°C Average",
    massRadius: "Mass: 0.107 M⊕ | Radius: 3,389 km (0.53 R⊕)",
    description:
      "The fourth planet from the Sun, famous for its rusty red regolith and home to Olympus Mons, the largest volcano in the Solar System (22 km high).",
    funFact:
      "Mars is home to Valles Marineris, a canyon system that spans over 4,000 km in length—spanning the entire width of the continental United States.",
  },
  saturn: {
    scientificName: "Saturn (The Ringed Jewel)",
    type: "Ringed Gas Giant Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~1.2 - 1.6 Billion km (~1.3 Light Hours)",
    spectralType: "Water Ice & Silicate Dust Rings",
    surfaceTemp: "-140°C",
    massRadius: "Mass: 95.2 M⊕ | Radius: 58,232 km (9.4 R⊕)",
    description:
      "A magnificent gas giant world enveloped by thousands of shimmering ice rings. It hosts 146 confirmed moons, including smog-shrouded Titan and ocean-world Enceladus.",
    funFact:
      "Saturn has an average density lower than water; if placed in a sufficiently vast cosmic bathtub, Saturn would float.",
  },
  mercury: {
    scientificName: "Mercury (The Swift Planet)",
    type: "Terrestrial Rocky Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~77 - 222 Million km (4.3 - 12.3 Light Minutes)",
    spectralType: "Cratered Basaltic Crust",
    surfaceTemp: "-180°C (Night) to +430°C (Day)",
    massRadius: "Mass: 0.055 M⊕ | Radius: 2,439 km (0.38 R⊕)",
    description:
      "The smallest planet and closest to the Sun, racing through space at 47 km/s with the highest orbital velocity in the Solar System.",
    funFact:
      "Lacking a substantial insulating atmosphere, Mercury endures the most extreme temperature swings in the Solar System.",
  },
  uranus: {
    scientificName: "Uranus (The Tilted Ice Giant)",
    type: "Ice Giant Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~2.7 - 3.0 Billion km (~2.7 Light Hours)",
    spectralType: "Methane-rich Hydrogen/Helium Atmosphere (Blue-green)",
    surfaceTemp: "-224°C (Cloud Tops) — coldest planet",
    massRadius: "Mass: 14.5 M⊕ | Radius: 25,362 km (4.0 R⊕)",
    description:
      "The seventh planet and first ice giant, with a dramatic axial tilt of 97.8°, meaning it effectively rolls along its orbital path on its side. It has 13 known rings and 28 moons.",
    funFact:
      "Uranus rotates on its side — its poles point almost directly toward and away from the Sun, giving each pole 42 years of continuous sunlight followed by 42 years of darkness.",
  },
  neptune: {
    scientificName: "Neptune (The Windy Ice Giant)",
    type: "Ice Giant Planet",
    constellation: "Ecliptic Planet",
    distanceLy: "~4.3 - 4.7 Billion km (~4.1 Light Hours)",
    spectralType: "Deep Methane Blue — Hydrogen/Helium/Methane Atmosphere",
    surfaceTemp: "-214°C (Cloud Tops)",
    massRadius: "Mass: 17.1 M⊕ | Radius: 24,622 km (3.9 R⊕)",
    description:
      "The most distant and windiest planet in the Solar System, with supersonic winds exceeding 2,100 km/h. Its vivid sapphire blue color comes from methane absorbing red light in its upper atmosphere.",
    funFact:
      "Voyager 2 remains the only spacecraft to have visited Neptune, flying past in August 1989. It would take a new mission over 12 years just to reach it again.",
  },
};
