import type { Metadata } from "next";
import OrbitalCatalogClient from "@/components/satellites/catalog/OrbitalCatalogClient";

export const metadata: Metadata = {
  title: "Cakrapala — 3D Orbital Constellation Catalog (1,000+ SGP4)",
  description:
    "Interactive full-viewport 3D Earth orbital catalog tracking 1,000+ active satellites in real time using SGP4 Web Worker propagation, CelesTrak OMM/SATCAT, and orbital analytics.",
};

export default function SatellitesCatalogPage() {
  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#02040a] text-slate-100">
      <OrbitalCatalogClient />
    </div>
  );
}
