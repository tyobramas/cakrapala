"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Search,
    X,
    Sun,
    Layers,
    ChevronDown,
    ChevronUp,
    RefreshCw,
} from "lucide-react";
import {
    prepareSatelliteCatalog,
    propagateSatelliteCatalog,
    propagateSatelliteProfile,
    type PreparedSatellite,
} from "@/lib/satellites/catalogPropagation";
import { parseCelestrakOmmCatalog } from "@/lib/satellites/celestrakCatalog";
import {
    loadCachedCatalog,
    saveCachedCatalog,
    createSnapshotCatalogResponse,
} from "@/lib/satellites/catalogStorage";
import type {
    SatelliteCatalogResponse,
    SatelliteOmmRecord,
} from "@/lib/satellites/catalogTypes";
import type {
    CatalogWorkerInboundMessage,
    CatalogWorkerOutboundMessage,
    CatalogWorkerPositionMessage,
    SelectedSatelliteAnalysisMessage,
} from "@/lib/satellites/catalogWorkerTypes";
import { getSatelliteMedia } from "@/lib/satellites/satelliteMedia";
import type { OrbitalRegimeFilter } from "./OrbitalCatalogGlobe";
import { getSatelliteRegime } from "./OrbitalCatalogGlobe";
import SatelliteDetailPanel from "./SatelliteDetailPanel";

const PROPAGATION_INTERVAL_MS = 5_000;
const EMPTY_SATELLITES: readonly SatelliteOmmRecord[] = [];
const EMPTY_FLOAT64 = new Float64Array(0);
const EMPTY_UINT8 = new Uint8Array(0);

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
                        Loading Cesium & Preparing SGP4 Web Worker in Parallel
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
    25994: "terra",
    53883: "starlink",
};

type DataOrigin = "none" | "cache" | "snapshot" | "live";

export default function OrbitalCatalogClient() {
    const workerRef = useRef<Worker | null>(null);
    const fallbackPreparedRef = useRef<PreparedSatellite[] | null>(null);
    const propagationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const catalogRef = useRef<SatelliteCatalogResponse | null>(null);
    const dataOriginRef = useRef<DataOrigin>("none");
    const analysisRequestIdRef = useRef<number>(0);
    const selectedNoradIdRef = useRef<number | null>(null);

    const [catalog, setCatalog] = useState<SatelliteCatalogResponse | null>(null);
    const [dataOrigin, setDataOrigin] = useState<DataOrigin>("none");
    const [isLiveSyncing, setIsLiveSyncing] = useState<boolean>(true);
    const [positionFrame, setPositionFrame] = useState<CatalogWorkerPositionMessage | null>(null);
    const [workerReady, setWorkerReady] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
    const [analysisCache, setAnalysisCache] = useState<Record<string, SelectedSatelliteAnalysisMessage>>({});
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const [recenterCounter, setRecenterCounter] = useState(0);
    const [filterRegime, setFilterRegime] = useState<OrbitalRegimeFilter>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [cameraPreset, setCameraPreset] = useState("global");
    const [showLighting, setShowLighting] = useState(true);
    const [showFleetBrowser, setShowFleetBrowser] = useState(false);
    const [calculationLatencyMs, setCalculationLatencyMs] = useState(1.8);

    // Synchronize selectedNoradId to ref
    useEffect(() => {
        selectedNoradIdRef.current = selectedNoradId;
    }, [selectedNoradId]);

    // Handle single-satellite SGP4 analytics request
    useEffect(() => {
        if (!selectedNoradId || !catalog) {
            return;
        }

        const selectedSat = catalog.satellites.find(
            (s) => s.NORAD_CAT_ID === selectedNoradId
        );

        if (!selectedSat) {
            return;
        }

        const cacheKey = `${selectedNoradId}_${selectedSat.EPOCH}`;
        if (analysisCache[cacheKey]) {
            return;
        }

        const reqId = ++analysisRequestIdRef.current;
        const worker = workerRef.current;

        if (worker && workerReady) {
            setIsAnalyzing(true);
            const message: CatalogWorkerInboundMessage = {
                type: "analyze-selected",
                requestId: reqId,
                noradId: selectedNoradId,
                startTimestamp: Date.now(),
                sampleCount: 120,
            };
            worker.postMessage(message);
        } else if (fallbackPreparedRef.current) {
            // Main thread calculation fallback
            const prepared = fallbackPreparedRef.current.find(
                (s) => s.noradId === selectedNoradId
            );

            if (prepared) {
                const profile = propagateSatelliteProfile(
                    prepared,
                    Date.now(),
                    120,
                    reqId
                );
                setAnalysisCache((prev) => ({
                    ...prev,
                    [cacheKey]: profile,
                }));
            }
        }
    }, [selectedNoradId, catalog, workerReady, analysisCache]);

    const currentAnalysis = useMemo(() => {
        if (!selectedNoradId || !catalog) return null;
        const selectedSat = catalog.satellites.find(
            (s) => s.NORAD_CAT_ID === selectedNoradId
        );
        if (!selectedSat) return null;
        const cacheKey = `${selectedNoradId}_${selectedSat.EPOCH}`;
        return analysisCache[cacheKey] ?? null;
    }, [selectedNoradId, catalog, analysisCache]);

    // Main parallel orchestration effect
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

        const setupFallback = (satellites: readonly SatelliteOmmRecord[]) => {
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

                if (message.type === "selected-analysis") {
                    if (
                        message.requestId === analysisRequestIdRef.current &&
                        message.noradId === selectedNoradIdRef.current
                    ) {
                        const cacheKey = `${message.noradId}_${message.elementEpoch}`;
                        setAnalysisCache((prev) => ({
                            ...prev,
                            [cacheKey]: message,
                        }));
                        setIsAnalyzing(false);
                    }
                    return;
                }

                if (message.type === "error") {
                    console.warn("[OrbitalCatalogClient] Worker reported error, using fallback:", message.message);
                    if (catalogRef.current) {
                        setupFallback(catalogRef.current.satellites);
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
                if (catalogRef.current) {
                    setupFallback(catalogRef.current.satellites);
                }
            };
        }

        // Helper to push new catalog to UI, worker, and cache
        const applyCatalogData = (
            newCatalog: SatelliteCatalogResponse,
            origin: DataOrigin
        ) => {
            if (disposed) return;

            catalogRef.current = newCatalog;
            dataOriginRef.current = origin;
            setCatalog(newCatalog);
            setDataOrigin(origin);

            if (worker) {
                const message: CatalogWorkerInboundMessage = {
                    type: "initialize",
                    satellites: newCatalog.satellites,
                };
                worker.postMessage(message);
            } else {
                setupFallback(newCatalog.satellites);
            }
        };

        // 1. Check local cache (synchronous 0ms)
        const localCached = loadCachedCatalog();
        let hasInitialData = false;

        if (localCached && localCached.satellites.length > 0) {
            hasInitialData = true;
            applyCatalogData(localCached, "cache");
        }

        // 2. Fetch static snapshot in parallel if no local cache exists
        if (!hasInitialData) {
            fetch("/data/active-satellites-1000.json", { cache: "default" })
                .then((res) => {
                    if (!res.ok) {
                        throw new Error(`Snapshot fetch HTTP ${res.status}`);
                    }
                    return res.json();
                })
                .then((raw) => {
                    if (disposed) return;
                    const parsed = parseCelestrakOmmCatalog(raw);
                    if (parsed.length > 0) {
                        // Only apply snapshot if we haven't already received live data
                        if (dataOriginRef.current !== "live") {
                            const snapshotResponse = createSnapshotCatalogResponse(parsed);
                            applyCatalogData(snapshotResponse, "snapshot");
                        }
                    }
                })
                .catch((snapError: unknown) => {
                    console.warn("[OrbitalCatalogClient] Static snapshot load error:", snapError);
                });
        }

        // 3. Background live fetch from CelesTrak relay API
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
            .then((livePayload) => {
                if (disposed) return;
                setIsLiveSyncing(false);
                applyCatalogData(livePayload, "live");
                saveCachedCatalog(livePayload);
            })
            .catch((error: unknown) => {
                if (
                    disposed ||
                    (error instanceof DOMException &&
                        error.name === "AbortError")
                ) {
                    return;
                }

                setIsLiveSyncing(false);
                console.warn(
                    "[OrbitalCatalogClient] Live catalog fetch failed, retaining snapshot/cached data:",
                    error
                );

                // Only set error screen if we have completely 0 records from all tiers
                if (!catalogRef.current) {
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : "Unable to load orbital catalog"
                    );
                }
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

    // Selected satellite media
    const selectedMedia = useMemo(() => {
        return getSatelliteMedia(selectedNoradId);
    }, [selectedNoradId]);

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

    const statusLabel =
        dataOrigin === "live"
            ? "LIVE SGP4 PROPAGATION"
            : dataOrigin === "cache"
                ? "LOCAL CACHED DATA"
                : dataOrigin === "snapshot"
                    ? "SNAPSHOT DATA (1,000 SATS)"
                    : "INITIALIZING ENGINE";

    const statusColor =
        dataOrigin === "live"
            ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            : dataOrigin === "cache"
                ? "bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                : "bg-amber-400 animate-pulse";

    if (errorMessage && !catalog) {
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
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className={["h-2.5 w-2.5 rounded-full", statusColor].join(" ")} />
                        <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-cyan-400">
                            {statusLabel}
                        </p>
                        <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                            {catalog ? `${catalog.count.toLocaleString()} SATELLITES` : "1,000+ SATELLITES"}
                        </span>
                        {catalog?.metadataSource?.available ? (
                            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                                SATCAT ENRICHED
                            </span>
                        ) : null}
                        {isLiveSyncing && (
                            <span className="flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                                <RefreshCw className="h-2.5 w-2.5 animate-spin text-cyan-400" />
                                <span>SYNCING LIVE...</span>
                            </span>
                        )}
                    </div>

                    <h2 className="mt-1 font-mono text-lg font-bold tracking-tight text-white sm:text-xl">
                        Active Satellite Orbital Constellation Console
                    </h2>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] sm:grid-cols-4">
                    <TelemetryBadge
                        label="TOTAL OBJECTS"
                        value={catalog ? catalog.count.toLocaleString() : "1,000"}
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
                    {/* Camera Presets Selector */}
                    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5">
                        {CAMERA_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setCameraPreset(preset.id)}
                                className={[
                                    "rounded px-2.5 py-1 font-mono text-[10px] font-semibold transition-all",
                                    cameraPreset === preset.id
                                        ? "bg-cyan-500/25 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                                        : "text-slate-400 hover:text-slate-200",
                                ].join(" ")}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Sunlight Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowLighting((l) => !l)}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-all",
                            showLighting
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-500 hover:text-slate-300",
                        ].join(" ")}
                        title="Toggle Real-Time Sunlight & Earth Day/Night Terminator"
                    >
                        <Sun className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">SUNLIGHT</span>
                    </button>

                    {/* Fleet Manifest Drawer Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowFleetBrowser((b) => !b)}
                        className={[
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-all",
                            showFleetBrowser
                                ? "border-cyan-400 bg-cyan-500/20 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white",
                        ].join(" ")}
                    >
                        <Layers className="h-3.5 w-3.5 text-cyan-400" />
                        <span>FLEET LIST</span>
                        {showFleetBrowser ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Quick Search & Search Chips Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/15 bg-slate-950/70 px-4 py-2.5 sm:px-6">
                <div className="relative flex-1 max-w-lg">
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
                <OrbitalCatalogGlobe
                    satellites={catalog?.satellites ?? EMPTY_SATELLITES}
                    positionsEcfKm={positionFrame?.positionsEcfKm ?? EMPTY_FLOAT64}
                    valid={positionFrame?.valid ?? EMPTY_UINT8}
                    selectedNoradId={selectedNoradId}
                    selectedAnalysis={currentAnalysis}
                    onSelectSatellite={(norad) => setSelectedNoradId(norad)}
                    filterRegime={filterRegime}
                    searchQuery={searchQuery}
                    cameraPreset={cameraPreset}
                    showLighting={showLighting}
                    recenterCounter={recenterCounter}
                />

                {/* Initializing telemetry banner if positions are still computing */}
                {!positionFrame && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
                        <div className="flex items-center gap-2.5 rounded-full border border-cyan-500/40 bg-slate-950/85 px-4 py-1.5 shadow-[0_0_25px_rgba(6,182,212,0.3)] backdrop-blur-md">
                            <span className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                            <span className="font-mono text-xs font-semibold tracking-wider text-cyan-300">
                                {dataOrigin === "none"
                                    ? "PARSING 1,000 ORBITAL ELEMENTS..."
                                    : "COMPUTING REAL-TIME SGP4 ORBITS..."}
                            </span>
                        </div>
                    </div>
                )}

                {/* Floating Selected Satellite Detail Panel */}
                {selectedSatelliteData && (
                    <div className="absolute left-4 top-4 z-20">
                        <SatelliteDetailPanel
                            satellite={selectedSatelliteData.record}
                            livePosition={{
                                altKm: selectedSatelliteData.altKm,
                                speedKmS: selectedSatelliteData.speedKmS,
                                speedKmH: selectedSatelliteData.speedKmH,
                            }}
                            analysis={currentAnalysis}
                            isAnalyzing={isAnalyzing && !currentAnalysis}
                            media={selectedMedia}
                            focusId={selectedSatelliteData.focusId}
                            onClose={() => setSelectedNoradId(null)}
                            onRecenterCamera={() => setRecenterCounter((c) => c + 1)}
                        />
                    </div>
                )}

                {/* Collapsible Fleet List Drawer */}
                {showFleetBrowser && catalog && (
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
            </div>

            {/* Mission Control Telemetry Footer */}
            <footer className="grid gap-3 border-t border-cyan-500/20 bg-slate-950/95 px-4 py-3.5 font-mono text-[10px] text-slate-500 sm:grid-cols-4 sm:px-6">
                <div>
                    EPHEMERIS SOURCE:{" "}
                    <strong className="text-cyan-300">
                        {catalog?.source.name ?? "CELESTRAK"} ({dataOrigin.toUpperCase()})
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
                    OMM EPOCH:{" "}
                    <strong className="text-amber-300">
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
