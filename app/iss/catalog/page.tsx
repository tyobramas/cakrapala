import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SatelliteModeTabs from "@/components/space/SatelliteModeTabs";
import OrbitalCatalogClient from "@/components/satellites/catalog/OrbitalCatalogClient";

export const metadata: Metadata = {
    title: "Cakrapala — 3D Orbital Constellation Catalog",
    description:
        "Interactive 3D space catalog tracking 1,000+ active satellites in real-time around Earth using SGP4 orbit propagation and CesiumJS.",
};

export default function OrbitalCatalogPage() {
    return (
        <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
            {/* Top Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-cyan-500/20 bg-[#040a17]/90 px-4 py-3.5 shadow-[0_4px_25px_rgba(0,0,0,0.5)] backdrop-blur-md sm:px-8">
                <div className="flex items-center gap-4">
                    <Link
                        href="/"
                        className="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-xs text-slate-300 transition-all hover:border-cyan-500/40 hover:text-white"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                        <span>MAIN PORTAL</span>
                    </Link>

                    <div className="h-5 w-px bg-slate-800" />

                    <div>
                        <h1 className="flex items-center gap-2 font-mono text-sm font-bold tracking-wider text-white sm:text-base">
                            SATELLITE FLIGHT OPERATIONS CONSOLE
                            <span className="hidden rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-normal text-cyan-400 sm:inline">
                                1,000+ ORBITAL CATALOG
                            </span>
                        </h1>
                    </div>
                </div>

                <div className="hidden items-center gap-3 sm:flex">
                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        <span>TELEMETRY SYNCED</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
                <SatelliteModeTabs active="catalog" />

                <OrbitalCatalogClient />
            </main>
        </div>
    );
}

