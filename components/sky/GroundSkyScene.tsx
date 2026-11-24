"use client";

import SkyDomeView from "./SkyDomeView";
import type { ObserverLocation } from "@/lib/astronomy/topocentricSky";

interface Props {
  location: ObserverLocation;
  onSelectLocation: (loc: ObserverLocation) => void;
}

export default function GroundSkyScene({ location, onSelectLocation }: Props) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#01030a] select-none">
      <SkyDomeView
        location={location}
        onSelectLocation={onSelectLocation}
      />
    </div>
  );
}
