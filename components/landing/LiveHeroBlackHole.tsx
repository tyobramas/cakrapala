"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Zap, Compass } from "lucide-react";

interface Particle {
  radius: number;
  angle: number;
  speed: number;
  size: number;
  brightness: number;
  hueOffset: number;
  zOffset: number;
}

interface LensedStar {
  baseX: number;
  baseY: number;
  size: number;
  baseBrightness: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

export default function LiveHeroBlackHole() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showJets, setShowJets] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse tilt refs for smooth 3D parallax
  const mouseTargetRef = useRef({ x: 0, y: 0 });
  const mouseSmoothRef = useRef({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    mouseTargetRef.current = { x, y };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseTargetRef.current = { x: 0, y: 0 };
    setIsHovered(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // ── Generate Background Distorted Stars ──────────────────────────────────
    const starCount = 140;
    const backgroundStars: LensedStar[] = [];
    for (let i = 0; i < starCount; i++) {
      backgroundStars.push({
        baseX: (Math.random() - 0.5) * 2.2,
        baseY: (Math.random() - 0.5) * 2.2,
        size: 0.7 + Math.random() * 1.5,
        baseBrightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2.0,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // ── Generate Accretion Disk Plasma Particles ─────────────────────────────
    const particleCount = 420;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      // Differential Keplerian radial distribution (dense closer to ISCO)
      const u = Math.random();
      const r = 0.22 + Math.pow(u, 1.8) * 0.76; // normalized [0.22, 0.98]
      // Keplerian angular velocity omega = sqrt(GM / r^3) -> faster inner orbit
      const speed = 0.012 / Math.sqrt(Math.max(0.1, r * r * r));
      particles.push({
        radius: r,
        angle: Math.random() * Math.PI * 2,
        speed: speed * (0.85 + Math.random() * 0.3),
        size: 1.2 + Math.random() * 2.8,
        brightness: 0.4 + Math.random() * 0.6,
        hueOffset: (Math.random() - 0.5) * 30,
        zOffset: (Math.random() - 0.5) * 0.08,
      });
    }

    let time = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Smooth mouse interpolation
      mouseSmoothRef.current.x += (mouseTargetRef.current.x - mouseSmoothRef.current.x) * 0.06;
      mouseSmoothRef.current.y += (mouseTargetRef.current.y - mouseSmoothRef.current.y) * 0.06;

      const cx = w * 0.5;
      const cy = h * 0.5;
      const baseRadius = Math.min(w, h) * 0.42;

      // 3D Tilt Matrix with interactive mouse pitch & yaw
      const pitch = 0.38 + mouseSmoothRef.current.y * 0.28; // angle looking down at disk
      const yaw = mouseSmoothRef.current.x * 0.22;
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);

      if (!isPaused) {
        time += 0.016 * speedMultiplier;
      }

      // ── 1. BACKGROUND RELATIVISTICALLY LENSED STARS ─────────────────────────
      const shadowRadius = baseRadius * 0.22;
      const einsteinRadius = shadowRadius * 1.55;

      for (const star of backgroundStars) {
        let sx = star.baseX * baseRadius * 1.1;
        let sy = star.baseY * baseRadius * 1.1;

        const dist = Math.hypot(sx, sy);
        if (dist > 0.01) {
          // Gravitational lensing deflection
          const lensedDist = dist + (einsteinRadius * einsteinRadius) / (dist + shadowRadius * 0.4);
          const factor = lensedDist / dist;
          sx *= factor;
          sy *= factor;
        }

        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
        const alpha = Math.min(1, star.baseBrightness * twinkle);

        ctx.fillStyle = `rgba(224, 242, 254, ${alpha})`;
        ctx.beginPath();
        ctx.arc(cx + sx, cy + sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 2. RELATIVISTIC BIPOLAR JET BEAMS (If Enabled) ──────────────────────
      if (showJets) {
        const jetLength = baseRadius * 1.15;
        const jetGlow = Math.sin(time * 3) * 0.15 + 0.85;

        // Top Polar Jet
        const topJetGrad = ctx.createLinearGradient(cx, cy, cx + yaw * 30, cy - jetLength);
        topJetGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
        topJetGrad.addColorStop(0.3, `rgba(99, 102, 241, ${0.45 * jetGlow})`);
        topJetGrad.addColorStop(0.7, `rgba(168, 85, 247, ${0.2 * jetGlow})`);
        topJetGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.save();
        ctx.fillStyle = topJetGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - shadowRadius * 0.5);
        ctx.lineTo(cx - 35, cy - jetLength);
        ctx.lineTo(cx + 35, cy - jetLength);
        ctx.lineTo(cx + 5, cy - shadowRadius * 0.5);
        ctx.closePath();
        ctx.fill();

        // Bottom Polar Jet
        const botJetGrad = ctx.createLinearGradient(cx, cy, cx - yaw * 30, cy + jetLength);
        botJetGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
        botJetGrad.addColorStop(0.3, `rgba(99, 102, 241, ${0.45 * jetGlow})`);
        botJetGrad.addColorStop(0.7, `rgba(168, 85, 247, ${0.2 * jetGlow})`);
        botJetGrad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.fillStyle = botJetGrad;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + shadowRadius * 0.5);
        ctx.lineTo(cx - 35, cy + jetLength);
        ctx.lineTo(cx + 35, cy + jetLength);
        ctx.lineTo(cx + 5, cy + shadowRadius * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // ── 3. GRAVITATIONAL LENSING HALO (Back of Disk Bent Over Top & Under Bottom) ─
      const innerDiskR = baseRadius * 0.32;
      const outerDiskR = baseRadius * 0.95;

      // Outer Gravitational Lensing Glow Ring
      const lensGlow = ctx.createRadialGradient(cx, cy, shadowRadius * 0.9, cx, cy, outerDiskR * 0.75);
      lensGlow.addColorStop(0, "rgba(255, 180, 50, 0.95)");
      lensGlow.addColorStop(0.25, "rgba(245, 120, 20, 0.65)");
      lensGlow.addColorStop(0.6, "rgba(220, 60, 20, 0.28)");
      lensGlow.addColorStop(1, "rgba(180, 30, 20, 0)");

      ctx.save();
      ctx.fillStyle = lensGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, outerDiskR * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Upper Arched Lensing Halo (Light from behind disk curving over black hole)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy - shadowRadius * 0.35, outerDiskR * 0.58, outerDiskR * 0.44 * sinPitch, 0, Math.PI, 0);
      ctx.lineWidth = shadowRadius * 0.65;
      const upperHaloGrad = ctx.createLinearGradient(cx - outerDiskR * 0.5, cy, cx + outerDiskR * 0.5, cy);
      // Relativistic Doppler Beaming: Left side approaching is brighter & bluer
      upperHaloGrad.addColorStop(0, "rgba(255, 240, 200, 0.92)");
      upperHaloGrad.addColorStop(0.35, "rgba(251, 191, 36, 0.78)");
      upperHaloGrad.addColorStop(0.7, "rgba(239, 68, 68, 0.45)");
      upperHaloGrad.addColorStop(1, "rgba(185, 28, 28, 0.15)");
      ctx.strokeStyle = upperHaloGrad;
      ctx.stroke();
      ctx.restore();

      // Lower Inverted Arched Lensing Halo (Light curving under black hole)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy + shadowRadius * 0.35, outerDiskR * 0.52, outerDiskR * 0.38 * sinPitch, 0, 0, Math.PI);
      ctx.lineWidth = shadowRadius * 0.45;
      const lowerHaloGrad = ctx.createLinearGradient(cx - outerDiskR * 0.5, cy, cx + outerDiskR * 0.5, cy);
      lowerHaloGrad.addColorStop(0, "rgba(255, 230, 180, 0.85)");
      lowerHaloGrad.addColorStop(0.4, "rgba(245, 158, 11, 0.65)");
      lowerHaloGrad.addColorStop(0.8, "rgba(220, 38, 38, 0.35)");
      lowerHaloGrad.addColorStop(1, "rgba(153, 27, 27, 0.1)");
      ctx.strokeStyle = lowerHaloGrad;
      ctx.stroke();
      ctx.restore();

      // ── 4. EQUATORIAL ACCRETION DISK (Primary Fiery Plasma Disk) ───────────
      // Render back-half of primary disk (y < 0)
      for (const p of particles) {
        if (!isPaused) {
          p.angle += p.speed * speedMultiplier;
        }

        const pr = innerDiskR + p.radius * (outerDiskR - innerDiskR);
        const diskX = Math.cos(p.angle) * pr;
        const diskY = Math.sin(p.angle) * pr;

        // 3D projected coordinates on tilted accretion plane
        const projX = cx + diskX;
        const projY = cy + diskY * sinPitch + p.zOffset * baseRadius;

        // Depth check: behind black hole?
        const isBack = diskY < 0;

        // Relativistic Doppler Beaming Factor (Left side approaches -> cos(angle) < 0)
        const dopplerFactor = Math.max(0.2, Math.min(1.8, 1.0 - Math.sin(p.angle) * 0.85));

        // Color temperature based on radius & Doppler beaming
        let rCol = 255;
        let gCol = Math.round(140 * dopplerFactor);
        let bCol = Math.round(40 * Math.max(0.1, dopplerFactor - 0.5) * 2);
        if (dopplerFactor > 1.3) {
          // Intense blueshifted white-hot plasma
          gCol = Math.min(255, gCol + 80);
          bCol = Math.min(255, bCol + 150);
        }

        const alpha = Math.min(1, p.brightness * dopplerFactor * (isBack ? 0.65 : 0.95));

        ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(projX, projY, p.size * (isBack ? 0.8 : 1.1), 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 5. EVENT HORIZON SHADOW & PHOTON SPHERE RING ───────────────────────
      // Pure Black Void (The Event Horizon)
      ctx.save();
      ctx.fillStyle = "#010409";
      ctx.beginPath();
      ctx.arc(cx, cy, shadowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Razor-Thin Ultra-Bright Photon Ring (r = 1.5 Rs)
      ctx.lineWidth = 2.2;
      const photonGrad = ctx.createLinearGradient(cx - shadowRadius, cy, cx + shadowRadius, cy);
      photonGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
      photonGrad.addColorStop(0.2, "rgba(254, 240, 138, 0.95)");
      photonGrad.addColorStop(0.6, "rgba(245, 158, 11, 0.75)");
      photonGrad.addColorStop(1, "rgba(239, 68, 68, 0.35)");
      ctx.strokeStyle = photonGrad;
      ctx.stroke();

      // Inner Shadow Soft Falloff
      const innerShadow = ctx.createRadialGradient(cx, cy, shadowRadius * 0.85, cx, cy, shadowRadius * 1.02);
      innerShadow.addColorStop(0, "rgba(1, 4, 9, 1)");
      innerShadow.addColorStop(0.9, "rgba(1, 4, 9, 0.98)");
      innerShadow.addColorStop(1, "rgba(255, 180, 50, 0.4)");
      ctx.fillStyle = innerShadow;
      ctx.beginPath();
      ctx.arc(cx, cy, shadowRadius * 1.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ── 6. FRONT HALF ACCRETION DISK OVERLAY ────────────────────────────────
      // Render front particles with highest depth priority over event horizon
      for (const p of particles) {
        const pr = innerDiskR + p.radius * (outerDiskR - innerDiskR);
        const diskX = Math.cos(p.angle) * pr;
        const diskY = Math.sin(p.angle) * pr;

        if (diskY >= 0) {
          const projX = cx + diskX;
          const projY = cy + diskY * sinPitch + p.zOffset * baseRadius;

          const dopplerFactor = Math.max(0.2, Math.min(1.8, 1.0 - Math.sin(p.angle) * 0.85));

          let rCol = 255;
          let gCol = Math.round(150 * dopplerFactor);
          let bCol = Math.round(50 * Math.max(0.1, dopplerFactor - 0.5) * 2);
          if (dopplerFactor > 1.3) {
            gCol = Math.min(255, gCol + 90);
            bCol = Math.min(255, bCol + 180);
          }

          const alpha = Math.min(1, p.brightness * dopplerFactor * 1.05);

          ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(projX, projY, p.size * 1.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused, speedMultiplier, showJets]);

  return (
    <div
      className="relative w-full max-w-[620px] aspect-square flex items-center justify-center select-none"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── Outer Aerospace Radar Frame ──────────────────────────────────────── */}
      <div className="absolute inset-0 rounded-full border border-cyan-500/20 shadow-[0_0_80px_rgba(6,182,212,0.12)] pointer-events-none" />
      <div className="absolute inset-4 rounded-full border border-dashed border-cyan-500/15 animate-[spin_45s_linear_infinite] pointer-events-none" />

      {/* ── Interactive 3D Black Hole Canvas ─────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Relativistic Black Hole Simulation with Gravitational Lensing"
      />

      {/* ── Top-Left Telemetry Pill ─────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-1 bg-[#020617]/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-cyan-500/30 text-left shadow-lg pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-mono text-[10px] font-bold text-amber-300 tracking-wider">
            GARGANTUA // KERR METRIC
          </span>
        </div>
        <div className="font-mono text-[9px] text-slate-400 space-y-0.5">
          <p>MASS: <span className="text-slate-200">4.154 × 10⁶ M☉</span></p>
          <p>SPIN: <span className="text-cyan-300">0.94 c</span> • LENSING: <span className="text-emerald-400">ACTIVE</span></p>
        </div>
      </div>

      {/* ── Bottom Interactive Controls Dock ───────────────────────────────── */}
      <div className="absolute bottom-4 z-20 flex items-center gap-2 bg-[#020617]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-cyan-500/30 shadow-xl">
        {/* Play/Pause Toggle */}
        <button
          type="button"
          onClick={() => setIsPaused(!isPaused)}
          className="p-1.5 rounded-full hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 transition-colors"
          title={isPaused ? "Resume Accretion Flow" : "Pause Accretion Flow"}
        >
          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />}
        </button>

        <div className="w-[1px] h-3.5 bg-slate-700/60" />

        {/* Speed Multiplier */}
        <button
          type="button"
          onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 2 : prev === 2 ? 5 : 1))}
          className="font-mono text-[10px] font-bold text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-500/30 transition-colors"
          title="Adjust Relativistic Spin Rate"
        >
          {speedMultiplier}X SPEED
        </button>

        <div className="w-[1px] h-3.5 bg-slate-700/60" />

        {/* Jet Beams Toggle */}
        <button
          type="button"
          onClick={() => setShowJets(!showJets)}
          className={`flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
            showJets
              ? "bg-purple-950/60 border-purple-500/40 text-purple-300"
              : "bg-slate-900/60 border-slate-700/40 text-slate-500"
          }`}
          title="Toggle Polar Relativistic Jets"
        >
          <Zap className="w-3 h-3" />
          JETS
        </button>

        {/* Parallax Hint */}
        <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-slate-400 pl-1">
          <Compass className={`w-3 h-3 ${isHovered ? "text-cyan-400 animate-spin" : "text-slate-500"}`} />
          <span>3D TILT</span>
        </div>
      </div>
    </div>
  );
}
