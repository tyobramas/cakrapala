import * as THREE from "three";

/**
 * Converts topocentric horizontal coordinates (Azimuth, Altitude) to Three.js Vector3.
 *
 * Convention:
 * - Azimuth 0° = North (+Z)
 * - Azimuth 90° = East (+X)
 * - Azimuth 180° = South (-Z)
 * - Azimuth 270° = West (-X)
 * - Altitude 0° = Horizon (y = 0)
 * - Altitude 90° = Zenith (+Y)
 */
export function horizontalToThreeVector3(
  azimuthDeg: number,
  altitudeDeg: number,
  radius: number = 500
): THREE.Vector3 {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const altRad = (altitudeDeg * Math.PI) / 180;

  const cosAlt = Math.cos(altRad);
  const x = radius * cosAlt * Math.sin(azRad);
  const y = radius * Math.sin(altRad);
  const z = radius * cosAlt * Math.cos(azRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Rotates celestial J2000 coordinates to match observer's Local Sidereal Time.
 */
export function equatorialToThreeVector3(
  raDeg: number,
  decDeg: number,
  lstDeg: number,
  latDeg: number,
  radius: number = 500
): THREE.Vector3 {
  const raRad = (raDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  const H = ((lstDeg - raDeg) % 360 + 360) % 360;
  const HRad = (H * Math.PI) / 180;

  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
  const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const cosAlt = Math.cos(altRad);

  const cosAz = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altRad)) / (cosAlt * Math.cos(latRad) || 0.0001);
  let azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(HRad) > 0) azRad = 2 * Math.PI - azRad;

  const x = radius * cosAlt * Math.sin(azRad);
  const y = radius * Math.sin(altRad);
  const z = radius * cosAlt * Math.cos(azRad);

  return new THREE.Vector3(x, y, z);
}
