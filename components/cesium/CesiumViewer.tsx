"use client";

/**
 * CesiumViewer — core CesiumJS globe component for Cakrapala Milestone 2.
 *
 * ARCHITECTURE RULES:
 *   - No Cesium objects stored in React state.  All Cesium refs use useRef.
 *   - No React setState calls from inside Cesium clock tick or render loop.
 *   - Single Viewer per component instance, guarded against React Strict Mode
 *     double-invocation via viewerRef.current check.
 *   - Full teardown on unmount: destroy viewer, clear intervals, remove entities.
 *   - CESIUM_BASE_URL is set once on mount (before any Cesium import runs).
 *
 * IMAGERY:
 *   - If NEXT_PUBLIC_CESIUM_ION_TOKEN is set → Cesium Ion access token is
 *     registered; Cesium will use its default Ion imagery layer (Bing Maps).
 *   - If not set → uses NaturalEarth II (bundled with Cesium, offline-capable).
 *
 * POSITIONS:
 *   Celestial body positions are recomputed on a 2-second tick driven by
 *   the Cesium clock's current time.  Entity positions are updated via
 *   updateCelestialEntities (mutation, no React re-render required).
 *
 * CALLBACKS:
 *   onTimeChange(utcDate)   — fired every tick, allows React UI to update
 *                             time display without touching Cesium objects.
 *   onPositionsChange(arr)  — fired every tick with the latest positions array,
 *                             allows the info panel to display Az/Alt values.
 */

import { useRef, useEffect } from "react";
import type { ObserverLocation, CelestialBodyPosition } from "@/lib/astronomy/types";
import { computeAllBodyPositions } from "@/lib/astronomy/celestialPositions";
import {
  createObserverMarker,
  updateCelestialEntities,
  createCelestialEntities,
} from "@/lib/cesium/entityFactory";
import {
  destroyViewer,
  createIntervalHandle,
  startInterval,
  stopInterval,
  removeEntity,
  removeEntityMap,
} from "@/lib/cesium/cesiumResourceManager";
import {
  setCesiumBaseUrl,
  buildViewerOptions,
  hasCesiumToken,
  getCesiumToken,
} from "@/lib/cesium/viewerConfig";

// Cesium is imported lazily at runtime (this component is ssr:false).
const getCesium = () => import("cesium");

// ── Types ──────────────────────────────────────────────────────────────────────

export type CesiumViewerProps = {
  /** Observer location for marker placement and celestial position calculation. */
  observer: ObserverLocation;
  /** Current simulation speed multiplier. */
  speedMultiplier: number;
  /** Whether the simulation clock is paused. */
  isPaused: boolean;
  /** Called each tick with the current Cesium clock UTC time. */
  onTimeChange: (utcDate: Date) => void;
  /** Called each tick with the latest computed celestial positions. */
  onPositionsChange: (positions: CelestialBodyPosition[]) => void;
};

// ── Tick interval ─────────────────────────────────────────────────────────────

/** How often we recompute celestial positions and fire callbacks (ms). */
const TICK_INTERVAL_MS = 2000;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CesiumViewer({
  observer,
  speedMultiplier,
  isPaused,
  onTimeChange,
  onPositionsChange,
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Cesium object refs — NEVER stored in React state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const observerEntityRef = useRef<any>(null);
  const celestialEntityMapRef = useRef<Map<string, import("cesium").Entity>>(new Map());
  const tickHandle = useRef(createIntervalHandle());

  // Keep latest props accessible inside the interval without re-registering it.
  const observerRef = useRef(observer);
  const speedRef = useRef(speedMultiplier);
  const isPausedRef = useRef(isPaused);
  const onTimeChangeRef = useRef(onTimeChange);
  const onPositionsChangeRef = useRef(onPositionsChange);

  // Sync prop refs.
  useEffect(() => { observerRef.current = observer; }, [observer]);
  useEffect(() => { speedRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { onTimeChangeRef.current = onTimeChange; }, [onTimeChange]);
  useEffect(() => { onPositionsChangeRef.current = onPositionsChange; }, [onPositionsChange]);

  // ── Sync speed + paused state to Cesium clock ───────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;
    viewer.clock.multiplier = isPaused ? 0 : speedMultiplier;
    viewer.scene.requestRender();
  }, [speedMultiplier, isPaused]);

  // ── Sync observer marker position when observer changes ─────────────────────
  useEffect(() => {
    const entity = observerEntityRef.current;
    const viewer = viewerRef.current;
    if (!entity || !viewer || viewer.isDestroyed()) return;

    import("cesium").then(({ Cartesian3, ConstantPositionProperty, ConstantProperty }) => {
      const cart = Cartesian3.fromDegrees(
        observer.longitude,
        observer.latitude,
        observer.elevationMeters
      );
      entity.position = new ConstantPositionProperty(cart);
      if (entity.label) {
        entity.label.text = new ConstantProperty(observer.displayName);
      }
      viewer.scene.requestRender();
    }).catch(() => {/* ignore */});
  }, [observer]);

  // ── Bootstrap — runs exactly once ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Guard: React Strict Mode double-invoke protection.
    if (viewerRef.current) return;

    let isMounted = true;

    (async () => {
      // 1. Set CESIUM_BASE_URL before any Cesium code runs.
      setCesiumBaseUrl();

      const Cesium = await getCesium();

      if (!isMounted) return;

      // 2. Configure Ion token if available.
      if (hasCesiumToken()) {
        Cesium.Ion.defaultAccessToken = getCesiumToken();
      }

      // 3. Build options.
      const opts = buildViewerOptions();

      // 4. Configure imagery: offline NaturalEarth II if no token.
      // Use baseLayer (the Viewer.ConstructorOptions-compatible approach).
      // TileMapServiceImageryProvider.fromUrl is async so we await it here.
      let baseLayer: import("cesium").ImageryLayer | undefined;
      if (!hasCesiumToken()) {
        const tmsProvider = await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
        );
        baseLayer = new Cesium.ImageryLayer(tmsProvider);
      }

      // 5. Create the Viewer.
      const viewer = new Cesium.Viewer(container, {
        ...opts,
        ...(baseLayer ? { baseLayer } : {}),
      });

      viewerRef.current = viewer;

      // 6. Configure clock.
      viewer.clock.shouldAnimate = !isPausedRef.current;
      viewer.clock.multiplier = isPausedRef.current ? 0 : speedRef.current;

      // 7. Observer marker.
      const observerEntity = createObserverMarker(viewer, observerRef.current);
      observerEntityRef.current = observerEntity;

      // 8. Initial celestial positions.
      const initDate = viewer.clock.currentTime
        ? Cesium.JulianDate.toDate(viewer.clock.currentTime)
        : new Date();
      const initPositions = computeAllBodyPositions(initDate, observerRef.current);
      const entityMap = createCelestialEntities(viewer, initPositions, observerRef.current);
      celestialEntityMapRef.current = entityMap;

      // Fire initial callbacks.
      onTimeChangeRef.current(initDate);
      onPositionsChangeRef.current(initPositions);

      // 9. Fly camera to observer location.
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          observerRef.current.longitude,
          observerRef.current.latitude,
          1e7 // 10,000 km altitude for a globe view
        ),
        duration: 2.0,
      });

      // 10. Start tick interval: read Cesium clock → recompute positions.
      startInterval(tickHandle.current, () => {
        const v = viewerRef.current;
        if (!v || v.isDestroyed()) return;

        const julianDate = v.clock.currentTime;
        const utcDate: Date = Cesium.JulianDate.toDate(julianDate);

        onTimeChangeRef.current(utcDate);

        const positions = computeAllBodyPositions(utcDate, observerRef.current);
        onPositionsChangeRef.current(positions);

        updateCelestialEntities(
          celestialEntityMapRef.current,
          positions,
          observerRef.current
        );

        v.scene.requestRender();
      }, TICK_INTERVAL_MS);
    })().catch((err) => {
      console.error("[CesiumViewer] bootstrap error:", err);
    });

    // Capture refs into locals so the cleanup closure does not read stale .current
    const capturedTickHandle = tickHandle;

    // ── Cleanup ────────────────────────────────────────────────────────────────
    return () => {
      isMounted = false;
      stopInterval(capturedTickHandle.current);

      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        removeEntity(viewer, observerEntityRef.current);
        removeEntityMap(viewer, celestialEntityMapRef.current);
        destroyViewer(viewer);
      }
      viewerRef.current = null;
      observerEntityRef.current = null;
    };
  }, []); // Intentionally empty — bootstrap runs once.

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Cesium 3D globe showing Earth and celestial body directions"
    />
  );
}
