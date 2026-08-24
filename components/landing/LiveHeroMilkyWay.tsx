"use client";

/**
 * LiveHeroMilkyWay — Pure Majestic Deep Space View of the Milky Way Galaxy.
 * Features:
 *   - Iconic NASA/JPL-Caltech Milky Way Barred Spiral Galaxy (PIA10748)
 *   - Instant image hydration with procedural fallback so canvas is NEVER blank
 *   - 100% Borderless & Clean: Pure galaxy floating in deep space
 *   - Smooth 3D Gyroscopic Perspective Tilt on Mouse Movement
 */

import { useRef, useEffect, useState, useCallback } from "react";

export default function LiveHeroMilkyWay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: 0, y: 0 });
    setIsHovered(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;
    let isLoaded = false;

    // Offscreen masked canvas for ultra-smooth edge feathering into deep space
    const offscreen = document.createElement("canvas");
    const oCtx = offscreen.getContext("2d");
    const size = 1024;
    offscreen.width = size;
    offscreen.height = size;

    const setupOffscreen = (img: HTMLImageElement) => {
      if (!oCtx) return;
      oCtx.clearRect(0, 0, size, size);
      oCtx.save();
      oCtx.drawImage(img, 0, 0, size, size);

      // Smooth radial fadeout on outer perimeter
      oCtx.globalCompositeOperation = "destination-in";
      const featherGrad = oCtx.createRadialGradient(
        size / 2,
        size / 2,
        size * 0.22,
        size / 2,
        size / 2,
        size * 0.48
      );
      featherGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
      featherGrad.addColorStop(0.75, "rgba(0, 0, 0, 0.85)");
      featherGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      oCtx.fillStyle = featherGrad;
      oCtx.fillRect(0, 0, size, size);
      oCtx.restore();
      isLoaded = true;
    };

    // Load authentic NASA Barred Spiral Galaxy texture (PIA10748)
    const galaxyImg = new window.Image();
    galaxyImg.onload = () => {
      setupOffscreen(galaxyImg);
    };
    galaxyImg.src = "/textures/planets/galaxy.jpg";

    if (galaxyImg.complete && galaxyImg.naturalWidth > 0) {
      setupOffscreen(galaxyImg);
    }

    const render = () => {
      time += 0.002;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width || 480;
      const height = rect.height || 480;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseR = Math.min(width, height) * 0.48;

      // 3D Gyroscopic tilt responding to mouse cursor
      const targetPitch = 0.52 + (isHovered ? mousePos.y * 0.16 : Math.sin(time * 0.5) * 0.03);
      const targetYaw = isHovered ? mousePos.x * 0.22 : Math.sin(time * 0.3) * 0.05;
      const sinPitch = Math.sin(targetPitch);

      // ── 1. Soft Cosmic Nebula Glow Background ─────────────────────────────
      const spaceGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.15);
      spaceGlow.addColorStop(0, "rgba(56, 189, 248, 0.15)");
      spaceGlow.addColorStop(0.4, "rgba(147, 51, 234, 0.06)");
      spaceGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = spaceGlow;
      ctx.beginPath();
      ctx.ellipse(cx, cy, baseR * 1.1, baseR * 1.1 * sinPitch, targetYaw, 0, Math.PI * 2);
      ctx.fill();

      // ── 2. Real NASA 3D Rotating Milky Way Galaxy or Procedural Spiral ─────
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(targetYaw);
      ctx.scale(1, sinPitch);
      ctx.rotate(time * 0.25); // Slow majestic rotation

      if (isLoaded) {
        ctx.drawImage(offscreen, -baseR, -baseR, baseR * 2, baseR * 2);
      } else {
        // Procedural vibrant spiral galaxy while texture loads
        const coreGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, baseR * 0.55);
        coreGlow.addColorStop(0, "rgba(255, 255, 240, 0.95)");
        coreGlow.addColorStop(0.2, "rgba(251, 191, 36, 0.6)");
        coreGlow.addColorStop(0.5, "rgba(56, 189, 248, 0.3)");
        coreGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(0, 0, baseR * 0.55, 0, Math.PI * 2);
        ctx.fill();

        // Spiral Arms
        for (let arm = 0; arm < 4; arm++) {
          const armAngle = (arm * Math.PI) / 2;
          for (let p = 0; p < 80; p++) {
            const r = (p / 80) * baseR * 0.9;
            const theta = armAngle + (p / 80) * Math.PI * 2.8;
            const px = r * Math.cos(theta);
            const py = r * Math.sin(theta);
            const pSize = Math.max(1, (1 - p / 80) * 2.5);
            ctx.fillStyle = arm % 2 === 0 ? "rgba(186, 230, 253, 0.7)" : "rgba(244, 114, 182, 0.6)";
            ctx.beginPath();
            ctx.arc(px, py, pSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.restore();
      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [mousePos, isHovered]);

  return (
    <div
      className="relative w-full max-w-[660px] aspect-square flex items-center justify-center select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* 100% Clean Canvas — pure galaxy floating in space */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        aria-label="NASA Milky Way Barred Spiral Galaxy Deep Space View"
      />
    </div>
  );
}
