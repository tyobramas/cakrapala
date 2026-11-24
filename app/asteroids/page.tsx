import type { Metadata } from "next";
import AsteroidTrackerLayout from "@/components/asteroid/AsteroidTrackerLayout";

export const metadata: Metadata = {
  title: "Cakrapala — Asteroid Defense & NEO Radar",
  description:
    "Real-time Near-Earth Object (NEO) tracking radar, 3D specimen inspector, and Collins-Melosh-Marcus impact physics lab powered by NASA JPL NeoWs.",
};

export default function AsteroidsPage() {
  return <AsteroidTrackerLayout />;
}
