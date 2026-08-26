/**
 * AI Mission Control — Human-Readable Formatters.
 */

/**
 * Format duration in hours to human-readable string.
 */
export function formatDurationHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = Math.floor(hours / 24);
  const remainH = Math.round(hours - days * 24);
  return remainH > 0 ? `${days}d ${remainH}h` : `${days}d`;
}

/**
 * Format delta-v value with units.
 */
export function formatDeltaV(mps: number): string {
  if (Math.abs(mps) >= 1000) {
    return `${(mps / 1000).toFixed(2)} km/s`;
  }
  return `${Math.round(mps)} m/s`;
}

/**
 * Format distance in km.
 */
export function formatDistanceKm(km: number): string {
  if (km >= 1_000_000) {
    return `${(km / 1_000_000).toFixed(2)}M km`;
  }
  if (km >= 1000) {
    return `${Math.round(km).toLocaleString()} km`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Format UTC timestamp for display.
 */
export function formatUtcTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toISOString().replace("T", " ").replace(".000Z", " UTC");
  } catch {
    return isoStr;
  }
}

/**
 * Format velocity in m/s or km/s.
 */
export function formatVelocity(mps: number): string {
  if (mps >= 1000) {
    return `${(mps / 1000).toFixed(2)} km/s`;
  }
  return `${Math.round(mps)} m/s`;
}
