"use client";

/**
 * CosmicCanvas — Authentic Deep Space Astrophysical Starfield & Cosmic Void.
 * Features:
 *   - 2,200+ Multi-Layered Stars with Astronomical Magnitude Distribution
 *   - Depth Parallax Drift: Moving the mouse feels like floating through the cosmic vacuum
 *   - Realistic Interstellar Star Clouds & Subtle Cosmic Dust Bands
 *   - Natural Atmosphere-less Deep Space Scintillation
 *   - Occasional Distant Meteor Streaks
 */

import { useEffect, useRef } from "react";

interface DeepStar {
  x: number;
  y: number;
  z: number; // Depth layer (0.2 = far away, 1.0 = close)
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
  hasSpikes: boolean;
}

interface Meteor {
  x: number;
  y: number;
  len: number;
  speed: number;
  angle: number;
  opacity: number;
  active: boolean;
}

export default function CosmicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let stars: DeepStar[] = [];
    let meteors: Meteor[] = [];

    // Mouse parallax tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 35;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 35;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Astronomical Spectral Star Colors (O, B, A, F, G, K, M)
    const starColors = [
      "rgba(255, 255, 255, ", // Pure White (Class A)
      "rgba(224, 242, 254, ", // Blue-White (Class B)
      "rgba(186, 230, 253, ", // Pale Sapphire (Class O)
      "rgba(254, 240, 138, ", // Warm White (Class F)
      "rgba(253, 224, 71, ",  // Golden Solar (Class G)
      "rgba(253, 186, 116, ", // Orange (Class K)
      "rgba(252, 165, 165, ", // Soft Red (Class M)
    ];

    const initCosmos = () => {
      stars = [];
      const count = Math.floor((width * height) / 1000); // Dense, realistic starfield

      for (let i = 0; i < count; i++) {
        const z = Math.random(); // 0 to 1 depth
        const isForeground = z > 0.85 && Math.random() < 0.08; // Rare bright foreground stars
        const isMidground = z > 0.5;
        const colorPrefix = starColors[Math.floor(Math.random() * starColors.length)];

        stars.push({
          x: Math.random() * (width + 100) - 50,
          y: Math.random() * (height + 100) - 50,
          z: z * 0.8 + 0.2, // 0.2 to 1.0
          r: isForeground
            ? Math.random() * 1.5 + 1.2
            : isMidground
            ? Math.random() * 0.8 + 0.5
            : Math.random() * 0.5 + 0.2,
          baseAlpha: isForeground
            ? Math.random() * 0.3 + 0.7
            : isMidground
            ? Math.random() * 0.4 + 0.35
            : Math.random() * 0.3 + 0.15,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2,
          color: colorPrefix,
          hasSpikes: isForeground && Math.random() < 0.5,
        });
      }

      // Meteors
      meteors = [];
      for (let i = 0; i < 2; i++) {
        meteors.push(createMeteor());
      }
    };

    const createMeteor = (): Meteor => {
      const angle = (Math.random() * 20 + 35) * (Math.PI / 180);
      return {
        x: Math.random() * width * 1.2 - width * 0.1,
        y: Math.random() * height * 0.3,
        len: Math.random() * 140 + 70,
        speed: Math.random() * 12 + 15,
        angle,
        opacity: Math.random() * 0.7 + 0.3,
        active: Math.random() < 0.25,
      };
    };

    initCosmos();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initCosmos();
    };
    window.addEventListener("resize", handleResize);

    // ── Animation Loop ───────────────────────────────────────────────────────
    let time = 0;
    let meteorTimer = 0;

    const render = () => {
      time += 0.012;

      // Smooth mouse parallax lerp
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      // ── 1. Pure Pitch-Black Deep Space Void with Cosmic Dust Band ─────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#01040f");
      bgGrad.addColorStop(0.5, "#020617");
      bgGrad.addColorStop(1, "#01040f");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Faint Interstellar Star Dust Band (Milky Way background glow)
      const dustGrad = ctx.createRadialGradient(
        width * 0.5 + mouseX * 0.2,
        height * 0.45 + mouseY * 0.2,
        width * 0.1,
        width * 0.5 + mouseX * 0.2,
        height * 0.45 + mouseY * 0.2,
        width * 0.65
      );
      dustGrad.addColorStop(0, "rgba(56, 189, 248, 0.035)");
      dustGrad.addColorStop(0.4, "rgba(147, 51, 234, 0.02)");
      dustGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = dustGrad;
      ctx.fillRect(0, 0, width, height);

      // ── 2. Render 2,200+ Multi-Layered Stars with Parallax ─────────────────
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Parallax shift based on star depth (z)
        const px = s.x - mouseX * s.z;
        const py = s.y - mouseY * s.z;

        // Skip if outside viewport
        if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue;

        // Natural deep space twinkle
        const twinkle = Math.sin(time * s.twinkleSpeed * 10 + s.twinklePhase);
        const alpha = Math.max(0.08, Math.min(1, s.baseAlpha + twinkle * 0.2));

        // Soft halo glow on brighter stars
        if (s.r > 1.1) {
          const halo = ctx.createRadialGradient(px, py, 0, px, py, s.r * 4.5);
          halo.addColorStop(0, `${s.color}${alpha * 0.5})`);
          halo.addColorStop(0.5, `${s.color}${alpha * 0.1})`);
          halo.addColorStop(1, `${s.color}0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(px, py, s.r * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Star Pinpoint Core
        ctx.fillStyle = `${s.color}${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, Math.PI * 2);
        ctx.fill();

        // 4-Point Optical Diffraction Spikes on First-Magnitude Stars
        if (s.hasSpikes && alpha > 0.65) {
          const spikeLen = s.r * 5.5;
          ctx.strokeStyle = `${s.color}${alpha * 0.4})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px - spikeLen, py);
          ctx.lineTo(px + spikeLen, py);
          ctx.moveTo(px, py - spikeLen);
          ctx.lineTo(px, py + spikeLen);
          ctx.stroke();
        }
      }

      // ── 3. Shooting Stars / Meteors ───────────────────────────────────────
      meteorTimer++;
      if (meteorTimer > 200 && Math.random() < 0.02) {
        meteorTimer = 0;
        meteors.push(createMeteor());
        if (meteors.length > 3) meteors.shift();
      }

      for (const m of meteors) {
        if (!m.active) {
          if (Math.random() < 0.01) m.active = true;
          continue;
        }

        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.opacity -= 0.007;

        if (m.opacity > 0) {
          const tailX = m.x - Math.cos(m.angle) * m.len;
          const tailY = m.y - Math.sin(m.angle) * m.len;

          const meteorGrad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
          meteorGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
          meteorGrad.addColorStop(0.7, `rgba(186, 230, 253, ${m.opacity * 0.5})`);
          meteorGrad.addColorStop(1, `rgba(255, 255, 255, ${m.opacity})`);

          ctx.strokeStyle = meteorGrad;
          ctx.lineWidth = 1.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        } else {
          m.active = false;
          m.x = Math.random() * width * 1.2 - width * 0.1;
          m.y = Math.random() * height * 0.3;
          m.opacity = Math.random() * 0.7 + 0.3;
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
