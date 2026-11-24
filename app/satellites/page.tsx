import type { Metadata } from "next";
import SatelliteObservatoryConsole from "@/components/satellites/SatelliteObservatoryConsole";

export const metadata: Metadata = {
  title: "Cakrapala — Real-Time SGP4 Satellite Observatory",
  description:
    "Precision real-time SGP4 orbital satellite tracking (ISS, Tiangong CSS, Hubble, NOAA-19, Terra, Starlink) with live CelesTrak TLEs, true Earth shadow eclipse detection, Doppler telemetry, and 24-hour overhead pass predictions.",
};

export default function SatellitesPage() {
  return <SatelliteObservatoryConsole />;
}
