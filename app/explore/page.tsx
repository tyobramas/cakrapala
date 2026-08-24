import type { Metadata } from "next";
import AsteroidTrackerLayout from "@/components/asteroid/AsteroidTrackerLayout";

/**
 * /explore — Cakrapala Asteroid Defense & Near-Earth Object (NEO) Radar
 *
 * Real-time 3D Proximity Radar powered by NASA JPL NeoWs API with:
 *   - Photorealistic Earth, Moon, and accurate Milky Way orientation
 *   - Lunar Distance proximity rings (1 LD, 5 LD, 10 LD, 20 LD, 50 LD)
 *   - Potentially Hazardous Asteroid (PHA) DEFCON alert classification
 *   - Orbital mechanics telemetry & real-world size comparisons
 */
export const metadata: Metadata = {
  title: "Cakrapala — Asteroid Defense & NEO Radar",
  description:
    "Real-time Near-Earth Object (NEO) tracking radar and planetary defense observatory powered by NASA JPL NeoWs API.",
};

export default function ExplorePage() {
  return <AsteroidTrackerLayout />;
}

