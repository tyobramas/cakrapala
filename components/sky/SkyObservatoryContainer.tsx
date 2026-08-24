"use client";

/**
 * SkyObservatoryContainer — Master IAU Celestial Sky Dome & Earth Geospatial Observatory.
 * Seamless UX providing instant 3D Sky Dome immersion with quick Day/Night map toggle and scrollable observatory list & footer.
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import DayNightMapPicker from "./DayNightMapPicker";
import Footer from "@/components/landing/Footer";
import { PRESET_CITIES, type ObserverLocation } from "@/lib/astronomy/topocentricSky";

const GroundSkyScene = dynamic(() => import("./GroundSkyScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#020617] text-cyan-400 font-mono text-xs">
      <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3 shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
      <span className="tracking-widest">ALIGNING IAU CELESTIAL SKY DOME &amp; ATMOSPHERE...</span>
    </div>
  ),
});

export default function SkyObservatoryContainer() {
  const [hasMounted, setHasMounted] = useState<boolean>(false);
  // Default to Location Selection Map (UX flow required by user)
  const [viewMode, setViewMode] = useState<"map" | "observatory">("map");
  const [selectedLocation, setSelectedLocation] = useState<ObserverLocation>(PRESET_CITIES[0]); // Default: Bogor

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-[#020617] text-cyan-400 font-mono text-xs">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3 shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
        <span className="tracking-widest">SYNCHRONIZING CELESTIAL EPHEMERIS...</span>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-[#020617] ${
        viewMode === "observatory"
          ? "h-screen overflow-hidden"
          : "min-h-screen flex flex-col overflow-y-auto"
      }`}
    >
      {viewMode === "observatory" ? (
        <GroundSkyScene
          location={selectedLocation}
          onBackToMap={() => setViewMode("map")}
        />
      ) : (
        <>
          <DayNightMapPicker
            selectedLocation={selectedLocation}
            onSelectLocation={(loc) => setSelectedLocation(loc)}
            onEnterObservatory={() => setViewMode("observatory")}
          />
          <Footer />
        </>
      )}
    </div>
  );
}
