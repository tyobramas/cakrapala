"use client";

import { useEffect, useRef } from "react";
import {
  computeGreatCircleFootprint,
  computeSolarTerminatorCurve,
} from "@/lib/satellites/sgp4Precision";

export interface SatelliteGroundTrack2DProps {
  satelliteName: string;
  iconSvg: string;
  themeColor: string;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  lighting: "sunlit" | "eclipsed";
  solarLatDeg: number;
  solarLonDeg: number;
  pastTrail: { lat: number; lon: number }[];
  futureOrbit: { lat: number; lon: number }[];
  observerLat: number;
  observerLon: number;
  observerLabel: string;
  isAboveHorizon: boolean;
}

/**
 * Precision 2D Equirectangular Ground Track Map with:
 *   - Real-time curved Solar Terminator & Night Shadow
 *   - True Spherical Great-Circle Visibility Footprint
 *   - Antimeridian-safe Past (-45m) & Future (+95m) SGP4 Ground Tracks
 *   - Live Observer Pin & Line-of-Sight Link when satellite is above horizon
 */
export default function SatelliteGroundTrack2D({
  satelliteName,
  iconSvg,
  themeColor,
  latitude,
  longitude,
  altitudeKm,
  lighting,
  solarLatDeg,
  solarLonDeg,
  pastTrail,
  futureOrbit,
  observerLat,
  observerLon,
  observerLabel,
  isAboveHorizon,
}: SatelliteGroundTrack2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const earthImgRef = useRef<HTMLImageElement | null>(null);
  const iconImgRef = useRef<HTMLImageElement | null>(null);
  const iconSrcRef = useRef<string>("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!earthImgRef.current) {
      const img = new Image();
      img.src = "/textures/planets/hd/earth.webp";
      img.onerror = () => {
        img.src = "/textures/planets/earth.jpg";
      };
      earthImgRef.current = img;
    }

    if (iconSrcRef.current !== iconSvg) {
      iconSrcRef.current = iconSvg;
      const ic = new Image();
      ic.src = iconSvg;
      iconImgRef.current = ic;
    }

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const tw = Math.round(w * dpr);
      const th = Math.round(h * dpr);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }

      const toX = (lon: number) => ((lon + 180) / 360) * w;
      const toY = (lat: number) => ((90 - lat) / 180) * h;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // 1. Base Earth Map Texture
      const earthImg = earthImgRef.current;
      if (earthImg && earthImg.complete && earthImg.naturalWidth > 0) {
        ctx.drawImage(earthImg, 0, 0, w, h);
        ctx.fillStyle = "rgba(2, 6, 18, 0.22)";
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = "#040d1e";
        ctx.fillRect(0, 0, w, h);
      }

      // 2. Real-Time Curved Solar Terminator & Night Hemisphere Shading
      const termPts = computeSolarTerminatorCurve(solarLatDeg, solarLonDeg, 180);
      if (termPts.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(toX(termPts[0].lon), toY(termPts[0].lat));
        for (let i = 1; i < termPts.length; i++) {
          ctx.lineTo(toX(termPts[i].lon), toY(termPts[i].lat));
        }
        // Close polygon toward the dark pole (south pole if solarLat >= 0, north pole if solarLat < 0)
        const darkPoleY = solarLatDeg >= 0 ? h : 0;
        ctx.lineTo(w, darkPoleY);
        ctx.lineTo(0, darkPoleY);
        ctx.closePath();
        ctx.fillStyle = "rgba(2, 6, 20, 0.56)";
        ctx.fill();

        // Subtle golden twilight hairline along exact terminator
        ctx.beginPath();
        ctx.moveTo(toX(termPts[0].lon), toY(termPts[0].lat));
        for (let i = 1; i < termPts.length; i++) {
          ctx.lineTo(toX(termPts[i].lon), toY(termPts[i].lat));
        }
        ctx.strokeStyle = "rgba(251, 191, 36, 0.32)";
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Subtle Lat/Lon Graticule
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 0.6;
      for (let lon = -150; lon <= 150; lon += 30) {
        const x = toX(lon);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = toY(lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // Equator hairline
      ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
      ctx.beginPath();
      ctx.moveTo(0, toY(0));
      ctx.lineTo(w, toY(0));
      ctx.stroke();

      // 4. Subsolar Point Marker
      const sx = toX(solarLonDeg);
      const sy = toY(solarLatDeg);
      const sunGrad = ctx.createRadialGradient(sx, sy, 1, sx, sy, 14);
      sunGrad.addColorStop(0, "rgba(254, 240, 138, 0.95)");
      sunGrad.addColorStop(0.4, "rgba(251, 191, 36, 0.32)");
      sunGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 5. Helper for Antimeridian-Safe Ground Tracks
      const drawTrack = (
        pts: { lat: number; lon: number }[],
        stroke: string,
        lineWidth: number,
        dash: number[],
      ) => {
        if (pts.length < 2) return;
        ctx.save();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dash);
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const x = toX(pts[i].lon);
          const y = toY(pts[i].lat);
          if (i === 0 || Math.abs(pts[i].lon - pts[i - 1].lon) > 180) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      };

      drawTrack(pastTrail, "rgba(52, 211, 153, 0.72)", 1.75, []);
      drawTrack(futureOrbit, "rgba(251, 191, 36, 0.82)", 1.65, [5, 4]);

      // 6. True Spherical Great-Circle Visibility Footprint
      const fpPts = computeGreatCircleFootprint(latitude, longitude, altitudeKm, 80);
      if (fpPts.length > 2) {
        ctx.save();
        ctx.strokeStyle = isAboveHorizon
          ? "rgba(52, 211, 153, 0.85)"
          : "rgba(56, 189, 248, 0.65)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < fpPts.length; i++) {
          const x = toX(fpPts[i].lon);
          const y = toY(fpPts[i].lat);
          if (i === 0 || Math.abs(fpPts[i].lon - fpPts[i - 1].lon) > 180) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // 7. Observer Pin & Active Acquisition Link
      const ox = toX(observerLon);
      const oy = toY(observerLat);
      const satX = toX(longitude);
      const satY = toY(latitude);

      if (isAboveHorizon && Math.abs(longitude - observerLon) < 180) {
        ctx.save();
        ctx.strokeStyle = "rgba(52, 211, 153, 0.65)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(satX, satY);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "600 10px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillText(observerLabel, ox + 9, oy + 3);

      // 8. Live Spacecraft Icon + Compact Telemetry Tag
      const halo = ctx.createRadialGradient(satX, satY, 2, satX, satY, 20);
      halo.addColorStop(0, `${themeColor}66`);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(satX, satY, 20, 0, Math.PI * 2);
      ctx.fill();

      const ic = iconImgRef.current;
      if (ic && ic.complete && ic.naturalWidth > 0) {
        ctx.drawImage(ic, satX - 13, satY - 13, 26, 26);
      } else {
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.arc(satX, satY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = "700 10.5px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(satelliteName, satX + 16, satY - 2);
      ctx.font = "500 9.5px ui-monospace, SFMono-Regular, monospace";
      ctx.fillStyle = lighting === "sunlit" ? "#fde68a" : "#94a3b8";
      ctx.fillText(
        `${altitudeKm.toFixed(0)} km · ${lighting === "sunlit" ? "SUNLIT" : "UMBRA"}`,
        satX + 16,
        satY + 10,
      );

      ctx.restore();
    };

    draw();
    const earthImg = earthImgRef.current;
    const iconImg = iconImgRef.current;
    if (earthImg && !earthImg.complete) earthImg.onload = draw;
    if (iconImg && !iconImg.complete) iconImg.onload = draw;

    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [
    satelliteName,
    iconSvg,
    themeColor,
    latitude,
    longitude,
    altitudeKm,
    lighting,
    solarLatDeg,
    solarLonDeg,
    pastTrail,
    futureOrbit,
    observerLat,
    observerLon,
    observerLabel,
    isAboveHorizon,
  ]);

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#02050d] p-0 sm:p-4">
      <div className="relative aspect-[2/1] max-h-full w-full max-w-[1440px] overflow-hidden rounded-none border-y border-white/[0.08] bg-[#040d1e] shadow-[0_24px_80px_rgba(0,0,0,0.75)] sm:rounded-2xl sm:border">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
