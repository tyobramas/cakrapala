"use client";

/**
 * SkyObservatoryContainer — Full-Viewport Precision IAU Celestial Sky Observatory.
 * Location resolution priority:
 *   1. Explicit user-selected location persisted in localStorage
 *   2. Automatic live browser Geolocation (with reverse-geocoded city name & real IANA timezone)
 *   3. New York (40.7128° N, 74.0060° W, America/New_York) fallback if geolocation is denied/unavailable
 */

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { PRESET_CITIES, type ObserverLocation } from "@/lib/astronomy/topocentricSky";
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";

const STORAGE_KEY = "cakrapala_sky_location_v3";

const NEW_YORK_DEFAULT: ObserverLocation = PRESET_CITIES.find(
  (c) => c.name === "New York",
) ?? {
  name: "New York",
  country: "United States",
  latitude: 40.7128,
  longitude: -74.006,
  timezoneOffsetHours: -5,
  timeZone: "America/New_York",
  elevationMeters: 10,
};

const GroundSkyScene = dynamic(() => import("./GroundSkyScene"), {
  ssr: false,
  loading: () => (
    <ObservatoryLoader
      variant="fullscreen"
      title="CAKRAPALA"
      subtitle="Aligning IAU celestial sphere"
    />
  ),
});

export default function SkyObservatoryContainer() {
  const [location, setLocation] = useState<ObserverLocation>(NEW_YORK_DEFAULT);

  useEffect(() => {
    let active = true;

    const resolveInitialLocation = () => {
      // 1. Respect explicit user-chosen location saved previously
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ObserverLocation;
          if (
            parsed &&
            typeof parsed.latitude === "number" &&
            typeof parsed.longitude === "number" &&
            parsed.name
          ) {
            if (active) setLocation(parsed);
            return;
          }
        }
      } catch {
        // Ignore storage errors
      }

      // 2. Try automatic live browser geolocation; fall back cleanly to New York on error/denial
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!active) return;
          const lat = Math.round(pos.coords.latitude * 10000) / 10000;
          const lon = Math.round(pos.coords.longitude * 10000) / 10000;
          const elev =
            typeof pos.coords.altitude === "number" && Number.isFinite(pos.coords.altitude)
              ? Math.round(pos.coords.altitude)
              : 10;
          const browserTz =
            Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
          const offsetHours = -new Date().getTimezoneOffset() / 60;

          const baseLoc: ObserverLocation = {
            name: "My Location",
            country: "Current GPS",
            latitude: lat,
            longitude: lon,
            timezoneOffsetHours: offsetHours,
            timeZone: browserTz,
            elevationMeters: elev,
          };

          if (active) setLocation(baseLoc);

          // Best-effort reverse geocode to show human-readable city name
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
            );
            if (!res.ok || !active) return;
            const geo = (await res.json()) as {
              city?: string;
              locality?: string;
              principalSubdivision?: string;
              countryName?: string;
            };
            const resolvedName =
              geo.city || geo.locality || geo.principalSubdivision || "My Location";
            const resolvedCountry = geo.countryName || "Current GPS";
            if (active) {
              setLocation({
                ...baseLoc,
                name: resolvedName,
                country: resolvedCountry,
              });
            }
          } catch {
            // Keep "My Location" with exact GPS coordinates & real timezone
          }
        },
        () => {
          // Permission denied / timeout / unavailable -> keep New York default cleanly
        },
        {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 300000,
        },
      );
    };

    queueMicrotask(resolveInitialLocation);

    return () => {
      active = false;
    };
  }, []);

  const handleSelectLocation = useCallback((loc: ObserverLocation) => {
    setLocation(loc);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
      // Ignore storage errors
    }
  }, []);

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#01030a]">
      <GroundSkyScene
        location={location}
        onSelectLocation={handleSelectLocation}
      />
    </div>
  );
}
