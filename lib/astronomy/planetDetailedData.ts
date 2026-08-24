import type { PlanetId } from "./types";

export interface MoonDetail {
  name: string;
  diameterKm: string;
  orbitalPeriodDays: string;
  imageSrc: string;
  features: string;
  discoveryYear: string;
}

export interface DetailedPlanetInfo {
  id: PlanetId;
  name: string;
  subtitle: string;
  classification: string;
  discovery: string;
  color: string;
  themeColor: string;
  badge: string;
  planetImageSrc: string;
  overview: string;
  physicalStats: {
    meanRadiusKm: string;
    massKg: string;
    massEarths: string;
    surfaceGravity: string;
    escapeVelocity: string;
    density: string;
    axialTilt: string;
    avgTempC: string;
  };
  orbitalStats: {
    semiMajorAxisAU: string;
    semiMajorAxisKm: string;
    orbitalPeriod: string;
    orbitalSpeedKmS: string;
    eccentricity: string;
    inclinationDeg: string;
  };
  atmosphere: {
    pressureBar: string;
    components: { name: string; percent: string }[];
    notes: string;
  };
  moons: {
    count: number;
    hasRings: boolean;
    ringDetails?: string;
    notableMoons: string[];
    moonsList: MoonDetail[];
  };
  missions: {
    name: string;
    agency: string;
    year: string;
    achievement: string;
  }[];
}

export const DETAILED_PLANET_DATA: Record<PlanetId, DetailedPlanetInfo> = {
  sun: {
    id: "sun",
    name: "Sun (Sol)",
    subtitle: "THE CENTRAL YELLOW DWARF STAR",
    classification: "G-Type Main-Sequence Star (G2V)",
    discovery: "Center of the Solar System (Copernican Heliocentric Model 1543)",
    color: "#FDB813",
    themeColor: "amber",
    badge: "0.00 AU • 99.86% OF TOTAL SOLAR MASS",
    planetImageSrc: "/textures/planets/sun.jpg",
    overview:
      "The Sun is the yellow dwarf star at the center of the Solar System. It is an almost perfect sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core, converting 600 million tons of hydrogen into helium every second.",
    physicalStats: {
      meanRadiusKm: "696,340 km (109.3 Earths)",
      massKg: "1.989 × 10³⁰ kg",
      massEarths: "333,000 Earth masses",
      surfaceGravity: "274.0 m/s² (27.9 g)",
      escapeVelocity: "617.5 km/s",
      density: "1.408 g/cm³ (Core: 150 g/cm³)",
      axialTilt: "7.25° to Ecliptic",
      avgTempC: "5,500°C Surface (15,000,000°C Core)",
    },
    orbitalStats: {
      semiMajorAxisAU: "0.000 AU (Origin)",
      semiMajorAxisKm: "Galactic Orbit: ~26,000 Light Years from Galactic Center",
      orbitalPeriod: "230 Million Earth Years (Galactic Year)",
      orbitalSpeedKmS: "220 km/s (Orbiting Milky Way Core)",
      eccentricity: "0.0000",
      inclinationDeg: "60.2° to Galactic Plane",
    },
    atmosphere: {
      pressureBar: "0.868 bar (Photosphere optical surface)",
      components: [
        { name: "Hydrogen (H)", percent: "73.46%" },
        { name: "Helium (He)", percent: "24.85%" },
        { name: "Oxygen (O)", percent: "0.77%" },
        { name: "Carbon (C)", percent: "0.29%" },
        { name: "Iron (Fe)", percent: "0.16%" },
      ],
      notes: "The outer solar corona reaches 1 to 3 million Kelvin, accelerating the Solar Wind throughout the heliosphere.",
    },
    moons: {
      count: 8,
      hasRings: true,
      ringDetails: "Main Asteroid Belt, Kuiper Belt, and Oort Cloud circumstellar debris disks.",
      notableMoons: [
        "8 Major Planets (Mercury to Neptune)",
        "5 Recognized Dwarf Planets (Pluto, Eris, Ceres, Haumea, Makemake)",
      ],
      moonsList: [
        {
          name: "Main Asteroid Belt",
          diameterKm: "Circumstellar Disk (2.2 – 3.2 AU)",
          orbitalPeriodDays: "3 – 6 Earth Years",
          imageSrc: "/textures/moons/phobos.jpg",
          features: "Contains millions of primordial rocky remnants including dwarf planet Ceres, Vesta, Pallas, and Hygiea.",
          discoveryYear: "1801 by Giuseppe Piazzi (Ceres)",
        },
      ],
    },
    missions: [
      { name: "Parker Solar Probe", agency: "NASA", year: "2018–Present", achievement: "First spacecraft to 'touch the Sun', flying through the outer corona at 690,000 km/h" },
      { name: "Solar Orbiter", agency: "ESA / NASA", year: "2020–Present", achievement: "High-resolution imaging of solar poles and magnetic field reconnections" },
      { name: "SOHO & SDO", agency: "NASA / ESA", year: "1995–Present", achievement: "Continuous 24/7 space weather monitoring and coronal mass ejection (CME) early warning" },
    ],
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    subtitle: "THE CRATERED SWIFT PLANET",
    classification: "Terrestrial / Inner Planet",
    discovery: "Known since Antiquity (Recorded by Assyrian Astronomers in 14th Century BCE)",
    color: "#B5B5B5",
    themeColor: "cyan",
    badge: "0.39 AU • HOTTEST-COLDEST EXTREMES",
    planetImageSrc: "/textures/planets/mercury.jpg",
    overview:
      "Mercury is the smallest and innermost planet in the Solar System. Lacking a substantial atmosphere, its cratered basalt surface endures the most punishing temperature swings in the solar system, ranging from scorching day heat to sub-zero night freeze.",
    physicalStats: {
      meanRadiusKm: "2,439.7 km (0.38 Earths)",
      massKg: "3.301 × 10²³ kg",
      massEarths: "0.055 Earth masses",
      surfaceGravity: "3.7 m/s² (0.38 g)",
      escapeVelocity: "4.25 km/s",
      density: "5.427 g/cm³ (High metallic core)",
      axialTilt: "0.034° (Virtually zero tilt)",
      avgTempC: "167°C (-180°C to 430°C)",
    },
    orbitalStats: {
      semiMajorAxisAU: "0.387 AU",
      semiMajorAxisKm: "57.91 Million km",
      orbitalPeriod: "87.97 Earth Days",
      orbitalSpeedKmS: "47.36 km/s",
      eccentricity: "0.2056 (High orbital elongation)",
      inclinationDeg: "7.00° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "10⁻¹⁴ bar (Exosphere trace)",
      components: [
        { name: "Oxygen (O₂)", percent: "42.0%" },
        { name: "Sodium (Na)", percent: "29.0%" },
        { name: "Hydrogen (H₂)", percent: "22.0%" },
        { name: "Helium (He)", percent: "6.0%" },
      ],
      notes: "Continuously replenished by solar wind bombardment and micrometeoroid impact vaporisation.",
    },
    moons: {
      count: 0,
      hasRings: false,
      notableMoons: ["None (No natural satellites)"],
      moonsList: [],
    },
    missions: [
      { name: "Mariner 10", agency: "NASA", year: "1974–1975", achievement: "First spacecraft flyby, mapped 45% of surface" },
      { name: "MESSENGER", agency: "NASA", year: "2011–2015", achievement: "First orbiter; discovered polar water ice inside shadowed craters" },
      { name: "BepiColombo", agency: "ESA / JAXA", year: "2018–Present", achievement: "En-route to orbital insertion in 2026 for magnetosphere analysis" },
    ],
  },

  venus: {
    id: "venus",
    name: "Venus",
    subtitle: "THE GREENHOUSE HELLWORLD",
    classification: "Terrestrial / Earth's Sister Planet",
    discovery: "Known since Prehistory (Identified as Morning/Evening Star)",
    color: "#E8C56C",
    themeColor: "amber",
    badge: "0.72 AU • 464°C SURFACE HEAT",
    planetImageSrc: "/textures/planets/venus.jpg",
    overview:
      "Venus is often called Earth's twin due to similar size and mass, but it is shrouded in an ultra-dense carbon dioxide atmosphere with opaque clouds of concentrated sulfuric acid. A runaway greenhouse effect makes its surface the hottest of any planet.",
    physicalStats: {
      meanRadiusKm: "6,051.8 km (0.95 Earths)",
      massKg: "4.867 × 10²⁴ kg",
      massEarths: "0.815 Earth masses",
      surfaceGravity: "8.87 m/s² (0.90 g)",
      escapeVelocity: "10.36 km/s",
      density: "5.243 g/cm³",
      axialTilt: "177.36° (Retrograde clockwise spin)",
      avgTempC: "464°C (Hot enough to melt lead)",
    },
    orbitalStats: {
      semiMajorAxisAU: "0.723 AU",
      semiMajorAxisKm: "108.2 Million km",
      orbitalPeriod: "224.70 Earth Days",
      orbitalSpeedKmS: "35.02 km/s",
      eccentricity: "0.0067 (Most circular orbit)",
      inclinationDeg: "3.39° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "92 bar (Equivalent to 900m ocean depth)",
      components: [
        { name: "Carbon Dioxide (CO₂)", percent: "96.5%" },
        { name: "Nitrogen (N₂)", percent: "3.5%" },
        { name: "Sulfur Dioxide (SO₂)", percent: "0.015%" },
      ],
      notes: "Super-rotating atmospheric winds reach 360 km/h, circling the globe in just 4 Earth days.",
    },
    moons: {
      count: 0,
      hasRings: false,
      notableMoons: ["None (No natural satellites)"],
      moonsList: [],
    },
    missions: [
      { name: "Venera 7", agency: "Soviet Union", year: "1970", achievement: "First human spacecraft to land on another planet and transmit telemetry" },
      { name: "Magellan", agency: "NASA", year: "1990–1994", achievement: "Synthetic Aperture Radar mapped 98% of Venusian topography" },
      { name: "DAVINCI+ / VERITAS", agency: "NASA", year: "Upcoming", achievement: "Atmospheric probe and high-resolution radar geological surveys" },
    ],
  },

  earth: {
    id: "earth",
    name: "Earth",
    subtitle: "THE BLUE OASIS OF LIFE",
    classification: "Terrestrial / Habitable Zone World",
    discovery: "Home Planet (Origin of Humanity)",
    color: "#4B9CD3",
    themeColor: "sky",
    badge: "1.00 AU • THE LIVING PLANET",
    planetImageSrc: "/textures/planets/earth.jpg",
    overview:
      "Earth is the third planet from the Sun and the only astronomical object known to harbor life. It features active plate tectonics, liquid water oceans covering 71% of its surface, and a dynamic magnetosphere that shields its biosphere from lethal cosmic radiation.",
    physicalStats: {
      meanRadiusKm: "6,371.0 km (1.00 Earth)",
      massKg: "5.972 × 10²⁴ kg",
      massEarths: "1.000 Earth mass (5.972 Zg)",
      surfaceGravity: "9.80665 m/s² (1.00 g)",
      escapeVelocity: "11.186 km/s",
      density: "5.514 g/cm³ (Densest in Solar System)",
      axialTilt: "23.44° (Generates 4 seasons)",
      avgTempC: "15°C (-89°C to 57°C)",
    },
    orbitalStats: {
      semiMajorAxisAU: "1.000 AU",
      semiMajorAxisKm: "149.60 Million km",
      orbitalPeriod: "365.256 Solar Days",
      orbitalSpeedKmS: "29.78 km/s (107,200 km/h)",
      eccentricity: "0.0167",
      inclinationDeg: "0.00° (Reference plane)",
    },
    atmosphere: {
      pressureBar: "1.013 bar (1 atm at sea level)",
      components: [
        { name: "Nitrogen (N₂)", percent: "78.08%" },
        { name: "Oxygen (O₂)", percent: "20.95%" },
        { name: "Argon (Ar)", percent: "0.93%" },
        { name: "Carbon Dioxide (CO₂)", percent: "0.042%" },
      ],
      notes: "Maintained in thermodynamic non-equilibrium by continuous photosynthetic biological activity.",
    },
    moons: {
      count: 1,
      hasRings: false,
      notableMoons: ["Moon (Luna) — 3,474 km diameter"],
      moonsList: [
        {
          name: "Moon (Luna)",
          diameterKm: "3,474.8 km (0.27 Earths)",
          orbitalPeriodDays: "27.3 Days (Synchronous)",
          imageSrc: "/textures/moons/moon.jpg",
          features: "Fifth largest moon in the Solar System. Stabilizes Earth's axial wobble, creating stable climate eras essential for the evolution of complex life.",
          discoveryYear: "Known since Prehistory (Apollo 11 Landed 1969)",
        },
      ],
    },
    missions: [
      { name: "International Space Station", agency: "NASA / ESA / JAXA / CSA", year: "1998–Present", achievement: "Continuous human orbital presence for 25+ years" },
      { name: "Landsat & Sentinel Series", agency: "NASA / USGS / ESA", year: "1972–Present", achievement: "Multispectral planetary remote sensing and climate monitoring" },
    ],
  },

  mars: {
    id: "mars",
    name: "Mars",
    subtitle: "THE FRONTIER RED PLANET",
    classification: "Terrestrial / Outer Habitable Zone",
    discovery: "Known since Antiquity (Associated with Gods of War)",
    color: "#C1440E",
    themeColor: "red",
    badge: "1.52 AU • HOME OF OLYMPUS MONS",
    planetImageSrc: "/textures/planets/mars.jpg",
    overview:
      "Mars is a cold desert world with a thin carbon dioxide atmosphere. Its rusty red hue is caused by iron oxide dust on its surface. Mars is home to the largest shield volcano in the solar system (Olympus Mons) and a gargantuan canyon system (Valles Marineris).",
    physicalStats: {
      meanRadiusKm: "3,389.5 km (0.53 Earths)",
      massKg: "6.417 × 10²³ kg",
      massEarths: "0.107 Earth masses",
      surfaceGravity: "3.72 m/s² (0.38 g)",
      escapeVelocity: "5.03 km/s",
      density: "3.933 g/cm³",
      axialTilt: "25.19° (Earth-like seasonal cycle)",
      avgTempC: "-63°C (-140°C to 20°C)",
    },
    orbitalStats: {
      semiMajorAxisAU: "1.524 AU",
      semiMajorAxisKm: "227.94 Million km",
      orbitalPeriod: "686.98 Earth Days (1.88 Earth Years)",
      orbitalSpeedKmS: "24.07 km/s",
      eccentricity: "0.0934",
      inclinationDeg: "1.85° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "0.006 bar (0.6% of Earth pressure)",
      components: [
        { name: "Carbon Dioxide (CO₂)", percent: "95.32%" },
        { name: "Nitrogen (N₂)", percent: "2.60%" },
        { name: "Argon (Ar)", percent: "1.90%" },
        { name: "Oxygen (O₂)", percent: "0.13%" },
      ],
      notes: "Thin atmosphere allows high levels of ultraviolet and solar energetic particle radiation to reach the surface.",
    },
    moons: {
      count: 2,
      hasRings: false,
      notableMoons: ["Phobos (22.2 km)", "Deimos (12.4 km)"],
      moonsList: [
        {
          name: "Phobos",
          diameterKm: "22.2 km (Irregular potato shape)",
          orbitalPeriodDays: "0.32 Days (7.66 Hours)",
          imageSrc: "/textures/moons/phobos.jpg",
          features: "Orbits just 6,000 km above Mars — closer than any other moon in the solar system. Slated to collide or form a ring around Mars in 50 million years.",
          discoveryYear: "1877 by Asaph Hall",
        },
        {
          name: "Deimos",
          diameterKm: "12.4 km",
          orbitalPeriodDays: "1.26 Days (30.3 Hours)",
          imageSrc: "/textures/moons/deimos.jpg",
          features: "Outer moon with a smooth, thick regolith blanket covering impact craters. Escaping Mars orbit gradually.",
          discoveryYear: "1877 by Asaph Hall",
        },
      ],
    },
    missions: [
      { name: "Curiosity Rover", agency: "NASA", year: "2012–Present", achievement: "Discovered ancient habitable fluvio-lacustrine environments in Gale Crater" },
      { name: "Perseverance & Ingenuity", agency: "NASA", year: "2021–Present", achievement: "Cached core rock samples in Jezero Crater; first powered aerodynamic flight on another world" },
      { name: "ExoMars TGO", agency: "ESA", year: "2016–Present", achievement: "Atmospheric methane and trace gas spectral mapping" },
    ],
  },

  jupiter: {
    id: "jupiter",
    name: "Jupiter",
    subtitle: "THE TITANIC GAS GIANT",
    classification: "Gas Giant / Jovian Planetary King",
    discovery: "Known since Antiquity; Moons discovered by Galileo Galilei in 1610",
    color: "#C88B3A",
    themeColor: "amber",
    badge: "5.20 AU • 95 MOONS & GREAT RED SPOT",
    planetImageSrc: "/textures/planets/jupiter.jpg",
    overview:
      "Jupiter is by far the largest planet in our solar system, containing more than double the mass of all other planets combined. It features alternating atmospheric cloud belts, dynamic cyclonic storms including the 350-year-old Great Red Spot, and a massive magnetosphere.",
    physicalStats: {
      meanRadiusKm: "69,911 km (10.97 Earths)",
      massKg: "1.898 × 10²⁷ kg",
      massEarths: "317.8 Earth masses",
      surfaceGravity: "24.79 m/s² (2.53 g)",
      escapeVelocity: "59.5 km/s",
      density: "1.326 g/cm³",
      axialTilt: "3.13° (Minimal seasonal variation)",
      avgTempC: "-110°C at 1 bar level",
    },
    orbitalStats: {
      semiMajorAxisAU: "5.204 AU",
      semiMajorAxisKm: "778.57 Million km",
      orbitalPeriod: "11.86 Earth Years (4,333 Days)",
      orbitalSpeedKmS: "13.07 km/s",
      eccentricity: "0.0489",
      inclinationDeg: "1.30° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "> 1,000 bar (Liquid metallic hydrogen mantle)",
      components: [
        { name: "Molecular Hydrogen (H₂)", percent: "89.8%" },
        { name: "Helium (He)", percent: "10.2%" },
        { name: "Methane (CH₄)", percent: "0.3%" },
        { name: "Ammonia (NH₃)", percent: "0.026%" },
      ],
      notes: "No solid surface. Transitions from gaseous atmosphere to supercritical fluid and liquid metallic hydrogen core.",
    },
    moons: {
      count: 95,
      hasRings: true,
      ringDetails: "Faint dust ring system formed by meteoroid impacts on inner moons.",
      notableMoons: [
        "Io (Most volcanically active body in solar system)",
        "Europa (Subsurface liquid ocean harboring potential life)",
        "Ganymede (Largest moon in solar system, has own magnetic field)",
        "Callisto (Heavily cratered ancient ice-rock world)",
      ],
      moonsList: [
        {
          name: "Europa",
          diameterKm: "3,121.6 km (Slightly smaller than Earth's Moon)",
          orbitalPeriodDays: "3.55 Days",
          imageSrc: "/textures/moons/europa.jpg",
          features: "Smooth ice crust covering a 100-km-deep liquid saltwater ocean containing more water than all of Earth's oceans combined. Prime astrobiology target for extraterrestrial life.",
          discoveryYear: "1610 by Galileo Galilei",
        },
        {
          name: "Io",
          diameterKm: "3,643.2 km",
          orbitalPeriodDays: "1.77 Days",
          imageSrc: "/textures/moons/io.jpg",
          features: "Over 400 active volcanoes powered by extreme tidal flexing from Jupiter and neighboring moons. Features sulfur geysers shooting plumes 500 km high.",
          discoveryYear: "1610 by Galileo Galilei",
        },
        {
          name: "Ganymede",
          diameterKm: "5,268.2 km (Larger than Mercury & Pluto)",
          orbitalPeriodDays: "7.15 Days",
          imageSrc: "/textures/moons/ganymede.jpg",
          features: "The largest moon in the Solar System. The only natural satellite known to possess its own internally generated magnetic field and auroral belts.",
          discoveryYear: "1610 by Galileo Galilei",
        },
        {
          name: "Callisto",
          diameterKm: "4,820.6 km",
          orbitalPeriodDays: "16.69 Days",
          imageSrc: "/textures/moons/callisto.jpg",
          features: "The most heavily cratered object in the Solar System. An ancient, undisturbed ice-rock surface acting as a historical record of cosmic impacts.",
          discoveryYear: "1610 by Galileo Galilei",
        },
      ],
    },
    missions: [
      { name: "Voyager 1 & 2", agency: "NASA", year: "1979", achievement: "Discovered Jupiter's rings and active volcanoes on moon Io" },
      { name: "Galileo", agency: "NASA", year: "1995–2003", achievement: "First dedicated orbiter; deployed atmospheric entry probe" },
      { name: "Juno", agency: "NASA", year: "2016–Present", achievement: "Mapping gravitational and magnetic field structure in polar orbits" },
      { name: "JUICE", agency: "ESA", year: "2023–En Route", achievement: "En-route to perform detailed surveys of icy moons Europa, Ganymede, Callisto" },
    ],
  },

  saturn: {
    id: "saturn",
    name: "Saturn",
    subtitle: "THE JEWEL OF THE SOLAR SYSTEM",
    classification: "Gas Giant / Ringed Jovian Planet",
    discovery: "Known since Antiquity; Rings observed by Christiaan Huygens in 1655",
    color: "#E4D191",
    themeColor: "yellow",
    badge: "9.58 AU • SPECTACULAR ICE RING COMPLEX",
    planetImageSrc: "/textures/planets/saturn.jpg",
    overview:
      "Saturn is the second largest planet, celebrated for its expansive and intricate planetary ring system composed primarily of billions of water-ice particles. It is the least dense planet in the solar system — less dense than water.",
    physicalStats: {
      meanRadiusKm: "58,232 km (9.14 Earths)",
      massKg: "5.683 × 10²⁶ kg",
      massEarths: "95.16 Earth masses",
      surfaceGravity: "10.44 m/s² (1.06 g)",
      escapeVelocity: "35.5 km/s",
      density: "0.687 g/cm³ (Floats in water)",
      axialTilt: "26.73° (Prominent ring viewing angles)",
      avgTempC: "-140°C at 1 bar level",
    },
    orbitalStats: {
      semiMajorAxisAU: "9.582 AU",
      semiMajorAxisKm: "1,433.5 Million km",
      orbitalPeriod: "29.46 Earth Years (10,759 Days)",
      orbitalSpeedKmS: "9.69 km/s",
      eccentricity: "0.0565",
      inclinationDeg: "2.48° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "> 1,000 bar (Supercritical interior)",
      components: [
        { name: "Molecular Hydrogen (H₂)", percent: "96.3%" },
        { name: "Helium (He)", percent: "3.25%" },
        { name: "Methane (CH₄)", percent: "0.45%" },
      ],
      notes: "Exhibits a persistent hexagonal cloud vortex around its north pole.",
    },
    moons: {
      count: 146,
      hasRings: true,
      ringDetails: "Extends from 7,000 km to 80,000 km above equator, only ~10 to 100 meters thick. Cassini Division gap.",
      notableMoons: [
        "Titan (Dense nitrogen atmosphere, methane lakes & rain)",
        "Enceladus (Cryovolcanic water geysers spraying into orbit from sub-surface ocean)",
        "Mimas ('Death Star' crater moon)",
        "Iapetus (Two-toned yin-yang contrast)",
      ],
      moonsList: [
        {
          name: "Titan",
          diameterKm: "5,149.5 km (Second largest moon in Solar System)",
          orbitalPeriodDays: "15.95 Days",
          imageSrc: "/textures/moons/titan.jpg",
          features: "The only moon with a dense nitrogen atmosphere and liquid hydrocarbon lakes (methane & ethane) on its surface with active hydrological cycles.",
          discoveryYear: "1655 by Christiaan Huygens",
        },
        {
          name: "Enceladus",
          diameterKm: "504.2 km",
          orbitalPeriodDays: "1.37 Days",
          imageSrc: "/textures/moons/enceladus.jpg",
          features: "Active ice geysers at its south pole erupt water vapor, organic molecules, and silica particles directly into Saturn's E-ring from a global subsurface hydrothermal ocean.",
          discoveryYear: "1789 by William Herschel",
        },
        {
          name: "Mimas",
          diameterKm: "396.4 km",
          orbitalPeriodDays: "0.94 Days",
          imageSrc: "/textures/moons/mimas.jpg",
          features: "Dominated by the 130-km Herschel Crater, giving it an uncanny resemblance to the fictional 'Death Star'. Recent Cassini data hints at an interior ocean.",
          discoveryYear: "1789 by William Herschel",
        },
        {
          name: "Iapetus",
          diameterKm: "1,469 km",
          orbitalPeriodDays: "79.33 Days",
          imageSrc: "/textures/moons/iapetus.jpg",
          features: "Dramatic two-toned coloration: leading hemisphere is coal-black while the trailing hemisphere is bright snow-white. Encircling equatorial mountain ridge 20 km tall.",
          discoveryYear: "1671 by Giovanni Cassini",
        },
      ],
    },
    missions: [
      { name: "Pioneer 11 & Voyager 1/2", agency: "NASA", year: "1979–1981", achievement: "First close-up imaging of complex ring divisions and Titan's smog" },
      { name: "Cassini-Huygens", agency: "NASA / ESA / ASI", year: "2004–2017", achievement: "Landmark 13-year orbital mission; landed Huygens probe on Titan; discovered Enceladus ocean geysers" },
      { name: "Dragonfly", agency: "NASA", year: "Upcoming (2028)", achievement: "Rotorcraft lander mission to explore Titan prebiotic chemistry" },
    ],
  },

  uranus: {
    id: "uranus",
    name: "Uranus",
    subtitle: "THE TILTED ICE GIANT",
    classification: "Ice Giant / Outer Solar System",
    discovery: "Discovered March 13, 1781 by Sir William Herschel",
    color: "#7DE8E8",
    themeColor: "teal",
    badge: "19.2 AU • 97.77° EXTREME AXIAL TILT",
    planetImageSrc: "/textures/planets/uranus.jpg",
    overview:
      "Uranus is unique for rotating almost completely on its side, rolling like a ball along its orbital plane. Its pale cyan color is produced by atmospheric methane absorbing red light. It holds the record for the coldest atmospheric temperature in the solar system.",
    physicalStats: {
      meanRadiusKm: "25,362 km (3.98 Earths)",
      massKg: "8.681 × 10²⁵ kg",
      massEarths: "14.54 Earth masses",
      surfaceGravity: "8.69 m/s² (0.89 g)",
      escapeVelocity: "21.3 km/s",
      density: "1.270 g/cm³",
      axialTilt: "97.77° (Rolls sideways on orbital plane)",
      avgTempC: "-195°C (-224°C record low)",
    },
    orbitalStats: {
      semiMajorAxisAU: "19.20 AU",
      semiMajorAxisKm: "2,872.5 Million km",
      orbitalPeriod: "84.02 Earth Years (30,687 Days)",
      orbitalSpeedKmS: "6.81 km/s",
      eccentricity: "0.0472",
      inclinationDeg: "0.77° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "> 1,000 bar (Water-Ammonia-Methane icy mantle)",
      components: [
        { name: "Hydrogen (H₂)", percent: "82.5%" },
        { name: "Helium (He)", percent: "15.2%" },
        { name: "Methane (CH₄)", percent: "2.3%" },
      ],
      notes: "Methane in upper atmosphere absorbs red light, giving Uranus its distinctive aquamarine tint.",
    },
    moons: {
      count: 28,
      hasRings: true,
      ringDetails: "13 dark, narrow planetary rings composed of organic-coated ice boulder grains.",
      notableMoons: [
        "Miranda (Extreme tectonic canyons like Verona Rupes, 20 km vertical cliff)",
        "Titania (Largest moon of Uranus)",
        "Oberon (Heavily cratered outermost major moon)",
      ],
      moonsList: [
        {
          name: "Miranda",
          diameterKm: "471.6 km",
          orbitalPeriodDays: "1.41 Days",
          imageSrc: "/textures/moons/miranda.jpg",
          features: "Extreme fractured patchwork geology including Verona Rupes, the tallest known cliff in the Solar System at 20 km high (10x deeper than the Grand Canyon).",
          discoveryYear: "1948 by Gerard Kuiper",
        },
        {
          name: "Titania",
          diameterKm: "1,577.8 km (Eighth largest moon in Solar System)",
          orbitalPeriodDays: "8.70 Days",
          imageSrc: "/textures/moons/titania.jpg",
          features: "Largest moon of Uranus consisting of roughly equal parts water ice and dense rocky core, laced with massive fault grabens and canyons.",
          discoveryYear: "1787 by William Herschel",
        },
      ],
    },
    missions: [
      { name: "Voyager 2", agency: "NASA", year: "1986", achievement: "Only spacecraft to visit Uranus; discovered 10 new moons, magnetic field tilt, and 2 new rings" },
      { name: "Uranus Orbiter & Probe", agency: "NASA Decadal Survey", year: "Proposed (2030s)", achievement: "Flagship mission priority for comprehensive atmospheric and orbital survey" },
    ],
  },

  neptune: {
    id: "neptune",
    name: "Neptune",
    subtitle: "THE SUPERSONIC WINDS WORLD",
    classification: "Ice Giant / Outermost Major Planet",
    discovery: "September 23, 1846 by Johann Galle & Urbain Le Verrier (Mathematical Prediction)",
    color: "#4B70DD",
    themeColor: "indigo",
    badge: "30.1 AU • 2,100 KM/H SUPERSONIC STORMS",
    planetImageSrc: "/textures/planets/neptune.jpg",
    overview:
      "Neptune is the most distant major planet from the Sun. It has a vivid azure blue atmosphere powered by internal heat that drives the fastest planetary wind storms recorded in the Solar System, exceeding supersonic speeds of 2,100 km/h.",
    physicalStats: {
      meanRadiusKm: "24,622 km (3.86 Earths)",
      massKg: "1.024 × 10²⁶ kg",
      massEarths: "17.15 Earth masses",
      surfaceGravity: "11.15 m/s² (1.14 g)",
      escapeVelocity: "23.5 km/s",
      density: "1.638 g/cm³ (Densest Ice Giant)",
      axialTilt: "28.32°",
      avgTempC: "-201°C at 1 bar level",
    },
    orbitalStats: {
      semiMajorAxisAU: "30.07 AU",
      semiMajorAxisKm: "4,495.1 Million km",
      orbitalPeriod: "164.80 Earth Years (60,190 Days)",
      orbitalSpeedKmS: "5.43 km/s",
      eccentricity: "0.0086",
      inclinationDeg: "1.77° to Ecliptic",
    },
    atmosphere: {
      pressureBar: "> 1,000 bar (Icy slush mantle)",
      components: [
        { name: "Hydrogen (H₂)", percent: "80.0%" },
        { name: "Helium (He)", percent: "19.0%" },
        { name: "Methane (CH₄)", percent: "1.5%" },
      ],
      notes: "Internal thermal radiation drives the Great Dark Spot and high-altitude cirrus-like methane ice clouds.",
    },
    moons: {
      count: 16,
      hasRings: true,
      ringDetails: "5 faint, clumpy rings featuring dynamic dust arcs (Galle, Le Verrier, Lassell, Arago, Adams).",
      notableMoons: [
        "Triton (Retrograde orbit, nitrogen geysers, captured Kuiper Belt Object larger than Pluto)",
        "Proteus (Irregular boxy ice moon)",
        "Nereid (Highly eccentric orbit)",
      ],
      moonsList: [
        {
          name: "Triton",
          diameterKm: "2,706.8 km (Seventh largest moon in Solar System)",
          orbitalPeriodDays: "5.88 Days (Retrograde)",
          imageSrc: "/textures/moons/triton.jpg",
          features: "The only large moon in the Solar System with a retrograde orbit (opposite to planet's rotation). Features active cryovolcanic geysers erupting liquid nitrogen and black organic dust 8 km into thin atmosphere.",
          discoveryYear: "1846 by William Lassell (17 days after Neptune's discovery)",
        },
      ],
    },
    missions: [
      { name: "Voyager 2", agency: "NASA", year: "1989", achievement: "Only probe flyby; discovered Great Dark Spot, complete ring system, and active nitrogen geysers on Triton" },
    ],
  },
};
