'use client';
// components/osint/OsintGlobe.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight Cesium globe for the OSINT module.
//
// Unlike CesiumViewer (which is tightly coupled to astronomy/celestial
// entities), this component provides a bare globe with:
//   - Camera altitude tracking (cameraAltM callback)
//   - Bounding box tracking (bbox callback)
//   - A ref to the Viewer for child layers (QuakeLayer etc.) to use
//
// Reuses lib/cesium/viewerConfig.ts and cesiumResourceManager.ts.
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

const getCesium = () => import('cesium');

export interface OsintGlobeHandle {
  /** The raw Cesium.Viewer instance (may be null before bootstrap). */
  getViewer(): import('cesium').Viewer | null;
}

export interface OsintGlobeProps {
  /** Called whenever the camera moves with the current altitude in meters. */
  onCameraAltChange?: (altM: number) => void;
  /** Called whenever the camera moves with the current viewport bbox. */
  onBBoxChange?: (bbox: BBox) => void;
}

const OsintGlobe = forwardRef<OsintGlobeHandle, OsintGlobeProps>(
  function OsintGlobe({ onCameraAltChange, onBBoxChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewerRef = useRef<any>(null);
    const callbackRefs = useRef({ onCameraAltChange, onBBoxChange });

    // Keep callbacks fresh.
    useEffect(() => {
      callbackRefs.current = { onCameraAltChange, onBBoxChange };
    }, [onCameraAltChange, onBBoxChange]);

    // Expose viewer to parent.
    useImperativeHandle(
      ref,
      () => ({
        getViewer: () => viewerRef.current,
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

        // Offline imagery if no token.
        let baseLayer: import('cesium').ImageryLayer | undefined;
        if (!hasCesiumToken()) {
          const tmsProvider =
            await Cesium.TileMapServiceImageryProvider.fromUrl(
              Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            );
          baseLayer = new Cesium.ImageryLayer(tmsProvider);
        }

        const viewer = new Cesium.Viewer(container, {
          ...opts,
          ...(baseLayer ? { baseLayer } : {}),
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
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
