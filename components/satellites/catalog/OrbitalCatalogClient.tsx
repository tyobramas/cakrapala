"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Search,
    X,
    Compass,
    Globe2,
    Eye,
    Sun,
    Satellite as SatIcon,
    Layers,
    Activity,
    Maximize2,
    RotateCcw,
    Zap,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Sparkles,
} from "lucide-react";
import {
    prepareSatelliteCatalog,
    propagateSatelliteCatalog,
    type PreparedSatellite,
} from "@/lib/satellites/catalogPropagation";
import type {
    SatelliteCatalogResponse,
    SatelliteOmmRecord,
} from "@/lib/satellites/catalogTypes";
import type {
    CatalogWorkerInboundMessage,
    CatalogWorkerOutboundMessage,
    CatalogWorkerPositionMessage,
} from "@/lib/satellites/catalogWorkerTypes";
import type { OrbitalRegimeFilter } from "./OrbitalCatalogGlobe";
import { getSatelliteRegime } from "./OrbitalCatalogGlobe";

const PROPAGATION_INTERVAL_MS = 5_000;

const OrbitalCatalogGlobe = dynamic(
    () => import("@/components/satellites/catalog/OrbitalCatalogGlobe"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-[640px] sm:h-[720px] lg:h-[780px] w-full items-center justify-center bg-[#020713]">
                <div className="text-center">
                    <div className="relative mx-auto h-16 w-16">
                        <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-cyan-400/20 border-t-cyan-400" />
                        <div className="absolute inset-2 animate-[spin_2s_linear_infinite_reverse] rounded-full border-2 border-amber-400/20 border-b-amber-400" />
                        <div className="absolute inset-5 animate-pulse rounded-full bg-cyan-400/30" />
                    </div>
                    <p className="mt-5 font-mono text-xs font-semibold tracking-[0.2em] text-cyan-400">
                        INITIALIZING CESIUM 3D ORBIT ENGINE...
                    </p>
                    <p className="mt-1 text-[11px] font-mono text-slate-500">
                        Compiling SGP4 Ephemeris Shaders & Coordinate Buffers
                    </p>
                </div>
            </div>
        ),
    }
);

function isUnknownRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isSatelliteCatalogResponse(
    value: unknown
): value is SatelliteCatalogResponse {
    if (!isUnknownRecord(value)) {
        return false;
    }

    return (
        value.group === "active" &&
        typeof value.generatedAt === "string" &&
        typeof value.count === "number" &&
        typeof value.totalAvailable === "number" &&
        Array.isArray(value.satellites)
    );
}

function getErrorMessage(
    payload: unknown,
    fallback: string
): string {
    if (
        isUnknownRecord(payload) &&
        typeof payload.message === "string"
    ) {
        return payload.message;
    }

    return fallback;
}

function formatUtcTime(timestamp: number): string {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date(timestamp));
}

function getFreshestEpoch(
    satellites: readonly SatelliteOmmRecord[]
): number | null {
    let newestEpoch: number | null = null;

    for (const satellite of satellites) {
        const epoch = Date.parse(satellite.EPOCH);

        if (
            Number.isFinite(epoch) &&
            (newestEpoch === null || epoch > newestEpoch)
        ) {
            newestEpoch = epoch;
        }
    }

    return newestEpoch;
}

const QUICK_SEARCH_CHIPS = [
    { label: "ISS", query: "ISS" },
    { label: "TIANGONG", query: "CSS" },
    { label: "HUBBLE", query: "HST" },
    { label: "STARLINK", query: "STARLINK" },
    { label: "GPS", query: "NAVSTAR" },
    { label: "GALILEO", query: "GSAT" },
    { label: "NOAA", query: "NOAA" },
];

const CAMERA_PRESETS = [
    { id: "global", label: "GLOBAL 3D" },
    { id: "polar", label: "POLAR RINGS" },
    { id: "geo", label: "GEO BELT" },
    { id: "asia", label: "ASIA-PACIFIC" },
    { id: "americas", label: "AMERICAS" },
    { id: "europe", label: "EUROPE" },
];

// Flagship satellites that exist in focus mode
const FOCUS_FLAGSHIP_NORAD_MAP: Record<number, string> = {
    25544: "iss",
    48274: "tiangong",
    20580: "hubble",
    33591: "noaa19",
};

export default function OrbitalCatalogClient() {
    const workerRef = useRef<Worker | null>(null);
    const fallbackPreparedRef = useRef<PreparedSatellite[] | null>(null);
    const propagationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [catalog, setCatalog] = useState<SatelliteCatalogResponse | null>(null);
    const [positionFrame, setPositionFrame] = useState<CatalogWorkerPositionMessage | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Interactive UI states
    const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
    const [filterRegime, setFilterRegime] = useState<OrbitalRegimeFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [cameraPreset, setCameraPreset] = useState("global");
    const [showLighting, setShowLighting] = useState(true);
    const [showFleetBrowser, setShowFleetBrowser] = useState(false);
    const [calculationLatencyMs, setCalculationLatencyMs] = useState(1.8);

    useEffect(() => {
        const abortController = new AbortController();
        let disposed = false;

        const runMainThreadPropagation = () => {
            if (!fallbackPreparedRef.current || disposed) {
                return;
            }

            try {
                const startT = performance.now();
                const result = propagateSatelliteCatalog(
                    fallbackPreparedRef.current,
                    new Date()
                );
                const endT = performance.now();
                setCalculationLatencyMs(Math.round((endT - startT) * 10) / 10);

                setPositionFrame({
                    type: "positions",
                    timestamp: result.timestamp,
                    count: result.count,
                    validCount: result.validCount,
                    positionsEcfKm: result.positionsEcfKm,
                    speedsKmS: result.speedsKmS,
                    valid: result.valid,
                });
                setWorkerReady(true);
            } catch (err: unknown) {
                console.error("[OrbitalCatalogClient] Main thread propagation error:", err);
            }
        };

        const setupFallback = (satellites: SatelliteOmmRecord[]) => {
            if (disposed) return;
            fallbackPreparedRef.current = prepareSatelliteCatalog(satellites);
            setWorkerReady(true);
            runMainThreadPropagation();

            if (propagationTimerRef.current) {
                clearInterval(propagationTimerRef.current);
            }
            propagationTimerRef.current = setInterval(
                runMainThreadPropagation,
                PROPAGATION_INTERVAL_MS
            );
        };

        let worker: Worker | null = null;
        try {
            if (typeof window !== "undefined" && typeof Worker !== "undefined") {
                worker = new Worker(
                    new URL(
                        "../../../workers/satelliteCatalog.worker.ts",
                        import.meta.url
                    ),
                    {
                        type: "module",
                        name: "cakrapala-satellite-catalog",
                    }
                );
                workerRef.current = worker;
            }
        } catch (workerInitError) {
            console.warn("[OrbitalCatalogClient] Web Worker not available, using main thread:", workerInitError);
            worker = null;
        }

        const requestWorkerPropagation = () => {
            if (worker) {
                const message: CatalogWorkerInboundMessage = {
                    type: "propagate",
                    timestamp: Date.now(),
                };
                worker.postMessage(message);
            }
        };

        if (worker) {
            worker.onmessage = (
                event: MessageEvent<CatalogWorkerOutboundMessage>
            ) => {
                if (disposed) {
                    return;
                }

                const message = event.data;

                if (message.type === "ready") {
                    setWorkerReady(true);
                    requestWorkerPropagation();

                    if (propagationTimerRef.current) {
                        clearInterval(propagationTimerRef.current);
                    }

                    propagationTimerRef.current = setInterval(
                        requestWorkerPropagation,
                        PROPAGATION_INTERVAL_MS
                    );

                    return;
                }

                if (message.type === "positions") {
                    setPositionFrame(message);
                    return;
                }

                if (message.type === "error") {
                    console.warn("[OrbitalCatalogClient] Worker reported error, using fallback:", message.message);
                    if (catalog) {
                        setupFallback(catalog.satellites);
                    }
                }
            };

            worker.onerror = (event: ErrorEvent) => {
                console.warn("[OrbitalCatalogClient] Worker error event, using fallback:", event.message);
                if (worker) {
                    worker.terminate();
                    workerRef.current = null;
                    worker = null;
                }
                if (catalog) {
                    setupFallback(catalog.satellites);
                }
            };
        }

        fetch("/api/satellites/catalog?limit=1000", {
            cache: "no-store",
            signal: abortController.signal,
        })
            .then(async (response) => {
                const payload: unknown = await response.json();

                if (!response.ok) {
                    throw new Error(
                        getErrorMessage(
                            payload,
                            `Catalog API returned HTTP ${response.status}`
                        )
                    );
                }

                if (!isSatelliteCatalogResponse(payload)) {
                    throw new TypeError(
                        "Catalog API returned an invalid response"
                    );
                }

                return payload;
            })
            .then((payload) => {
                if (disposed) {
                    return;
                }

                setCatalog(payload);

                if (worker) {
                    const message: CatalogWorkerInboundMessage = {
                        type: "initialize",
                        satellites: payload.satellites,
                    };
                    worker.postMessage(message);
                } else {
                    setupFallback(payload.satellites);
                }
            })
            .catch((error: unknown) => {
                if (
                    disposed ||
                    (error instanceof DOMException &&
                        error.name === "AbortError")
                ) {
                    return;
                }

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to load orbital catalog"
                );
            });

        return () => {
            disposed = true;
            abortController.abort();

            if (propagationTimerRef.current) {
                clearInterval(propagationTimerRef.current);
                propagationTimerRef.current = null;
            }

            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    const freshestEpoch = useMemo(() => {
        if (!catalog) {
            return null;
        }

        return getFreshestEpoch(catalog.satellites);
    }, [catalog]);

    // Regime counts
    const regimeCounts = useMemo(() => {
        if (!catalog) return { all: 0, leo: 0, meo: 0, geo: 0 };
        let leo = 0;
        let meo = 0;
        let geo = 0;

        for (const sat of catalog.satellites) {
            const regime = getSatelliteRegime(sat.MEAN_MOTION);
            if (regime === "leo") leo++;
            else if (regime === "meo") meo++;
            else geo++;
        }

        return {
            all: catalog.satellites.length,
            leo,
            meo,
            geo,
        };
    }, [catalog]);

    // Selected satellite details
    const selectedSatelliteData = useMemo(() => {
        if (!selectedNoradId || !catalog) return null;
        const index = catalog.satellites.findIndex((s) => s.NORAD_CAT_ID === selectedNoradId);
        if (index === -1) return null;

        const sat = catalog.satellites[index];
        const regime = getSatelliteRegime(sat.MEAN_MOTION);

        let speedKmS: number | null = null;
        let altKm: number | null = null;

        if (positionFrame && positionFrame.valid[index] === 1) {
            speedKmS = positionFrame.speedsKmS[index];
            const offset = index * 3;
            const x = positionFrame.positionsEcfKm[offset];
            const y = positionFrame.positionsEcfKm[offset + 1];
            const z = positionFrame.positionsEcfKm[offset + 2];
            const radius = Math.sqrt(x * x + y * y + z * z);
            altKm = Math.round(radius - 6371);
        }

        const periodMin = (1440 / sat.MEAN_MOTION).toFixed(2);

        return {
            record: sat,
            index,
            regime,
            speedKmS,
            speedKmH: speedKmS ? Math.round(speedKmS * 3600) : null,
            altKm: altKm ?? Math.round(Math.pow(86400 / (sat.MEAN_MOTION * 2 * Math.PI), 2 / 3) * Math.pow(398600.4418, 1 / 3) - 6378.137),
            periodMin,
            focusId: FOCUS_FLAGSHIP_NORAD_MAP[sat.NORAD_CAT_ID] ?? null,
        };
    }, [selectedNoradId, catalog, positionFrame]);

    // Filtered satellites for fleet list
    const filteredSatellites = useMemo(() => {
        if (!catalog) return [];
        const q = searchQuery.trim().toLowerCase();

        return catalog.satellites.filter((sat) => {
            if (filterRegime !== "all") {
                const regime = getSatelliteRegime(sat.MEAN_MOTION);
                if (regime !== filterRegime) return false;
            }
            if (q.length > 0) {
                const nameMatch = sat.OBJECT_NAME.toLowerCase().includes(q);
                const noradMatch = String(sat.NORAD_CAT_ID).includes(q);
                const idMatch = sat.OBJECT_ID.toLowerCase().includes(q);
                return nameMatch || noradMatch || idMatch;
            }
            return true;
        });
    }, [catalog, filterRegime, searchQuery]);

    const status = errorMessage
        ? "error"
        : !catalog
            ? "loading-data"
            : !workerReady
                ? "preparing"
                : !positionFrame
                    ? "propagating"
                    : "ready";

    const statusLabel = {
        error: "SYSTEM ERROR",
        "loading-data": "DOWNLOADING OMM DATA",
        preparing: "PREPARING SGP4 RECORDS",
        propagating: "PROPAGATING ORBITS",
        ready: "LIVE PROPAGATION ACTIVE",
    }[status];

    const statusColor =
        status === "error"
            ? "bg-red-400"
            : status === "ready"
                ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                : "bg-amber-400 animate-pulse";

    if (errorMessage) {
        return (
            <section className="flex min-h-[640px] items-center justify-center rounded-2xl border border-red-500/30 bg-red-950/20 px-6 backdrop-blur-xl">
                <div className="max-w-lg text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <span className="font-mono text-2xl text-red-300">!</span>
                    </div>

                    <p className="font-mono text-xs font-semibold tracking-[0.2em] text-red-400">
                        ORBITAL CATALOG UNAVAILABLE
                    </p>

                    <h2 className="mt-3 text-xl font-bold text-white">
                        Unable to initialize catalog
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                        {errorMessage}
                    </p>

                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-6 rounded-xl border border-red-400/40 bg-red-500/15 px-6 py-2.5 font-mono text-xs font-semibold text-red-200 transition-all hover:bg-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                    >
                        RETRY CATALOG
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-[#020713] shadow-[0_30px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            {/* Top Mission Control Header */}
            <div className="flex flex-col gap-4 border-b border-cyan-500/20 bg-gradient-to-r from-slate-950 via-[#061224] to-slate-950 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className={["h-2.5 w-2.5 rounded-full", statusColor].join(" ")} />
                        <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-cyan-400">
                            {statusLabel}
                        </p>
                        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                            1,000+ SATELLITES
                        </span>
                    </div>

                    <h2 className="mt-1 font-mono text-lg font-bold tracking-tight text-white sm:text-xl">
                        Active Satellite Orbital Constellation Console
                    </h2>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-4">
                    <TelemetryBadge
                        label="TOTAL OBJECTS"
                        value={catalog ? catalog.count.toLocaleString() : "—"}
                        highlight="cyan"
                    />

                    <TelemetryBadge
                        label="PROPAGATED"
                        value={
                            positionFrame
                                ? positionFrame.validCount.toLocaleString()
                                : "—"
                        }
                        highlight="emerald"
                    />

                    <TelemetryBadge label="ENGINE" value="SGP4 / ECF" highlight="amber" />

                    <TelemetryBadge
                        label="CYCLE LATENCY"
                        value={positionFrame ? `${calculationLatencyMs} ms` : "—"}
                        highlight="purple"
                    />
                </div>
            </div>

            {/* Quick Interactive Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 bg-slate-950/90 px-4 py-3 sm:px-6">
                {/* Orbital Regime Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    <span className="mr-1 hidden text-[10px] uppercase tracking-wider text-slate-500 lg:inline">
                        REGIME:
                    </span>

                    <button
                        type="button"
                        onClick={() => setFilterRegime("all")}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-all",
                            filterRegime === "all"
                                ? "border-cyan-400 bg-cyan-500/20 font-bold text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white",
                        ].join(" ")}
                    >
                        <span>ALL</span>
                        <span className="rounded bg-slate-800/80 px-1 text-[9px] text-cyan-300">
                            {regimeCounts.all}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilterRegime("leo")}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-all",
                            filterRegime === "leo"
                                ? "border-cyan-400 bg-cyan-500/20 font-bold text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-cyan-300",
                        ].join(" ")}
                    >
                        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,1)]" />
                        <span>LEO (&lt; 2,000km)</span>
                        <span className="rounded bg-slate-800/80 px-1 text-[9px] text-cyan-300">
                            {regimeCounts.leo}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilterRegime("meo")}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-all",
                            filterRegime === "meo"
                                ? "border-amber-400 bg-amber-500/20 font-bold text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-amber-300",
                        ].join(" ")}
                    >
                        <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,1)]" />
                        <span>MEO / GNSS</span>
                        <span className="rounded bg-slate-800/80 px-1 text-[9px] text-amber-300">
                            {regimeCounts.meo}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setFilterRegime("geo")}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] transition-all",
                            filterRegime === "geo"
                                ? "border-purple-400 bg-purple-500/20 font-bold text-purple-200 shadow-[0_0_15px_rgba(192,132,252,0.3)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-purple-300",
                        ].join(" ")}
                    >
                        <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,1)]" />
                        <span>GEO BELT</span>
                        <span className="rounded bg-slate-800/80 px-1 text-[9px] text-purple-300">
                            {regimeCounts.geo}
                        </span>
                    </button>
                </div>

                {/* Right controls: Camera Preset & Sun toggle */}
                <div className="flex items-center gap-2">
                    <select
                        value={cameraPreset}
                        onChange={(e) => setCameraPreset(e.target.value)}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-[11px] text-slate-200 outline-none transition-colors hover:border-cyan-500/40 focus:border-cyan-400"
                        aria-label="Camera Angle Preset"
                    >
                        {CAMERA_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id} className="bg-slate-950 text-white">
                                {preset.label}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={() => setShowLighting((v) => !v)}
                        title="Toggle Sun Lighting / Atmosphere"
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-all",
                            showLighting
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                                : "border-slate-800 bg-slate-900/80 text-slate-500 hover:text-slate-300",
                        ].join(" ")}
                    >
                        <Sun className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">SUN LIGHT</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowFleetBrowser((v) => !v)}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all",
                            showFleetBrowser
                                ? "border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                : "border-slate-800 bg-slate-900/80 text-slate-300 hover:border-cyan-500/40 hover:text-white",
                        ].join(" ")}
                    >
                        <Layers className="h-3.5 w-3.5 text-cyan-400" />
                        <span>FLEET LIST ({filteredSatellites.length})</span>
                        {showFleetBrowser ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>

            {/* Search Input Bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-cyan-500/10 bg-[#030914] px-4 py-2 sm:px-6">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search 1,000+ satellites by name, NORAD ID, or International Designator..."
                        className="w-full rounded-lg border border-slate-800/90 bg-slate-950/80 py-1.5 pl-9 pr-8 font-mono text-xs text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-400/60 focus:bg-slate-950 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Quick search recommendation chips */}
                <div className="hidden flex-wrap items-center gap-1 sm:flex">
                    <span className="font-mono text-[10px] text-slate-600">QUICK:</span>
                    {QUICK_SEARCH_CHIPS.map((chip) => (
                        <button
                            key={chip.label}
                            type="button"
                            onClick={() => setSearchQuery(chip.query)}
                            className="rounded border border-slate-800 bg-slate-900/60 px-2 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3D Cesium Viewport & Floating HUD */}
            <div className="relative h-[640px] sm:h-[720px] lg:h-[780px] w-full">
                {catalog && positionFrame ? (
                    <>
                        <OrbitalCatalogGlobe
                            satellites={catalog.satellites}
                            positionsEcfKm={positionFrame.positionsEcfKm}
                            valid={positionFrame.valid}
                            selectedNoradId={selectedNoradId}
                            onSelectSatellite={(norad) => setSelectedNoradId(norad)}
                            filterRegime={filterRegime}
                            searchQuery={searchQuery}
                            cameraPreset={cameraPreset}
                            showLighting={showLighting}
                        />

                        {/* Floating Selected Satellite Telemetry Inspector Card */}
                        {selectedSatelliteData && (
                            <div className="absolute left-4 top-4 z-20 w-[340px] sm:w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-950/90 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-2xl transition-all">
                                <div className="flex items-start justify-between gap-3 border-b border-cyan-500/20 pb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                                            <SatIcon className="h-5 w-5 text-cyan-300" />
                                        </div>
                                        <div>
                                            <h3 className="font-mono text-sm font-bold tracking-wide text-white">
                                                {selectedSatelliteData.record.OBJECT_NAME}
                                            </h3>
                                            <p className="font-mono text-[10px] text-cyan-400">
                                                NORAD #{selectedSatelliteData.record.NORAD_CAT_ID} • {selectedSatelliteData.record.OBJECT_ID || "COSPAR"}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedNoradId(null)}
                                        className="rounded-lg border border-slate-800 p-1 text-slate-400 hover:border-slate-700 hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Telemetry Grid */}
                                <div className="mt-3.5 grid grid-cols-2 gap-2 font-mono text-[11px]">
                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">ALTITUDE</span>
                                        <strong className="mt-0.5 block text-sm text-cyan-300">
                                            {selectedSatelliteData.altKm ? `${selectedSatelliteData.altKm.toLocaleString()} km` : "—"}
                                        </strong>
                                    </div>

                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">SPEED (SGP4)</span>
                                        <strong className="mt-0.5 block text-sm text-emerald-300">
                                            {selectedSatelliteData.speedKmS ? `${selectedSatelliteData.speedKmS.toFixed(2)} km/s` : "—"}
                                        </strong>
                                        <span className="block text-[9px] text-slate-500">
                                            {selectedSatelliteData.speedKmH ? `${selectedSatelliteData.speedKmH.toLocaleString()} km/h` : ""}
                                        </span>
                                    </div>

                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">ORBITAL REGIME</span>
                                        <strong className="mt-0.5 block uppercase text-amber-300">
                                            {selectedSatelliteData.regime} ORBIT
                                        </strong>
                                    </div>

                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">PERIOD</span>
                                        <strong className="mt-0.5 block text-slate-200">
                                            {selectedSatelliteData.periodMin} min
                                        </strong>
                                    </div>

                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">INCLINATION</span>
                                        <strong className="mt-0.5 block text-slate-300">
                                            {selectedSatelliteData.record.INCLINATION.toFixed(2)}°
                                        </strong>
                                    </div>

                                    <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                                        <span className="block text-[10px] text-slate-500">ECCENTRICITY</span>
                                        <strong className="mt-0.5 block text-slate-300">
                                            {selectedSatelliteData.record.ECCENTRICITY.toFixed(6)}
                                        </strong>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="mt-4 flex items-center gap-2">
                                    {selectedSatelliteData.focusId && (
                                        <Link
                                            href={`/iss?sat=${selectedSatelliteData.focusId}`}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/20 py-2 font-mono text-xs font-bold text-cyan-200 transition-all hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            <span>FOCUS CONSOLE</span>
                                        </Link>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            const id = selectedNoradId;
                                            setSelectedNoradId(null);
                                            setTimeout(() => setSelectedNoradId(id), 50);
                                        }}
                                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 py-2 font-mono text-xs font-semibold text-slate-300 transition-all hover:border-slate-700 hover:text-white"
                                    >
                                        <Compass className="h-3.5 w-3.5 text-cyan-400" />
                                        <span>RE-CENTER CAMERA</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Collapsible Fleet List Drawer */}
                        {showFleetBrowser && (
                            <div className="absolute right-4 top-4 z-20 w-[320px] sm:w-[360px] max-h-[580px] overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl flex flex-col">
                                <div className="flex items-center justify-between border-b border-slate-800 p-3.5">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-cyan-400" />
                                        <span className="font-mono text-xs font-bold text-white">
                                            CATALOG FLEET MANIFEST
                                        </span>
                                        <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                                            {filteredSatellites.length}
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setShowFleetBrowser(false)}
                                        className="rounded-lg p-1 text-slate-400 hover:text-white"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="overflow-y-auto p-2 space-y-1.5 max-h-[500px]">
                                    {filteredSatellites.map((sat) => {
                                        const isSel = selectedNoradId === sat.NORAD_CAT_ID;
                                        const regime = getSatelliteRegime(sat.MEAN_MOTION);
                                        const badgeColor =
                                            regime === "leo"
                                                ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                                                : regime === "meo"
                                                    ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                                    : "text-purple-400 border-purple-500/30 bg-purple-500/10";

                                        return (
                                            <div
                                                key={sat.NORAD_CAT_ID}
                                                onClick={() => setSelectedNoradId(sat.NORAD_CAT_ID)}
                                                className={[
                                                    "cursor-pointer rounded-xl border p-2.5 transition-all flex items-center justify-between gap-3",
                                                    isSel
                                                        ? "border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                                        : "border-slate-800/80 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-900",
                                                ].join(" ")}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-mono text-xs font-bold text-white">
                                                        {sat.OBJECT_NAME}
                                                    </p>
                                                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                                                        NORAD #{sat.NORAD_CAT_ID} • {sat.MEAN_MOTION.toFixed(2)} rev/day
                                                    </p>
                                                </div>

                                                <span className={["rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase", badgeColor].join(" ")}>
                                                    {regime}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#020713]">
                        <div className="text-center">
                            <div className="relative mx-auto h-24 w-24">
                                <div className="absolute inset-0 animate-[spin_4s_linear_infinite] rounded-full border border-dashed border-cyan-400/30" />
                                <div className="absolute inset-4 animate-pulse rounded-full border border-cyan-400/40 bg-cyan-500/10" />
                                <div className="absolute inset-[40%] rounded-full bg-cyan-300 shadow-[0_0_25px_rgba(34,211,238,1)]" />
                            </div>

                            <p className="mt-6 font-mono text-sm font-bold tracking-[0.16em] text-cyan-300">
                                {statusLabel}
                            </p>

                            <p className="mt-2 font-mono text-xs text-slate-500">
                                {catalog
                                    ? `Propagating ${catalog.count.toLocaleString()} orbital state vectors with SGP4`
                                    : "Connecting to CelesTrak NORAD Ephemeris Relay"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Mission Control Telemetry Footer */}
            <footer className="grid gap-3 border-t border-cyan-500/20 bg-slate-950/95 px-4 py-3.5 font-mono text-[10px] text-slate-500 sm:grid-cols-4 sm:px-6">
                <div>
                    EPHEMERIS SOURCE:{" "}
                    <strong className="text-cyan-300">
                        {catalog?.source.name ?? "CELESTRAK"} (OMM)
                    </strong>
                </div>

                <div className="sm:text-center">
                    POSITION TIMESTAMP:{" "}
                    <strong className="text-slate-300">
                        {positionFrame
                            ? `${formatUtcTime(positionFrame.timestamp)} UTC`
                            : "—"}
                    </strong>
                </div>

                <div className="sm:text-center">
                    NEWEST EPOCH:{" "}
                    <strong className="text-slate-300">
                        {freshestEpoch
                            ? `${formatUtcTime(freshestEpoch)} UTC`
                            : "—"}
                    </strong>
                </div>

                <div className="sm:text-right">
                    COORDINATE FRAME:{" "}
                    <strong className="text-emerald-400">
                        WGS84 / ECF (3D)
                    </strong>
                </div>
            </footer>
        </section>
    );
}

interface TelemetryBadgeProps {
    label: string;
    value: string;
    highlight?: "cyan" | "emerald" | "amber" | "purple";
}

function TelemetryBadge({
    label,
    value,
    highlight = "cyan",
}: TelemetryBadgeProps) {
    const valueColor = {
        cyan: "text-cyan-300",
        emerald: "text-emerald-400",
        amber: "text-amber-300",
        purple: "text-purple-300",
    }[highlight];

    return (
        <div className="min-w-20 rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-2 shadow-inner">
            <span className="block text-[9px] text-slate-500">{label}</span>
            <strong className={["mt-0.5 block text-xs font-bold", valueColor].join(" ")}>
                {value}
            </strong>
        </div>
    );
}

