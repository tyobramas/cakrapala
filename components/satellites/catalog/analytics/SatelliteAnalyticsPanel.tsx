"use client";

import { useState } from "react";
import type { SatelliteOmmRecord } from "@/lib/satellites/catalogTypes";
import type { SelectedSatelliteAnalysisMessage } from "@/lib/satellites/catalogWorkerTypes";
import type { OrbitalFingerprintResult } from "@/lib/satellites/orbitalFingerprint";
import type { DataQualityReport } from "@/lib/satellites/dataQuality";
import OrbitalProfileChart from "./OrbitalProfileChart";
import OrbitalFingerprintChart from "./OrbitalFingerprintChart";
import DataQualityPanel from "./DataQualityPanel";
import { Activity, Fingerprint, ShieldCheck } from "lucide-react";

export interface SatelliteAnalyticsPanelProps {
    satellite: SatelliteOmmRecord;
    analysis: SelectedSatelliteAnalysisMessage | null;
    fingerprint: OrbitalFingerprintResult;
    dataQuality: DataQualityReport;
    isAnalyzing?: boolean;
    periodMinutes?: number;
}

export default function SatelliteAnalyticsPanel({
    analysis,
    fingerprint,
    dataQuality,
    isAnalyzing = false,
    periodMinutes = 92.5,
}: SatelliteAnalyticsPanelProps) {
    const [activeView, setActiveView] = useState<"profile" | "fingerprint">("profile");

    return (
        <div className="space-y-4">
            {/* View Sub-Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 p-1 font-mono text-[10.5px]">
                    <button
                        type="button"
                        onClick={() => setActiveView("profile")}
                        className={[
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all",
                            activeView === "profile"
                                ? "bg-cyan-500/20 text-cyan-200 font-bold shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                                : "text-slate-400 hover:text-white",
                        ].join(" ")}
                    >
                        <Activity className="h-3.5 w-3.5 text-cyan-400" />
                        <span>SGP4 PREDICTION PROFILE</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveView("fingerprint")}
                        className={[
                            "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all",
                            activeView === "fingerprint"
                                ? "bg-emerald-500/20 text-emerald-200 font-bold shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                                : "text-slate-400 hover:text-white",
                        ].join(" ")}
                    >
                        <Fingerprint className="h-3.5 w-3.5 text-emerald-400" />
                        <span>ORBITAL FINGERPRINT</span>
                    </button>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>VERIFIED EPHEMERIS</span>
                </div>
            </div>

            {/* Active Graphic Display */}
            {activeView === "profile" ? (
                <OrbitalProfileChart
                    analysis={analysis}
                    isLoading={isAnalyzing}
                    periodMinutes={periodMinutes}
                />
            ) : (
                <OrbitalFingerprintChart fingerprint={fingerprint} />
            )}

            {/* Data Quality & Health Card */}
            <DataQualityPanel report={dataQuality} />
        </div>
    );
}
