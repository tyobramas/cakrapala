"use client";

/**
 * CesiumViewerM3 — extended CesiumJS globe component for Cakrapala Milestone 3.
 *
 * Extends Milestone 2 (CesiumViewer) with:
 *   - Star field rendering (PointPrimitiveCollection).
 *   - Constellation lines (PolylineCollection).
 *   - Sky Dome mode: camera repositioned inside the star sphere, horizon ring.
 *   - Globe mode: same as M2 with star field overlay.
 *   - Mode switching without destroying the Viewer.
 *   - Horizon ring entity at the observer.
 *
 * ARCHITECTURE RULES (inherited from M2):
 *   - No Cesium objects in React state.
 *   - No React setState from Cesium clock tick.
 *   - Single Viewer — guarded against React Strict Mode double-mount.
 *   - Full cleanup on unmount.
 *
 * COORDINATE NOTES:
 *   Stars and constellations use the GAST-approximation RA/Dec→Az/Alt→ECEF
 *   pipeline described in lib/cesium/starFieldRenderer.ts.
 *   Sky dome mode repositions the camera INSIDE the star sphere pointing
 *   toward the local zenith, producing an immersive sky view.
 *   This is a VISUAL APPROXIMATION; see coordinateTransforms.ts for details.
 */

import { useRef, useEffect } from "react";
import type { ObserverLocation, CelestialBodyPosition, SkyRenderMode } from "@/lib/astronomy/types";
import { computeAllBodyPositions } from "@/lib/astronomy/celestialPositions";
import { createObserverMarker, createCelestialEntities, updateCelestialEntities } from "@/lib/cesium/entityFactory";
import { destroyViewer, createIntervalHandle, startInterval, stopInterval, removeEntity, removeEntityMap } from "@/lib/cesium/cesiumResourceManager";
import { setCesiumBaseUrl, buildViewerOptions, hasCesiumToken, getCesiumToken } from "@/lib/cesium/viewerConfig";
import { CesiumStarFieldRenderer } from "@/lib/cesium/starFieldRenderer";
import { CesiumConstellationRenderer } from "@/lib/cesium/constellationRenderer";
import type { StarRecord, ConstellationSegment } from "@/lib/astronomy/types";

const getCesium = () => import("cesium");

// ── Types ──────────────────────────────────────────────────────────────────────

export type CesiumViewerM3Props = {
  observer: ObserverLocation;
  speedMultiplier: number;
  isPaused: boolean;
  renderMode: SkyRenderMode;
  showStars: boolean;
  showConstellations: boolean;
  showHorizon: boolean;
  showLabels: boolean;
  onTimeChange: (utcDate: Date) => void;
  onPositionsChange: (positions: CelestialBodyPosition[]) => void;
};

const TICK_INTERVAL_MS = 2000;
/** How often the star field is updated (sidereal time changes slowly). */
const STAR_UPDATE_INTERVAL_MS = 30000; // 30 s

// ── Component ─────────────────────────────────────────────────────────────────

export default function CesiumViewerM3({
  observer,
  speedMultiplier,
  isPaused,
  renderMode,
  showStars,
  showConstellations,
  showHorizon,
  showLabels,
  onTimeChange,
  onPositionsChange,
}: CesiumViewerM3Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observerEntityRef = useRef<any>(null);
  const celestialEntityMapRef = useRef<Map<string, import("cesium").Entity>>(new Map());
  const tickHandle = useRef(createIntervalHandle());
  const starUpdateHandle = useRef(createIntervalHandle());
  const starRendererRef = useRef<CesiumStarFieldRenderer | null>(null);
  const constellationRendererRef = useRef<CesiumConstellationRenderer | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const horizonEntityRef = useRef<any>(null);

  // Prop refs — keep latest values accessible inside intervals.
  const observerRef = useRef(observer);
  const speedRef = useRef(speedMultiplier);
  const isPausedRef = useRef(isPaused);
  const renderModeRef = useRef(renderMode);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPositionsChangeRef = useRef(onPositionsChange);
  const showLabelsRef = useRef(showLabels);
  const showStarsRef = useRef(showStars);
  const showConstellationsRef = useRef(showConstellations);
  const showHorizonRef = useRef(showHorizon);

  useEffect(() => { observerRef.current = observer; }, [observer]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { renderModeRef.current = renderMode; }, [renderMode]);
  useEffect(() => { onTimeChangeRef.current = onTimeChange; }, [onTimeChange]);
  useEffect(() => { onPositionsChangeRef.current = onPositionsChange; }, [onPositionsChange]);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { showStarsRef.current = showStars; }, [showStars]);
  useEffect(() => { showConstellationsRef.current = showConstellations; }, [showConstellations]);
  useEffect(() => { showHorizonRef.current = showHorizon; }, [showHorizon]);

  // ── Speed / pause sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.clock.multiplier = isPaused ? 0 : speedMultiplier;
    viewer.scene.requestRender();
  }, [speedMultiplier, isPaused]);

  // ── Star visibility sync ───────────────────────────────────────────────────
  useEffect(() => {
    starRendererRef.current?.setVisible(showStars);
    viewerRef.current?.scene.requestRender();
  }, [showStars]);

  // ── Constellation visibility sync ─────────────────────────────────────────
  useEffect(() => {
    constellationRendererRef.current?.setVisible(showConstellations);
    viewerRef.current?.scene.requestRender();
  }, [showConstellations]);

  // ── Horizon visibility sync ───────────────────────────────────────────────
  useEffect(() => {
    const entity = horizonEntityRef.current;
    if (entity) entity.show = showHorizon;
    viewerRef.current?.scene.requestRender();
  }, [showHorizon]);

  // ── Label visibility sync ─────────────────────────────────────────────────
  useEffect(() => {
    for (const entity of celestialEntityMapRef.current.values()) {
      if (entity.label) {
        import("cesium").then(({ ConstantProperty }) => {
          if (entity.label) entity.label.show = new ConstantProperty(showLabels);
        }).catch(() => {/* ignore */});
      }
    }
    viewerRef.current?.scene.requestRender();
  }, [showLabels]);

  // ── Render mode switch ─────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    if (renderMode === "sky-dome") {
      // Position camera at observer ECEF, looking straight up.
      import("cesium").then(({ Cartesian3, Math: CesiumMath }) => {
        const cart = Cartesian3.fromDegrees(
          observerRef.current.longitude,
          observerRef.current.latitude,
          observerRef.current.elevationMeters + 2 // 2 m above ground
        );
        viewer.camera.setView({
          destination: cart,
          orientation: {
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(90), // looking straight up
            roll: 0,
          },
        });
        // Disable globe for immersive sky dome.
        viewer.scene.globe.show = false;
        viewer.scene.skyBox.show = false;
        viewer.scene.requestRender();
      }).catch(() => {/* ignore */});
    } else {
      // Globe mode: restore globe and fly to overview.
      import("cesium").then(({ Cartesian3 }) => {
        viewer.scene.globe.show = true;
        viewer.scene.skyBox.show = true;
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(
            observerRef.current.longitude,
            observerRef.current.latitude,
            1e7
          ),
          duration: 1.5,
        });
        viewer.scene.requestRender();
      }).catch(() => {/* ignore */});
    }
  }, [renderMode]);

  // ── Observer marker sync ───────────────────────────────────────────────────
  useEffect(() => {
    const entity = observerEntityRef.current;
    const viewer = viewerRef.current;
    if (!entity || !viewer || viewer.isDestroyed()) return;
    import("cesium").then(({ Cartesian3, ConstantPositionProperty, ConstantProperty }) => {
      const cart = Cartesian3.fromDegrees(
        observer.longitude, observer.latitude, observer.elevationMeters
      );
      entity.position = new ConstantPositionProperty(cart);
      if (entity.label) entity.label.text = new ConstantProperty(observer.displayName);
      viewer.scene.requestRender();
    }).catch(() => {/* ignore */});
  }, [observer]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewerRef.current) return;

    let isMounted = true;

    (async () => {
      setCesiumBaseUrl();
      const Cesium = await getCesium();
      if (!isMounted) return;

      if (hasCesiumToken()) {
        Cesium.Ion.defaultAccessToken = getCesiumToken();
      }

      const opts = buildViewerOptions();
      let baseLayer: import("cesium").ImageryLayer | undefined;
      if (!hasCesiumToken()) {
        const tmsProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
        );
        baseLayer = new Cesium.ImageryLayer(tmsProvider);
      }

      if (!isMounted) return;

      const viewer = new Cesium.Viewer(container, {
        ...opts,
        ...(baseLayer ? { baseLayer } : {}),
      });
      viewerRef.current = viewer;

      viewer.clock.shouldAnimate = !isPausedRef.current;
      viewer.clock.multiplier = isPausedRef.current ? 0 : speedRef.current;

      // Observer marker.
      const observerEntity = createObserverMarker(viewer, observerRef.current);
      observerEntityRef.current = observerEntity;

      // Initial celestial positions.
      const initDate = Cesium.JulianDate.toDate(viewer.clock.currentTime);
      const initPositions = computeAllBodyPositions(initDate, observerRef.current);
      const entityMap = createCelestialEntities(viewer, initPositions, observerRef.current);
      celestialEntityMapRef.current = entityMap;

      onTimeChangeRef.current(initDate);
      onPositionsChangeRef.current(initPositions);

      // Horizon ring entity (a large ellipse on the ground plane at the observer).
      const horizonCart = Cesium.Cartesian3.fromDegrees(
        observerRef.current.longitude,
        observerRef.current.latitude,
        observerRef.current.elevationMeters
      );
      const horizonEntity = viewer.entities.add({
        id: "horizon-ring",
        position: new Cesium.ConstantPositionProperty(horizonCart),
        ellipse: {
          semiMajorAxis: 500000, // 500 km visual radius
          semiMinorAxis: 500000,
          height: observerRef.current.elevationMeters,
          material: new Cesium.Color(0.3, 0.6, 1.0, 0.08),
          outline: true,
          outlineColor: new Cesium.Color(0.3, 0.6, 1.0, 0.4),
          outlineWidth: 2,
        },
        show: showHorizonRef.current,
      });
      horizonEntityRef.current = horizonEntity;

      // Load and render star field.
      try {
        const resp = await fetch("/data/stars-bsc5.json");
        if (resp.ok && isMounted) {
          const data = (await resp.json()) as { stars: StarRecord[] };
          const starRenderer = new CesiumStarFieldRenderer(viewer);
          starRenderer.create(data.stars);
          starRenderer.setVisible(showStarsRef.current);
          starRendererRef.current = starRenderer;

          // Load constellation lines.
          const constellResp = await fetch("/data/constellation-lines.json");
          if (constellResp.ok && isMounted) {
            const constellData = (await constellResp.json()) as {
              segments: ConstellationSegment[];
            };
            const constellRenderer = new CesiumConstellationRenderer(viewer);
            constellRenderer.create(
              data.stars,
              constellData.segments,
              observerRef.current,
              initDate
            );
            constellRenderer.setVisible(showConstellationsRef.current);
            constellationRendererRef.current = constellRenderer;
          }
        }
      } catch {
        // Star field load failure is non-fatal.
        console.warn("[CesiumViewerM3] Star catalog load failed — continuing without stars.");
      }

      // Fly to observer.
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          observerRef.current.longitude,
          observerRef.current.latitude,
          1e7
        ),
        duration: 2.0,
      });

      // Tick: recompute celestial positions from Cesium clock.
      startInterval(tickHandle.current, () => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed()) return;
        const utcDate: Date = Cesium.JulianDate.toDate(v.clock.currentTime);
        onTimeChangeRef.current(utcDate);
        const positions = computeAllBodyPositions(utcDate, observerRef.current);
        onPositionsChangeRef.current(positions);
        updateCelestialEntities(celestialEntityMapRef.current, positions, observerRef.current);
        v.scene.requestRender();
      }, TICK_INTERVAL_MS);

      // Star update tick (less frequent — sidereal frame shifts slowly).
      startInterval(starUpdateHandle.current, () => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed()) return;
        const utcDate: Date = Cesium.JulianDate.toDate(v.clock.currentTime);
        starRendererRef.current?.update({
          utcDate,
          observer: observerRef.current,
          renderMode: renderModeRef.current,
        });
        v.scene.requestRender();
      }, STAR_UPDATE_INTERVAL_MS);

    })().catch((err) => {
      console.error("[CesiumViewerM3] bootstrap error:", err);
    });

    const capturedTickHandle = tickHandle;
    const capturedStarHandle = starUpdateHandle;

    return () => {
      isMounted = false;
      stopInterval(capturedTickHandle.current);
      stopInterval(capturedStarHandle.current);

      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        starRendererRef.current?.destroy();
        constellationRendererRef.current?.destroy();
        removeEntity(viewer, observerEntityRef.current);
        removeEntity(viewer, horizonEntityRef.current);
        removeEntityMap(viewer, celestialEntityMapRef.current);
        destroyViewer(viewer);
      }
      viewerRef.current = null;
      observerEntityRef.current = null;
      horizonEntityRef.current = null;
      starRendererRef.current = null;
      constellationRendererRef.current = null;
    };
  }, []); // Bootstrap runs once.

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Cesium 3D globe with star field and constellation lines"
    />
  );
}
