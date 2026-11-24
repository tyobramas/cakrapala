'use client';

/**
 * FireControl — Refined Glassmorphic NASA FIRMS Wildfire Settings.
 */

import { Flame, X, AlertTriangle, Search } from 'lucide-react';
import { FIRMS_SOURCES } from '@/lib/osint/layers/fire';

export interface FireSettings {
  dayRange: number;
  includeLowConfidence: boolean;
  nightOnly: boolean;
  source: string;
}

export interface FireControlProps {
  settings: FireSettings;
  onChange: (settings: FireSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  error?: string | null;
}

export default function FireControl({
  settings,
  onChange,
  isOpen,
  onClose,
  error,
}: FireControlProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="NASA FIRMS Active Fire Settings"
      className="
        fixed z-30 top-20 left-60 max-md:inset-x-4 max-md:top-28
        w-[320px] max-w-[calc(100vw-2rem)]
        rounded-2xl border border-white/[0.10] bg-[#030714]/78 p-4 text-slate-200
        backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]
      "
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300">
            <Flame className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-xs font-medium tracking-[0.14em] text-white uppercase">
              Active Wildfires
            </h2>
            <p className="text-[10px] text-slate-400">NASA FIRMS · 375m VIIRS</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wildfire settings"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error === 'MISSING_KEY' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <div>
            <p className="font-medium">FIRMS_MAP_KEY not configured</p>
            <p className="mt-0.5 text-[10.5px] text-amber-200/80">
              Set the free NASA FIRMS MAP_KEY in your server environment to load thermal hotspots.
            </p>
          </div>
        </div>
      )}

      {error === 'AREA_TOO_LARGE' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-400/25 bg-sky-500/10 p-3 text-xs text-sky-100">
          <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" />
          <div>
            <p className="font-medium">Zoom closer to inspect</p>
            <p className="mt-0.5 text-[10.5px] text-sky-200/80">
              Zoom below 3,000 km (max 60° × 60° area) to query live NASA FIRMS hotspots.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4 text-xs">
        <div>
          <span className="mb-2 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
            Observation Window
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((days) => {
              const selected = settings.dayRange === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ ...settings, dayRange: days })}
                  className={`cursor-pointer rounded-xl border py-2 text-center font-mono text-[10.5px] font-medium transition-all ${
                    selected
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-100'
                      : 'border-white/[0.07] bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {days} Day{days > 1 ? 's' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 border-t border-white/[0.08] pt-3">
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-[11px] font-medium text-slate-200">
              Include low confidence
            </span>
            <input
              type="checkbox"
              checked={settings.includeLowConfidence}
              onChange={(e) =>
                onChange({ ...settings, includeLowConfidence: e.target.checked })
              }
              className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-amber-400"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-medium text-slate-200">
                Night passes only
              </span>
              <p className="text-[10px] text-slate-400">
                Filters daytime solar glare artifacts
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.nightOnly}
              onChange={(e) =>
                onChange({ ...settings, nightOnly: e.target.checked })
              }
              className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-amber-400"
            />
          </label>
        </div>

        <div className="border-t border-white/[0.08] pt-3">
          <label
            htmlFor="fire-source-select"
            className="mb-1.5 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase"
          >
            Sensor Source
          </label>
          <select
            id="fire-source-select"
            value={settings.source}
            onChange={(e) => onChange({ ...settings, source: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-[#050b18] px-3 py-2 text-[11px] text-slate-100 focus:border-white/30 focus:outline-none"
          >
            <option value="auto">Auto (VIIRS NOAA-20 + Fallback)</option>
            <option value={FIRMS_SOURCES[0]}>VIIRS NOAA-20 NRT (375m)</option>
            <option value={FIRMS_SOURCES[1]}>VIIRS Suomi NPP NRT (375m)</option>
            <option value={FIRMS_SOURCES[2]}>MODIS Terra/Aqua NRT (1km)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
