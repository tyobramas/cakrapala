"use client";

import { useState } from "react";
import { ArrowLeft, Box, Sparkles } from "lucide-react";
import GroundSkyCanvasBackup from "./GroundSkyCanvasBackup";
import ThreeGroundSkyView from "./ThreeGroundSkyView";
import type { ObserverLocation } from "@/lib/astronomy/topocentricSky";

interface Props {
  location: ObserverLocation;
  onBackToMap: () => void;
}

export default function GroundSkyScene({ location, onBackToMap }: Props) {
  return (
    <div className="relative w-full h-full bg-[#010206] overflow-hidden select-none">
      {/* Active Sky Observatory Renderer (Three.js WebGL GPU) */}
      <ThreeGroundSkyView location={location} onBackToMap={onBackToMap} />
    </div>
  );
}
