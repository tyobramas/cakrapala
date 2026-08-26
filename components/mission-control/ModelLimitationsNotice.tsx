"use client";

/**
 * ModelLimitationsNotice — Disclaimer banner.
 * Required on every mission-control output.
 */

import { AlertTriangle } from "lucide-react";

export default function ModelLimitationsNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[8px] text-amber-400/70 font-mono">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>
          Simplified physics model — requires high-fidelity verification for
          operational use.
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-[10px] text-amber-300/80 font-mono leading-relaxed">
        <strong className="text-amber-300">SIMPLIFIED PHYSICS MODEL</strong> —
        This is a conceptual/educational decision-support prototype.
        Results require high-fidelity verification for operational use.
        Not certified flight software.
      </div>
    </div>
  );
}
