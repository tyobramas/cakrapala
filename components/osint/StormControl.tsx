'use client';

/**
 * StormControl — Refined Glassmorphic Tropical Cyclone Settings (NOAA NHC + GDACS).
 */

import { CloudLightning, X, AlertTriangle, Info } from 'lucide-react';

export interface StormSettings {
  allPast: boolean;
}

export interface StormControlProps {
  settings: StormSettings;
  onChange: (settings: StormSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  error?: string | null;
}

export default function StormControl({
  settings,
  onChange,
  isOpen,
  onClose,
  error,
}: StormControlProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Tropical Cyclone Settings"
      className="
        fixed z-30 top-20 left-60 max-md:inset-x-4 max-md:top-28
        w-[320px] max-w-[calc(100vw-2rem)]
        rounded-2xl border border-white/[0.10] bg-[#030714]/78 p-4 text-slate-200
        backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]
      "
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-400/25 bg-violet-400/10 text-violet-300">
            <CloudLightning className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-xs font-medium tracking-[0.14em] text-white uppercase">
              Tropical Cyclones
            </h2>
            <p className="text-[10px] text-slate-400">NOAA NHC · GDACS Global</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close storm settings"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-2.5 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 space-y-4 text-xs">
        <div>
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-[11px] font-medium text-slate-200">
              Include dissipated storms (7d)
            </span>
            <input
              type="checkbox"
              checked={settings.allPast}
              onChange={(e) =>
                onChange({ ...settings, allPast: e.target.checked })
              }
              className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-violet-400"
            />
          </label>
          <p className="mt-1 text-[10.5px] text-slate-400">
            Displays recently concluded cyclones for post-event tracking context.
          </p>
        </div>

        <div className="border-t border-white/[0.08] pt-3">
          <span className="mb-2 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
            GDACS Alert Levels
          </span>
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
              <span>Red — Severe humanitarian impact</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              <span>Orange — Significant coastal impact</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />
              <span>Green — Active cyclone / depression</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-[10.5px] leading-relaxed text-slate-400">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-200">
            <Info className="h-3 w-3 text-violet-300" />
            <span>Global Coverage</span>
          </div>
          High-precision track cones from <strong className="text-slate-200">NOAA NHC</strong> (Atlantic &amp; East/Central Pacific) merged with global alerts from <strong className="text-slate-200">GDACS</strong> (Western Pacific &amp; Indian Ocean).
        </div>
      </div>
    </div>
  );
}
