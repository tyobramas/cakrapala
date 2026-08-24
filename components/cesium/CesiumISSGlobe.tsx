"use client";

/**
 * CesiumISSGlobe — High-Precision 3D Photorealistic Globe for Satellite Tracking.
 *
 * Implements:
 *   - Unique real vector billboard icon per satellite (ISS, Tiangong, Hubble, NOAA, Terra, Starlink)
 *   - Exact orbit connection: green past track ends seamlessly at the satellite,
 *     and orange future track starts seamlessly from the satellite
 *   - Red dashed footprint coverage circle
 *   - User location marker ("YOU")
 *   - Interactive orbit view (pan, zoom, tilt)
 */

import { useRef, useEffect } from "react";
import {
  setCesiumBaseUrl,
  buildViewerOptions,
  hasCesiumToken,
  getCesiumToken,
} from "@/lib/cesium/viewerConfig";

interface OrbitPoint {
  lat: number;
  lon: number;
}

export interface CesiumISSGlobeProps {
  satelliteId?: string;
  satelliteName?: string;
  iconSvg?: string;
  themeColor?: string;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number;
  orbitTrail: OrbitPoint[];
  futureOrbit: OrbitPoint[];
  userLat: number;
  userLon: number;
}

/**
 * Generate footprint circle points with angular radius α = arccos(Re / (Re + alt))
 */
function computeFootprintCircle(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  nPoints: number = 128
): number[] {
  const Re = 6371;
  const safeAlt = Math.max(100, altKm || 420);
  const alpha = Math.acos(Re / (Re + safeAlt));
  const latR = (latDeg * Math.PI) / 180;
  const lonR = (lonDeg * Math.PI) / 180;

  const sx = Math.cos(latR) * Math.cos(lonR);
  const sy = Math.sin(latR);
  const sz = Math.cos(latR) * Math.sin(lonR);

  // East basis vector
  let ex = -sz,
    ey = 0,
    ez = sx;
  const eLen = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
  ex /= eLen;
  ey /= eLen;
  ez /= eLen;

  // North basis vector = sat × east
  const nx = sy * ez - sz * ey;
  const ny = sz * ex - sx * ez;
  const nz = sx * ey - sy * ex;

  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  const positions: number[] = [];

  for (let i = 0; i <= nPoints; i++) {
    const phi = (i / nPoints) * 2 * Math.PI;
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const px = cosA * sx + sinA * (cp * ex + sp * nx);
    const py = cosA * sy + sinA * (cp * ey + sp * ny);
    const pz = cosA * sz + sinA * (cp * ez + sp * nz);

    const fLat = Math.asin(Math.max(-1, Math.min(1, py))) * (180 / Math.PI);
    const fLon = Math.atan2(pz, px) * (180 / Math.PI);
    positions.push(fLon, fLat);
  }

  return positions;
}

export default function CesiumISSGlobe({
  satelliteId = "iss",
  satelliteName = "ISS (ZARYA)",
  iconSvg = "/textures/satellites/iss.svg",
  themeColor = "#00f0ff",
  latitude,
  longitude,
  altitude,
  orbitTrail,
  futureOrbit,
  userLat,
  userLon,
}: CesiumISSGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const viewerRef = useRef<any>(null);
  const satEntityRef = useRef<any>(null);
  const pastTrailRef = useRef<any>(null);
  const futureTrailRef = useRef<any>(null);
  const footprintRef = useRef<any>(null);
  const observerRef = useRef<any>(null);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const initDoneRef = useRef(false);

  const propsRef = useRef({
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  });
  propsRef.current = {
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  };

  // ── INIT: Create Cesium Viewer once ──────────────────────────────────────────
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    let destroyed = false;

    const boot = async () => {
      if (!containerRef.current) return;

      setCesiumBaseUrl();

      const Cesium = await import("cesium");
      await import("cesium/Build/Cesium/Widgets/widgets.css");

      if (destroyed) return;

      if (hasCesiumToken()) {
        Cesium.Ion.defaultAccessToken = getCesiumToken();
      }

      const viewer = new Cesium.Viewer(containerRef.current!, {
        ...buildViewerOptions(),
        requestRenderMode: false,
        skyBox: false,
        skyAtmosphere: new Cesium.SkyAtmosphere(),
        globe: new Cesium.Globe(Cesium.Ellipsoid.WGS84),
        shadows: false,
        contextOptions: {
          webgl: { alpha: true, antialias: true },
        },
      });

      if (destroyed) {
        viewer.destroy();
        return;
      }

      viewerRef.current = viewer;

      // Hide default credit bar
      const credit = viewer.cesiumWidget.creditContainer as HTMLElement;
      if (credit) credit.style.display = "none";

      // Globe space aesthetics
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#020713");
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.atmosphereLightIntensity = 8.0;
      viewer.scene.globe.atmosphereBrightnessShift = 0.05;
      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#020713");

      if (!hasCesiumToken()) {
        try {
          const imgProvider = new Cesium.SingleTileImageryProvider({
            url: "/textures/planets/earth.jpg",
          });
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(imgProvider);
        } catch {
          // fallback
        }
      }

      const p = propsRef.current;
      const altM = p.altitude * 1000;

      // ── Camera: Focus on satellite location ──────────────────────────────────
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          p.longitude,
          p.latitude,
          11_500_000
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });

      // ── 1. Satellite Real Model (Vector Billboard + Label) ───────────────────
      satEntityRef.current = viewer.entities.add({
        name: p.satelliteName,
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, altM),
        billboard: {
          image: p.iconSvg || "/textures/satellites/iss.svg",
          width: 58,
          height: 35,
          scaleByDistance: new Cesium.NearFarScalar(1.2e6, 1.4, 3.0e7, 0.7),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        },
        point: {
          pixelSize: 5,
          color: Cesium.Color.fromCssColorString(p.themeColor || "#00f0ff"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: p.satelliteName.toUpperCase(),
          font: "bold 12px monospace",
          fillColor: Cesium.Color.fromCssColorString(p.themeColor || "#00f0ff"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -32),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });

      // ── 2. Past Orbit Trail (Green, exactly connects to current satellite pos)
      const pastCoords = [...(p.orbitTrail || []), { lat: p.latitude, lon: p.longitude }];
      const pastPos = pastCoords.flatMap((pt) => [pt.lon, pt.lat, altM]);
      pastTrailRef.current = viewer.entities.add({
        name: "Past Orbit",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(pastPos),
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString("#84cc16"),
          }),
          clampToGround: false,
        },
      });

      // ── 3. Future Orbit Trail (Orange, starts exactly from current satellite pos)
      const futureCoords = [{ lat: p.latitude, lon: p.longitude }, ...(p.futureOrbit || [])];
      const futurePos = futureCoords.flatMap((pt) => [pt.lon, pt.lat, altM]);
      futureTrailRef.current = viewer.entities.add({
        name: "Future Orbit",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(futurePos),
          width: 3.5,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: Cesium.Color.fromCssColorString("#f97316"),
          }),
          clampToGround: false,
        },
      });

      // ── 4. Footprint Circle (Red Dashed) ─────────────────────────────────────
      const fpPositions = computeFootprintCircle(p.latitude, p.longitude, p.altitude);
      footprintRef.current = viewer.entities.add({
        name: "Coverage Footprint",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(fpPositions),
          width: 2.2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString("#ef4444"),
            dashLength: 16,
          }),
          clampToGround: true,
        },
      });

      // ── 5. Observer Marker ("YOU") ───────────────────────────────────────────
      observerRef.current = viewer.entities.add({
        name: "Observer",
        position: Cesium.Cartesian3.fromDegrees(p.userLon, p.userLat, 0),
        point: {
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString("#38bdf8"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: "YOU",
          font: "bold 11px monospace",
          fillColor: Cesium.Color.fromCssColorString("#38bdf8"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    };

    boot().catch(console.error);

    return () => {
      destroyed = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      initDoneRef.current = false;
    };
  }, []);

  // ── UPDATE: Seamlessly synchronize entity positions on telemetry tick ─────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const update = async () => {
      const Cesium = await import("cesium");
      const altM = altitude * 1000;

      // Update Satellite entity position & icon
      if (satEntityRef.current) {
        satEntityRef.current.position = Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          altM
        );
        if (satEntityRef.current.billboard) {
          satEntityRef.current.billboard.image = iconSvg || "/textures/satellites/iss.svg";
        }
        if (satEntityRef.current.label) {
          satEntityRef.current.label.text = satelliteName.toUpperCase();
          satEntityRef.current.label.fillColor = Cesium.Color.fromCssColorString(
            themeColor || "#00f0ff"
          );
        }
      }

      // Update Past Trail
      if (pastTrailRef.current) {
        const pastCoords = [...(orbitTrail || []), { lat: latitude, lon: longitude }];
        const pos = pastCoords.flatMap((pt) => [pt.lon, pt.lat, altM]);
        pastTrailRef.current.polyline.positions =
          Cesium.Cartesian3.fromDegreesArrayHeights(pos);
      }

      // Update Future Trail
      if (futureTrailRef.current) {
        const futureCoords = [{ lat: latitude, lon: longitude }, ...(futureOrbit || [])];
        const pos = futureCoords.flatMap((pt) => [pt.lon, pt.lat, altM]);
        futureTrailRef.current.polyline.positions =
          Cesium.Cartesian3.fromDegreesArrayHeights(pos);
      }

      // Update Footprint
      if (footprintRef.current) {
        const fp = computeFootprintCircle(latitude, longitude, altitude);
        footprintRef.current.polyline.positions =
          Cesium.Cartesian3.fromDegreesArray(fp);
      }

      // Update Observer
      if (observerRef.current) {
        observerRef.current.position = Cesium.Cartesian3.fromDegrees(
          userLon,
          userLat,
          0
        );
      }
    };

    update().catch(console.error);
  }, [
    satelliteId,
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitude,
    orbitTrail,
    futureOrbit,
    userLat,
    userLon,
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#020713" }}
    />
  );
}
