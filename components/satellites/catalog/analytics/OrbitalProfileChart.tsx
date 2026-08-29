"use client";

import { useMemo, useState } from "react";
import type { SelectedSatelliteAnalysisMessage } from "@/lib/satellites/catalogWorkerTypes";

export type ProfileMetricType = "altitude" | "speed" | "latitude";

export interface OrbitalProfileChartProps {
    analysis: SelectedSatelliteAnalysisMessage | null;
    isLoading?: boolean;
    periodMinutes?: number;
}

export default function OrbitalProfileChart({
    analysis,
    isLoading = false,
    periodMinutes = 92.5,
}: OrbitalProfileChartProps) {
    const [activeMetric, setActiveMetric] = useState<ProfileMetricType>("altitude");

    const chartWidth = 320;
    const chartHeight = 130;
    const padding = { top: 15, right: 15, bottom: 25, left: 45 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const stats = useMemo(() => {
        if (!analysis || analysis.valid.length === 0) {
            return null;
        }

        let array: Float32Array;
        let unit: string;

        if (activeMetric === "altitude") {
            array = analysis.altitudesKm;
            unit = "km";
        } else if (activeMetric === "speed") {
            array = analysis.speedsKmS;
            unit = "km/s";
        } else {
            array = analysis.latitudesDeg;
            unit = "°";
        }

        let min = Number.POSITIVE_INFINITY;
        let max = Number.NEGATIVE_INFINITY;
        let sum = 0;
        let validCount = 0;
        let startVal: number | null = null;

        const points: { x: number; y: number; val: number; timeRelMin: number }[] = [];
        const totalDurationMin = periodMinutes > 0 ? periodMinutes : 90;

        for (let i = 0; i < array.length; i += 1) {
            if (analysis.valid[i] === 1 && Number.isFinite(array[i])) {
                const val = array[i];
                if (startVal === null) startVal = val;
                if (val < min) min = val;
                if (val > max) max = val;
                sum += val;
                validCount += 1;
            }
        }

        if (validCount === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
            return null;
        }

        // For latitude, use fixed [-90, 90] bounds for context
        let yMin = min;
        let yMax = max;
        if (activeMetric === "latitude") {
            yMin = -90;
            yMax = 90;
        } else if (yMin === yMax) {
            yMin = yMin * 0.95;
            yMax = yMax * 1.05;
        } else {
            const margin = (yMax - yMin) * 0.1;
            yMin = yMin - margin;
            yMax = yMax + margin;
        }

        for (let i = 0; i < array.length; i += 1) {
            if (analysis.valid[i] === 1 && Number.isFinite(array[i])) {
                const val = array[i];
                const timeRelMin = (i / (array.length - 1)) * totalDurationMin;
                const x = padding.left + (i / (array.length - 1)) * innerWidth;
                const yNorm = (val - yMin) / (yMax - yMin || 1);
                const y = padding.top + innerHeight - yNorm * innerHeight;
                points.push({ x, y, val, timeRelMin });
            }
        }

        const avg = sum / validCount;

        return {
            points,
            min,
            max,
            avg,
            startVal: startVal ?? avg,
            unit,
            yMin,
            yMax,
            validCount,
        };
    }, [analysis, activeMetric, periodMinutes, innerWidth, innerHeight, padding.left, padding.top]);

    const svgPath = useMemo(() => {
        if (!stats || stats.points.length === 0) return "";
        return stats.points.reduce((path, pt, idx) => {
            return `${path} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        }, "");
    }, [stats]);

    const areaPath = useMemo(() => {
        if (!stats || stats.points.length === 0) return "";
        const baseLineY = padding.top + innerHeight;
        const first = stats.points[0];
        const last = stats.points[stats.points.length - 1];
        return `${svgPath} L ${last.x.toFixed(1)} ${baseLineY} L ${first.x.toFixed(1)} ${baseLineY} Z`;
    }, [stats, svgPath, padding.top, innerHeight]);

    // Equator line y-coordinate for latitude metric
    const equatorY = useMemo(() => {
        if (!stats || activeMetric !== "latitude") return null;
        const yNorm = (0 - stats.yMin) / (stats.yMax - stats.yMin || 1);
        return padding.top + innerHeight - yNorm * innerHeight;
    }, [stats, activeMetric, padding.top, innerHeight]);

    return (
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            {/* Header with Title & Metric Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                <div>
                    <span className="font-mono text-xs font-bold tracking-wider text-cyan-300 block">
                        SGP4 PREDICTED ORBIT PROFILE
                    </span>
                    <span className="font-mono text-[9px] text-slate-500">
                        1 Orbital Revolution ({periodMinutes.toFixed(1)} min prediction)
                    </span>
                </div>

                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5 font-mono text-[10px]">
                    <button
                        type="button"
                        onClick={() => setActiveMetric("altitude")}
                        className={[
                            "rounded px-2 py-0.5 transition-all",
                            activeMetric === "altitude"
                                ? "bg-cyan-500/20 text-cyan-300 font-bold"
                                : "text-slate-400 hover:text-white",
                        ].join(" ")}
                    >
                        ALTITUDE
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveMetric("speed")}
                        className={[
                            "rounded px-2 py-0.5 transition-all",
                            activeMetric === "speed"
                                ? "bg-emerald-500/20 text-emerald-300 font-bold"
                                : "text-slate-400 hover:text-white",
                        ].join(" ")}
                    >
                        SPEED
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveMetric("latitude")}
                        className={[
                            "rounded px-2 py-0.5 transition-all",
                            activeMetric === "latitude"
                                ? "bg-purple-500/20 text-purple-300 font-bold"
                                : "text-slate-400 hover:text-white",
                        ].join(" ")}
                    >
                        LATITUDE
                    </button>
                </div>
            </div>

            {/* Main Graph Area */}
            <div className="relative my-3 w-full">
                {isLoading ? (
                    <div className="flex h-[130px] w-full items-center justify-center font-mono text-xs text-cyan-400">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                            <span>COMPUTING SGP4 TRAJECTORY...</span>
                        </div>
                    </div>
                ) : stats && stats.points.length > 1 ? (
                    <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                        className="h-auto w-full overflow-visible"
                        aria-label={`SGP4 ${activeMetric} profile chart`}
                    >
                        <defs>
                            <linearGradient id="profileAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop
                                    offset="0%"
                                    stopColor={
                                        activeMetric === "altitude"
                                            ? "#06b6d4"
                                            : activeMetric === "speed"
                                                ? "#10b981"
                                                : "#c084fc"
                                    }
                                    stopOpacity="0.35"
                                />
                                <stop offset="100%" stopColor="#020617" stopOpacity="0.0" />
                            </linearGradient>
                        </defs>

                        {/* Horizontal Grid lines */}
                        <line
                            x1={padding.left}
                            y1={padding.top}
                            x2={chartWidth - padding.right}
                            y2={padding.top}
                            stroke="#1e293b"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                        />
                        <line
                            x1={padding.left}
                            y1={padding.top + innerHeight / 2}
                            x2={chartWidth - padding.right}
                            y2={padding.top + innerHeight / 2}
                            stroke="#1e293b"
                            strokeWidth="1"
                            strokeDasharray="2,2"
                        />
                        <line
                            x1={padding.left}
                            y1={padding.top + innerHeight}
                            x2={chartWidth - padding.right}
                            y2={padding.top + innerHeight}
                            stroke="#334155"
                            strokeWidth="1"
                        />

                        {/* Equator reference line for latitude */}
                        {equatorY !== null && (
                            <g>
                                <line
                                    x1={padding.left}
                                    y1={equatorY}
                                    x2={chartWidth - padding.right}
                                    y2={equatorY}
                                    stroke="#e2e8f0"
                                    strokeWidth="1"
                                    strokeDasharray="4,4"
                                    opacity="0.4"
                                />
                                <text
                                    x={padding.left + 4}
                                    y={equatorY - 3}
                                    className="font-mono text-[7.5px] fill-slate-400 select-none"
                                >
                                    EQUATOR (0°)
                                </text>
                            </g>
                        )}

                        {/* Y-axis Labels */}
                        <text
                            x={padding.left - 6}
                            y={padding.top + 4}
                            textAnchor="end"
                            className="font-mono text-[8px] fill-slate-500"
                        >
                            {Math.round(stats.yMax)}
                        </text>
                        <text
                            x={padding.left - 6}
                            y={padding.top + innerHeight}
                            textAnchor="end"
                            className="font-mono text-[8px] fill-slate-500"
                        >
                            {Math.round(stats.yMin)}
                        </text>

                        {/* Shaded Area Under Curve */}
                        <path d={areaPath} fill="url(#profileAreaGrad)" />

                        {/* Main Profile Line */}
                        <path
                            d={svgPath}
                            fill="none"
                            stroke={
                                activeMetric === "altitude"
                                    ? "#22d3ee"
                                    : activeMetric === "speed"
                                        ? "#34d399"
                                        : "#c084fc"
                            }
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* NOW Marker at First Point */}
                        {stats.points[0] && (
                            <g>
                                <circle
                                    cx={stats.points[0].x}
                                    cy={stats.points[0].y}
                                    r="4"
                                    fill="#facc15"
                                    stroke="#020617"
                                    strokeWidth="1.5"
                                />
                                <text
                                    x={stats.points[0].x}
                                    y={stats.points[0].y - 7}
                                    textAnchor="middle"
                                    className="font-mono text-[7.5px] font-bold fill-amber-300 select-none"
                                >
                                    NOW
                                </text>
                            </g>
                        )}

                        {/* X-axis Relative Time Labels */}
                        <text
                            x={padding.left}
                            y={chartHeight - 8}
                            textAnchor="start"
                            className="font-mono text-[8px] fill-slate-500"
                        >
                            +0m
                        </text>
                        <text
                            x={padding.left + innerWidth / 2}
                            y={chartHeight - 8}
                            textAnchor="middle"
                            className="font-mono text-[8px] fill-slate-500"
                        >
                            +{(periodMinutes / 2).toFixed(0)}m
                        </text>
                        <text
                            x={chartWidth - padding.right}
                            y={chartHeight - 8}
                            textAnchor="end"
                            className="font-mono text-[8px] fill-slate-500"
                        >
                            +{periodMinutes.toFixed(0)}m
                        </text>
                    </svg>
                ) : (
                    <div className="flex h-[130px] w-full items-center justify-center font-mono text-xs text-slate-500">
                        ANALYSIS UNAVAILABLE (NO SGP4 EPHEMERIS RECORD)
                    </div>
                )}
            </div>

            {/* Summary Statistics Bar */}
            {stats && (
                <div className="grid grid-cols-4 gap-1.5 border-t border-slate-800/80 pt-2.5 font-mono text-[10px]">
                    <div className="rounded bg-slate-900/60 p-1.5 text-center">
                        <span className="block text-[8.5px] text-slate-500">CURRENT</span>
                        <strong className="text-white">
                            {stats.startVal.toFixed(activeMetric === "speed" ? 2 : 1)} {stats.unit}
                        </strong>
                    </div>

                    <div className="rounded bg-slate-900/60 p-1.5 text-center">
                        <span className="block text-[8.5px] text-slate-500">MIN</span>
                        <strong className="text-cyan-400">
                            {stats.min.toFixed(activeMetric === "speed" ? 2 : 1)} {stats.unit}
                        </strong>
                    </div>

                    <div className="rounded bg-slate-900/60 p-1.5 text-center">
                        <span className="block text-[8.5px] text-slate-500">MAX</span>
                        <strong className="text-amber-400">
                            {stats.max.toFixed(activeMetric === "speed" ? 2 : 1)} {stats.unit}
                        </strong>
                    </div>

                    <div className="rounded bg-slate-900/60 p-1.5 text-center">
                        <span className="block text-[8.5px] text-slate-500">AVERAGE</span>
                        <strong className="text-emerald-400">
                            {stats.avg.toFixed(activeMetric === "speed" ? 2 : 1)} {stats.unit}
                        </strong>
                    </div>
                </div>
            )}
        </div>
    );
}
