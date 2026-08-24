"use client";

/**
 * ISS3DGlobe — Fast 3D-looking canvas globe for real-time ISS tracking.
 *
 * Rendering technique (main-thread safe):
 *   - Earth texture rendered via ctx.drawImage() with a circular clip mask.
 *   - Horizontal offset of the drawImage simulates globe rotation (non-blocking).
 *   - Lambertian day/night lighting applied via a radial gradient overlay.
 *   - Orbital tracks projected onto the visible hemisphere using sphere math.
 *   - ISS drawn at true altitude above surface with dashed connector.
 *   - Footprint rendered as a dashed ellipse on the sphere face.
 *
 * IMPORTANT: No per-pixel scanline loops. All heavy work is GPU-delegated
 * through canvas compositing, keeping the main thread unblocked.
 */

import { useEffect, useRef } from "react";

export interface ISS3DGlobeProps {
  latitude: number;
  longitude: number;
  altitude: number; // km
  orbitTrail: { lat: number; lon: number }[];
  futureOrbit: { lat: number; lon: number }[];
  userLat: number;
  userLon: number;
  autoRotate?: boolean;
}

/** Convert geodetic lat/lon (degrees) to unit-sphere XYZ. */
function latLonToXYZ(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  ];
}

/**
 * Project a unit-sphere point [x,y,z] (already world-rotated by rotY)
 * into screen (px, py) with orthographic projection.
 * Returns visible=false when the point is on the back hemisphere.
 */
function project(
  x: number, y: number, z: number,
  rotY: number,
  cx: number, cy: number,
  radius: number,
  radialFrac = 1.0
): { px: number; py: number; visible: boolean } {
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);
  const rx = x * cosR + z * sinR;
  const ry = y;
  const rz = -x * sinR + z * cosR;
  return {
    px: cx + rx * radius * radialFrac,
    py: cy - ry * radius * radialFrac,
    visible: rz > -0.08,
  };
}

/** Draw a great-circle polyline, skipping back-hemisphere segments. */
function drawOrbitTrack(
  ctx: CanvasRenderingContext2D,
  points: { lat: number; lon: number }[],
  rotY: number,
  cx: number, cy: number, radius: number,
  color: string,
  width: number
) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowBlur = 7;
  ctx.shadowColor = color;
  ctx.beginPath();
  let penDown = false;
  let prevVis = false;
  for (const pt of points) {
    const [x, y, z] = latLonToXYZ(pt.lat, pt.lon);
    const { px, py, visible } = project(x, y, z, rotY, cx, cy, radius);
    if (!visible) {
      if (penDown) { ctx.stroke(); ctx.beginPath(); penDown = false; }
      prevVis = false;
      continue;
    }
    if (!penDown || !prevVis) { ctx.moveTo(px, py); penDown = true; }
    else ctx.lineTo(px, py);
    prevVis = true;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

/** Draw the ISS visibility footprint as a dashed polyline. */
function drawFootprint(
  ctx: CanvasRenderingContext2D,
  satLat: number, satLon: number, altKm: number,
  rotY: number,
  cx: number, cy: number, radius: number
) {
  const Re = 6371;
  const alpha = Math.acos(Re / (Re + altKm));
  const latR = (satLat * Math.PI) / 180;
  const lonR = (satLon * Math.PI) / 180;

  const sx = Math.cos(latR) * Math.cos(lonR);
  const sy = Math.sin(latR);
  const sz = Math.cos(latR) * Math.sin(lonR);

  // East basis vector
  let ex = -sz, ey = 0, ez = sx;
  const eLen = Math.sqrt(ex * ex + ey * ey + ez * ez) || 1;
  ex /= eLen; ey /= eLen; ez /= eLen;

  // North (on sphere) basis vector = sat × east
  const nx = sy * ez - sz * ey;
  const ny = sz * ex - sx * ez;
  const nz = sx * ey - sy * ex;

  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);
  const N = 96;

  ctx.save();
  ctx.strokeStyle = "rgba(239,68,68,0.8)";
  ctx.lineWidth = 1.8;
  ctx.setLineDash([5, 4]);
  ctx.shadowBlur = 5;
  ctx.shadowColor = "#ef4444";
  ctx.beginPath();

  let first = true;
  let prevVis = false;
  for (let i = 0; i <= N; i++) {
    const phi = (i / N) * 2 * Math.PI;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const px3 = cosA * sx + sinA * (cp * ex + sp * nx);
    const py3 = cosA * sy + sinA * (cp * ey + sp * ny);
    const pz3 = cosA * sz + sinA * (cp * ez + sp * nz);
    const { px, py, visible } = project(px3, py3, pz3, rotY, cx, cy, radius);
    if (!visible) {
      if (!first) { ctx.stroke(); ctx.beginPath(); }
      first = true; prevVis = false;
      continue;
    }
    if (first || !prevVis) { ctx.moveTo(px, py); first = false; }
    else ctx.lineTo(px, py);
    prevVis = true;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

export default function ISS3DGlobe({
  latitude,
  longitude,
  altitude,
  orbitTrail,
  futureOrbit,
  userLat,
  userLon,
  autoRotate = true,
}: ISS3DGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const rotYRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgReadyRef = useRef(false);

  // Keep latest prop values without re-initialising the rAF loop
  const propsRef = useRef({ latitude, longitude, altitude, orbitTrail, futureOrbit, userLat, userLon });
  propsRef.current = { latitude, longitude, altitude, orbitTrail, futureOrbit, userLat, userLon };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Preload earth texture
    const img = new Image();
    img.src = "/textures/planets/earth.jpg";
    img.onload = () => { imgReadyRef.current = true; };
    imgRef.current = img;

    const render = () => {
      const { latitude: lat, longitude: lon, altitude: alt,
              orbitTrail: past, futureOrbit: future,
              userLat: uLat, userLon: uLon } = propsRef.current;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        animRef.current = requestAnimationFrame(render);
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = rect.width;
      const h = rect.height;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // ── Background ──────────────────────────────────────────────────────────
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "#060e1e");
      bg.addColorStop(1, "#010408");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Static star field (fixed positions relative to canvas)
      const starPositions = [
        [0.08, 0.12], [0.15, 0.72], [0.22, 0.35], [0.31, 0.88],
        [0.44, 0.07], [0.52, 0.62], [0.61, 0.23], [0.73, 0.81],
        [0.82, 0.44], [0.91, 0.18], [0.06, 0.55], [0.38, 0.47],
        [0.67, 0.93], [0.88, 0.67], [0.19, 0.29], [0.56, 0.11],
        [0.76, 0.51], [0.42, 0.79], [0.95, 0.33], [0.29, 0.61],
      ];
      for (let i = 0; i < starPositions.length; i++) {
        const [sx, sy] = starPositions[i];
        const ss = 0.6 + (i % 4) * 0.35;
        const sa = 0.35 + (i % 3) * 0.22;
        ctx.fillStyle = `rgba(255,255,255,${sa})`;
        ctx.beginPath();
        ctx.arc(sx * w, sy * h, ss, 0, Math.PI * 2);
        ctx.fill();
      }

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.42;

      // ── Auto-rotate to track ISS longitude ──────────────────────────────────
      if (autoRotate) {
        const target = -(lon * Math.PI) / 180;
        let diff = target - rotYRef.current;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        rotYRef.current += diff * 0.012 + 0.0004;
      }
      const rotY = rotYRef.current;

      // ── 1. EARTH SPHERE (fast drawImage approach) ────────────────────────────
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      if (imgReadyRef.current && imgRef.current) {
        const img = imgRef.current;
        // Map rotY → pixel offset in texture.
        // rotY=0 means prime meridian centred; rotY increases → shifts right
        const normOffset = ((rotY / (2 * Math.PI)) % 1 + 1) % 1;
        const texW = img.naturalWidth;
        const texH = img.naturalHeight;

        // Draw the image twice (to handle wrap-around) at the computed x-offset
        const xOffset = -(normOffset * texW * (radius * 2 / texW));
        const scale = (radius * 2) / texH;
        const drawW = texW * scale;
        const drawH = texH * scale;
        const startX = cx - radius + xOffset;
        const startY = cy - radius;

        ctx.drawImage(img, startX, startY, drawW, drawH);
        // Second copy for wrap-around
        if (startX > cx - radius) {
          ctx.drawImage(img, startX - drawW, startY, drawW, drawH);
        } else {
          ctx.drawImage(img, startX + drawW, startY, drawW, drawH);
        }

        // Day/Night lighting overlay (shadow half on the right)
        const lightGrad = ctx.createRadialGradient(
          cx - radius * 0.25, cy - radius * 0.2, radius * 0.1,
          cx, cy, radius
        );
        lightGrad.addColorStop(0, "rgba(0,0,0,0)");
        lightGrad.addColorStop(0.55, "rgba(0,0,0,0.05)");
        lightGrad.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = lightGrad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      } else {
        // Fallback solid sphere while texture loads
        const fallback = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.25, radius * 0.05, cx, cy, radius);
        fallback.addColorStop(0, "#3b82f6");
        fallback.addColorStop(0.6, "#1e40af");
        fallback.addColorStop(1, "#0f172a");
        ctx.fillStyle = fallback;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }

      ctx.restore(); // remove clip

      // ── 2. ATMOSPHERE GLOW ──────────────────────────────────────────────────
      const atmos = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.14);
      atmos.addColorStop(0, "rgba(56,189,248,0.24)");
      atmos.addColorStop(0.5, "rgba(56,189,248,0.08)");
      atmos.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = atmos;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.14, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      const spec = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.32, 0, cx, cy, radius);
      spec.addColorStop(0, "rgba(255,255,255,0.14)");
      spec.addColorStop(0.4, "rgba(255,255,255,0.03)");
      spec.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = spec;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      // ── 3. ORBIT TRACKS ─────────────────────────────────────────────────────
      if (past && past.length > 1)
        drawOrbitTrack(ctx, past, rotY, cx, cy, radius, "#84cc16", 2.5);
      if (future && future.length > 1)
        drawOrbitTrack(ctx, future, rotY, cx, cy, radius, "#f97316", 2.0);

      // ── 4. FOOTPRINT ────────────────────────────────────────────────────────
      if (alt > 0)
        drawFootprint(ctx, lat, lon, alt, rotY, cx, cy, radius);

      // ── 5. OBSERVER MARKER ──────────────────────────────────────────────────
      {
        const [ux, uy, uz] = latLonToXYZ(uLat, uLon);
        const { px, py, visible } = project(ux, uy, uz, rotY, cx, cy, radius);
        if (visible) {
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = "#38bdf8";
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.font = "bold 10px monospace";
          ctx.fillStyle = "#38bdf8";
          ctx.textAlign = "center";
          ctx.fillText("YOU", px, py - 9);
          ctx.restore();
        }
      }

      // ── 6. ISS MARKER at true altitude ──────────────────────────────────────
      {
        const Re = 6371;
        const radialFrac = (Re + alt) / Re;
        const [sx, sy, sz] = latLonToXYZ(lat, lon);
        const surf = project(sx, sy, sz, rotY, cx, cy, radius, 1.0);
        const iss = project(sx, sy, sz, rotY, cx, cy, radius, radialFrac);

        if (iss.visible) {
          // Altitude connector line
          if (surf.visible) {
            ctx.save();
            ctx.strokeStyle = "rgba(0,240,255,0.45)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(surf.px, surf.py);
            ctx.lineTo(iss.px, iss.py);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // ISS glow halo
          const glow = ctx.createRadialGradient(iss.px, iss.py, 0, iss.px, iss.py, 20);
          glow.addColorStop(0, "rgba(0,240,255,0.45)");
          glow.addColorStop(1, "rgba(0,240,255,0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(iss.px, iss.py, 20, 0, Math.PI * 2);
          ctx.fill();

          // ISS icon (solar arrays + truss)
          ctx.save();
          ctx.translate(iss.px, iss.py);
          const sc = Math.max(0.55, Math.min(1.3, radius / 130));
          ctx.scale(sc, sc);
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#38bdf8";
          // Solar panels
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(-18, -10, 8, 20);
          ctx.fillRect(10, -10, 8, 20);
          // Panel grid lines
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 0.6;
          for (let i = -6; i <= 6; i += 4) {
            ctx.beginPath(); ctx.moveTo(-18, i); ctx.lineTo(-10, i); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(10, i); ctx.lineTo(18, i); ctx.stroke();
          }
          // Main truss
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#e2e8f0";
          ctx.fillRect(-10, -3, 20, 6);
          // Beacon
          ctx.fillStyle = "#10b981";
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#10b981";
          ctx.beginPath();
          ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();

          // ISS label callout
          const lx = Math.max(72, Math.min(w - 72, iss.px));
          const ly = Math.max(32, iss.py - 34);
          ctx.save();
          ctx.fillStyle = "rgba(2,6,23,0.92)";
          ctx.strokeStyle = "rgba(0,240,255,0.7)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(lx - 65, ly - 13, 130, 24, 6);
          else ctx.rect(lx - 65, ly - 13, 130, 24);
          ctx.fill(); ctx.stroke();
          ctx.font = "bold 10px monospace";
          ctx.fillStyle = "#00f0ff";
          ctx.textAlign = "center";
          ctx.fillText(`ISS  ${alt.toFixed(0)} km`, lx, ly + 2);
          ctx.restore();
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [autoRotate]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-label="3D Earth Globe showing live ISS orbital position, footprint, and ground track"
    />
  );
}
