"use client";

/**
 * NavbarArc — Precision Aerospace Flight-Deck Navigation (lg+ screens).
 *
 * Mathematical Architecture:
 * - Single continuous trajectory: arcY(x) across a 1600x124 viewBox.
 * - Dynamic percentage anchoring: DOM navigation items and SVG HUD rails
 *   share the exact same proportional coordinates (17%, 28%, 39%, 61%, 72%, 83%).
 * - Zero Collision: Navigation items sit strictly ABOVE the glowing orbital rail.
 * - Center Command Nexus: Single unified button triggering the SYS-AI Terminal.
 * - Fully symmetrical layout with corner clutter removed.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    Globe2, RadioTower, Telescope, Radar, SatelliteDish, Atom,
} from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

// ── Mathematical Trajectory ──────────────────────────────────────────────────

const VB_W = 1600;
const VB_H = 124;
const CX = VB_W / 2; // 800
const Y_WING = 46;   // Height at outer wings
const SAG = 28;       // Gentle, elegant downward sag at the command center

/** Curve height in viewBox units for given x */
function getArcY(x: number): number {
    const u = (x - CX) / (CX - 60);
    return Y_WING + SAG * (1 - u * u);
}

/** Tangent tilt in degrees for given x (gentle, natural flow) */
function getTiltDeg(x: number): number {
    const u = (x - CX) / (CX - 60);
    const slope = (-2 * SAG * u) / (CX - 60);
    const deg = Math.atan(slope) * (180 / Math.PI) * 0.75;
    return Math.max(-4.5, Math.min(4.5, deg));
}

/** SVG Polyline along the mathematical trajectory */
function generateArcPath(x0: number, x1: number, n = 40): string {
    let d = "";
    for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${getArcY(x).toFixed(1)}`;
    }
    return d;
}

// ── Navigation Stations Configuration ────────────────────────────────────────

interface NavStation {
    id: string;
    label: string;
    href: string;
    icon: React.ElementType;
    xPct: number; // Horizontal % across header
    xVB: number;  // Matching viewBox coordinate
    azimuth: string; // Calibrated degree annotation
}

const LEFT_STATIONS: NavStation[] = [
    { id: "solar", label: "SOLAR SYSTEM", href: "/solar-system", icon: Globe2, xPct: 17, xVB: 272, azimuth: "045°" },
    { id: "mission-control", label: "MISSION CONTROL", href: "/mission-control", icon: RadioTower, xPct: 28, xVB: 448, azimuth: "075°" },
    { id: "sky", label: "SKY MAP", href: "/sky", icon: Telescope, xPct: 39, xVB: 624, azimuth: "105°" },
];

const RIGHT_STATIONS: NavStation[] = [
    { id: "globe", label: "ASTEROID RADAR", href: "/explore", icon: Radar, xPct: 61, xVB: 976, azimuth: "255°" },
    { id: "satellites", label: "SATELLITE", href: "/iss", icon: SatelliteDish, xPct: 72, xVB: 1152, azimuth: "285°" },
    { id: "codex", label: "SPACE CODEX", href: "/codex", icon: Atom, xPct: 83, xVB: 1328, azimuth: "315°" },
];

// ── Tactical Aerospace SVG HUD Frame ─────────────────────────────────────────

function TacticalArcFrame() {
    // Left & Right precision ticks hanging strictly BELOW the rail
    const generateTicks = (xStart: number, xEnd: number, step = 24) => {
        const items: { x: number; y1: number; y2: number; isMajor: boolean }[] = [];
        let count = 0;
        for (let x = xStart; x <= xEnd; x += step) {
            const y = getArcY(x);
            const isMajor = count % 3 === 0;
            const h = isMajor ? 7 : 3.5;
            items.push({ x, y1: y + 2, y2: y + 2 + h, isMajor });
            count++;
        }
        return items;
    };

    const leftTicks = generateTicks(140, 720, 24);
    const rightTicks = generateTicks(880, 1460, 24);

    return (
        <svg
            className="absolute inset-0 h-full w-full pointer-events-none"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <defs>
                {/* Tactical glow for active cyan laser rail */}
                <filter id="tacticalGlow" x="-10%" y="-30%" width="120%" height="160%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>

                {/* Left Rail Energy Gradient */}
                <linearGradient id="railLeftGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.1" />
                    <stop offset="30%" stopColor="#0ea5e9" stopOpacity="0.55" />
                    <stop offset="80%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                </linearGradient>

                {/* Right Rail Energy Gradient */}
                <linearGradient id="railRightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                    <stop offset="20%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
                </linearGradient>

                {/* Secondary dashed trajectory gradient */}
                <linearGradient id="subRailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.05" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
                </linearGradient>
            </defs>

            {/* Left Terminal Wing End Node */}
            <circle cx="120" cy={getArcY(120)} r="2.5" fill="#38bdf8" fillOpacity="0.8" />

            {/* ── Left Primary Orbital Rail ───────────────────────────── */}
            {/* Ambient Bloom */}
            <path
                d={generateArcPath(120, 736)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeOpacity="0.25"
                filter="url(#tacticalGlow)"
            />
            {/* Core Laser Rail */}
            <path
                d={generateArcPath(120, 736)}
                fill="none"
                stroke="url(#railLeftGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Secondary Segmented Orbit Guide */}
            <path
                d={generateArcPath(140, 726)}
                fill="none"
                stroke="url(#subRailGrad)"
                strokeWidth="0.8"
                strokeDasharray="4 6"
                transform="translate(0, 4)"
            />

            {/* Left Rail Terminal Node at Command Nexus */}
            <circle cx="736" cy={getArcY(736)} r="2.5" fill="#22d3ee" filter="url(#tacticalGlow)" />
            <line
                x1="736" y1={getArcY(736) - 5}
                x2="736" y2={getArcY(736) + 5}
                stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.8"
            />

            {/* ── Left Calibrated Azimuth Ticks & Annotations ─────────── */}
            {leftTicks.map((t, i) => (
                <line
                    key={`lt-${i}`}
                    x1={t.x} y1={t.y1}
                    x2={t.x} y2={t.y2}
                    stroke={t.isMajor ? "#38bdf8" : "#64748b"}
                    strokeOpacity={t.isMajor ? 0.65 : 0.3}
                    strokeWidth={t.isMajor ? 1.2 : 0.8}
                />
            ))}
            {LEFT_STATIONS.map((s) => (
                <text
                    key={`lt-lbl-${s.id}`}
                    x={s.xVB}
                    y={getArcY(s.xVB) + 14}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fillOpacity="0.45"
                    fontSize="7"
                    fontFamily="monospace"
                    letterSpacing="0.08em"
                >
                    {s.azimuth}
                </text>
            ))}




            {/* ── Right Rail Terminal Node at Command Nexus ──────────── */}
            <circle cx="864" cy={getArcY(864)} r="2.5" fill="#22d3ee" filter="url(#tacticalGlow)" />
            <line
                x1="864" y1={getArcY(864) - 5}
                x2="864" y2={getArcY(864) + 5}
                stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.8"
            />

            {/* ── Right Primary Orbital Rail ──────────────────────────── */}
            {/* Ambient Bloom */}
            <path
                d={generateArcPath(864, 1480)}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeOpacity="0.25"
                filter="url(#tacticalGlow)"
            />
            {/* Core Laser Rail */}
            <path
                d={generateArcPath(864, 1480)}
                fill="none"
                stroke="url(#railRightGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
            {/* Secondary Segmented Orbit Guide */}
            <path
                d={generateArcPath(874, 1460)}
                fill="none"
                stroke="url(#subRailGrad)"
                strokeWidth="0.8"
                strokeDasharray="4 6"
                transform="translate(0, 4)"
            />

            {/* Right Terminal Wing End Node */}
            <circle cx="1480" cy={getArcY(1480)} r="2.5" fill="#38bdf8" fillOpacity="0.8" />

            {/* ── Right Calibrated Azimuth Ticks & Annotations ────────── */}
            {rightTicks.map((t, i) => (
                <line
                    key={`rt-${i}`}
                    x1={t.x} y1={t.y1}
                    x2={t.x} y2={t.y2}
                    stroke={t.isMajor ? "#38bdf8" : "#64748b"}
                    strokeOpacity={t.isMajor ? 0.65 : 0.3}
                    strokeWidth={t.isMajor ? 1.2 : 0.8}
                />
            ))}
            {RIGHT_STATIONS.map((s) => (
                <text
                    key={`rt-lbl-${s.id}`}
                    x={s.xVB}
                    y={getArcY(s.xVB) + 14}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fillOpacity="0.45"
                    fontSize="7"
                    fontFamily="monospace"
                    letterSpacing="0.08em"
                >
                    {s.azimuth}
                </text>
            ))}
        </svg>
    );
}

// ── Nav Station Component (Clean Pod Above Rail) ─────────────────────────────

function StationPod({
    station,
    active,
}: {
    station: NavStation;
    active: boolean;
}) {
    const Icon = station.icon;
    const arcY = getArcY(station.xVB);
    const topPct = (arcY / VB_H) * 100;
    const tilt = getTiltDeg(station.xVB);

    return (
        <Link
            href={station.href}
            style={{
                left: `${station.xPct}%`,
                top: `${topPct.toFixed(2)}%`,
                transform: `translate(-50%, -100%) rotate(${tilt.toFixed(2)}deg)`,
                transformOrigin: "bottom center",
            }}
            className="group absolute flex flex-col items-center justify-end pb-1 cursor-pointer select-none transition-transform duration-300 hover:scale-105 will-change-transform"
        >
            {/* Clean Floating Nav Item — Pure color change on hover, no rounded rectangle border */}
            <div className="relative flex flex-col items-center justify-center gap-1.5 px-2.5 py-1 transition-colors duration-300">
                {/* Station Icon */}
                <div className="relative">
                    <Icon
                        className={`h-4 w-4 transition-all duration-300 ${
                            active
                                ? "text-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.95)] scale-110"
                                : "text-slate-400 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.9)] group-hover:scale-110"
                        }`}
                    />
                </div>

                {/* Station Label — Smooth Color Transition without Box/Border */}
                <span
                    className={`whitespace-nowrap font-mono text-[10px] font-bold tracking-[0.16em] transition-all duration-300 ${
                        active
                            ? "text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                            : "text-slate-400 group-hover:text-cyan-100 group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    }`}
                >
                    {station.label}
                </span>
            </div>

            {/* Tactical Docking Node — Sits precisely on the glowing rail */}
            <div className="flex flex-col items-center -mt-0.5">
                <span
                    className={`rounded-full transition-all duration-300 ${
                        active
                            ? "h-1.5 w-3 bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
                            : "h-1 w-1 bg-slate-600 group-hover:h-1.5 group-hover:w-2.5 group-hover:bg-cyan-400 group-hover:shadow-[0_0_8px_#22d3ee]"
                    }`}
                />
            </div>
        </Link>
    );
}

// ── Main Flight-Deck Curved Header ───────────────────────────────────────────

export default function NavbarArc() {
    const pathname = usePathname();
    const [isAiOpen, setIsAiOpen] = useState(false);

    const isActive = (href: string) =>
        href === "/" ? pathname === "/" : pathname.startsWith(href);

    return (
        <header className="pointer-events-none fixed inset-x-0 top-0 z-50 hidden h-[124px] select-none lg:block">
            {/* Subtle atmospheric visor scrim behind the header */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#020617]/90 via-[#020617]/40 to-transparent" />

            {/* Mathematical SVG Tactical Frame */}
            <TacticalArcFrame />

            {/* Proportional Container for Navigation Stations */}
            <div className="pointer-events-auto relative mx-auto h-full w-full max-w-[1600px]">

                {/* ── Left Stations: Solar System, Mission Control, Sky Map ──── */}
                {LEFT_STATIONS.map((station) => (
                    <StationPod
                        key={station.id}
                        station={station}
                        active={isActive(station.href)}
                    />
                ))}

                {/* ── Command Nexus: Pure Logo Only ─ */}
                <div
                    style={{
                        left: "50%",
                        top: `${((getArcY(CX) / VB_H) * 100).toFixed(2)}%`,
                        transform: "translate(-50%, -50%)",
                    }}
                    className="absolute flex items-center justify-center select-none"
                >
                    <button
                        type="button"
                        onClick={() => setIsAiOpen(true)}
                        className="group relative flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110 active:scale-95"
                        title="Launch Cakrapala SYS-AI Terminal"
                    >
                        <Image
                            src="/cakrapala.png"
                            alt="Cakrapala Deep Space Observatory"
                            width={76}
                            height={76}
                            className="h-[76px] w-[76px] object-contain drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]
                              transition-all duration-300 group-hover:drop-shadow-[0_0_35px_rgba(6,182,212,0.9)]"
                            priority
                        />
                    </button>
                </div>

                {/* ── Right Stations: Asteroid Radar, Satellite, Space Codex ─── */}
                {RIGHT_STATIONS.map((station) => (
                    <StationPod
                        key={station.id}
                        station={station}
                        active={isActive(station.href)}
                    />
                ))}
            </div>

            <AstronomyTerminal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
        </header>
    );
}
