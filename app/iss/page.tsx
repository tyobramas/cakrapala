import type { Metadata } from "next";
import ISSMissionConsole from "@/components/space/ISSMissionConsole";

export const metadata: Metadata = {
  title: "Cakrapala — Satellite Flight Operations & Focus Tracker",
  description:
    "Real-time NORAD multi-satellite orbital tracking (ISS, Tiangong CSS, Hubble Space Telescope, NOAA, Terra, Starlink) with SGP4 ephemeris and 2D/3D CesiumJS globe.",
};

export default function ISSMissionPage() {
  return <ISSMissionConsole />;
}

