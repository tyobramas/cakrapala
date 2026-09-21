'use client';
// components/osint/OsintGlobe.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Cesium globe for the OSINT module.
//
// Features:
//   - NaturalEarthII offline basemap permanently at layer 0 (never black globe)
//   - NASA GIBS imagery layer (EPSG:4326 GeographicTilingScheme) on top at layer 1
//   - NASA GIBS static overlays (Coastlines, Reference Labels) on top
//   - Camera altitude tracking (cameraAltM callback)
//   - Bounding box tracking (bbox callback)
//   - Clean lifecycle management: zero layer leaks across base/date changes
//   - Soft tile error reporting with fallback suggestion
// ─────────────────────────────────────────────────────────────────────────────

import {
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
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
  type GibsLayer,
} from '@/lib/osint/imagery/catalog';
import {
  resolveImageryDate,
  formatUtcDate,
  parseUtcDate,
} from '@/lib/osint/imagery/time';
import { createGibsImageryLayer } from '@/lib/osint/imagery/provider';

const getCesium = () => import('cesium');

export interface OsintGlobeHandle {
  /** The raw Cesium.Viewer instance (may be null before bootstrap). */
  getViewer(): import('cesium').Viewer | null;
  /** Returns the current number of imagery layers attached to the viewer. */
  getImageryLayerCount(): number;
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
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewerRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gibsBaseLayerRef = useRef<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gibsOverlaysRef = useRef<Map<string, any>>(new Map());

    const currentBaseIdRef = useRef<string | null>(null);
    const currentDateRef = useRef<string | null>(null);
    const tileErrorCountRef = useRef<number>(0);

    const callbackRefs = useRef({
      onCameraAltChange,
      onBBoxChange,
      onTileError,
    });

    useEffect(() => {
      callbackRefs.current = {
        onCameraAltChange,
        onBBoxChange,
        onTileError,
      };
    }, [onCameraAltChange, onBBoxChange, onTileError]);

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
      }),
      [],
    );

    // ── Camera move handler ───────────────────────────────────────────────

    const handleCameraMove = useCallback(async () => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      const Cesium = await getCesium();

      // Camera altitude.
      const carto = Cesium.Cartographic.fromCartesian(
        viewer.camera.positionWC,
      );
      const altM = carto.height;
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

      (async () => {
        setCesiumBaseUrl();

        const Cesium = await getCesium();
        if (!isMounted) return;

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

        const viewer = new Cesium.Viewer(container, {
          ...opts,
          baseLayer,
        });

        viewerRef.current = viewer;

        // Dark globe atmosphere.
        viewer.scene.globe.enableLighting = true;

        // Listen for camera moves — throttled by Cesium's requestRenderMode.
        viewer.camera.moveEnd.addEventListener(handleCameraMove);
        // Fire once initially.
        handleCameraMove();

        // Fly to default position (whole globe view).
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(110, -2, 2e7),
          duration: 0,
        });

        viewer.scene.requestRender();
      })().catch((err) => {
        console.error('[OsintGlobe] bootstrap error:', err);
      });

      return () => {
        isMounted = false;
        const viewer = viewerRef.current;
        if (viewer && !viewer.isDestroyed()) {
          viewer.camera.moveEnd.removeEventListener(handleCameraMove);
          destroyViewer(viewer);
        }
        viewerRef.current = null;
        gibsBaseLayerRef.current = null;
        gibsOverlaysRef.current.clear();
        currentBaseIdRef.current = null;
        currentDateRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Manage GIBS Imagery Layers (Base + Overlays) ───────────────────────

    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;

      let isMounted = true;

      (async () => {
        const Cesium = await getCesium();
        if (!isMounted || !viewer || viewer.isDestroyed()) return;

        // 1. If imagery is disabled: remove GIBS base and overlays.
        if (!imageryEnabled) {
          if (gibsBaseLayerRef.current) {
            viewer.imageryLayers.remove(gibsBaseLayerRef.current, true);
            gibsBaseLayerRef.current = null;
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

        // 2. Identify target base layer and resolved date.
        const baseLayerDef: GibsLayer =
          GIBS_LAYERS.find((l) => l.id === activeBaseLayerId && l.type === 'base') ??
          getDefaultBaseLayer();

        const safeDate = resolveImageryDate(baseLayerDef, imageryDate);

        // Check if base layer or date actually changed.
        const baseChanged =
          currentBaseIdRef.current !== baseLayerDef.id ||
          currentDateRef.current !== safeDate ||
          !gibsBaseLayerRef.current;

        if (baseChanged) {
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
                  message: `Sebagian tile citra untuk tanggal ${safeDate} gagal dimuat dari server GIBS.`,
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
    }, [imageryEnabled, activeBaseLayerId, imageryDate, overlaySettings]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="OSINT 3D globe"
      />
    );
  },
);

export default OsintGlobe;
