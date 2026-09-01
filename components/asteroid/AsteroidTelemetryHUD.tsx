"use client";

import React, { useEffect, useState } from "react";
import { AsteroidFeedSummary } from "@/lib/asteroid/types";
import { OPS, OPS_TYPE } from "@/lib/ui/opsTheme";
import { useOpsMode } from "@/lib/ui/opsMode";

interface AsteroidTelemetryHUDProps {
  summary: AsteroidFeedSummary | null;
  isLoading?: boolean;
  lastFetchedAt?: Date | null;
}

export default function AsteroidTelemetryHUD({
  summary,
  isLoading,
  lastFetchedAt,
}: AsteroidTelemetryHUDProps) {
  const { isOps } = useOpsMode();
  const [fetchAgeSec, setFetchAgeSec] = useState<number>(0);
  const [fetchAgeStr, setFetchAgeStr] = useState<string>("0s");
  const [fetchAgePublicStr, setFetchAgePublicStr] = useState<string>("just now");
  const [fetchTimeZ, setFetchTimeZ] = useState<string>("00:00:00Z");

  useEffect(() => {
    if (lastFetchedAt) {
      const h = String(lastFetchedAt.getUTCHours()).padStart(2, "0");
      const m = String(lastFetchedAt.getUTCMinutes()).padStart(2, "0");
      const s = String(lastFetchedAt.getUTCSeconds()).padStart(2, "0");
      setFetchTimeZ(`${h}:${m}:${s}Z`);
    }
  }, [lastFetchedAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!lastFetchedAt) return;
      const elapsedSec = Math.floor((Date.now() - lastFetchedAt.getTime()) / 1000);
      setFetchAgeSec(elapsedSec);

      if (elapsedSec < 60) {
        setFetchAgeStr(`${elapsedSec}s`);
        setFetchAgePublicStr("just now");
      } else {
        const mins = Math.floor(elapsedSec / 60);
        const secs = String(elapsedSec % 60).padStart(2, "0");
        setFetchAgeStr(`${mins}m${secs}s`);
        setFetchAgePublicStr(`${mins} min ago`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [lastFetchedAt]);

  const isHazardPresent = (summary?.hazardousCount || 0) > 0;
  const statusLabel = isHazardPresent ? "ELEVATED" : "NOMINAL";

  // Data Age Color Indicator for OPS mode
  const ageColor =
    !lastFetchedAt
      ? OPS.textFaint
      : fetchAgeSec < 300
      ? OPS.safe // < 5 minutes: green / fresh
      : fetchAgeSec >= 900
      ? OPS.caution // > 15 minutes: caution / stale
      : OPS.textDim;

  return (
    <div
      className="w-full px-3.5 py-2 select-none border-b"
      style={{ background: OPS.panel, borderColor: OPS.line }}
    >
      {isOps ? (
        /* ── OPS MODE: Dense Aerospace Telemetry Strip ───────────────────────── */
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-3 font-mono">
          {/* Left: Planetary Defense Domain Status */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className={OPS_TYPE.label} style={{ color: OPS.textDim }}>
              PLANETARY DEFENSE
            </span>
            {/* Status lamp (6px round dot) */}
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isHazardPresent ? OPS.caution : OPS.safe }}
            />
            <span className="text-[11px] font-mono tracking-wide" style={{ color: OPS.text }}>
              {isLoading
                ? "CALCULATING THREAT MATRIX..."
                : `${statusLabel} · ${summary?.totalTracked || 0} TRACKED · ${
                    summary?.hazardousCount || 0
                  } PHA · TORINO 0`}
            </span>
          </div>

          {/* Center/Right: Label-Above-Value Metric Strip with 1px Vertical Dividers */}
          <div
            className="flex items-center gap-0 divide-x overflow-x-auto"
            style={{ borderColor: OPS.line }}
          >
            {/* Metric 1: Tracked */}
            <div className="px-3.5 first:pl-0 text-right" style={{ borderColor: OPS.line }}>
              <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>TRACKED</div>
              <div className={OPS_TYPE.value + " leading-tight mt-0.5"} style={{ color: OPS.text }}>
                {isLoading ? "—" : summary?.totalTracked || 0}
              </div>
            </div>

            {/* Metric 2: Closest */}
            <div className="px-3.5 text-right" style={{ borderColor: OPS.line }}>
              <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>CLOSEST</div>
              <div className={OPS_TYPE.value + " leading-tight mt-0.5"} style={{ color: OPS.text }}>
                {isLoading
                  ? "—"
                  : summary?.closestObject
                  ? `${summary.closestObject.distanceLd.toFixed(2)} LD`
                  : "N/A"}
              </div>
              {summary?.closestObject && (
                <div className={OPS_TYPE.meta + " leading-none"} style={{ color: OPS.textFaint }}>
                  {((summary.closestObject.distanceKm || 0) / 1e6).toFixed(2)} M km
                </div>
              )}
            </div>

            {/* Metric 3: Max Velocity */}
            <div className="px-3.5 text-right" style={{ borderColor: OPS.line }}>
              <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>MAX VEL</div>
              <div className={OPS_TYPE.value + " leading-tight mt-0.5"} style={{ color: OPS.text }}>
                {isLoading
                  ? "—"
                  : summary?.fastestObject
                  ? Math.round(summary.fastestObject.velocityKmh).toLocaleString()
                  : "N/A"}
              </div>
              <div className={OPS_TYPE.meta + " leading-none"} style={{ color: OPS.textFaint }}>
                km/h
              </div>
            </div>

            {/* Metric 4: Largest */}
            <div className="px-3.5 text-right" style={{ borderColor: OPS.line }}>
              <div className={OPS_TYPE.label} style={{ color: OPS.textDim }}>LARGEST</div>
              <div className={OPS_TYPE.value + " leading-tight mt-0.5"} style={{ color: OPS.text }}>
                {isLoading
                  ? "—"
                  : summary?.largestObject
                  ? `${summary.largestObject.diameterMeters} m`
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Far Right: Provenance & Color-Coded Age */}
          <div className="shrink-0 hidden xl:block">
            <span className={OPS_TYPE.meta} style={{ color: OPS.textFaint }}>
              SRC NASA/JPL SBDB · NeoWs · FETCH {fetchTimeZ} · AGE{" "}
              <span style={{ color: ageColor, fontWeight: 600 }}>{fetchAgeStr}</span>
            </span>
          </div>
        </div>
      ) : (
        /* ── PUBLIC MODE: Plain Language Contextual Summary ─────────────────── */
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-3 font-mono">
          {/* Left: Clear Natural Language Threat Headline */}
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: isHazardPresent ? OPS.caution : OPS.safe }}
            />
            <div>
              <div className="text-xs font-semibold" style={{ color: OPS.text }}>
                {isLoading
                  ? "Loading asteroid tracking data..."
                  : isHazardPresent
                  ? `Potential hazard monitored — ${summary?.hazardousCount || 0} of ${
                      summary?.totalTracked || 0
                    } asteroids classified as PHA`
                  : `No threat detected — ${summary?.totalTracked || 0} asteroids tracked today`}
              </div>
              <div className="text-[11px]" style={{ color: OPS.textDim }}>
                {summary?.closestObject
                  ? `Closest passes at ${summary.closestObject.distanceLd.toFixed(1)}× the Moon's distance (~${(
                      (summary.closestObject.distanceKm || 0) / 1e6
                    ).toFixed(1)} million km). Data from NASA, updated ${fetchAgePublicStr}.`
                  : `Data from NASA JPL, updated ${fetchAgePublicStr}.`}
              </div>
            </div>
          </div>

          {/* Right: Human-Friendly Key Metrics */}
          <div
            className="flex items-center gap-0 divide-x text-xs"
            style={{ borderColor: OPS.line }}
          >
            <div className="px-3 first:pl-0 text-right" style={{ borderColor: OPS.line }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: OPS.textDim }}>
                Tracked Today
              </div>
              <div className="text-xs font-bold" style={{ color: OPS.text }}>
                {summary?.totalTracked || 0} asteroids
              </div>
            </div>

            <div className="px-3 text-right" style={{ borderColor: OPS.line }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: OPS.textDim }}>
                Closest Approach
              </div>
              <div className="text-xs font-bold" style={{ color: OPS.text }}>
                {summary?.closestObject ? `${summary.closestObject.distanceLd.toFixed(1)}× Moon` : "N/A"}
              </div>
            </div>

            <div className="px-3 text-right" style={{ borderColor: OPS.line }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: OPS.textDim }}>
                Peak Speed
              </div>
              <div className="text-xs font-bold" style={{ color: OPS.text }}>
                {summary?.fastestObject
                  ? `${Math.round(summary.fastestObject.velocityKmh).toLocaleString()} km/h`
                  : "N/A"}
              </div>
            </div>

            <div className="px-3 text-right" style={{ borderColor: OPS.line }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: OPS.textDim }}>
                Largest Object
              </div>
              <div className="text-xs font-bold" style={{ color: OPS.text }}>
                {summary?.largestObject ? `${summary.largestObject.diameterMeters} meters` : "N/A"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
