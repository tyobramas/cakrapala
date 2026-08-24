"use client";

import { useEffect, useRef, useState } from "react";

interface PlanetRender {
  id: string;
  name: string;
  distRatio: number;
  radius: number;
  speed: number;
  angle: number;
  rotationAngle: number;
  rotationSpeed: number;
  color: string;
  textureSrc: string;
  hasRing?: boolean;
  ringRadiusRatio?: number;
  details: string;
}

export default function LiveHeroOrrery() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Planet definition with calibrated, non-overlapping orbital radii & distributed initial angles
    const planetImages: Record<string, HTMLImageElement> = {};

    const planetDefs: PlanetRender[] = [
      { id: "mercury", name: "Mercury", distRatio: 0.20, radius: 5.5, speed: 0.007, angle: 0.6, rotationAngle: 0, rotationSpeed: 0.004, color: "#a8a29e", textureSrc: "/textures/planets/mercury.jpg", details: "0.39 AU • 88 Days" },
      { id: "venus", name: "Venus", distRatio: 0.31, radius: 8.5, speed: 0.005, angle: 2.1, rotationAngle: 0, rotationSpeed: 0.003, color: "#fbbf24", textureSrc: "/textures/planets/venus.jpg", details: "0.72 AU • 464°C" },
      { id: "earth", name: "Earth", distRatio: 0.42, radius: 9.5, speed: 0.004, angle: 3.6, rotationAngle: 0, rotationSpeed: 0.006, color: "#38bdf8", textureSrc: "/textures/planets/earth.jpg", details: "1.00 AU • Home World" },
      { id: "mars", name: "Mars", distRatio: 0.53, radius: 7.0, speed: 0.003, angle: 5.0, rotationAngle: 0, rotationSpeed: 0.005, color: "#ef4444", textureSrc: "/textures/planets/mars.jpg", details: "1.52 AU • 687 Days" },
      { id: "jupiter", name: "Jupiter", distRatio: 0.66, radius: 15.0, speed: 0.0016, angle: 0.2, rotationAngle: 0, rotationSpeed: 0.008, color: "#f59e0b", textureSrc: "/textures/planets/jupiter.jpg", details: "5.20 AU • Gas Giant" },
      { id: "saturn", name: "Saturn", distRatio: 0.78, radius: 13.0, speed: 0.0011, angle: 1.7, rotationAngle: 0, rotationSpeed: 0.007, color: "#fde68a", textureSrc: "/textures/planets/saturn.jpg", hasRing: true, ringRadiusRatio: 1.75, details: "9.58 AU • Ring System" },
      { id: "uranus", name: "Uranus", distRatio: 0.89, radius: 10.5, speed: 0.0007, angle: 3.1, rotationAngle: 0, rotationSpeed: 0.005, color: "#22d3ee", textureSrc: "/textures/planets/uranus.jpg", hasRing: true, ringRadiusRatio: 1.4, details: "19.2 AU • Ice Giant" },
      { id: "neptune", name: "Neptune", distRatio: 0.98, radius: 10.0, speed: 0.0005, angle: 4.7, rotationAngle: 0, rotationSpeed: 0.004, color: "#3b82f6", textureSrc: "/textures/planets/neptune.jpg", details: "30.1 AU • 164.8 Yr" },
    ];

    // Preload textures
    planetDefs.forEach((p) => {
      const img = new Image();
      img.src = p.textureSrc;
      planetImages[p.id] = img;
    });

    const sunImg = new Image();
    sunImg.src = "/textures/planets/sun.jpg";

    let mousePos = { x: -1000, y: -1000 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mousePos = { x: -1000, y: -1000 };
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let sunPulseAngle = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Clear transparently
      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      // Generous orbit radius utilizing available container
      const maxOrbitRadius = Math.min(width, height) * 0.46;

      sunPulseAngle += 0.015;

      // ── 1. Interstellar Nebula Glow ──────────────────────────────────────────
      const nebulaGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        15,
        centerX,
        centerY,
        maxOrbitRadius * 1.12
      );
      nebulaGrad.addColorStop(0, "rgba(217, 70, 239, 0.15)");
      nebulaGrad.addColorStop(0.35, "rgba(99, 102, 241, 0.10)");
      nebulaGrad.addColorStop(0.7, "rgba(14, 165, 233, 0.04)");
      nebulaGrad.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = nebulaGrad;
      ctx.fillRect(0, 0, width, height);

      // ── 2. Concentric Orbital Rings ─────────────────────────────────────────
      planetDefs.forEach((p) => {
        const orbitR = p.distRatio * maxOrbitRadius;
        ctx.beginPath();
        ctx.arc(centerX, centerY, orbitR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(148, 163, 184, 0.16)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // ── 3. Central Sun (Balanced size so it doesn't overlap Mercury) ─────────
      const sunRadius = Math.max(20, maxOrbitRadius * 0.09);
      const sunGlow = 3 + Math.sin(sunPulseAngle) * 2;

      // Soft Corona Glow (Restrained radius so it stays well within Mercury's orbit)
      const coronaGrad = ctx.createRadialGradient(
        centerX,
        centerY,
        sunRadius * 0.5,
        centerX,
        centerY,
        sunRadius * 1.8 + sunGlow
      );
      coronaGrad.addColorStop(0, "rgba(254, 240, 138, 0.9)");
      coronaGrad.addColorStop(0.4, "rgba(249, 115, 22, 0.5)");
      coronaGrad.addColorStop(0.8, "rgba(239, 68, 68, 0.15)");
      coronaGrad.addColorStop(1, "rgba(239, 68, 68, 0)");
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sunRadius * 1.8 + sunGlow, 0, Math.PI * 2);
      ctx.fill();

      // Sun Photosphere Texture Sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
      ctx.clip();

      if (sunImg.complete && sunImg.naturalWidth > 0) {
        ctx.drawImage(
          sunImg,
          centerX - sunRadius,
          centerY - sunRadius,
          sunRadius * 2,
          sunRadius * 2
        );
      } else {
        const sunBodyGrad = ctx.createRadialGradient(
          centerX - 3,
          centerY - 3,
          2,
          centerX,
          centerY,
          sunRadius
        );
        sunBodyGrad.addColorStop(0, "#ffffff");
        sunBodyGrad.addColorStop(0.4, "#fbbf24");
        sunBodyGrad.addColorStop(1, "#b45309");
        ctx.fillStyle = sunBodyGrad;
        ctx.fill();
      }
      ctx.restore();

      // ── 4. Render Orbiting & Rotating Planets ────────────────────────────────
      planetDefs.forEach((p) => {
        if (!isPaused) {
          p.angle += p.speed * 0.35 * speedMultiplier;
          p.rotationAngle += p.rotationSpeed * 0.5;
        }

        const orbitR = p.distRatio * maxOrbitRadius;
        const px = centerX + Math.cos(p.angle) * orbitR;
        const py = centerY + Math.sin(p.angle) * orbitR;

        // Check hover
        const dx = mousePos.x - px;
        const dy = mousePos.y - py;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        const isHovered = distToMouse < p.radius + 10;

        // Draw Saturn ring behind planet
        if (p.hasRing && p.ringRadiusRatio) {
          const ringR = p.radius * p.ringRadiusRatio;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(0.35);
          ctx.scale(1, 0.35);

          ctx.beginPath();
          ctx.arc(0, 0, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(253, 230, 138, 0.55)";
          ctx.lineWidth = ringR * 0.35;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, ringR * 1.15, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(217, 119, 6, 0.35)";
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.restore();
        }

        // Draw Planet Sphere with Real NASA Texture
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, p.radius, 0, Math.PI * 2);
        ctx.clip();

        const pImg = planetImages[p.id];
        if (pImg && pImg.complete && pImg.naturalWidth > 0) {
          ctx.translate(px, py);
          ctx.rotate(p.rotationAngle);
          ctx.drawImage(
            pImg,
            -p.radius,
            -p.radius,
            p.radius * 2,
            p.radius * 2
          );
          ctx.rotate(-p.rotationAngle);
          ctx.translate(-px, -py);

          // Realistic Day/Night shadow facing sun
          const sunAngle = Math.atan2(centerY - py, centerX - px);
          const shadowGrad = ctx.createLinearGradient(
            px - Math.cos(sunAngle) * p.radius,
            py - Math.sin(sunAngle) * p.radius,
            px + Math.cos(sunAngle) * p.radius,
            py + Math.sin(sunAngle) * p.radius
          );
          shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
          shadowGrad.addColorStop(0.7, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = shadowGrad;
          ctx.fillRect(px - p.radius, py - p.radius, p.radius * 2, p.radius * 2);
        } else {
          const bodyGrad = ctx.createRadialGradient(
            px - p.radius * 0.3,
            py - p.radius * 0.3,
            p.radius * 0.1,
            px,
            py,
            p.radius
          );
          bodyGrad.addColorStop(0, "#ffffff");
          bodyGrad.addColorStop(0.3, p.color);
          bodyGrad.addColorStop(1, "#030712");
          ctx.fillStyle = bodyGrad;
          ctx.fill();
        }

        ctx.restore();

        // Planet Hover Highlight Ring & Tooltip
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(px, py, p.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.5;
          ctx.shadowBlur = 12;
          ctx.shadowColor = "#38bdf8";
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Tooltip Label Pill
          ctx.font = "bold 11px monospace";
          const label = `${p.name.toUpperCase()} • ${p.details}`;
          const textMetrics = ctx.measureText(label);
          const bgW = textMetrics.width + 16;
          const bgH = 22;

          ctx.fillStyle = "rgba(2, 6, 23, 0.95)";
          ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
          ctx.lineWidth = 1;
          ctx.roundRect(px - bgW / 2, py - p.radius - 32, bgW, bgH, 5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#38bdf8";
          ctx.fillText(label, px - bgW / 2 + 8, py - p.radius - 17);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused, speedMultiplier]);

  return (
    <div className="relative w-full h-full min-h-[480px] sm:min-h-[560px] lg:min-h-[640px] flex items-center justify-center pointer-events-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
      />

      {/* Floating HUD Controls */}
      <div className="absolute bottom-2 right-2 z-20 flex items-center gap-2 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="px-3 py-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 backdrop-blur-md transition-all shadow-md"
        >
          {isPaused ? "RESUME" : "PAUSE"}
        </button>
        <button
          type="button"
          onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 0.5 : 1))}
          className="px-3 py-1.5 rounded-full bg-slate-950/70 border border-slate-800 text-cyan-300 hover:border-cyan-500/40 backdrop-blur-md transition-all shadow-md"
        >
          {speedMultiplier}X SPEED
        </button>
      </div>
    </div>
  );
}
