"use client";

import { useState } from "react";
import type { OrbitalFingerprintResult, FingerprintAxis } from "@/lib/satellites/orbitalFingerprint";

export interface OrbitalFingerprintChartProps {
    fingerprint: OrbitalFingerprintResult;
}

export default function OrbitalFingerprintChart({
    fingerprint,
}: OrbitalFingerprintChartProps) {
    const [activeAxis, setActiveAxis] = useState<FingerprintAxis | null>(null);

    const size = 300;
    const center = size / 2;
    const radius = 100;
    const numAxes = fingerprint.axes.length;

    // Calculate vertex coordinates for a given normalized radius factor (0 to 1)
    const getVertex = (index: number, factor: number) => {
        // Start from top (-90 deg / -π/2) and go clockwise
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / numAxes;
        const x = center + radius * factor * Math.cos(angle);
        const y = center + radius * factor * Math.sin(angle);
        return { x, y, angle };
    };

    // Concentric grid polygon rings (25%, 50%, 75%, 100%)
    const ringFactors = [0.25, 0.5, 0.75, 1.0];
    const gridRings = ringFactors.map((factor) => {
        const points = Array.from({ length: numAxes })
            .map((_, i) => {
                const { x, y } = getVertex(i, factor);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
        return { factor, points };
    });

    // Data polygon vertices
    const dataPoints = fingerprint.axes
        .map((axis, i) => {
            const { x, y } = getVertex(i, axis.normalizedValue);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    return (
        <div className="flex flex-col items-center rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex w-full items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="font-mono text-xs font-bold tracking-wider text-cyan-300">
                    ORBITAL FINGERPRINT
                </span>
                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-400">
                    7-AXIS NORMALIZED
                </span>
            </div>

            <div className="relative my-2 w-full max-w-[300px]">
                <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="h-auto w-full overflow-visible"
                    aria-label="Orbital Fingerprint Radar Chart"
                >
                    <defs>
                        <linearGradient id="fingerprintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                        </linearGradient>
                    </defs>

                    {/* Concentric grid rings */}
                    {gridRings.map((ring) => (
                        <polygon
                            key={ring.factor}
                            points={ring.points}
                            fill="none"
                            stroke="#1e293b"
                            strokeWidth={ring.factor === 1.0 ? "1.5" : "1"}
                            strokeDasharray={ring.factor === 1.0 ? "none" : "3,3"}
                        />
                    ))}

                    {/* Radial axis spokes */}
                    {fingerprint.axes.map((axis, i) => {
                        const outer = getVertex(i, 1.0);
                        const labelPos = getVertex(i, 1.22);
                        const isHovered = activeAxis?.id === axis.id;

                        return (
                            <g key={axis.id}>
                                <line
                                    x1={center}
                                    y1={center}
                                    x2={outer.x}
                                    y2={outer.y}
                                    stroke={isHovered ? "#38bdf8" : "#334155"}
                                    strokeWidth={isHovered ? "1.5" : "1"}
                                />

                                {/* Axis Label */}
                                <text
                                    x={labelPos.x}
                                    y={labelPos.y}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className={[
                                        "font-mono text-[9px] transition-colors cursor-pointer select-none",
                                        isHovered ? "fill-cyan-300 font-bold" : "fill-slate-400",
                                    ].join(" ")}
                                    onMouseEnter={() => setActiveAxis(axis)}
                                    onMouseLeave={() => setActiveAxis(null)}
                                    onClick={() => setActiveAxis(axis)}
                                >
                                    {axis.label}
                                </text>
                            </g>
                        );
                    })}

                    {/* Data Polygon */}
                    <polygon
                        points={dataPoints}
                        fill="url(#fingerprintGrad)"
                        stroke="#22d3ee"
                        strokeWidth="2"
                        className="drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all duration-300"
                    />

                    {/* Data Vertex Dots */}
                    {fingerprint.axes.map((axis, i) => {
                        const { x, y } = getVertex(i, axis.normalizedValue);
                        const isHovered = activeAxis?.id === axis.id;

                        return (
                            <circle
                                key={axis.id}
                                cx={x}
                                cy={y}
                                r={isHovered ? 5.5 : 3.5}
                                fill={isHovered ? "#38bdf8" : "#22d3ee"}
                                stroke="#0f172a"
                                strokeWidth="1.5"
                                className="cursor-pointer transition-all duration-200"
                                onMouseEnter={() => setActiveAxis(axis)}
                                onMouseLeave={() => setActiveAxis(null)}
                                onClick={() => setActiveAxis(axis)}
                            />
                        );
                    })}
                </svg>
            </div>

            {/* Active Axis Detail Tooltip Box */}
            <div className="w-full rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 font-mono text-[10.5px]">
                {activeAxis ? (
                    <div>
                        <div className="flex items-center justify-between text-cyan-300">
                            <span className="font-bold">{activeAxis.label}</span>
                            <span className="text-emerald-400">
                                {activeAxis.formattedValue} (Norm: {activeAxis.normalizedValue})
                            </span>
                        </div>
                        <p className="mt-1 text-[9.5px] leading-tight text-slate-400">
                            {activeAxis.description}
                        </p>
                    </div>
                ) : (
                    <div className="text-center text-[10px] text-slate-500">
                        Hover or tap any axis for normalized metric breakdown
                    </div>
                )}
            </div>

            {/* Strict Disclaimer */}
            <p className="mt-2.5 text-center font-mono text-[8.5px] text-slate-500">
                {fingerprint.disclaimer}
            </p>
        </div>
    );
}
