"use client";

/**
 * CesiumCameraController — camera control buttons for the Cesium globe view.
 *
 * Provides:
 *   - Fly to observer location
 *   - Fly to home (default globe overview)
 *   - Tilt toggle (2D top-down vs 3D perspective)
 *
 * This component receives imperative camera action callbacks from the parent.
 * No Cesium objects are imported here — this is pure React UI.
 */

import { MapPin, Globe, Maximize } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  onFlyToObserver: () => void;
  onFlyToHome: () => void;
  onFlyToGlobeOverview: () => void;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CesiumCameraController({
  onFlyToObserver,
  onFlyToHome,
  onFlyToGlobeOverview,
}: Props) {
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Camera controls"
    >
      {/* ── Fly to observer ────────────────────────────────────────────────── */}
      <button
        onClick={onFlyToObserver}
        aria-label="Fly camera to observer location"
        title="Fly to Observer"
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          bg-[#112240] hover:bg-[#1a3560] text-slate-200 border border-[#1e3a5f]
          transition-colors min-h-[36px]
        "
      >
        <MapPin size={14} />
        <span>Observer</span>
      </button>

      {/* ── Globe overview ─────────────────────────────────────────────────── */}
      <button
        onClick={onFlyToGlobeOverview}
        aria-label="Fly camera to full globe overview"
        title="Globe Overview"
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          bg-[#112240] hover:bg-[#1a3560] text-slate-200 border border-[#1e3a5f]
          transition-colors min-h-[36px]
        "
      >
        <Globe size={14} />
        <span>Globe</span>
      </button>

      {/* ── Home / reset ───────────────────────────────────────────────────── */}
      <button
        onClick={onFlyToHome}
        aria-label="Reset camera to default view"
        title="Home"
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
          bg-transparent hover:bg-[#112240] text-slate-400 border border-[#1e3a5f]
          transition-colors min-h-[36px]
        "
      >
        <Maximize size={14} />
        <span>Home</span>
      </button>
    </div>
  );
}
