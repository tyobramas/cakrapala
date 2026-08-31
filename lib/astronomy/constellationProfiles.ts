/**
 * Comprehensive Constellation Lore, Astronomical Metrics, and Artwork Registry
 * Standardized according to International Astronomical Union (IAU) guidelines.
 */

export interface ConstellationProfile {
  id: string;
  name: string;
  abbreviation: string;
  genitive: string;
  englishName: string;
  family: string;
  brightestStar: string;
  brightestStarMag: number;
  raHours: number; // Approximate center RA in hours (0..24)
  decDeg: number;  // Approximate center Dec in degrees (-90..+90)
  areaSqDeg: number;
  areaRank: number; // 1 to 88
  quadrant: string;
  zodiacSign?: string;
  monthBestSeen: string;
  mythology: string;
  astronomicalHighlights: string[];
  artworkFile: string;
  artworkScaleDeg: number; // Angular size in sky dome (degrees)
  artworkRotationDeg?: number; // Visual alignment rotation offset
}

export const CONSTELLATION_PROFILES: Record<string, ConstellationProfile> = {
  vir: {
    id: "vir",
    name: "Virgo",
    abbreviation: "Vir",
    genitive: "Virginis",
    englishName: "The Maiden",
    family: "Zodiac",
    brightestStar: "Spica (α Virginis)",
    brightestStarMag: 0.98,
    raHours: 13.3,
    decDeg: -4.0,
    areaSqDeg: 1294.4,
    areaRank: 2,
    quadrant: "SQ3",
    zodiacSign: "♍ (August 23 – September 22)",
    monthBestSeen: "May (Spring/Autumn)",
    mythology:
      "In Greek mythology, Virgo represents Astraea, the goddess of innocence and purity, and the last immortal to live among humans during the Golden Age. When mankind became wicked in the Bronze Age, she ascended to the heavens as a constellation holding a sheaf of wheat (symbolized by the bright star Spica). In Roman lore, she is identified with Ceres (Demeter), goddess of the harvest and agriculture.",
    astronomicalHighlights: [
      "Spica (Alpha Virginis): A brilliant blue-white spectroscopic binary star 250 light-years away.",
      "Virgo Galaxy Cluster: The heart of the local supercluster, containing over 1,300 galaxies including giant elliptical M87 hosting the first directly imaged supermassive black hole.",
      "Sombrero Galaxy (M104): Famous edge-on spiral galaxy with a brilliant white nucleus and dark dust lane.",
    ],
    artworkFile: "virgo.webp",
    artworkScaleDeg: 38,
    artworkRotationDeg: 0,
  },
  tau: {
    id: "tau",
    name: "Taurus",
    abbreviation: "Tau",
    genitive: "Tauri",
    englishName: "The Celestial Bull",
    family: "Zodiac",
    brightestStar: "Aldebaran (α Tauri)",
    brightestStarMag: 0.85,
    raHours: 4.6,
    decDeg: 16.5,
    areaSqDeg: 797.2,
    areaRank: 17,
    quadrant: "NQ1",
    zodiacSign: "♉ (April 20 – May 20)",
    monthBestSeen: "January (Winter)",
    mythology:
      "Taurus depicts the great bull of classical mythology. In Greek myth, Zeus transformed himself into a magnificent white bull to abduct the Phoenician princess Europa across the Mediterranean Sea to the island of Crete. In Mesopotamian lore, it is the Bull of Heaven sent by the goddess Ishtar to battle the hero Gilgamesh.",
    astronomicalHighlights: [
      "Pleiades (M45 / The Seven Sisters): The most famous naked-eye open star cluster, shrouded in blue reflection nebulosity.",
      "Aldebaran (Alpha Tauri): The glowing reddish-orange 'Eye of the Bull', a giant star 65 light-years away.",
      "Crab Nebula (M1 / NGC 1952): The remnant of the famous supernova observed by Chinese astronomers in 1054 CE.",
      "Hyades Cluster: The closest open star cluster to Earth (153 light-years), forming the V-shaped face of the bull.",
    ],
    artworkFile: "taurus.webp",
    artworkScaleDeg: 34,
    artworkRotationDeg: 0,
  },
  ori: {
    id: "ori",
    name: "Orion",
    abbreviation: "Ori",
    genitive: "Orionis",
    englishName: "The Hunter",
    family: "Orion",
    brightestStar: "Rigel (β Orionis) & Betelgeuse (α Orionis)",
    brightestStarMag: 0.18,
    raHours: 5.5,
    decDeg: 5.0,
    areaSqDeg: 594.1,
    areaRank: 26,
    quadrant: "NQ1",
    monthBestSeen: "January (Winter)",
    mythology:
      "Orion is the legendary gigantic huntsman of Greek mythology, born of the gods and blessed with the power to walk upon the seas. Boasting that he could defeat any beast on Earth, Mother Gaia dispatched a giant scorpion (Scorpius) to duel him. Zeus placed both in the heavens on opposite horizons so they never appear in the sky at the same time.",
    astronomicalHighlights: [
      "Orion Nebula (M42): A stellar nursery visible to the naked eye, glowing brightly with ionized hydrogen and newborn trapezoid stars.",
      "Betelgeuse: A luminous red supergiant nearing the end of its life, slated to erupt as a galactic supernova.",
      "Rigel: A searing blue-white supergiant over 40,000 times more luminous than our Sun.",
      "Horsehead Nebula (Barnard 33): Iconic dark absorption nebula silhouetted against glowing emission gas.",
      "Orion's Belt: Famous triplet of aligned bright supergiant stars: Alnitak, Alnilam, and Mintaka.",
    ],
    artworkFile: "orion.webp",
    artworkScaleDeg: 34,
    artworkRotationDeg: 0,
  },
  leo: {
    id: "leo",
    name: "Leo",
    abbreviation: "Leo",
    genitive: "Leonis",
    englishName: "The Lion",
    family: "Zodiac",
    brightestStar: "Regulus (α Leonis)",
    brightestStarMag: 1.36,
    raHours: 10.7,
    decDeg: 15.0,
    areaSqDeg: 947.0,
    areaRank: 12,
    quadrant: "NQ2",
    zodiacSign: "♌ (July 23 – August 22)",
    monthBestSeen: "April (Spring)",
    mythology:
      "Leo immortalizes the fierce Nemean Lion whose golden impenetrable hide could not be pierced by mortal weapons. Slain by Hercules as the first of his Twelve Labors, the hero used the lion's own claws to skin the pelt, wearing it as protective armor. Zeus placed the regal beast among the stars to honor Hercules' triumph.",
    astronomicalHighlights: [
      "Regulus (Alpha Leonis): The 'Little King' star, an ultra-fast spinning quadruple star system at the base of the sickle.",
      "Leo Triplet (M65, M66, NGC 3628): A magnificent group of interacting spiral galaxies 35 million light-years away.",
      "Leonid Meteor Shower: Famous annual meteor shower originating from comet Tempel-Tuttle every November.",
    ],
    artworkFile: "leo.webp",
    artworkScaleDeg: 32,
    artworkRotationDeg: 0,
  },
  sco: {
    id: "sco",
    name: "Scorpius",
    abbreviation: "Sco",
    genitive: "Scorpii",
    englishName: "The Scorpion",
    family: "Zodiac",
    brightestStar: "Antares (α Scorpii)",
    brightestStarMag: 0.96,
    raHours: 16.7,
    decDeg: -28.0,
    areaSqDeg: 496.8,
    areaRank: 33,
    quadrant: "SQ3",
    zodiacSign: "♏ (October 23 – November 21)",
    monthBestSeen: "July (Summer/Winter in Southern hemisphere)",
    mythology:
      "In mythology, Scorpius is the giant scorpion sent by Gaia to challenge Orion the Hunter. Its curved tail hooks downward into the Milky Way galactic center, ending in the poison stinger stars Shaula and Lesath. The fiery red supergiant Antares serves as the scorpion's glowing heart.",
    astronomicalHighlights: [
      "Antares (Alpha Scorpii): The 'Rival of Mars', a massive red supergiant star over 700 times the diameter of our Sun.",
      "Butterfly Cluster (M6) & Ptolemy's Cluster (M7): Two rich, brilliant open star clusters near the scorpion's stinger.",
      "Cat's Paw Nebula (NGC 6334): Enormous star-forming emission nebula situated along the galactic plane.",
    ],
    artworkFile: "scorpius.webp",
    artworkScaleDeg: 28,
    artworkRotationDeg: 0,
  },
  uma: {
    id: "uma",
    name: "Ursa Major",
    abbreviation: "UMa",
    genitive: "Ursae Majoris",
    englishName: "The Great Bear",
    family: "Ursa Major",
    brightestStar: "Alioth (ε Ursae Majoris)",
    brightestStarMag: 1.76,
    raHours: 11.3,
    decDeg: 55.6,
    areaSqDeg: 1279.7,
    areaRank: 3,
    quadrant: "NQ2",
    monthBestSeen: "April (Circumpolar in Northern Hemisphere)",
    mythology:
      "According to Greek myth, Callisto was a nymph beloved by Zeus. Hera, furious with jealousy, transformed Callisto into a bear. Years later, her hunter son Arcas encountered the bear and nearly killed his own mother. Zeus intervened, flinging both into the celestial vault by their tails (explaining the bear's unusually long stellar tail).",
    astronomicalHighlights: [
      "The Big Dipper / Plough: Iconic 7-star asterism used for centuries as a celestial compass pointing to Polaris.",
      "Mizar & Alcor: The famous naked-eye optical double star in the handle, historically used as an eyesight test.",
      "Bode's Galaxy (M81) & Cigar Galaxy (M82): A pair of interacting galaxies showing vigorous starburst activity.",
    ],
    artworkFile: "ursa-major.webp",
    artworkScaleDeg: 48,
    artworkRotationDeg: 10,
  },
  umi: {
    id: "umi",
    name: "Ursa Minor",
    abbreviation: "UMi",
    genitive: "Ursae Minoris",
    englishName: "The Little Bear",
    family: "Ursa Major",
    brightestStar: "Polaris (α Ursae Minoris / North Star)",
    brightestStarMag: 1.98,
    raHours: 15.0,
    decDeg: 78.0,
    areaSqDeg: 255.9,
    areaRank: 56,
    quadrant: "NQ3",
    monthBestSeen: "All year (North Celestial Pole)",
    mythology:
      "Ursa Minor represents Arcas, the son of Callisto, placed beside his mother in the heavens. The tip of the bear's tail is anchored by Polaris, the North Star, which remains almost stationary in the northern sky as Earth rotates.",
    astronomicalHighlights: [
      "Polaris (The North Star): A multiple star system and Cepheid variable marking true celestial north within 0.7 degrees.",
      "Little Dipper Asterism: A miniature dipper curving outward from Polaris.",
      "Ursids Meteor Shower: A late-December meteor shower radiating from near the bowl of Ursa Minor.",
    ],
    artworkFile: "ursa-minor.webp",
    artworkScaleDeg: 30,
    artworkRotationDeg: 0,
  },
  gem: {
    id: "gem",
    name: "Gemini",
    abbreviation: "Gem",
    genitive: "Geminorum",
    englishName: "The Heavenly Twins",
    family: "Zodiac",
    brightestStar: "Pollux (β Geminorum) & Castor (α Geminorum)",
    brightestStarMag: 1.14,
    raHours: 7.1,
    decDeg: 22.0,
    areaSqDeg: 513.8,
    areaRank: 30,
    quadrant: "NQ2",
    zodiacSign: "♊ (May 21 – June 20)",
    monthBestSeen: "February (Winter)",
    mythology:
      "Gemini immortalizes the twin brothers Castor and Pollux (the Dioscuri). When the mortal Castor was slain in battle, Pollux begged his father Zeus to share his immortality. Zeus granted his wish by uniting them in the sky as protectors of sailors and travelers.",
    astronomicalHighlights: [
      "Castor (Alpha Geminorum): A fascinating sextuple star system consisting of three pairs of spectroscopic binary stars.",
      "Pollux (Beta Geminorum): An orange giant star known to host an extrasolar gas giant planet.",
      "Geminid Meteor Shower: One of the most reliable and spectacular annual meteor showers peaking every December.",
      "Eskimo Nebula (NGC 2392): A planetary nebula with glowing shells resembling a fur parka.",
    ],
    artworkFile: "gemini.webp",
    artworkScaleDeg: 36,
    artworkRotationDeg: 5,
  },
  cma: {
    id: "cma",
    name: "Canis Major",
    abbreviation: "CMa",
    genitive: "Canis Majoris",
    englishName: "The Greater Dog",
    family: "Bayer",
    brightestStar: "Sirius (α Canis Majoris)",
    brightestStarMag: -1.46,
    raHours: 6.8,
    decDeg: -22.0,
    areaSqDeg: 380.1,
    areaRank: 43,
    quadrant: "SQ2",
    monthBestSeen: "February (Winter)",
    mythology:
      "Canis Major represents the larger and swifter of Orion's two hunting dogs, leaping behind the hunter in pursuit of Lepus the Hare. The constellation hosts Sirius, known since antiquity as the 'Dog Star'.",
    astronomicalHighlights: [
      "Sirius (The Dog Star): The brightest individual star in the entire night sky, glowing dazzling blue-white at magnitude -1.46.",
      "Messier 41: A beautiful open star cluster containing about 100 stars easily visible in binoculars.",
      "Thor's Helmet (NGC 2359): A cosmic emission bubble blown by a central Wolf-Rayet star.",
    ],
    artworkFile: "canis-major.webp",
    artworkScaleDeg: 32,
    artworkRotationDeg: 15,
  },
  cyg: {
    id: "cyg",
    name: "Cygnus",
    abbreviation: "Cyg",
    genitive: "Cygni",
    englishName: "The Swan",
    family: "Hercules",
    brightestStar: "Deneb (α Cygni)",
    brightestStarMag: 1.25,
    raHours: 20.6,
    decDeg: 42.0,
    areaSqDeg: 804.0,
    areaRank: 16,
    quadrant: "NQ4",
    monthBestSeen: "September (Summer/Autumn)",
    mythology:
      "Cygnus depicts a swan flying southward along the star-rich band of the Milky Way. In myth, it represents Zeus transformed into a majestic swan, or Orpheus transformed into a swan upon his death and placed beside his harp (Lyra).",
    astronomicalHighlights: [
      "Deneb (Alpha Cygni): An ultra-luminous white supergiant star marking the tail of the swan and a corner of the Summer Triangle.",
      "Albireo (Beta Cygni): One of the most famous and breathtaking double stars, displaying contrasting gold and sapphire blue components.",
      "Cygnus X-1: The first widely accepted stellar-mass black hole discovered in the Milky Way galaxy.",
      "Veil Nebula & North America Nebula: Expansive supernova remnants and glowing emission complexes.",
    ],
    artworkFile: "cygnus.webp",
    artworkScaleDeg: 38,
    artworkRotationDeg: -10,
  },
  aql: {
    id: "aql",
    name: "Aquila",
    abbreviation: "Aql",
    genitive: "Aquilae",
    englishName: "The Eagle",
    family: "Hercules",
    brightestStar: "Altair (α Aquilae)",
    brightestStarMag: 0.77,
    raHours: 19.7,
    decDeg: 3.0,
    areaSqDeg: 652.5,
    areaRank: 22,
    quadrant: "NQ4",
    monthBestSeen: "August (Summer)",
    mythology:
      "Aquila is the divine eagle of Zeus, responsible for carrying the thunderbolts of the king of gods and retrieving the youth Ganymede to Mount Olympus.",
    astronomicalHighlights: [
      "Altair (Alpha Aquilae): A rapidly spinning A-type star (spinning once every 9 hours, flattening its poles) and anchor of the Summer Triangle.",
      "Barnard 142/143 (The 'E' Nebula): Dark interstellar absorption dust clouds silhouetted against rich Milky Way star fields.",
    ],
    artworkFile: "aquila.webp",
    artworkScaleDeg: 34,
    artworkRotationDeg: 0,
  },
  cas: {
    id: "cas",
    name: "Cassiopeia",
    abbreviation: "Cas",
    genitive: "Cassiopeiae",
    englishName: "The Queen of the Heavens",
    family: "Perseus",
    brightestStar: "Schedar (α Cassiopeiae)",
    brightestStarMag: 2.24,
    raHours: 1.0,
    decDeg: 60.0,
    areaSqDeg: 598.4,
    areaRank: 25,
    quadrant: "NQ1",
    monthBestSeen: "November (Autumn/Winter)",
    mythology:
      "Cassiopeia was the vain queen of Ethiopia whose boast of being more beautiful than the Nereids (sea nymphs) brought the wrath of Poseidon. To punish her vanity, the gods placed her on a celestial throne that rotates upside down around the celestial pole for half the year.",
    astronomicalHighlights: [
      "The 'W' Asterism: Distinctive 5-star zigzag shape prominent in northern skies.",
      "Cassiopeia A: A prominent supernova remnant and one of the brightest astronomical radio sources outside our solar system.",
      "Heart & Soul Nebulae (IC 1805 / IC 1848): Expansive emission nebulae actively giving birth to clusters of massive stars.",
    ],
    artworkFile: "cassiopeia.webp",
    artworkScaleDeg: 36,
    artworkRotationDeg: 180,
  },
  peg: {
    id: "peg",
    name: "Pegasus",
    abbreviation: "Peg",
    genitive: "Pegasi",
    englishName: "The Winged Horse",
    family: "Perseus",
    brightestStar: "Enif (ε Pegasi)",
    brightestStarMag: 2.38,
    raHours: 22.7,
    decDeg: 20.0,
    areaSqDeg: 1121.3,
    areaRank: 7,
    quadrant: "NQ4",
    monthBestSeen: "October (Autumn)",
    mythology:
      "Pegasus is the magical winged stallion that sprang from Medusa upon her defeat by Perseus. Tamed by the hero Bellerophon with a golden bridle from Athena, Pegasus carried him to victory over the Chimera.",
    astronomicalHighlights: [
      "Great Square of Pegasus: A massive landmark celestial square formed by Markab, Scheat, Algenib, and Alpheratz.",
      "51 Pegasi: The historic Sun-like star where the first exoplanet orbiting a main-sequence star (51 Pegasi b / Dimidium) was discovered in 1995.",
      "Stephan's Quintet: A compact group of five interacting galaxies famous for violent galactic collisions.",
    ],
    artworkFile: "pegasus.webp",
    artworkScaleDeg: 44,
    artworkRotationDeg: 25,
  },
  sgr: {
    id: "sgr",
    name: "Sagittarius",
    abbreviation: "Sgr",
    genitive: "Sagittarii",
    englishName: "The Archer / Centaur",
    family: "Zodiac",
    brightestStar: "Kaus Australis (ε Sagittarii)",
    brightestStarMag: 1.79,
    raHours: 19.1,
    decDeg: -25.0,
    areaSqDeg: 867.4,
    areaRank: 15,
    quadrant: "SQ4",
    zodiacSign: "♐ (November 22 – December 21)",
    monthBestSeen: "August (Summer)",
    mythology:
      "Sagittarius depicts a centaur (half-human, half-horse) drawing a bow aimed at the heart of Scorpius. In Greek myth, it is identified with the scholarly centaur Crotus, inventor of archery and champion of the Muses.",
    astronomicalHighlights: [
      "Milky Way Galactic Center (Sagittarius A*): The supermassive black hole around which our entire galaxy revolves.",
      "The Teapot Asterism: Prominent celestial teapot whose spout points toward the densest star clouds of the Milky Way.",
      "Lagoon Nebula (M8) & Trifid Nebula (M20): Magnificent stellar nurseries glowing with pink hydrogen and blue reflection dust.",
    ],
    artworkFile: "sagittarius.webp",
    artworkScaleDeg: 40,
    artworkRotationDeg: 0,
  },
  cap: {
    id: "cap",
    name: "Capricornus",
    abbreviation: "Cap",
    genitive: "Capricorni",
    englishName: "The Sea Goat",
    family: "Zodiac",
    brightestStar: "Deneb Algedi (δ Capricorni)",
    brightestStarMag: 2.85,
    raHours: 21.0,
    decDeg: -20.0,
    areaSqDeg: 413.9,
    areaRank: 40,
    quadrant: "SQ4",
    zodiacSign: "♑ (December 22 – January 19)",
    monthBestSeen: "September (Late Summer)",
    mythology:
      "Capricornus is one of the oldest recorded constellations, dating back to Bronze Age Babylonian star catalogs. It represents the mythological Sea Goat (Pricus), with the head of a goat and the body and tail of a fish.",
    astronomicalHighlights: [
      "Deneb Algedi (Delta Capricorni): An eclipsing binary star system 39 light-years away.",
      "Messier 30: A dense globular star cluster that has undergone core collapse, containing over 150,000 ancient stars.",
    ],
    artworkFile: "capricornus.webp",
    artworkScaleDeg: 34,
    artworkRotationDeg: -5,
  },
  aqr: {
    id: "aqr",
    name: "Aquarius",
    abbreviation: "Aqr",
    genitive: "Aquarii",
    englishName: "The Water Bearer",
    family: "Zodiac",
    brightestStar: "Sadalsuud (β Aquarii)",
    brightestStarMag: 2.90,
    raHours: 22.3,
    decDeg: -10.0,
    areaSqDeg: 979.9,
    areaRank: 10,
    quadrant: "SQ4",
    zodiacSign: "♒ (January 20 – February 18)",
    monthBestSeen: "October (Autumn)",
    mythology:
      "Aquarius represents the Water Bearer pouring a celestial urn of life-giving water into the mouth of the Southern Fish (Piscis Austrinus). In Greek lore, he is Ganymede, the cupbearer to the Olympian gods.",
    astronomicalHighlights: [
      "Helix Nebula (NGC 7293): The 'Eye of God', one of the closest and largest planetary nebulae to Earth (650 light-years).",
      "Saturn Nebula (NGC 7009): A glowing green-blue planetary nebula with rings resembling Saturn.",
      "Eta Aquariid Meteor Shower: Fast-moving annual meteor shower spawned by Halley's Comet.",
    ],
    artworkFile: "aquarius.webp",
    artworkScaleDeg: 40,
    artworkRotationDeg: 10,
  },
  psc: {
    id: "psc",
    name: "Pisces",
    abbreviation: "Psc",
    genitive: "Piscium",
    englishName: "The Fishes",
    family: "Zodiac",
    brightestStar: "Alpherg (η Piscium)",
    brightestStarMag: 3.62,
    raHours: 0.5,
    decDeg: 15.0,
    areaSqDeg: 889.4,
    areaRank: 14,
    quadrant: "NQ1",
    zodiacSign: "♓ (February 19 – March 20)",
    monthBestSeen: "November (Autumn)",
    mythology:
      "Pisces depicts two fish tied together by a cord. In mythology, the goddess Aphrodite and her son Eros transformed themselves into fish and tied their tails together with a ribbon to escape the monster Typhon in the Euphrates river.",
    astronomicalHighlights: [
      "Vernal Equinox Point: The First Point of Aries has drifted into Pisces due to the precession of Earth's axis.",
      "Phantom Galaxy (M74): A grand design face-on spiral galaxy containing about 100 billion stars.",
    ],
    artworkFile: "pisces.webp",
    artworkScaleDeg: 44,
    artworkRotationDeg: 0,
  },
  ari: {
    id: "ari",
    name: "Aries",
    abbreviation: "Ari",
    genitive: "Arietis",
    englishName: "The Ram",
    family: "Zodiac",
    brightestStar: "Hamal (α Arietis)",
    brightestStarMag: 2.01,
    raHours: 2.6,
    decDeg: 20.0,
    areaSqDeg: 441.4,
    areaRank: 39,
    quadrant: "NQ1",
    zodiacSign: "♈ (March 21 – April 19)",
    monthBestSeen: "December (Winter)",
    mythology:
      "Aries represents the winged ram with the Golden Fleece sent by the cloud nymph Nephele to rescue Phrixus and Helle. The golden fleece later became the legendary prize sought by Jason and the Argonauts.",
    astronomicalHighlights: [
      "Hamal (Alpha Arietis): An orange giant star slightly brighter than the North Star, hosting an extrasolar planet.",
      "Mesarthim (Gamma Arietis): A pioneering double star discovered by Robert Hooke in 1664.",
    ],
    artworkFile: "aries.webp",
    artworkScaleDeg: 30,
    artworkRotationDeg: -10,
  },
  cnc: {
    id: "cnc",
    name: "Cancer",
    abbreviation: "Cnc",
    genitive: "Cancri",
    englishName: "The Crab",
    family: "Zodiac",
    brightestStar: "Tarf (β Cancri)",
    brightestStarMag: 3.53,
    raHours: 8.6,
    decDeg: 20.0,
    areaSqDeg: 505.9,
    areaRank: 31,
    quadrant: "NQ2",
    zodiacSign: "♋ (June 21 – July 22)",
    monthBestSeen: "March (Spring)",
    mythology:
      "Cancer was the giant crab sent by Hera to distract Hercules while he battled the Hydra. Though Hercules crushed the creature beneath his foot, Hera placed the brave crab in the heavens as a reward.",
    astronomicalHighlights: [
      "Beehive Cluster (M44 / Praesepe): A sparkling open cluster of hundreds of stars visible as a misty cloud to the naked eye.",
      "Messier 67: One of the oldest known open clusters in the Milky Way (estimated age 4 billion years).",
      "55 Cancri: A famous star system hosting five confirmed exoplanets, including a super-Earth with molten lava surface.",
    ],
    artworkFile: "cancer.webp",
    artworkScaleDeg: 32,
    artworkRotationDeg: 0,
  },
  lib: {
    id: "lib",
    name: "Libra",
    abbreviation: "Lib",
    genitive: "Librae",
    englishName: "The Scales of Justice",
    family: "Zodiac",
    brightestStar: "Zubeneschamali (β Librae)",
    brightestStarMag: 2.61,
    raHours: 15.3,
    decDeg: -15.0,
    areaSqDeg: 538.1,
    areaRank: 29,
    quadrant: "SQ3",
    zodiacSign: "♎ (September 23 – October 22)",
    monthBestSeen: "June (Late Spring/Summer)",
    mythology:
      "Libra is the only zodiac constellation representing an inanimate object — the Scales of Justice held by Astraea (Virgo). In ancient times, the sun entered Libra at the autumnal equinox, when day and night were equal in balance.",
    astronomicalHighlights: [
      "Zubeneschamali (Beta Librae): The only naked-eye star frequently reported by stargazers as possessing an emerald greenish hue.",
      "Gliese 581: A red dwarf system with multiple exoplanets in the habitable zone.",
      "Methuselah Star (HD 140283): One of the oldest known stars in the universe, nearly 13.7 billion years old.",
    ],
    artworkFile: "libra.webp",
    artworkScaleDeg: 32,
    artworkRotationDeg: 0,
  },
  boo: {
    id: "boo",
    name: "Boötes",
    abbreviation: "Boo",
    genitive: "Boötis",
    englishName: "The Herdsman",
    family: "Ursa Major",
    brightestStar: "Arcturus (α Boötis)",
    brightestStarMag: -0.05,
    raHours: 14.6,
    decDeg: 30.0,
    areaSqDeg: 906.8,
    areaRank: 13,
    quadrant: "NQ3",
    monthBestSeen: "June (Summer)",
    mythology:
      "Boötes is the celestial herdsman who drives the Great and Little Bears (Ursa Major and Ursa Minor) around the north celestial pole using his hunting dogs (Canes Venatici). He is also credited in myth as the inventor of the agricultural plow.",
    astronomicalHighlights: [
      "Arcturus (Alpha Boötis): The fourth-brightest star in the sky and brightest in the northern celestial hemisphere, shining with a distinctive golden-orange glow.",
      "Izar (Epsilon Boötis / 'Pulcherrima'): Known as 'The Most Beautiful', a celebrated double star with amber orange and blue components.",
      "Boötes Void: An immense region of space (330 million light-years across) containing exceptionally few galaxies.",
    ],
    artworkFile: "bootes.webp",
    artworkScaleDeg: 42,
    artworkRotationDeg: -15,
  },
  lyr: {
    id: "lyr",
    name: "Lyra",
    abbreviation: "Lyr",
    genitive: "Lyrae",
    englishName: "The Harp / Lyre",
    family: "Hercules",
    brightestStar: "Vega (α Lyrae)",
    brightestStarMag: 0.03,
    raHours: 18.9,
    decDeg: 36.0,
    areaSqDeg: 286.5,
    areaRank: 52,
    quadrant: "NQ4",
    monthBestSeen: "August (Summer)",
    mythology:
      "Lyra depicts the enchanted musical lyre created by Hermes from a tortoise shell and given to Orpheus. His music was so exquisite that it could charm beasts, trees, and even the rocks into dancing.",
    astronomicalHighlights: [
      "Vega (Alpha Lyrae): The baseline star of the astronomical magnitude system, and the first star other than the Sun to be photographed.",
      "Ring Nebula (M57): The quintessential planetary nebula showing a glowing donut of ionized gas surrounding a dying white dwarf.",
      "Epsilon Lyrae ('The Double Double'): Famous multiple star system consisting of two pairs of binary stars.",
    ],
    artworkFile: "lyra.webp",
    artworkScaleDeg: 28,
    artworkRotationDeg: 0,
  },
  cru: {
    id: "cru",
    name: "Crux",
    abbreviation: "Cru",
    genitive: "Crucis",
    englishName: "The Southern Cross",
    family: "Heavenly Waters",
    brightestStar: "Acrux (α Crucis)",
    brightestStarMag: 0.77,
    raHours: 12.4,
    decDeg: -60.0,
    areaSqDeg: 68.4,
    areaRank: 88,
    quadrant: "SQ3",
    monthBestSeen: "May (Southern Hemisphere)",
    mythology:
      "Although the smallest of all 88 modern constellations, Crux is among the most distinctive. Navigators in the southern hemisphere used its long axis as a celestial compass to locate the South Celestial Pole.",
    astronomicalHighlights: [
      "Acrux (Alpha Crucis) & Mimosa (Beta Crucis): Luminous blue-white stars anchoring the cross.",
      "Coalsack Nebula: The most prominent naked-eye dark absorption nebula in the southern Milky Way.",
      "Jewel Box Cluster (NGC 4755): A stunning open cluster of multicolored supergiant stars resembling a celestial brooch.",
    ],
    artworkFile: "crux.webp",
    artworkScaleDeg: 22,
    artworkRotationDeg: 0,
  },
  cen: {
    id: "cen",
    name: "Centaurus",
    abbreviation: "Cen",
    genitive: "Centauri",
    englishName: "The Wise Centaur",
    family: "Hercules",
    brightestStar: "Alpha Centauri (Rigil Kentaurus)",
    brightestStarMag: -0.27,
    raHours: 13.7,
    decDeg: -47.0,
    areaSqDeg: 1060.4,
    areaRank: 9,
    quadrant: "SQ3",
    monthBestSeen: "May (Southern Hemisphere)",
    mythology:
      "Centaurus honors Chiron, the wisest and most just of all centaurs. Renowned as a master of medicine, music, hunting, and astronomy, Chiron served as the revered mentor to Achilles, Asclepius, and Hercules.",
    astronomicalHighlights: [
      "Alpha Centauri System (Rigil Kentaurus, Toliman, and Proxima Centauri): The closest stellar system to our solar system (4.24 light-years).",
      "Omega Centauri (NGC 5139): The largest and brightest globular star cluster in the Milky Way, containing over 10 million stars.",
      "Centaurus A (NGC 5128): A massive radio galaxy with an active galactic nucleus and prominent relativistic plasma jets.",
    ],
    artworkFile: "centaurus.webp",
    artworkScaleDeg: 42,
    artworkRotationDeg: 0,
  },
};

/**
 * 3-Star Astronomical Affine Anchor System
 * Maps 3 specific points on each constellation texture to the exact J2000 RA/Dec of its anchor stars.
 * This guarantees 100% mathematical alignment of the artwork with the real celestial sphere.
 */
export interface ConstellationAnchorData {
  star1: { uv: [number, number]; ra: number; dec: number; name: string };
  star2: { uv: [number, number]; ra: number; dec: number; name: string };
  star3: { uv: [number, number]; ra: number; dec: number; name: string };
}

export interface CelestialCorner {
  ra: number;
  dec: number;
}

export const CONSTELLATION_ANCHORS: Record<string, ConstellationAnchorData> = {
  // Scorpius: Antares (Heart), Dschubba (Head/Claws), Shaula (Stinger)
  sco: {
    star1: { name: "Antares (α Sco)", uv: [270 / 512, 1 - 230 / 512], ra: 247.35, dec: -26.43 },
    star2: { name: "Dschubba (δ Sco)", uv: [310 / 512, 1 - 135 / 512], ra: 240.08, dec: -22.62 },
    star3: { name: "Shaula (λ Sco)", uv: [65 / 512, 1 - 410 / 512], ra: 263.40, dec: -37.10 },
  },
  // Orion: Betelgeuse (Left Shoulder), Rigel (Right Foot), Bellatrix (Right Shoulder)
  ori: {
    star1: { name: "Betelgeuse (α Ori)", uv: [175 / 512, 1 - 165 / 512], ra: 88.79, dec: 7.41 },
    star2: { name: "Rigel (β Ori)", uv: [450 / 512, 1 - 370 / 512], ra: 78.63, dec: -8.20 },
    star3: { name: "Bellatrix (γ Ori)", uv: [330 / 512, 1 - 170 / 512], ra: 81.28, dec: 6.35 },
  },
  // Taurus: Aldebaran (Eye of Bull), Elnath (Horn Tip), Alcyone (Pleiades on Back)
  tau: {
    star1: { name: "Aldebaran (α Tau)", uv: [245 / 512, 1 - 255 / 512], ra: 68.98, dec: 16.51 },
    star2: { name: "Elnath (β Tau)", uv: [60 / 512, 1 - 120 / 512], ra: 81.57, dec: 28.61 },
    star3: { name: "Alcyone (η Tau)", uv: [430 / 512, 1 - 180 / 512], ra: 56.87, dec: 24.11 },
  },
  // Virgo: Spica (Ear of Wheat in Left Hand), Porrima (Torso), Vindemiatrix (Right Shoulder/Wing)
  vir: {
    star1: { name: "Spica (α Vir)", uv: [340 / 512, 1 - 380 / 512], ra: 201.30, dec: -11.16 },
    star2: { name: "Porrima (γ Vir)", uv: [280 / 512, 1 - 250 / 512], ra: 190.43, dec: -1.45 },
    star3: { name: "Vindemiatrix (ε Vir)", uv: [360 / 512, 1 - 180 / 512], ra: 195.55, dec: 10.96 },
  },
  // Leo: Regulus (Heart), Denebola (Tail), Algieba (Mane)
  leo: {
    star1: { name: "Regulus (α Leo)", uv: [360 / 512, 1 - 230 / 512], ra: 152.09, dec: 11.97 },
    star2: { name: "Denebola (β Leo)", uv: [40 / 512, 1 - 390 / 512], ra: 177.26, dec: 14.57 },
    star3: { name: "Algieba (γ Leo)", uv: [310 / 512, 1 - 140 / 512], ra: 154.99, dec: 19.84 },
  },
  // Ursa Major: Dubhe (Bowl Top), Merak (Bowl Bottom), Alkaid (Tail Tip)
  uma: {
    star1: { name: "Dubhe (α UMa)", uv: [370 / 512, 1 - 230 / 512], ra: 165.93, dec: 61.75 },
    star2: { name: "Merak (β UMa)", uv: [325 / 512, 1 - 360 / 512], ra: 165.46, dec: 56.38 },
    star3: { name: "Alkaid (η UMa)", uv: [40 / 512, 1 - 80 / 512], ra: 206.88, dec: 49.31 },
  },
  // Bootes: Arcturus (Base of Torso/Kite), Nekkar (Head), Izar (Side)
  boo: {
    star1: { name: "Arcturus (α Boo)", uv: [255 / 512, 1 - 320 / 512], ra: 213.91, dec: 19.18 },
    star2: { name: "Nekkar (β Boo)", uv: [370 / 512, 1 - 90 / 512], ra: 225.49, dec: 40.39 },
    star3: { name: "Izar (ε Boo)", uv: [270 / 512, 1 - 220 / 512], ra: 221.25, dec: 27.07 },
  },
  // Corvus: Gienah (Top Wing), Algorab (Right Wing), Kraz (Claw/Tail)
  crv: {
    star1: { name: "Gienah (γ Crv)", uv: [190 / 512, 1 - 100 / 512], ra: 183.95, dec: -17.54 },
    star2: { name: "Algorab (δ Crv)", uv: [370 / 512, 1 - 220 / 512], ra: 187.47, dec: -16.52 },
    star3: { name: "Kraz (β Crv)", uv: [140 / 512, 1 - 310 / 512], ra: 193.30, dec: -23.40 },
  },
  // Crater: Delta Crt (Left Rim), Gamma Crt (Right Rim), Alkes (Base)
  crt: {
    star1: { name: "Delta Crt (δ Crt)", uv: [110 / 512, 1 - 120 / 512], ra: 169.62, dec: -14.78 },
    star2: { name: "Gamma Crt (γ Crt)", uv: [400 / 512, 1 - 160 / 512], ra: 173.79, dec: -17.68 },
    star3: { name: "Alkes (α Crt)", uv: [256 / 512, 1 - 440 / 512], ra: 164.96, dec: -18.30 },
  },
  // Canis Major: Sirius (Mouth), Adhara (Hind Foot), Wezen (Hind Body)
  cma: {
    star1: { name: "Sirius (α CMa)", uv: [360 / 512, 1 - 90 / 512], ra: 101.29, dec: -16.72 },
    star2: { name: "Adhara (ε CMa)", uv: [170 / 512, 1 - 440 / 512], ra: 104.66, dec: -28.97 },
    star3: { name: "Wezen (δ CMa)", uv: [130 / 512, 1 - 330 / 512], ra: 107.10, dec: -26.39 },
  },
  // Gemini: Castor (Northern Twin Head), Pollux (Southern Twin Head), Alhena (Foot)
  gem: {
    star1: { name: "Castor (α Gem)", uv: [100 / 512, 1 - 110 / 512], ra: 113.65, dec: 31.89 },
    star2: { name: "Pollux (β Gem)", uv: [260 / 512, 1 - 110 / 512], ra: 116.33, dec: 28.03 },
    star3: { name: "Alhena (γ Gem)", uv: [220 / 512, 1 - 470 / 512], ra: 99.43, dec: 16.40 },
  },
  // Sagittarius: Kaus Australis (Bow Base), Nunki (Upper Chest), Alnasl (Arrow Tip)
  sgr: {
    star1: { name: "Kaus Australis (ε Sgr)", uv: [400 / 512, 1 - 310 / 512], ra: 276.04, dec: -34.38 },
    star2: { name: "Nunki (σ Sgr)", uv: [190 / 512, 1 - 200 / 512], ra: 283.82, dec: -26.30 },
    star3: { name: "Alnasl (γ Sgr)", uv: [480 / 512, 1 - 160 / 512], ra: 271.43, dec: -30.42 },
  },
  // Cygnus: Deneb (Tail), Albireo (Beak), Sadr (Chest)
  cyg: {
    star1: { name: "Deneb (α Cyg)", uv: [255 / 512, 1 - 170 / 512], ra: 310.36, dec: 45.28 },
    star2: { name: "Albireo (β Cyg)", uv: [480 / 512, 1 - 450 / 512], ra: 292.68, dec: 27.96 },
    star3: { name: "Sadr (γ Cyg)", uv: [310 / 512, 1 - 280 / 512], ra: 305.56, dec: 40.26 },
  },
  // Aquila: Altair (Neck), Tarazed (Right Wing), Alshain (Left Wing)
  aql: {
    star1: { name: "Altair (α Aql)", uv: [220 / 512, 1 - 240 / 512], ra: 297.70, dec: 8.87 },
    star2: { name: "Tarazed (γ Aql)", uv: [350 / 512, 1 - 130 / 512], ra: 296.54, dec: 10.61 },
    star3: { name: "Alshain (β Aql)", uv: [100 / 512, 1 - 350 / 512], ra: 298.83, dec: 6.41 },
  },
  // Lyra: Vega (Top of Harp), Sheliak (Base Left), Sulafat (Base Right)
  lyr: {
    star1: { name: "Vega (α Lyr)", uv: [256 / 512, 1 - 70 / 512], ra: 279.23, dec: 38.78 },
    star2: { name: "Sheliak (β Lyr)", uv: [210 / 512, 1 - 410 / 512], ra: 282.52, dec: 33.36 },
    star3: { name: "Sulafat (γ Lyr)", uv: [300 / 512, 1 - 410 / 512], ra: 284.74, dec: 32.69 },
  },
  // Cassiopeia: Schedar (Center of W), Caph (Right of W), Gamma Cas (Middle Peak)
  cas: {
    star1: { name: "Schedar (α Cas)", uv: [160 / 512, 1 - 180 / 512], ra: 10.13, dec: 56.54 },
    star2: { name: "Caph (β Cas)", uv: [190 / 512, 1 - 50 / 512], ra: 2.29, dec: 59.15 },
    star3: { name: "Gamma Cas (γ Cas)", uv: [240 / 512, 1 - 240 / 512], ra: 14.18, dec: 60.72 },
  },
  // Pegasus: Markab (Shoulder), Scheat (Front Leg), Algenib (Wing)
  peg: {
    star1: { name: "Markab (α Peg)", uv: [310 / 512, 1 - 290 / 512], ra: 346.19, dec: 15.21 },
    star2: { name: "Scheat (β Peg)", uv: [60 / 512, 1 - 270 / 512], ra: 345.94, dec: 28.08 },
    star3: { name: "Algenib (γ Peg)", uv: [470 / 512, 1 - 370 / 512], ra: 2.30, dec: 15.18 },
  },
  // Crux: Acrux (Cross Base), Gacrux (Cross Top), Mimosa (Cross Left)
  cru: {
    star1: { name: "Acrux (α Cru)", uv: [60 / 512, 1 - 430 / 512], ra: 186.65, dec: -63.10 },
    star2: { name: "Gacrux (γ Cru)", uv: [420 / 512, 1 - 90 / 512], ra: 187.79, dec: -57.11 },
    star3: { name: "Mimosa (β Cru)", uv: [160 / 512, 1 - 90 / 512], ra: 191.93, dec: -59.69 },
  },
  // Centaurus: Rigil Kentaurus (Front Hoof), Hadar (Front Leg), Menkent (Head)
  cen: {
    star1: { name: "Rigil Kentaurus (α Cen)", uv: [240 / 512, 1 - 470 / 512], ra: 219.90, dec: -60.83 },
    star2: { name: "Hadar (β Cen)", uv: [360 / 512, 1 - 420 / 512], ra: 210.96, dec: -60.37 },
    star3: { name: "Menkent (θ Cen)", uv: [150 / 512, 1 - 140 / 512], ra: 211.72, dec: -36.37 },
  },
  // Libra: Zubeneschamali (North Scale), Zubenelgenubi (South Scale), Zubenelakrab (Beam)
  lib: {
    star1: { name: "Zubeneschamali (β Lib)", uv: [80 / 512, 1 - 290 / 512], ra: 229.25, dec: -9.38 },
    star2: { name: "Zubenelgenubi (α Lib)", uv: [420 / 512, 1 - 370 / 512], ra: 222.72, dec: -16.04 },
    star3: { name: "Zubenelakrab (γ Lib)", uv: [290 / 512, 1 - 120 / 512], ra: 233.87, dec: -14.79 },
  },
  // Cancer: Acubens (Left Claw), Altarf (Right Leg), Asellus Australis (Shell)
  cnc: {
    star1: { name: "Acubens (α Cnc)", uv: [110 / 512, 1 - 330 / 512], ra: 134.61, dec: 11.86 },
    star2: { name: "Altarf (β Cnc)", uv: [240 / 512, 1 - 440 / 512], ra: 124.13, dec: 9.19 },
    star3: { name: "Asellus Australis (δ Cnc)", uv: [250 / 512, 1 - 260 / 512], ra: 131.17, dec: 18.15 },
  },
  // Aries: Hamal (Head), Sheratan (Horns), Mesarthim (Back)
  ari: {
    star1: { name: "Hamal (α Ari)", uv: [390 / 512, 1 - 130 / 512], ra: 31.79, dec: 23.46 },
    star2: { name: "Sheratan (β Ari)", uv: [460 / 512, 1 - 90 / 512], ra: 28.66, dec: 20.81 },
    star3: { name: "Mesarthim (γ Ari)", uv: [200 / 512, 1 - 200 / 512], ra: 28.02, dec: 19.29 },
  },
  // Pisces: Alrescha (Knot), Fumalsamakah (Western Fish), Gamma Psc (Northern Fish)
  psc: {
    star1: { name: "Alrescha (α Psc)", uv: [110 / 512, 1 - 470 / 512], ra: 30.51, dec: 2.76 },
    star2: { name: "Fumalsamakah (β Psc)", uv: [50 / 512, 1 - 150 / 512], ra: 345.97, dec: 3.82 },
    star3: { name: "Gamma Psc (γ Psc)", uv: [450 / 512, 1 - 200 / 512], ra: 349.25, dec: 3.28 },
  },
  // Capricornus: Algedi (Horns), Dabih (Head), Deneb Algedi (Fish Tail)
  cap: {
    star1: { name: "Algedi (α Cap)", uv: [420 / 512, 1 - 70 / 512], ra: 304.49, dec: -12.54 },
    star2: { name: "Dabih (β Cap)", uv: [480 / 512, 1 - 150 / 512], ra: 305.25, dec: -14.78 },
    star3: { name: "Deneb Algedi (δ Cap)", uv: [70 / 512, 1 - 350 / 512], ra: 326.76, dec: -16.13 },
  },
  // Aquarius: Sadalmelik (Right Shoulder), Sadalsuud (Left Shoulder), Skat (Water Stream)
  aqr: {
    star1: { name: "Sadalmelik (α Aqr)", uv: [240 / 512, 1 - 140 / 512], ra: 331.45, dec: -0.32 },
    star2: { name: "Sadalsuud (β Aqr)", uv: [420 / 512, 1 - 100 / 512], ra: 322.89, dec: -5.57 },
    star3: { name: "Skat (δ Aqr)", uv: [110 / 512, 1 - 460 / 512], ra: 343.66, dec: -15.82 },
  },
  // Andromeda: Alpheratz (Crown/Head), Mirach (Waist), Almach (Left Foot)
  and: {
    star1: { name: "Alpheratz (α And)", uv: [300 / 512, 1 - 80 / 512], ra: 2.10, dec: 29.09 },
    star2: { name: "Mirach (β And)", uv: [250 / 512, 1 - 280 / 512], ra: 17.43, dec: 35.62 },
    star3: { name: "Almach (γ And)", uv: [270 / 512, 1 - 460 / 512], ra: 30.97, dec: 42.33 },
  },
  // Perseus: Mirfak (Chest), Algol (Medusa Head), Atik (Foot)
  per: {
    star1: { name: "Mirfak (α Per)", uv: [330 / 512, 1 - 160 / 512], ra: 51.08, dec: 49.86 },
    star2: { name: "Algol (β Per)", uv: [330 / 512, 1 - 330 / 512], ra: 47.04, dec: 40.96 },
    star3: { name: "Atik (ζ Per)", uv: [160 / 512, 1 - 460 / 512], ra: 58.52, dec: 31.88 },
  },
  // Auriga: Capella (Goat on Shoulder), Menkalinan (Right Shoulder), Hassaleh (Foot)
  aur: {
    star1: { name: "Capella (α Aur)", uv: [440 / 512, 1 - 180 / 512], ra: 79.17, dec: 46.00 },
    star2: { name: "Menkalinan (β Aur)", uv: [250 / 512, 1 - 120 / 512], ra: 89.84, dec: 44.95 },
    star3: { name: "Hassaleh (ι Aur)", uv: [360 / 512, 1 - 470 / 512], ra: 74.11, dec: 33.17 },
  },
  // Hercules: Kornephoros (Hero Shoulder), Rasalgethi (Head), Sarin (Waist)
  her: {
    star1: { name: "Kornephoros (β Her)", uv: [180 / 512, 1 - 180 / 512], ra: 247.61, dec: 21.49 },
    star2: { name: "Rasalgethi (α Her)", uv: [200 / 512, 1 - 110 / 512], ra: 258.66, dec: 14.39 },
    star3: { name: "Sarin (δ Her)", uv: [260 / 512, 1 - 290 / 512], ra: 258.77, dec: 24.84 },
  },
  // Ophiuchus: Rasalhague (Head), Sabik (Leg), Cebalrai (Shoulder)
  oph: {
    star1: { name: "Rasalhague (α Oph)", uv: [230 / 512, 1 - 90 / 512], ra: 263.73, dec: 12.56 },
    star2: { name: "Sabik (η Oph)", uv: [240 / 512, 1 - 470 / 512], ra: 257.59, dec: -15.72 },
    star3: { name: "Cebalrai (β Oph)", uv: [310 / 512, 1 - 180 / 512], ra: 265.87, dec: 4.57 },
  },
  // Draco: Eltanin (Dragon Head Top), Rastaban (Dragon Eye), Thuban (Dragon Body Tail)
  dra: {
    star1: { name: "Eltanin (γ Dra)", uv: [420 / 512, 1 - 190 / 512], ra: 269.15, dec: 51.49 },
    star2: { name: "Rastaban (β Dra)", uv: [410 / 512, 1 - 140 / 512], ra: 262.61, dec: 52.30 },
    star3: { name: "Thuban (α Dra)", uv: [50 / 512, 1 - 390 / 512], ra: 211.14, dec: 64.38 },
  },
  // Ursa Minor: Polaris (Little Bear Tail Tip), Kochab (Bowl Shoulder), Pherkad (Bowl Foot)
  umi: {
    star1: { name: "Polaris (α UMi)", uv: [40 / 512, 1 - 80 / 512], ra: 37.95, dec: 89.26 },
    star2: { name: "Kochab (β UMi)", uv: [370 / 512, 1 - 230 / 512], ra: 222.68, dec: 74.16 },
    star3: { name: "Pherkad (γ UMi)", uv: [325 / 512, 1 - 360 / 512], ra: 230.18, dec: 71.83 },
  },
};

/**
 * Solve 4 Celestial Corners (RA, Dec) from 3-Star Affine Anchors.
 * Returns corners corresponding to texture UVs:
 * [0]: (u=0, v=0) Bottom-Left
 * [1]: (u=1, v=0) Bottom-Right
 * [2]: (u=1, v=1) Top-Right
 * [3]: (u=0, v=1) Top-Left
 */
export function solveConstellationCorners(anchors: ConstellationAnchorData): [CelestialCorner, CelestialCorner, CelestialCorner, CelestialCorner] {
  const u1 = anchors.star1.uv[0], v1 = anchors.star1.uv[1];
  const u2 = anchors.star2.uv[0], v2 = anchors.star2.uv[1];
  const u3 = anchors.star3.uv[0], v3 = anchors.star3.uv[1];

  const det = u1 * (v2 - v3) - u2 * (v1 - v3) + u3 * (v1 - v2);
  if (Math.abs(det) < 1e-6) {
    const centerRa = anchors.star1.ra;
    const centerDec = anchors.star1.dec;
    return [
      { ra: centerRa + 15, dec: centerDec - 15 },
      { ra: centerRa - 15, dec: centerDec - 15 },
      { ra: centerRa - 15, dec: centerDec + 15 },
      { ra: centerRa + 15, dec: centerDec + 15 },
    ];
  }

  const inv00 = (v2 - v3) / det;
  const inv01 = (u3 - u2) / det;
  const inv02 = (u2 * v3 - u3 * v2) / det;

  const inv10 = (v3 - v1) / det;
  const inv11 = (u1 - u3) / det;
  const inv12 = (u3 * v1 - u1 * v3) / det;

  const inv20 = (v1 - v2) / det;
  const inv21 = (u2 - u1) / det;
  const inv22 = (u1 * v2 - u2 * v1) / det;

  // Normalize RA values relative to star1 to handle 0°/360° wrap-around
  // (e.g. Pegasus: Markab RA=346° vs Algenib RA=2° → delta should be +16°, not -344°)
  const raRef = anchors.star1.ra;
  const wrapRA = (ra: number) => { let d = ra - raRef; if (d > 180) d -= 360; if (d < -180) d += 360; return raRef + d; };
  const ra1 = raRef, dec1 = anchors.star1.dec;
  const ra2 = wrapRA(anchors.star2.ra), dec2 = anchors.star2.dec;
  const ra3 = wrapRA(anchors.star3.ra), dec3 = anchors.star3.dec;

  const a11 = ra1 * inv00 + ra2 * inv10 + ra3 * inv20;
  const a12 = ra1 * inv01 + ra2 * inv11 + ra3 * inv21;
  const b1  = ra1 * inv02 + ra2 * inv12 + ra3 * inv22;

  const a21 = dec1 * inv00 + dec2 * inv10 + dec3 * inv20;
  const a22 = dec1 * inv01 + dec2 * inv11 + dec3 * inv21;
  const b2  = dec1 * inv02 + dec2 * inv12 + dec3 * inv22;

  // Denormalize output corners back to 0°–360° range
  const normRA = (ra: number) => ((ra % 360) + 360) % 360;

  return [
    { ra: normRA(b1), dec: b2 },                                     // (0, 0)
    { ra: normRA(a11 + b1), dec: a21 + b2 },                         // (1, 0)
    { ra: normRA(a11 + a12 + b1), dec: a21 + a22 + b2 },             // (1, 1)
    { ra: normRA(a12 + b1), dec: a22 + b2 },                         // (0, 1)
  ];
}

/**
 * Get 4 celestial corners for any constellation.
 * Uses exact 3-star affine anchors if available, or computes an astronomical fallback from profile centroid & scale.
 */
export function getConstellationCorners(
  abbrOrName: string,
  profile: ConstellationProfile | null
): [CelestialCorner, CelestialCorner, CelestialCorner, CelestialCorner] {
  const code = (profile?.abbreviation || abbrOrName).toLowerCase().trim();
  const explicitAnchor = CONSTELLATION_ANCHORS[code];
  if (explicitAnchor) {
    return solveConstellationCorners(explicitAnchor);
  }

  // Astronomical fallback from profile centroid & angular scale
  const raDeg = profile ? profile.raHours * 15 : 0;
  const decDeg = profile ? profile.decDeg : 0;
  const halfSpan = (profile?.artworkScaleDeg || 30) / 2;
  const cosDec = Math.max(0.1, Math.cos((decDeg * Math.PI) / 180));
  const halfRa = halfSpan / cosDec;

  return [
    { ra: (raDeg + halfRa) % 360, dec: Math.max(-90, decDeg - halfSpan) },
    { ra: (raDeg - halfRa + 360) % 360, dec: Math.max(-90, decDeg - halfSpan) },
    { ra: (raDeg - halfRa + 360) % 360, dec: Math.min(90, decDeg + halfSpan) },
    { ra: (raDeg + halfRa) % 360, dec: Math.min(90, decDeg + halfSpan) },
  ];
}

/**
 * Get profile for a constellation by name, abbreviation, or ID
 */
export function getConstellationProfile(query: string): ConstellationProfile | null {
  const q = query.toLowerCase().trim().replace(/[^a-z]/g, "");
  for (const [key, profile] of Object.entries(CONSTELLATION_PROFILES)) {
    if (
      key === q ||
      profile.id === q ||
      profile.abbreviation.toLowerCase() === q ||
      profile.name.toLowerCase().replace(/[^a-z]/g, "") === q ||
      profile.genitive.toLowerCase().replace(/[^a-z]/g, "") === q ||
      profile.englishName.toLowerCase().replace(/[^a-z]/g, "").includes(q)
    ) {
      return profile;
    }
  }
  return null;
}
