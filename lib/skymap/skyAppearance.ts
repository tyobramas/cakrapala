import * as THREE from "three";

export type SkyAtmosphereState = {
  phase: "day" | "civil" | "nautical" | "astronomical" | "night";
  zenithColor: THREE.Color;
  midColor: THREE.Color;
  horizonColor: THREE.Color;
  duskColor: THREE.Color;
  starBrightnessMultiplier: number;
  milkyWayOpacity: number;
  sunPosition: THREE.Vector3;
};

/**
 * Computes atmospheric sky color grading based on solar altitude.
 */
export function computeSkyAtmosphere(
  sunAltDeg: number,
  sunAzDeg: number
): SkyAtmosphereState {
  const sunAzRad = (sunAzDeg * Math.PI) / 180;
  const sunAltRad = (sunAltDeg * Math.PI) / 180;

  const sunPos = new THREE.Vector3(
    Math.cos(sunAltRad) * Math.sin(sunAzRad),
    Math.sin(sunAltRad),
    Math.cos(sunAltRad) * Math.cos(sunAzRad)
  ).normalize();

  if (sunAltDeg > 0) {
    // Daylight
    return {
      phase: "day",
      zenithColor: new THREE.Color("#08336b"),
      midColor: new THREE.Color("#1a60b5"),
      horizonColor: new THREE.Color("#60a5fa"),
      duskColor: new THREE.Color("#93c5fd"),
      starBrightnessMultiplier: 0.25,
      milkyWayOpacity: 0.15,
      sunPosition: sunPos,
    };
  } else if (sunAltDeg > -6) {
    // Civil Twilight (Golden / Magenta dusk)
    const factor = (sunAltDeg + 6) / 6;
    return {
      phase: "civil",
      zenithColor: new THREE.Color("#050b1f"),
      midColor: new THREE.Color("#161b3d"),
      horizonColor: new THREE.Color("#432838").lerp(new THREE.Color("#7c3f2b"), factor),
      duskColor: new THREE.Color("#ea580c"),
      starBrightnessMultiplier: 0.55,
      milkyWayOpacity: 0.35,
      sunPosition: sunPos,
    };
  } else if (sunAltDeg > -12) {
    // Nautical Twilight (Deep purple / Indigo)
    return {
      phase: "nautical",
      zenithColor: new THREE.Color("#030612"),
      midColor: new THREE.Color("#0b1228"),
      horizonColor: new THREE.Color("#1e162a"),
      duskColor: new THREE.Color("#3b1d38"),
      starBrightnessMultiplier: 0.85,
      milkyWayOpacity: 0.65,
      sunPosition: sunPos,
    };
  } else if (sunAltDeg > -18) {
    // Astronomical Twilight
    return {
      phase: "astronomical",
      zenithColor: new THREE.Color("#02040c"),
      midColor: new THREE.Color("#060a18"),
      horizonColor: new THREE.Color("#0d1326"),
      duskColor: new THREE.Color("#111827"),
      starBrightnessMultiplier: 0.95,
      milkyWayOpacity: 0.9,
      sunPosition: sunPos,
    };
  } else {
    // True Cosmic Night
    return {
      phase: "night",
      zenithColor: new THREE.Color("#010206"),
      midColor: new THREE.Color("#040712"),
      horizonColor: new THREE.Color("#080d1e"),
      duskColor: new THREE.Color("#050814"),
      starBrightnessMultiplier: 1.0,
      milkyWayOpacity: 1.0,
      sunPosition: sunPos,
    };
  }
}
