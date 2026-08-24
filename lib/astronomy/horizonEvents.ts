/**
 * Horizon event calculations for Cakrapala Milestone 3.
 *
 * Wraps astronomy-engine SearchRiseSet() to compute sunrise, sunset,
 * moonrise, and moonset times for a given observer and date.
 *
 * ACCURACY NOTES:
 *   - Uses astronomy-engine's built-in refraction model (standard refraction,
 *     ~0.57° correction at the horizon).
 *   - Horizon defined as altitude = 0° (geometric; refraction correction applied
 *     internally by astronomy-engine).
 *   - Results agree with USNO and JPL Horizons to within ~1 minute for most
 *     latitudes and dates.
 *   - Polar regions (|lat| > ~65°) may produce null results during polar
 *     day or polar night. This is expected behaviour.
 *   - All internal computation uses UTC. Local-time display is the caller's
 *     responsibility via formatLocalTime() in lib/astronomy/time.ts.
 *
 * REFRACTION ASSUMPTION:
 *   The "normal" refraction correction is applied by astronomy-engine.
 *   Standard sea-level refraction is assumed; elevation is NOT used to
 *   adjust refraction.
 */

import * as Astronomy from "astronomy-engine";
import type { ObserverLocation, HorizonEventResult, RiseSetPair } from "./types";
import { clampToAstronomyRange } from "./time";

// ── Internal helpers ──────────────────────────────────────────────────────────

function toAstroObserver(loc: ObserverLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.latitude, loc.longitude, loc.elevationMeters);
}

/**
 * Searches for a single rise OR set event.
 *
 * @param body      astronomy-engine Body enum.
 * @param direction +1 = rise, -1 = set.
 * @param observer  Observer location.
 * @param startDate UTC start date for the search window.
 * @returns         HorizonEventResult with date (UTC) or null.
 */
function searchRiseOrSet(
  body: Astronomy.Body,
  direction: 1 | -1,
  observer: Astronomy.Observer,
  startDate: Date
): HorizonEventResult {
  const safeDate = clampToAstronomyRange(startDate);

  // Search within a 24-hour window from startDate.
  const limitDays = 1.0;

  try {
    const result = Astronomy.SearchRiseSet(body, observer, direction, safeDate, limitDays);
    if (result === null) {
      return {
        date: null,
        unavailableReason:
          "Event not found in the 24-hour window (possible polar day/night or circumpolar body).",
      };
    }
    return { date: result.date };
  } catch (err) {
    return {
      date: null,
      unavailableReason: `Calculation error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Calculates the next sunrise after `startDate` for the given observer.
 *
 * @param observer  Geographic observer location.
 * @param startDate UTC date from which to search (typically 00:00 UTC of the day).
 * @returns         HorizonEventResult — UTC Date of sunrise, or null if unavailable.
 */
export function calculateSunrise(
  observer: ObserverLocation,
  startDate: Date
): HorizonEventResult {
  return searchRiseOrSet(
    Astronomy.Body.Sun,
    +1,
    toAstroObserver(observer),
    startDate
  );
}

/**
 * Calculates the next sunset after `startDate` for the given observer.
 */
export function calculateSunset(
  observer: ObserverLocation,
  startDate: Date
): HorizonEventResult {
  return searchRiseOrSet(
    Astronomy.Body.Sun,
    -1,
    toAstroObserver(observer),
    startDate
  );
}

/**
 * Calculates the next moonrise after `startDate` for the given observer.
 */
export function calculateMoonrise(
  observer: ObserverLocation,
  startDate: Date
): HorizonEventResult {
  return searchRiseOrSet(
    Astronomy.Body.Moon,
    +1,
    toAstroObserver(observer),
    startDate
  );
}

/**
 * Calculates the next moonset after `startDate` for the given observer.
 */
export function calculateMoonset(
  observer: ObserverLocation,
  startDate: Date
): HorizonEventResult {
  return searchRiseOrSet(
    Astronomy.Body.Moon,
    -1,
    toAstroObserver(observer),
    startDate
  );
}

/**
 * Calculates sunrise AND sunset for a given day.
 * Convenience wrapper returning both in a single object.
 *
 * @param observer  Geographic observer location.
 * @param dayStart  UTC midnight (or any time) of the target day.
 */
export function calculateSunRiseSet(
  observer: ObserverLocation,
  dayStart: Date
): RiseSetPair {
  const astroObs = toAstroObserver(observer);
  return {
    rise: searchRiseOrSet(Astronomy.Body.Sun, +1, astroObs, dayStart),
    set:  searchRiseOrSet(Astronomy.Body.Sun, -1, astroObs, dayStart),
  };
}

/**
 * Calculates moonrise AND moonset for a given day.
 */
export function calculateMoonRiseSet(
  observer: ObserverLocation,
  dayStart: Date
): RiseSetPair {
  const astroObs = toAstroObserver(observer);
  return {
    rise: searchRiseOrSet(Astronomy.Body.Moon, +1, astroObs, dayStart),
    set:  searchRiseOrSet(Astronomy.Body.Moon, -1, astroObs, dayStart),
  };
}

/**
 * Returns the UTC midnight (00:00:00.000) of the day containing `date`.
 * Useful for building rise/set search start dates.
 */
export function utcDayStart(date: Date): Date {
  const d = new Date(date.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
