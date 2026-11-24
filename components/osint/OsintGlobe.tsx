'use client';
// components/osint/OsintGlobe.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Cesium globe for the OSINT module.
//
// Features:
//   - NaturalEarthII offline basemap permanently at layer 0 (never black globe)
//   - NASA GIBS imagery (EPSG:4326 GeographicTilingScheme) at layer 1
//   - Cesium Ion World Imagery (Bing Maps Aerial, ~1m) auto-switch for deep zoom
//   - NASA GIBS static overlays (Coastlines, Reference Labels) on top
//   - Height-based auto-switch with 400km/600km hysteresis
//   - Camera altitude tracking (cameraAltM callback)
//   - Bounding box tracking (bbox callback)
//   - Clean lifecycle management: zero layer leaks across base/date changes
//   - Soft tile error reporting with fallback suggestion
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type * as CesiumTypes from 'cesium';
import type { BBox } from '@/lib/osint/types';
import {
  setCesiumBaseUrl,
  buildViewerOptions,
  hasCesiumToken,
  getCesiumToken,
} from '@/lib/cesium/viewerConfig';
import { destroyViewer } from '@/lib/cesium/cesiumResourceManager';
import {
  GIBS_LAYERS,
  getDefaultBaseLayer,
  getCesiumIonLayer,
  type GibsLayer,
} from '@/lib/osint/imagery/catalog';
import {
  resolveImageryDate,
  formatUtcDate,
  parseUtcDate,
} from '@/lib/osint/imagery/time';
import {
  createGibsImageryLayer,
  createCesiumIonImageryLayer,
} from '@/lib/osint/imagery/provider';

const getCesium = () => import('cesium');

/** Hysteresis thresholds for auto-switching between GIBS and hi-res basemaps */
const HIRES_SWITCH_DOWN_ALT = 400_000; // Switch TO hi-res when descending below 400 km
const HIRES_SWITCH_UP_ALT = 600_000;   // Switch TO GIBS when ascending above 600 km

export type HiResMode = 'auto' | 'always-gibs' | 'always-hires';

export interface OsintGlobeHandle {
  /** The raw Cesium.Viewer instance (may be null before bootstrap). */
  getViewer(): import('cesium').Viewer | null;
  /** Returns the current number of imagery layers attached to the viewer. */
  getImageryLayerCount(): number;
  /** Fly camera to coordinates */
  flyTo(lat: number, lon: number, altM?: number): void;
}

let globalViewerConstructionCount = 0;
export function getViewerConstructionCount(): number {
  return globalViewerConstructionCount;
}

export interface OsintGlobeProps {
  /** Called whenever the camera moves with the current altitude in meters. */
  onCameraAltChange?: (altM: number) => void;
  /** Called whenever the camera moves with the current viewport bbox. */
  onBBoxChange?: (bbox: BBox) => void;
  /** Whether the GIBS imagery layer is active. */
  imageryEnabled?: boolean;
  /** Active GIBS base layer ID (e.g. VIIRS_SNPP_CorrectedReflectance_TrueColor). */
  activeBaseLayerId?: string;
  /** Active imagery date string (YYYY-MM-DD). */
  imageryDate?: string;
  /** Configurations for overlays (e.g. Coastlines, Reference Labels). */
  overlaySettings?: Record<string, { enabled: boolean; opacity: number }>;
  /** Callback when tile loading errors exceed threshold. */
  onTileError?: (notice: {
    layerId: string;
    message: string;
    fallbackDate: string;
  }) => void;
  /** Notifies parent when Cesium Viewer is fully instantiated and ready. */
  onViewerReady?: (viewer: CesiumTypes.Viewer) => void;
  /** Notifies parent when Cesium Viewer is being destroyed. */
  onViewerDestroy?: () => void;
  /** When true, disables requestRenderMode so moving layers animate at 60fps. */
  movingLayersActive?: boolean;
  /**
   * Hi-res basemap mode:
   * - 'auto' (default): auto-switch between GIBS and Cesium Ion based on altitude hysteresis
   * - 'always-gibs': always use GIBS imagery, never switch to hi-res
   * - 'always-hires': always use Cesium Ion hi-res imagery
   */
  hiResMode?: HiResMode;
  /** Called when the actually-mounted basemap source changes (e.g. "VIIRS SNPP True Color" or "High-Res Satellite (Bing)") */
  onActiveSourceChange?: (source: string) => void;
}

const OsintGlobe = forwardRef<OsintGlobeHandle, OsintGlobeProps>(
  function OsintGlobe(
    {
      onCameraAltChange,
      onBBoxChange,
      imageryEnabled = true,
      activeBaseLayerId = 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
      imageryDate,
      overlaySettings,
      onTileError,
      onViewerReady,
      onViewerDestroy,
      movingLayersActive = false,
      hiResMode = 'auto',
      onActiveSourceChange,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewerRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [viewer, setViewer] = useState<any>(null);
    // Counter that increments when camera altitude crosses a hysteresis threshold,
    // triggering the hi-res auto-switch effect to re-evaluate.
    const [hiResTrigger, setHiResTrigger] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gibsBaseLayerRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gibsOverlaysRef = useRef<Map<string, any>>(new Map());

    const creditContainerRef = useRef<HTMLDivElement>(null);
    const currentBaseIdRef = useRef<string | null>(null);
    const currentDateRef = useRef<string | null>(null);
    const tileErrorCountRef = useRef<number>(0);
    // Track altitude for hi-res hysteresis
    const currentAltRef = useRef<number>(180_000);
    // Track which base source is active: 'gibs' or 'hires' (state ensures GIBS effect re-runs on switch back)
    const activeBaseSourceRef = useRef<'gibs' | 'hires'>('gibs');
    const [activeBaseSource, setActiveBaseSource] = useState<'gibs' | 'hires'>('gibs');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hiResLayerRef = useRef<any>(null);

    const callbackRefs = useRef({
      onCameraAltChange,
      onBBoxChange,
      onTileError,
      onActiveSourceChange,
    });

    useEffect(() => {
      callbackRefs.current = {
        onCameraAltChange,
        onBBoxChange,
        onTileError,
        onActiveSourceChange,
      };
    }, [onCameraAltChange, onBBoxChange, onTileError, onActiveSourceChange]);

    // Expose viewer and imagery layer count to parent / tests.
    useImperativeHandle(
      ref,
      () => ({
        getViewer: () => viewerRef.current,
        getImageryLayerCount: () => {
          const v = viewerRef.current;
          if (!v || v.isDestroyed()) return 0;
          return v.imageryLayers.length;
        },
        flyTo: async (lat: number, lon: number, altM = 25000) => {
          const v = viewerRef.current;
          if (!v || v.isDestroyed()) return;
          const Cesium = await getCesium();
          v.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lon, lat, altM),
            duration: 1.5,
          });
        },
      }),
      [],
    );

    // ── Camera move handler ───────────────────────────────────────────────

    const handleCameraMove = useCallback(async () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const Cesium = await getCesium();

      // Camera altitude (works in 2D, Columbus View, and 3D).
      const carto = viewer.camera.positionCartographic;
      const altM = carto ? carto.height : 2e7;
      // Check if altitude crossed a hysteresis threshold and trigger hi-res re-evaluation
      const prevAlt = currentAltRef.current;
      currentAltRef.current = altM;
      const crossedDown =
        prevAlt > HIRES_SWITCH_DOWN_ALT && altM <= HIRES_SWITCH_DOWN_ALT;
      const crossedUp =
        prevAlt < HIRES_SWITCH_UP_ALT && altM >= HIRES_SWITCH_UP_ALT;
      if (crossedDown || crossedUp) {
        setHiResTrigger((c) => c + 1);
      }
      callbackRefs.current.onCameraAltChange?.(altM);

      // Compute bbox from the camera's view rectangle.
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (rect) {
          const west = Cesium.Math.toDegrees(rect.west);
          const south = Cesium.Math.toDegrees(rect.south);
          const east = Cesium.Math.toDegrees(rect.east);
          const north = Cesium.Math.toDegrees(rect.north);
          callbackRefs.current.onBBoxChange?.([west, south, east, north]);
        }
      } catch {
        // computeViewRectangle can throw when zoomed far out.
      }
    }, []);

    // ── Bootstrap ─────────────────────────────────────────────────────────

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      if (viewerRef.current) return;

      let isMounted = true;
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

      const handleResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          const v = viewerRef.current;
          if (!v || v.isDestroyed()) return;
          v.resize();
          if (v.scene?.requestRenderMode) {
            v.scene.requestRender();
          }
        }, 100);
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);

      (async () => {
        setCesiumBaseUrl();

        const Cesium = await getCesium();
        if (!isMounted) return;

        // Delay construction until container dimensions > 0 (max 60 frames ~ 1s)
        let attempts = 0;
        while (
          isMounted &&
          container &&
          (container.clientWidth === 0 || container.clientHeight === 0) &&
          attempts < 60
        ) {
          attempts++;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
        if (!isMounted || !container) return;

        if (hasCesiumToken()) {
          Cesium.Ion.defaultAccessToken = getCesiumToken();
        }

        const opts = buildViewerOptions();

        // NaturalEarthII offline basemap is ALWAYS base layer (layer 0).
        // This structurally guarantees the globe never goes black.
        const tmsProvider =
          await Cesium.TileMapServiceImageryProvider.fromUrl(
            Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
          );
        const baseLayer = new Cesium.ImageryLayer(tmsProvider);

        const creditContainer = creditContainerRef.current ?? undefined;

        globalViewerConstructionCount++;
        const viewer = new Cesium.Viewer(container, {
          ...opts,
          sceneMode: Cesium.SceneMode.SCENE2D,
          mapMode2D: Cesium.MapMode2D.INFINITE_SCROLL,
          baseLayer,
          ...(creditContainer ? { creditContainer } : {}),
        });

        viewerRef.current = viewer;
        setViewer(viewer);
        onViewerReady?.(viewer);
        if (typeof window !== 'undefined') {
          const debugWin = window as Window & {
            __cesiumViewer?: CesiumTypes.Viewer;
            __Cesium?: typeof CesiumTypes;
          };
          debugWin.__cesiumViewer = viewer;
          debugWin.__Cesium = Cesium;
        }

        // Dark globe atmosphere.
        viewer.scene.globe.enableLighting = true;

        // Canvas sharpness: use device pixel ratio for crisp rendering
        viewer.useBrowserRecommendedResolution = false;
        // Tighter tile screen-space error for sharper base imagery
        viewer.scene.globe.maximumScreenSpaceError = 1.5;

        // Ensure canvas buffer fits container on next frame, then re-compute accurate bbox/alt
        requestAnimationFrame(() => {
          if (!isMounted || !viewer || viewer.isDestroyed()) return;
          viewer.resize();
          handleCameraMove();
          if (viewer.scene?.requestRenderMode) {
            viewer.scene.requestRender();
          }
        });

        // Listen for camera moves — throttled by Cesium's requestRenderMode.
        viewer.camera.moveEnd.addEventListener(handleCameraMove);

        // Set initial camera to Jakarta at 180 km (detail mode immediately).
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(106.85, -6.21, 180_000),
        });

        // Fire camera handler AFTER setView so bbox/alt reflects Jakarta.
        handleCameraMove();

        viewer.scene.requestRender();
      })().catch((err) => {
        console.error('[OsintGlobe] bootstrap error:', err);
      });

      return () => {
        isMounted = false;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeObserver.disconnect();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);

        const v = viewerRef.current;
        if (v && !v.isDestroyed()) {
          v.camera.moveEnd.removeEventListener(handleCameraMove);
          destroyViewer(v);
        }
        onViewerDestroy?.();
        setViewer(null);
        viewerRef.current = null;
        gibsBaseLayerRef.current = null;
        hiResLayerRef.current = null;
        gibsOverlaysRef.current.clear();
        currentBaseIdRef.current = null;
        currentDateRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Auto-switch hi-res / GIBS basemap based on altitude hysteresis ─────

    useEffect(() => {
      if (!viewer || viewer.isDestroyed()) return;
      if (!imageryEnabled) return;

      const ionLayerDef = getCesiumIonLayer();
      if (!ionLayerDef) return; // No Ion layer in catalog

      let isMounted = true;

      const resolveDesiredSource = (): 'gibs' | 'hires' => {
        if (hiResMode === 'always-gibs') return 'gibs';
        if (hiResMode === 'always-hires') return 'hires';
        // auto mode: hysteresis
        const alt = currentAltRef.current;
        const current = activeBaseSourceRef.current;
        if (current === 'gibs' && alt <= HIRES_SWITCH_DOWN_ALT) return 'hires';
        if (current === 'hires' && alt >= HIRES_SWITCH_UP_ALT) return 'gibs';
        return current;
      };

      const desired = resolveDesiredSource();

      if (desired === activeBaseSourceRef.current) return;

      (async () => {
        const Cesium = await getCesium();
        if (!isMounted || !viewer || viewer.isDestroyed()) return;

        if (desired === 'hires') {
          // Load Ion hi-res FIRST before removing GIBS so the globe never falls back to blurry NaturalEarthII
          if (!hiResLayerRef.current) {
            const ionLayer = await createCesiumIonImageryLayer(Cesium, { opacity: 1.0 });
            if (!isMounted || !viewer || viewer.isDestroyed()) return;
            viewer.imageryLayers.add(ionLayer, 1);
            hiResLayerRef.current = ionLayer;
          }
          if (gibsBaseLayerRef.current) {
            viewer.imageryLayers.remove(gibsBaseLayerRef.current, true);
            gibsBaseLayerRef.current = null;
            currentBaseIdRef.current = null;
            currentDateRef.current = null;
          }
          activeBaseSourceRef.current = 'hires';
          setActiveBaseSource('hires');
          callbackRefs.current.onActiveSourceChange?.(ionLayerDef.label);
        } else {
          // Remove hi-res layer and trigger GIBS effect via activeBaseSource state
          if (hiResLayerRef.current) {
            viewer.imageryLayers.remove(hiResLayerRef.current, true);
            hiResLayerRef.current = null;
          }
          activeBaseSourceRef.current = 'gibs';
          currentBaseIdRef.current = null;
          currentDateRef.current = null;
          setActiveBaseSource('gibs');
          const gibsBase = GIBS_LAYERS.find(
            (l) => l.id === activeBaseLayerId && l.type === 'base' && !l.isCesiumIon,
          ) ?? getDefaultBaseLayer();
          callbackRefs.current.onActiveSourceChange?.(gibsBase.label);
        }
        viewer.scene.requestRender();
      })().catch((err) => {
        console.error('[OsintGlobe] hi-res switch error:', err);
      });

      return () => { isMounted = false; };
    }, [viewer, imageryEnabled, hiResMode, activeBaseLayerId, hiResTrigger]); // re-evaluate on mode or altitude threshold crossing

    // ── Dynamically toggle requestRenderMode for moving layers (air, sea) ────
    useEffect(() => {
      if (!viewer || viewer.isDestroyed()) return;
      if (viewer.scene) {
        viewer.scene.requestRenderMode = !movingLayersActive;
        if (movingLayersActive) {
          viewer.scene.requestRender();
        }
      }
    }, [viewer, movingLayersActive]);

    // ── Manage GIBS Imagery Layers (Base + Overlays) ───────────────────────

    useEffect(() => {
      if (!viewer || viewer.isDestroyed()) return;

      // When hi-res is active, skip GIBS base management (overlays still managed)
      const isHiResActive = activeBaseSource === 'hires';

      let isMounted = true;

      (async () => {
        const Cesium = await getCesium();
        if (!isMounted || !viewer || viewer.isDestroyed()) return;

        // 1. If imagery is disabled: remove GIBS base, hi-res base, and overlays.
        if (!imageryEnabled) {
          if (gibsBaseLayerRef.current) {
            viewer.imageryLayers.remove(gibsBaseLayerRef.current, true);
            gibsBaseLayerRef.current = null;
          }
          if (hiResLayerRef.current) {
            viewer.imageryLayers.remove(hiResLayerRef.current, true);
            hiResLayerRef.current = null;
            activeBaseSourceRef.current = 'gibs';
            setActiveBaseSource('gibs');
          }
          for (const [, layer] of gibsOverlaysRef.current) {
            viewer.imageryLayers.remove(layer, true);
          }
          gibsOverlaysRef.current.clear();
          currentBaseIdRef.current = null;
          currentDateRef.current = null;
          viewer.scene.requestRender();
          return;
        }

        // 2. Identify target base layer and resolved date (skip CesiumIon entries).
        const baseLayerDef: GibsLayer =
          GIBS_LAYERS.find((l) => l.id === activeBaseLayerId && l.type === 'base' && !l.isCesiumIon) ??
          getDefaultBaseLayer();

        const safeDate = resolveImageryDate(baseLayerDef, imageryDate);

        // Check if base layer or date actually changed.
        const baseChanged =
          currentBaseIdRef.current !== baseLayerDef.id ||
          currentDateRef.current !== safeDate ||
          !gibsBaseLayerRef.current;

        if (baseChanged && !isHiResActive) {
          // Remove old GIBS base layer if it exists (destroy = true to prevent leak).
          if (gibsBaseLayerRef.current) {
            viewer.imageryLayers.remove(gibsBaseLayerRef.current, true);
            gibsBaseLayerRef.current = null;
          }

          tileErrorCountRef.current = 0;

          const newBaseLayer = createGibsImageryLayer(Cesium, {
            layer: baseLayerDef,
            dateStr: safeDate,
            opacity: 1.0,
            onTileError: (count) => {
              tileErrorCountRef.current = count;
              if (count >= 3 && callbackRefs.current.onTileError) {
                const parsed = parseUtcDate(safeDate);
                let fallback = safeDate;
                if (parsed) {
                  parsed.setUTCDate(parsed.getUTCDate() - 1);
                  fallback = formatUtcDate(parsed);
                }
                callbackRefs.current.onTileError({
                  layerId: baseLayerDef.id,
                  message: `Some imagery tiles for date ${safeDate} failed to load from NASA GIBS.`,
                  fallbackDate: fallback,
                });
              }
            },
          });

          // Insert GIBS base layer at index 1 (directly above NaturalEarthII at index 0).
          // If overlays already exist, index 1 ensures it stays below them.
          viewer.imageryLayers.add(newBaseLayer, 1);
          gibsBaseLayerRef.current = newBaseLayer;
          currentBaseIdRef.current = baseLayerDef.id;
          currentDateRef.current = safeDate;
        }

        // 3. Manage Overlays (Coastlines, Labels).
        const overlayDefs = GIBS_LAYERS.filter((l) => l.type === 'overlay');

        for (const ovDef of overlayDefs) {
          const cfg = overlaySettings?.[ovDef.id] ?? {
            enabled: ovDef.defaultActive ?? false,
            opacity: 0.8,
          };

          const existingLayer = gibsOverlaysRef.current.get(ovDef.id);

          if (cfg.enabled) {
            if (existingLayer) {
              existingLayer.alpha = cfg.opacity;
              existingLayer.show = true;
            } else {
              const newOv = createGibsImageryLayer(Cesium, {
                layer: ovDef,
                opacity: cfg.opacity,
              });
              // Add overlay at the top.
              viewer.imageryLayers.add(newOv);
              gibsOverlaysRef.current.set(ovDef.id, newOv);
            }
          } else if (existingLayer) {
            viewer.imageryLayers.remove(existingLayer, true);
            gibsOverlaysRef.current.delete(ovDef.id);
          }
        }

        viewer.scene.requestRender();
      })().catch((err) => {
        console.error('[OsintGlobe] imagery update error:', err);
      });

      return () => {
        isMounted = false;
      };
    }, [viewer, imageryEnabled, activeBaseLayerId, imageryDate, overlaySettings, activeBaseSource]);

    return (
      <div className="osint-cesium-root relative w-full h-full" aria-label="OSINT 3D globe">
        <div
          ref={containerRef}
          className="w-full h-full"
        />

        <div
          ref={creditContainerRef}
          className="osint-cesium-credit-dock"
        />

        <style jsx global>{`
          .osint-cesium-root {
            position: relative;
            width: 100%;
            height: 100%;
          }
          .osint-cesium-root .cesium-viewer,
          .osint-cesium-root .cesium-viewer-cesiumWidgetContainer,
          .osint-cesium-root .cesium-widget,
          .osint-cesium-root .cesium-widget canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
          }
          .osint-cesium-credit-dock {
            position: absolute;
            bottom: 4px;
            right: 8px;
            max-width: 65vw;
            font-family: monospace;
            font-size: 9px;
            color: #94a3b8;
            pointer-events: auto;
            z-index: 10;
          }
          .osint-cesium-credit-dock a {
            color: #38bdf8;
            text-decoration: underline;
            pointer-events: auto;
          }
          .osint-cesium-credit-dock img {
            display: inline-block;
            vertical-align: middle;
            max-height: 14px;
          }
        `}</style>
      </div>
    );
  },
);

export default OsintGlobe;
