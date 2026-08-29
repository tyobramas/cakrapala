"use client";

import { useEffect, useRef } from "react";
import type { SatelliteOmmRecord } from "@/lib/satellites/catalogTypes";
import {
    buildViewerOptions,
    getCesiumToken,
    hasCesiumToken,
    setCesiumBaseUrl,
} from "@/lib/cesium/viewerConfig";

export type OrbitalRegimeFilter = "all" | "leo" | "meo" | "geo";

export interface OrbitalCatalogGlobeProps {
    satellites: readonly SatelliteOmmRecord[];
    positionsEcfKm: Float64Array;
    valid: Uint8Array;
    selectedNoradId?: number | null;
    onSelectSatellite?: (noradId: number | null) => void;
    filterRegime?: OrbitalRegimeFilter;
    searchQuery?: string;
    cameraPreset?: string;
    showLighting?: boolean;
}

interface LatestPositionFrame {
    positionsEcfKm: Float64Array;
    valid: Uint8Array;
}

export function getSatelliteRegime(meanMotion: number): "leo" | "meo" | "geo" {
    if (meanMotion >= 11.25) return "leo";
    if (meanMotion > 1.2) return "meo";
    return "geo";
}

function getPointColor(
    Cesium: typeof import("cesium"),
    meanMotion: number,
    isSelected: boolean
): import("cesium").Color {
    if (isSelected) {
        return Cesium.Color.fromCssColorString("#ffffff");
    }

    // LEO: orbital period shorter than 128 minutes (~11.25 rev/day).
    if (meanMotion >= 11.25) {
        return Cesium.Color.fromCssColorString("#06b6d4"); // Cyan
    }

    // MEO and intermediate regimes.
    if (meanMotion > 1.2) {
        return Cesium.Color.fromCssColorString("#f59e0b"); // Amber
    }

    // GEO and deep-space orbits.
    return Cesium.Color.fromCssColorString("#c084fc"); // Purple/Violet
}

function applyPositionFrame(
    Cesium: typeof import("cesium"),
    viewer: import("cesium").Viewer,
    points: import("cesium").PointPrimitiveCollection,
    satellites: readonly SatelliteOmmRecord[],
    frame: LatestPositionFrame,
    filterRegime: OrbitalRegimeFilter,
    searchQuery: string,
    selectedNoradId: number | null
): void {
    const availablePositions = Math.floor(
        frame.positionsEcfKm.length / 3
    );

    const count = Math.min(
        points.length,
        frame.valid.length,
        satellites.length,
        availablePositions
    );

    const normalizedQuery = searchQuery.trim().toLowerCase();

    for (let index = 0; index < count; index += 1) {
        const point = points.get(index);
        const satellite = satellites[index];

        if (frame.valid[index] !== 1 || !satellite) {
            point.show = false;
            continue;
        }

        // Apply regime filter
        if (filterRegime !== "all") {
            const regime = getSatelliteRegime(satellite.MEAN_MOTION);
            if (regime !== filterRegime) {
                point.show = false;
                continue;
            }
        }

        // Apply search query filter
        if (normalizedQuery.length > 0) {
            const nameMatch = satellite.OBJECT_NAME.toLowerCase().includes(normalizedQuery);
            const noradMatch = String(satellite.NORAD_CAT_ID).includes(normalizedQuery);
            const idMatch = satellite.OBJECT_ID.toLowerCase().includes(normalizedQuery);
            if (!nameMatch && !noradMatch && !idMatch) {
                point.show = false;
                continue;
            }
        }

        const offset = index * 3;
        const xMeters = frame.positionsEcfKm[offset] * 1000;
        const yMeters = frame.positionsEcfKm[offset + 1] * 1000;
        const zMeters = frame.positionsEcfKm[offset + 2] * 1000;

        if (
            !Number.isFinite(xMeters) ||
            !Number.isFinite(yMeters) ||
            !Number.isFinite(zMeters)
        ) {
            point.show = false;
            continue;
        }

        const isSelected = selectedNoradId === satellite.NORAD_CAT_ID;

        point.position = new Cesium.Cartesian3(
            xMeters,
            yMeters,
            zMeters
        );

        point.pixelSize = isSelected ? 8 : 4;
        point.color = getPointColor(Cesium, satellite.MEAN_MOTION, isSelected);
        point.outlineColor = isSelected
            ? Cesium.Color.fromCssColorString("#38bdf8")
            : Cesium.Color.fromCssColorString("#020617");
        point.outlineWidth = isSelected ? 2 : 1;
        point.show = true;
    }

    for (let index = count; index < points.length; index += 1) {
        points.get(index).show = false;
    }

    viewer.scene.requestRender();
}

export default function OrbitalCatalogGlobe({
    satellites,
    positionsEcfKm,
    valid,
    selectedNoradId = null,
    onSelectSatellite,
    filterRegime = "all",
    searchQuery = "",
    cameraPreset = "global",
    showLighting = true,
}: OrbitalCatalogGlobeProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const viewerRef = useRef<import("cesium").Viewer | null>(null);
    const pointCollectionRef = useRef<import("cesium").PointPrimitiveCollection | null>(null);
    const handlerRef = useRef<import("cesium").ScreenSpaceEventHandler | null>(null);

    const latestFrameRef = useRef<LatestPositionFrame>({
        positionsEcfKm,
        valid,
    });

    const satellitesRef = useRef(satellites);
    satellitesRef.current = satellites;

    const onSelectSatelliteRef = useRef(onSelectSatellite);
    onSelectSatelliteRef.current = onSelectSatellite;

    // Update positions & filters
    useEffect(() => {
        latestFrameRef.current = {
            positionsEcfKm,
            valid,
        };

        const viewer = viewerRef.current;
        const pointCollection = pointCollectionRef.current;

        if (!viewer || !pointCollection || viewer.isDestroyed()) {
            return;
        }

        void import("cesium").then((Cesium) => {
            if (viewer.isDestroyed()) {
                return;
            }

            applyPositionFrame(
                Cesium,
                viewer,
                pointCollection,
                satellites,
                latestFrameRef.current,
                filterRegime,
                searchQuery,
                selectedNoradId
            );
        });
    }, [positionsEcfKm, valid, filterRegime, searchQuery, selectedNoradId, satellites]);

    // Handle lighting toggle
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;
        viewer.scene.globe.enableLighting = showLighting;
        viewer.scene.requestRender();
    }, [showLighting]);

    // Handle camera presets
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;

        void import("cesium").then((Cesium) => {
            if (viewer.isDestroyed()) return;

            switch (cameraPreset) {
                case "polar":
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(0, 88, 28_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-89),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
                case "geo":
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(105, 0, 58_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-90),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
                case "asia":
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(115, 5, 18_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-90),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
                case "americas":
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(-90, 20, 18_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-90),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
                case "europe":
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(15, 35, 18_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-90),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
                case "global":
                default:
                    viewer.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(105, 5, 25_000_000),
                        orientation: {
                            heading: 0,
                            pitch: Cesium.Math.toRadians(-90),
                            roll: 0,
                        },
                        duration: 1.5,
                    });
                    break;
            }
        });
    }, [cameraPreset]);

    // Fly to selected satellite
    useEffect(() => {
        if (!selectedNoradId) return;

        const viewer = viewerRef.current;
        if (!viewer || viewer.isDestroyed()) return;

        const satelliteIndex = satellites.findIndex((s) => s.NORAD_CAT_ID === selectedNoradId);
        if (satelliteIndex === -1) return;

        const offset = satelliteIndex * 3;
        const xKm = positionsEcfKm[offset];
        const yKm = positionsEcfKm[offset + 1];
        const zKm = positionsEcfKm[offset + 2];

        if (!Number.isFinite(xKm) || !Number.isFinite(yKm) || !Number.isFinite(zKm)) return;

        void import("cesium").then((Cesium) => {
            if (viewer.isDestroyed()) return;
            const targetPos = new Cesium.Cartesian3(xKm * 1000, yKm * 1000, zKm * 1000);
            const cartographic = Cesium.Cartographic.fromCartesian(targetPos);
            const latDeg = Cesium.Math.toDegrees(cartographic.latitude);
            const lonDeg = Cesium.Math.toDegrees(cartographic.longitude);
            const altMeters = cartographic.height;

            viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    lonDeg,
                    latDeg,
                    Math.max(altMeters * 2.2, 4_000_000)
                ),
                duration: 1.6,
            });
        });
    }, [selectedNoradId, satellites, positionsEcfKm]);

    // Initialize Cesium Viewer & Event Handling
    useEffect(() => {
        const container = containerRef.current;
        if (!container || viewerRef.current) {
            return;
        }

        let disposed = false;
        let createdViewer: import("cesium").Viewer | null = null;

        setCesiumBaseUrl();

        void import("cesium")
            .then(async (Cesium) => {
                if (disposed) {
                    return;
                }

                if (hasCesiumToken()) {
                    Cesium.Ion.defaultAccessToken = getCesiumToken();
                }

                let baseLayer: import("cesium").ImageryLayer | undefined;

                if (!hasCesiumToken()) {
                    const imageryProvider =
                        await Cesium.TileMapServiceImageryProvider.fromUrl(
                            Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
                        );

                    if (disposed) {
                        return;
                    }

                    baseLayer = new Cesium.ImageryLayer(imageryProvider);
                }

                const viewer = new Cesium.Viewer(container, {
                    ...buildViewerOptions(),
                    ...(baseLayer ? { baseLayer } : {}),
                });

                createdViewer = viewer;
                viewerRef.current = viewer;

                viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#01040d");
                viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#07111f");
                viewer.scene.globe.enableLighting = showLighting;
                viewer.scene.globe.depthTestAgainstTerrain = true;
                viewer.scene.fog.enabled = true;

                const pointCollection = viewer.scene.primitives.add(
                    new Cesium.PointPrimitiveCollection({
                        blendOption: Cesium.BlendOption.OPAQUE,
                    })
                );

                pointCollectionRef.current = pointCollection;

                for (let index = 0; index < satellitesRef.current.length; index += 1) {
                    const satellite = satellitesRef.current[index];

                    pointCollection.add({
                        id: {
                            kind: "catalog-satellite",
                            index,
                            noradId: satellite.NORAD_CAT_ID,
                        },
                        position: Cesium.Cartesian3.ZERO,
                        show: false,
                        pixelSize: 4,
                        color: getPointColor(Cesium, satellite.MEAN_MOTION, false),
                        outlineColor: Cesium.Color.fromCssColorString("#020617"),
                        outlineWidth: 1,
                        scaleByDistance: new Cesium.NearFarScalar(
                            2_000_000,
                            1.6,
                            80_000_000,
                            0.65
                        ),
                    });
                }

                applyPositionFrame(
                    Cesium,
                    viewer,
                    pointCollection,
                    satellitesRef.current,
                    latestFrameRef.current,
                    filterRegime,
                    searchQuery,
                    selectedNoradId
                );

                // Initial camera view
                viewer.camera.setView({
                    destination: Cesium.Cartesian3.fromDegrees(105, 5, 25_000_000),
                    orientation: {
                        heading: 0,
                        pitch: Cesium.Math.toRadians(-90),
                        roll: 0,
                    },
                });

                // Setup Click Handler for Picking Satellites
                const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
                handlerRef.current = handler;

                handler.setInputAction((movement: { position: import("cesium").Cartesian2 }) => {
                    const pickedObject = viewer.scene.pick(movement.position);
                    if (
                        Cesium.defined(pickedObject) &&
                        pickedObject.id &&
                        typeof pickedObject.id === "object" &&
                        pickedObject.id.kind === "catalog-satellite"
                    ) {
                        const pickedNorad = pickedObject.id.noradId;
                        if (typeof pickedNorad === "number" && onSelectSatelliteRef.current) {
                            onSelectSatelliteRef.current(pickedNorad);
                        }
                    }
                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                viewer.scene.requestRender();
            })
            .catch((error: unknown) => {
                console.error("[OrbitalCatalogGlobe] initialization failed:", error);
            });

        return () => {
            disposed = true;

            if (handlerRef.current && !handlerRef.current.isDestroyed()) {
                handlerRef.current.destroy();
                handlerRef.current = null;
            }

            pointCollectionRef.current = null;
            viewerRef.current = null;

            if (createdViewer && !createdViewer.isDestroyed()) {
                createdViewer.destroy();
            }
        };
    }, []);

    return (
        <div className="relative h-full w-full">
            <div
                ref={containerRef}
                className="orbital-catalog-cesium h-[640px] w-full bg-[#01040d] sm:h-[720px] lg:h-[780px]"
                aria-label="Interactive 3D active satellite orbital catalog"
            />

            <style jsx global>{`
                .orbital-catalog-cesium,
                .orbital-catalog-cesium .cesium-viewer,
                .orbital-catalog-cesium .cesium-viewer-cesiumWidgetContainer,
                .orbital-catalog-cesium .cesium-widget,
                .orbital-catalog-cesium canvas {
                    width: 100%;
                    height: 100%;
                }

                .orbital-catalog-cesium .cesium-widget-credits {
                    font-size: 9px;
                    opacity: 0.65;
                }
            `}</style>
        </div>
    );
}

