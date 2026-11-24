"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
    X,
    ExternalLink,
    Compass,
    Layers,
    Orbit as OrbitIcon,
    BarChart3,
    FileText,
} from "lucide-react";
import type { SatelliteOmmRecord } from "@/lib/satellites/catalogTypes";
import type { SelectedSatelliteAnalysisMessage } from "@/lib/satellites/catalogWorkerTypes";
import type { SatelliteMediaRecord } from "@/lib/satellites/satelliteMedia";
import { formatSatelliteOwner } from "@/lib/satellites/ownerMetadata";
import { formatObjectType, formatOperationalStatus } from "@/lib/satellites/satcatParser";
import { calculateOrbitalMetrics } from "@/lib/satellites/orbitalMetrics";
import { calculateOrbitalFingerprint } from "@/lib/satellites/orbitalFingerprint";
import { assessDataQuality } from "@/lib/satellites/dataQuality";
import SatelliteMediaCard from "./SatelliteMediaCard";
import SatelliteAnalyticsPanel from "./analytics/SatelliteAnalyticsPanel";

export interface SatelliteDetailPanelProps {
    satellite: SatelliteOmmRecord;
    livePosition?: {
        altKm: number | null;
        speedKmS: number | null;
        speedKmH: number | null;
        latitudeDeg?: number | null;
        longitudeDeg?: number | null;
    } | null;
    analysis: SelectedSatelliteAnalysisMessage | null;
    isAnalyzing?: boolean;
    media: SatelliteMediaRecord | null;
    focusId?: string | null;
    onClose: () => void;
    onRecenterCamera: () => void;
}

type TabType = "overview" | "orbit" | "analytics" | "source";

export default function SatelliteDetailPanel({
    satellite,
    livePosition,
    analysis,
    isAnalyzing = false,
    media,
    focusId,
    onClose,
    onRecenterCamera,
}: SatelliteDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>("overview");

    const ownerDisplay = useMemo(() => {
        return formatSatelliteOwner(satellite.SATCAT?.OWNER ?? (satellite.OWNER as string | null));
    }, [satellite]);

    const statusDisplay = useMemo(() => {
        return formatOperationalStatus(satellite.SATCAT?.OPS_STATUS_CODE);
    }, [satellite]);

    const objectTypeLabel = useMemo(() => {
        return formatObjectType(satellite.SATCAT?.OBJECT_TYPE);
    }, [satellite]);

    const orbitalMetrics = useMemo(() => {
        return calculateOrbitalMetrics(satellite);
    }, [satellite]);

    const fingerprint = useMemo(() => {
        return calculateOrbitalFingerprint(satellite);
    }, [satellite]);

    const dataQuality = useMemo(() => {
        return assessDataQuality(satellite, true);
    }, [satellite]);

    return (
        <aside
            aria-label="Selected satellite detail console"
            className="flex max-h-full w-[348px] sm:w-[392px] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-2xl border border-white/[0.11] bg-[#030714]/86 shadow-[0_24px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all"
        >
            {/* Compact Frosted Header */}
            <header className="flex items-start justify-between gap-2.5 border-b border-white/[0.08] px-3.5 pt-3 pb-2.5">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.85)]" />
                        <span className="rounded border border-sky-400/30 bg-sky-400/12 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold tracking-wider text-sky-200 uppercase">
                            {orbitalMetrics.regime}
                        </span>
                        <span className="font-mono text-[9.5px] text-slate-400 tabular-nums">
                            #{satellite.NORAD_CAT_ID}
                        </span>
                    </div>

                    <h3 className="mt-1 truncate font-mono text-sm font-bold text-white">
                        {satellite.OBJECT_NAME}
                    </h3>

                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                        {satellite.OBJECT_ID || "COSPAR Unassigned"} · {ownerDisplay.name}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.04] text-slate-400 transition-colors hover:border-white/25 hover:bg-white/[0.10] hover:text-white"
                    aria-label="Close detail panel"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </header>

            {/* Compact Segmented Tabs */}
            <nav className="border-b border-white/[0.08] px-3 py-2">
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 font-mono text-[9.5px]">
                    {[
                        { id: "overview" as const, label: "Info", icon: Layers },
                        { id: "orbit" as const, label: "Orbit", icon: OrbitIcon },
                        { id: "analytics" as const, label: "Stats", icon: BarChart3 },
                        { id: "source" as const, label: "OMM", icon: FileText },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1.5 font-medium tracking-wider uppercase transition-all ${
                                    active
                                        ? "bg-white/[0.13] text-white shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <Icon className="h-2.5 w-2.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {/* 1. OVERVIEW TAB */}
                {activeTab === "overview" && (
                    <div className="space-y-4">
                        {/* Spacecraft Media or Procedural Placeholder */}
                        <SatelliteMediaCard
                            noradId={satellite.NORAD_CAT_ID}
                            objectName={satellite.OBJECT_NAME}
                            objectType={satellite.SATCAT?.OBJECT_TYPE}
                            owner={ownerDisplay}
                            regime={orbitalMetrics.regime}
                            media={media}
                        />

                        {/* Live Telemetry Grid */}
                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
                                <span className="block text-[9.5px] text-slate-500">CURRENT ALTITUDE</span>
                                <strong className="mt-0.5 block text-sm font-bold text-cyan-300">
                                    {livePosition?.altKm ? `${livePosition.altKm.toLocaleString()} km` : `${orbitalMetrics.estimatedPerigeeKm.toLocaleString()} km (est)`}
                                </strong>
                            </div>

                            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
                                <span className="block text-[9.5px] text-slate-500">SPEED (SGP4)</span>
                                <strong className="mt-0.5 block text-sm font-bold text-emerald-300">
                                    {livePosition?.speedKmS ? `${livePosition.speedKmS.toFixed(2)} km/s` : "—"}
                                </strong>
                                <span className="block text-[9px] text-slate-500">
                                    {livePosition?.speedKmH ? `${livePosition.speedKmH.toLocaleString()} km/h` : ""}
                                </span>
                            </div>
                        </div>

                        {/* Identity & Mission Profile */}
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 font-mono text-[11px] space-y-2">
                            <span className="font-bold text-cyan-300 text-[10px] tracking-wider block border-b border-slate-800 pb-1">
                                OBJECT IDENTITY & METADATA
                            </span>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">OBJECT TYPE:</span>
                                <strong className="text-white">{objectTypeLabel}</strong>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">OPERATIONAL STATUS:</span>
                                <span className={["rounded px-1.5 py-0.5 text-[10px] font-bold", statusDisplay.isOperational ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-300"].join(" ")}>
                                    {statusDisplay.label}
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">RESPONSIBLE ENTITY:</span>
                                <strong className="text-slate-200">
                                    {ownerDisplay.flag ? `${ownerDisplay.flag} ` : ""}{ownerDisplay.name}
                                </strong>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">LAUNCH DATE:</span>
                                <strong className="text-slate-200">
                                    {satellite.SATCAT?.LAUNCH_DATE ?? "NOT RECORDED"}
                                </strong>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">LAUNCH SITE:</span>
                                <strong className="text-slate-200">
                                    {satellite.SATCAT?.LAUNCH_SITE ?? "NOT RECORDED"}
                                </strong>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">RADAR CROSS SECTION (RCS):</span>
                                <strong className="text-slate-200">
                                    {satellite.SATCAT?.RCS !== null && satellite.SATCAT?.RCS !== undefined
                                        ? `${satellite.SATCAT.RCS} m²`
                                        : "NOT AVAILABLE"}
                                </strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ORBIT TAB */}
                {activeTab === "orbit" && (
                    <div className="space-y-3 font-mono text-[11px]">
                        <div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                            <span className="text-[10px] text-cyan-300 font-bold uppercase">
                                ORBIT REGIME: {orbitalMetrics.regime}
                            </span>
                            <span className="text-[10px] text-cyan-400">
                                PERIOD: {orbitalMetrics.periodMinutes} min
                            </span>
                        </div>

                        {/* Calculated vs SATCAT Apogee/Perigee */}
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-2">
                            <span className="text-[10px] font-bold text-amber-300 tracking-wider block border-b border-slate-800 pb-1">
                                ALTITUDE EXTREMES (ESTIMATED FROM MEAN ELEMENTS)
                            </span>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg bg-slate-950 p-2">
                                    <span className="block text-[9px] text-slate-500">PERIGEE ALTITUDE</span>
                                    <strong className="text-cyan-300 text-xs">
                                        {orbitalMetrics.estimatedPerigeeKm.toLocaleString()} km
                                    </strong>
                                </div>

                                <div className="rounded-lg bg-slate-950 p-2">
                                    <span className="block text-[9px] text-slate-500">APOGEE ALTITUDE</span>
                                    <strong className="text-amber-300 text-xs">
                                        {orbitalMetrics.estimatedApogeeKm.toLocaleString()} km
                                    </strong>
                                </div>
                            </div>

                            {satellite.SATCAT?.APOGEE !== null && satellite.SATCAT?.APOGEE !== undefined && (
                                <div className="mt-1 pt-1 border-t border-slate-800/60 text-[9.5px] text-slate-400 flex items-center justify-between">
                                    <span>SATCAT CATALOG VALUES:</span>
                                    <span className="text-slate-300">
                                        Perigee: {satellite.SATCAT.PERIGEE} km • Apogee: {satellite.SATCAT.APOGEE} km
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Full Keplerian Mean Elements Table */}
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-2">
                            <span className="text-[10px] font-bold text-cyan-300 tracking-wider block border-b border-slate-800 pb-1">
                                KEPLERIAN MEAN ELEMENTS (OMM)
                            </span>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10.5px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">INCLINATION:</span>
                                    <span className="text-white">{satellite.INCLINATION.toFixed(4)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">ECCENTRICITY:</span>
                                    <span className="text-white">{satellite.ECCENTRICITY.toFixed(7)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">RAAN:</span>
                                    <span className="text-white">{satellite.RA_OF_ASC_NODE.toFixed(4)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">ARG PERIGEE:</span>
                                    <span className="text-white">{satellite.ARG_OF_PERICENTER.toFixed(4)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">MEAN ANOMALY:</span>
                                    <span className="text-white">{satellite.MEAN_ANOMALY.toFixed(4)}°</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">MEAN MOTION:</span>
                                    <span className="text-white">{satellite.MEAN_MOTION.toFixed(8)} rev/d</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">SEMI-MAJOR AXIS:</span>
                                    <span className="text-white">{orbitalMetrics.semiMajorAxisKm.toLocaleString()} km</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">BSTAR DRAG:</span>
                                    <span className="text-white">{satellite.BSTAR.toExponential(4)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">REV AT EPOCH:</span>
                                    <span className="text-white">{satellite.REV_AT_EPOCH}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">ELEMENT SET:</span>
                                    <span className="text-white">{satellite.ELEMENT_SET_NO}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. ANALYTICS TAB */}
                {activeTab === "analytics" && (
                    <SatelliteAnalyticsPanel
                        satellite={satellite}
                        analysis={analysis}
                        fingerprint={fingerprint}
                        dataQuality={dataQuality}
                        isAnalyzing={isAnalyzing}
                        periodMinutes={orbitalMetrics.periodMinutes}
                    />
                )}

                {/* 4. SOURCE & AUDIT TAB */}
                {activeTab === "source" && (
                    <div className="space-y-3 font-mono text-[11px]">
                        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-2">
                            <span className="text-[10px] font-bold text-cyan-300 tracking-wider block border-b border-slate-800 pb-1">
                                DATA SOURCES & PROVENANCE
                            </span>

                            <div className="space-y-1.5 text-[10.5px]">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">OMM EPHEMERIS:</span>
                                    <strong className="text-slate-300">CelesTrak GP (JSON Format)</strong>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">SATCAT REGISTRY:</span>
                                    <strong className="text-slate-300">
                                        {satellite.SATCAT ? "CelesTrak SATCAT (Joined)" : "Fallback / Offline"}
                                    </strong>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">PROPAGATOR:</span>
                                    <strong className="text-emerald-400">satellite.js SGP4 Engine</strong>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">OBSERVATION EPOCH:</span>
                                    <strong className="text-slate-300">{satellite.EPOCH}</strong>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">CLASSIFICATION:</span>
                                    <strong className="text-slate-300">
                                        {satellite.CLASSIFICATION_TYPE === "U" ? "Unclassified (U)" : "Classified (C)"}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {media && (
                            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-1.5 text-[10.5px]">
                                <span className="text-[10px] font-bold text-emerald-300 tracking-wider block border-b border-slate-800 pb-1">
                                    MEDIA ATTRIBUTION & LICENSING
                                </span>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">SOURCE:</span>
                                    <strong className="text-slate-300">{media.sourceName}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">CREDIT:</span>
                                    <strong className="text-slate-300">{media.credit}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">LICENSE:</span>
                                    <strong className="text-emerald-400">{media.license}</strong>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Compact Bottom Actions Bar */}
            <footer className="flex items-center gap-1.5 border-t border-white/[0.08] bg-white/[0.02] p-2.5">
                {focusId && (
                    <Link
                        href={`/satellites?sat=${focusId}`}
                        className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-400/15 font-mono text-[10px] font-semibold tracking-wider text-sky-200 uppercase transition-all hover:bg-sky-400/25 hover:text-white"
                    >
                        <ExternalLink className="h-3 w-3" />
                        <span>Focus Ops</span>
                    </Link>
                )}

                <button
                    type="button"
                    onClick={onRecenterCamera}
                    className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/[0.10] bg-white/[0.05] font-mono text-[10px] font-medium tracking-wider text-slate-200 uppercase transition-all hover:border-white/25 hover:bg-white/[0.10] hover:text-white"
                >
                    <Compass className="h-3 w-3 text-sky-300" />
                    <span>Re-Center</span>
                </button>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] px-3 font-mono text-[10px] text-slate-400 uppercase transition-colors hover:border-white/20 hover:text-white"
                    title="Clear selected satellite"
                >
                    Clear
                </button>
            </footer>
        </aside>
    );
}
