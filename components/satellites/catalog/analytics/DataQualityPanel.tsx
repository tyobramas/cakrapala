"use client";

import type { DataQualityReport } from "@/lib/satellites/dataQuality";
import { CheckCircle2, AlertTriangle, XCircle, Info, Database } from "lucide-react";

export interface DataQualityPanelProps {
    report: DataQualityReport;
}

export default function DataQualityPanel({ report }: DataQualityPanelProps) {
    const freshnessBadge = {
        emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
        red: "border-red-500/30 bg-red-500/10 text-red-300",
    }[report.freshnessColor];

    const propagationBadge = {
        VALID: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        DEGRADED: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        UNAVAILABLE: "border-red-500/30 bg-red-500/10 text-red-300",
    }[report.propagationStatus];

    return (
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-400" />
                    <span className="font-mono text-xs font-bold tracking-wider text-cyan-300">
                        DATA QUALITY & EPHEMERIS HEALTH
                    </span>
                </div>

                <span className={["rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase", freshnessBadge].join(" ")}>
                    {report.freshnessLabel}
                </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
                {/* Propagation Integrity */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">PROPAGATION STATUS</span>
                        {report.propagationStatus === "VALID" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : report.propagationStatus === "DEGRADED" ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                    </div>
                    <strong className={["mt-1 block text-xs uppercase", propagationBadge].join(" ")}>
                        {report.propagationStatus}
                    </strong>
                </div>

                {/* Field Completeness */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                    <span className="block text-[10px] text-slate-500">FIELD COMPLETENESS</span>
                    <strong className="mt-1 block text-xs text-cyan-300">
                        {report.fieldCompletenessPercent}% (12/12 OMM Parameters)
                    </strong>
                </div>

                {/* SATCAT Metadata */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                    <span className="block text-[10px] text-slate-500">SATCAT METADATA</span>
                    <strong className={["mt-1 block text-xs", report.satcatStatus === "AVAILABLE" ? "text-emerald-400" : "text-slate-400"].join(" ")}>
                        {report.satcatStatus}
                    </strong>
                </div>

                {/* Data Age */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5">
                    <span className="block text-[10px] text-slate-500">DATA AGE (SINCE EPOCH)</span>
                    <strong className="mt-1 block text-xs text-amber-300">
                        {report.dataAgeFormatted}
                    </strong>
                </div>
            </div>

            {/* Epoch & Source Detail */}
            <div className="mt-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5 font-mono text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                    <span>ELEMENT EPOCH:</span>
                    <strong className="text-slate-300">{report.elementEpochUtc}</strong>
                </div>
                <div className="flex items-center justify-between">
                    <span>SOURCE AUTHORITY:</span>
                    <strong className="text-cyan-300">{report.sourceDescription}</strong>
                </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="mt-3 flex items-start gap-1.5 font-mono text-[9px] text-slate-500">
                <Info className="h-3.5 w-3.5 shrink-0 text-slate-600 mt-0.5" />
                <p>{report.disclaimer}</p>
            </div>
        </div>
    );
}
