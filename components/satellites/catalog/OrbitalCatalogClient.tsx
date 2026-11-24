"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ArrowLeft,
    Search,
    X,
    Sun,
    Layers,
    Radio,
    RefreshCw,
    PanelRightClose,
    PanelRightOpen,
    Globe2,
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
import ObservatoryLoader from "@/components/ui/ObservatoryLoader";

const PROPAGATION_INTERVAL_MS = 5_000;
const EMPTY_SATELLITES: readonly SatelliteOmmRecord[] = [];
const EMPTY_FLOAT64 = new Float64Array(0);
const EMPTY_UINT8 = new Uint8Array(0);

const OrbitalCatalogGlobe = dynamic(
    () => import("@/components/satellites/catalog/OrbitalCatalogGlobe"),
    {
        ssr: false,
        loading: () => (
            <ObservatoryLoader
                variant="fullscreen"
                title="CAKRAPALA"
                subtitle="Initializing 1,000+ SGP4 orbital catalog"
            />
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
    { id: "global", label: "Global" },
    { id: "polar", label: "Polar" },
    { id: "geo", label: "GEO Belt" },
    { id: "asia", label: "Asia" },
    { id: "americas", label: "Americas" },
    { id: "europe", label: "Europe" },
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
    const [showFleetBrowser, setShowFleetBrowser] = useState(true);
    const [calculationLatencyMs, setCalculationLatencyMs] = useState(1.8);

    // Collapse right catalog drawer automatically on narrow viewports so 3D globe stays open
    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            queueMicrotask(() => setShowFleetBrowser(false));
        }
    }, []);

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
            ? "CelesTrak Live"
            : dataOrigin === "cache"
                ? "Cached OMM"
                : dataOrigin === "snapshot"
                    ? "Verified Snapshot"
                    : "Syncing";

    const statusDotClass =
        dataOrigin === "live"
            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]"
            : dataOrigin === "cache"
                ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                : "bg-amber-400 animate-pulse";

    if (errorMessage && !catalog) {
        return (
            <section className="flex h-[100dvh] w-screen items-center justify-center bg-[#02040a] px-6">
                <div className="max-w-md rounded-2xl border border-rose-500/25 bg-[#030714]/85 p-6 text-center backdrop-blur-2xl">
                    <p className="font-mono text-[10px] font-semibold tracking-[0.22em] text-rose-400 uppercase">
                        Orbital Catalog Unavailable
                    </p>
                    <h2 className="mt-2 font-sans text-lg font-semibold text-white">
                        Unable to initialize SGP4 catalog
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        {errorMessage}
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-5 cursor-pointer rounded-full border border-white/15 bg-white/[0.08] px-5 py-2 font-mono text-[10.5px] font-medium tracking-wider text-white uppercase transition-colors hover:bg-white/[0.15]"
                    >
                        Retry Catalog
                    </button>
                </div>
            </section>
        );
    }

    const displayedFleet = filteredSatellites.slice(0, 220);

    return (
        <section className="relative h-[100dvh] w-screen overflow-hidden bg-[#02040a] font-sans text-slate-100 select-none">
            {/* ── 1. Full-Viewport Edge-to-Edge 3D CesiumJS Orbital Globe ────── */}
            <div className="absolute inset-0">
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
            </div>

            {/* ── 2. Corner-Pinned Compact Top Header Bar ────────────────────── */}
            <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-2 pt-2 sm:px-2.5 sm:pt-2.5">
                <div className="pointer-events-auto flex w-full items-center justify-between gap-2">
                    {/* Top-Left Corner Capsule */}
                    <div className="flex h-8 shrink-0 items-center rounded-full border border-white/[0.10] bg-[#030714]/72 p-0.5 pr-3 backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
                        <Link
                            href="/"
                            aria-label="Back to Home"
                            title="Back to Home"
                            className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
                        >
                            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                        </Link>

                        <span className="mx-1 h-3.5 w-px bg-white/[0.12]" />

                        <div className="flex items-center gap-1.5 pl-1">
                            <Image
                                src="/cakrapala1.png"
                                alt="Cakrapala"
                                width={18}
                                height={18}
                                className="h-[18px] w-[18px] rounded-full object-contain opacity-95"
                            />
                            <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-medium tracking-[0.18em] text-white/95">
                                SATELLITES
                            </span>
                        </div>
                    </div>

                    {/* Top-Center: Mode Switcher + Compact Live SGP4 Status Pill */}
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-8 items-center rounded-full border border-white/[0.10] bg-[#030714]/72 p-0.5 font-mono text-[10px] backdrop-blur-2xl shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
                            <Link
                                href="/satellites"
                                className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-medium tracking-wider text-slate-400 uppercase transition-colors hover:bg-white/[0.06] hover:text-white"
                            >
                                <Radio className="h-3 w-3" />
                                <span>Focus</span>
                            </Link>
                            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.14] px-3 font-medium tracking-wider text-white uppercase">
                                <Layers className="h-3 w-3 text-sky-300" />
                                <span className="hidden sm:inline">Catalog 1,000+</span>
                                <span className="sm:hidden">1k+</span>
                            </span>
                        </div>

                        <div className="hidden h-8 items-center gap-2 rounded-full border border-white/[0.09] bg-[#030714]/68 px-3 font-mono text-[10px] text-slate-300 backdrop-blur-2xl xl:flex">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                            <span className="text-white/90">{statusLabel}</span>
                            <span className="text-white/20">·</span>
                            <span className="tabular-nums text-sky-300">
                                {positionFrame
                                    ? `${positionFrame.validCount.toLocaleString()} live`
                                    : catalog
                                        ? `${catalog.count.toLocaleString()} loaded`
                                        : "Loading"}
                            </span>
                            {positionFrame && (
                                <>
                                    <span className="text-white/20">·</span>
                                    <span className="tabular-nums text-slate-400">
                                        {calculationLatencyMs} ms
                                    </span>
                                </>
                            )}
                            {catalog?.metadataSource?.available && (
                                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8.5px] font-medium text-emerald-300">
                                    SATCAT
                                </span>
                            )}
                            {isLiveSyncing && (
                                <RefreshCw className="h-3 w-3 animate-spin text-sky-300" />
                            )}
                        </div>
                    </div>

                    {/* Top-Right: Sunlight Terminator Toggle + Catalog Drawer Toggle */}
                    <div className="flex shrink-0 items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setShowLighting((l) => !l)}
                            title="Toggle Real-Time Sunlight & Earth Day/Night Terminator"
                            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-medium uppercase backdrop-blur-2xl transition-all ${
                                showLighting
                                    ? "border-amber-400/35 bg-amber-400/15 text-amber-200"
                                    : "border-white/[0.10] bg-[#030714]/72 text-slate-400 hover:border-white/25 hover:text-white"
                            }`}
                        >
                            <Sun className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Day/Night</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowFleetBrowser((b) => !b)}
                            title="Toggle Satellite Search & Constellation Browser"
                            className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] font-medium tracking-wider uppercase backdrop-blur-2xl transition-all ${
                                showFleetBrowser
                                    ? "border-white/25 bg-white/[0.12] text-white"
                                    : "border-white/[0.10] bg-[#030714]/72 text-slate-300 hover:border-white/25 hover:text-white"
                            }`}
                        >
                            {showFleetBrowser ? (
                                <PanelRightClose className="h-3.5 w-3.5" />
                            ) : (
                                <PanelRightOpen className="h-3.5 w-3.5" />
                            )}
                            <span className="hidden sm:inline">Explorer</span>
                            <span className="rounded-full bg-white/[0.10] px-1.5 py-0.5 text-[9px] tabular-nums text-sky-200">
                                {filteredSatellites.length.toLocaleString()}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ── 3. Computing Pill (only while initial SGP4 worker warms up) ── */}
            {!positionFrame && (
                <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-[#030714]/82 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.14em] text-sky-200 uppercase backdrop-blur-2xl shadow-xl">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
                        <span>
                            {dataOrigin === "none"
                                ? "Parsing OMM elements..."
                                : "Propagating SGP4 orbits..."}
                        </span>
                    </div>
                </div>
            )}

            {/* ── 4. Left Floating Selected Satellite Detail Inspector ───────── */}
            {selectedSatelliteData && (
                <div className="fixed top-13 bottom-14 left-2.5 z-30 flex items-start">
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

            {/* ── 5. Right Floating Compact Search & Fleet Browser Drawer ───── */}
            <aside
                className={`fixed top-13 right-2.5 bottom-2.5 z-30 w-[calc(100vw-20px)] max-w-[336px] transition-all duration-200 ease-out ${
                    showFleetBrowser
                        ? "translate-x-0 opacity-100 pointer-events-auto"
                        : "translate-x-[110%] opacity-0 pointer-events-none"
                }`}
            >
                <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-[#030714]/80 backdrop-blur-2xl shadow-[0_24px_68px_rgba(0,0,0,0.72)]">
                    {/* Search, Quick Constellations & Regime Filters */}
                    <div className="space-y-2 border-b border-white/[0.08] p-3">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="flex items-center gap-1.5 font-semibold tracking-[0.16em] text-white/90 uppercase">
                                <Globe2 className="h-3 w-3 text-sky-300" />
                                Orbital Explorer
                            </span>
                            <span className="text-[9.5px] text-slate-400 tabular-nums">
                                {filteredSatellites.length.toLocaleString()} / {regimeCounts.all.toLocaleString()}
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search name, NORAD ID, COSPAR..."
                                className="h-8 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pr-7 pl-8 font-mono text-[11px] text-white placeholder:text-slate-500 focus:border-sky-400/45 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-white"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>

                        {/* Quick Constellation Chips */}
                        <div className="flex flex-wrap items-center gap-1 font-mono text-[9px]">
                            {QUICK_SEARCH_CHIPS.map((chip) => {
                                const isActiveChip =
                                    searchQuery.trim().toUpperCase() === chip.query;
                                return (
                                    <button
                                        key={chip.label}
                                        type="button"
                                        onClick={() =>
                                            setSearchQuery(isActiveChip ? "" : chip.query)
                                        }
                                        className={`cursor-pointer rounded-md border px-1.5 py-0.5 transition-colors ${
                                            isActiveChip
                                                ? "border-sky-400/45 bg-sky-400/18 text-sky-200"
                                                : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.16] hover:text-white"
                                        }`}
                                    >
                                        {chip.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Orbital Regime Filter Tabs */}
                        <div className="grid grid-cols-4 gap-1 font-mono text-[9.5px]">
                            {[
                                {
                                    id: "all" as const,
                                    label: "All",
                                    count: regimeCounts.all,
                                    dot: "bg-white/70",
                                    active: "border-white/25 bg-white/[0.13] text-white",
                                },
                                {
                                    id: "leo" as const,
                                    label: "LEO",
                                    count: regimeCounts.leo,
                                    dot: "bg-sky-400",
                                    active: "border-sky-400/45 bg-sky-400/18 text-sky-200",
                                },
                                {
                                    id: "meo" as const,
                                    label: "MEO",
                                    count: regimeCounts.meo,
                                    dot: "bg-amber-400",
                                    active: "border-amber-400/45 bg-amber-400/18 text-amber-200",
                                },
                                {
                                    id: "geo" as const,
                                    label: "GEO",
                                    count: regimeCounts.geo,
                                    dot: "bg-purple-400",
                                    active: "border-purple-400/45 bg-purple-400/18 text-purple-200",
                                },
                            ].map((r) => {
                                const isAct = filterRegime === r.id;
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setFilterRegime(r.id)}
                                        className={`flex cursor-pointer flex-col items-center rounded-lg border py-1 transition-all ${
                                            isAct
                                                ? r.active
                                                : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.15] hover:text-slate-200"
                                        }`}
                                    >
                                        <span className="flex items-center gap-1 font-semibold">
                                            <span className={`h-1.5 w-1.5 rounded-full ${r.dot}`} />
                                            {r.label}
                                        </span>
                                        <span className="text-[8.5px] opacity-75 tabular-nums">
                                            {r.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Fast Scrollable Satellite List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
                        {displayedFleet.length === 0 ? (
                            <div className="py-12 text-center font-mono text-[11px] text-slate-500">
                                No satellites match filter
                            </div>
                        ) : (
                            displayedFleet.map((sat) => {
                                const isSel = selectedNoradId === sat.NORAD_CAT_ID;
                                const regime = getSatelliteRegime(sat.MEAN_MOTION);
                                const regimeStyle =
                                    regime === "leo"
                                        ? "border-sky-400/30 bg-sky-400/12 text-sky-300"
                                        : regime === "meo"
                                            ? "border-amber-400/30 bg-amber-400/12 text-amber-300"
                                            : "border-purple-400/30 bg-purple-400/12 text-purple-300";

                                return (
                                    <button
                                        key={sat.NORAD_CAT_ID}
                                        type="button"
                                        onClick={() => setSelectedNoradId(sat.NORAD_CAT_ID)}
                                        className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                                            isSel
                                                ? "bg-sky-400/[0.14]"
                                                : "hover:bg-white/[0.04]"
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-mono text-[11.5px] font-semibold text-white">
                                                {sat.OBJECT_NAME}
                                            </p>
                                            <p className="mt-0.5 font-mono text-[9.5px] text-slate-400 tabular-nums">
                                                #{sat.NORAD_CAT_ID} · {sat.INCLINATION.toFixed(1)}° ·{" "}
                                                {sat.MEAN_MOTION.toFixed(2)} rev/d
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase ${regimeStyle}`}
                                        >
                                            {regime}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                        {filteredSatellites.length > displayedFleet.length && (
                            <div className="px-3 py-2 text-center font-mono text-[9.5px] text-slate-500">
                                Showing first {displayedFleet.length} of{" "}
                                {filteredSatellites.length.toLocaleString()} — type to narrow search
                            </div>
                        )}
                    </div>

                    {/* Compact Ephemeris Metadata Footer */}
                    <div className="flex items-center justify-between border-t border-white/[0.07] bg-white/[0.02] px-3 py-1.5 font-mono text-[9px] text-slate-500">
                        <span>WGS84 · SGP4 Worker</span>
                        <span className="tabular-nums">
                            {freshestEpoch ? `OMM ${formatUtcTime(freshestEpoch).slice(0, 17)}Z` : "Syncing"}
                        </span>
                    </div>
                </div>
            </aside>

            {/* ── 6. Bottom-Center Compact Floating Camera Presets Dock ──────── */}
            <div
                className={`pointer-events-none fixed bottom-3 left-1/2 z-20 -translate-x-1/2 transition-all duration-200 ${
                    showFleetBrowser ? "lg:-translate-x-[calc(50%+168px)]" : ""
                }`}
            >
                <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/[0.10] bg-[#030714]/76 p-1 font-mono text-[10px] backdrop-blur-2xl shadow-[0_14px_40px_rgba(0,0,0,0.65)]">
                    {CAMERA_PRESETS.map((preset) => {
                        const active = cameraPreset === preset.id;
                        return (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setCameraPreset(preset.id)}
                                className={`h-7 cursor-pointer rounded-full px-2.5 font-medium transition-all ${
                                    active
                                        ? "bg-white/[0.14] text-white"
                                        : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                                }`}
                            >
                                {preset.label}
                            </button>
                        );
                    })}
                    {positionFrame && (
                        <span className="hidden border-l border-white/[0.10] pr-2.5 pl-2.5 text-[9.5px] text-slate-400 tabular-nums md:inline">
                            {formatUtcTime(positionFrame.timestamp).slice(12)} UTC
                        </span>
                    )}
                </div>
            </div>
        </section>
    );
}
