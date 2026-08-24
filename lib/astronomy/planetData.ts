/**
 * Visual planet data for Cakrapala 3D Solar System.
 *
 * Scaled for high-fidelity interactive visualization with authentic IAU/NASA distances.
 */

import type { PlanetDefinition, SunDefinition } from "./types";

export const SUN_DATA: SunDefinition = {
  name: "Sun",
  description:
    "The G-type main-sequence star at the centre of our Solar System. Its mass accounts for 99.86% of the total solar system mass.",
  visualRadius: 3.5,
  color: "#FDB813",
};

export const PLANET_DATA: PlanetDefinition[] = [
  {
    id: "mercury",
    name: "Mercury",
    description:
      "The smallest planet and closest to the Sun. Its surface is heavily cratered with extreme temperature swings.",
    color: "#B5B5B5",
    visualRadius: 0.55,
    visualOrbitRadius: 7.0,
    orbitSpeed: 1.607,
    hasRing: false,
    realSemiMajorAxisAU: 0.387,
  },
  {
    id: "venus",
    name: "Venus",
    description:
      "The hottest planet with a thick toxic atmosphere of carbon dioxide and sulphuric acid clouds.",
    color: "#E8C56C",
    visualRadius: 0.85,
    visualOrbitRadius: 11.5,
    orbitSpeed: 1.174,
    hasRing: false,
    realSemiMajorAxisAU: 0.723,
  },
  {
    id: "earth",
    name: "Earth",
    description:
      "Our home planet — the only known body in the universe confirmed to harbour life.",
    color: "#4B9CD3",
    visualRadius: 0.95,
    visualOrbitRadius: 16.0,
    orbitSpeed: 1.0,
    hasRing: false,
    realSemiMajorAxisAU: 1.000,
  },
  {
    id: "mars",
    name: "Mars",
    description:
      "The Red Planet, with the tallest volcano (Olympus Mons) and deepest canyon (Valles Marineris) in the solar system.",
    color: "#C1440E",
    visualRadius: 0.72,
    visualOrbitRadius: 21.0,
    orbitSpeed: 0.802,
    hasRing: false,
    realSemiMajorAxisAU: 1.524,
  },
  // Main Asteroid Belt is located between Mars (21.0) and Jupiter (41.0) -> Belt spans 26.5 to 34.5 (2.1 to 3.3 AU)
  {
    id: "jupiter",
    name: "Jupiter",
    description:
      "The largest planet — a gas giant with the iconic Great Red Spot storm that has raged for centuries.",
    color: "#C88B3A",
    visualRadius: 2.3,
    visualOrbitRadius: 41.0,
    orbitSpeed: 0.434,
    hasRing: false,
    realSemiMajorAxisAU: 5.204,
  },
  {
    id: "saturn",
    name: "Saturn",
    description:
      "The ringed gas giant. Its spectacular ring system is made of ice and rock particles.",
    color: "#E4D191",
    visualRadius: 1.95,
    visualOrbitRadius: 55.0,
    orbitSpeed: 0.323,
    hasRing: true,
    realSemiMajorAxisAU: 9.582,
  },
  {
    id: "uranus",
    name: "Uranus",
    description:
      "An ice giant that rotates on its side, likely due to an ancient massive collision.",
    color: "#7DE8E8",
    visualRadius: 1.40,
    visualOrbitRadius: 69.0,
    orbitSpeed: 0.228,
    hasRing: false,
    realSemiMajorAxisAU: 19.201,
  },
  {
    id: "neptune",
    name: "Neptune",
    description:
      "The most distant major planet in our solar system. An ice giant known for supersonic winds.",
    color: "#4B70DD",
    visualRadius: 1.35,
    visualOrbitRadius: 83.0,
    orbitSpeed: 0.182,
    hasRing: false,
    realSemiMajorAxisAU: 30.047,
  },
];
