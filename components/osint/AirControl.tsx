'use client';

/**
 * AirControl — Refined Glassmorphic ADS-B Flight Traffic Settings.
 */

import { useState } from 'react';
import { Plane, X, Search, Shield } from 'lucide-react';
import type { AirFilterSettings } from './layers/AirLayer';
import type { OsintEntity } from '@/lib/osint/types';

export interface AirControlProps {
  settings: AirFilterSettings;
  onChange: (settings: AirFilterSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  entities?: OsintEntity[];
  onFlyTo?: (entity: OsintEntity) => void;
}

export default function AirControl({
  settings,
  onChange,
  isOpen,
  onClose,
  entities = [],
  onFlyTo,
}: AirControlProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredSearchResults =
    searchQuery.trim().length >= 2
      ? entities
          .filter((e) => {
            const q = searchQuery.trim().toUpperCase();
            const callsign = String(e.raw?.callsign || '').toUpperCase();
            const reg = String(e.raw?.registration || '').toUpperCase();
            const hex = String(e.raw?.hex || '').toUpperCase();
            return callsign.includes(q) || reg.includes(q) || hex.includes(q);
          })
          .slice(0, 5)
      : [];

  return (
    <div
      role="dialog"
      aria-label="Air Traffic Settings"
      className="
        fixed z-30 top-20 left-60 max-md:inset-x-4 max-md:top-28
        w-[330px] max-w-[calc(100vw-2rem)]
        rounded-2xl border border-white/[0.10] bg-[#030714]/78 p-4 text-slate-200
        backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]
      "
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
            <Plane className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-xs font-medium tracking-[0.14em] text-white uppercase">
              Air Traffic
            </h2>
            <p className="text-[10px] text-slate-400">Live ADS-B · adsb.lol ODbL</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close air settings"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="mt-3.5">
        <label className="mb-1.5 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
          Find Callsign / Reg / Hex
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="e.g. GIA404, PK-G..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-1.5 pr-7 pl-8 font-mono text-[11px] text-white placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {filteredSearchResults.length > 0 && (
          <div className="mt-1.5 space-y-1 rounded-xl border border-white/10 bg-[#020510]/90 p-1">
            {filteredSearchResults.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onFlyTo?.(e);
                  setSearchQuery('');
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-white/[0.08]"
              >
                <div className="font-mono">
                  <span className="font-medium text-sky-200">{e.label}</span>
                  {Boolean(e.raw?.acType) && (
                    <span className="ml-1.5 text-[10px] text-slate-400">
                      {String(e.raw?.acType)}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  {Math.round(e.position.altM * 3.28084).toLocaleString()} ft
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mt-4 space-y-3 text-xs">
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-[11px] text-slate-200">Hide grounded aircraft</span>
          <input
            type="checkbox"
            checked={settings.hideOnGround ?? true}
            onChange={(e) =>
              onChange({ ...settings, hideOnGround: e.target.checked })
            }
            className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-sky-400"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between">
          <span className="flex items-center gap-2 text-[11px] text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Military aircraft only
          </span>
          <input
            type="checkbox"
            checked={settings.militaryOnly ?? false}
            onChange={(e) =>
              onChange({ ...settings, militaryOnly: e.target.checked })
            }
            className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-amber-400"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-[11px] text-slate-200">Show 60s flight trails</span>
          <input
            type="checkbox"
            checked={settings.showTrails ?? true}
            onChange={(e) =>
              onChange({ ...settings, showTrails: e.target.checked })
            }
            className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-white/5 accent-sky-400"
          />
        </label>

        <div className="border-t border-white/[0.08] pt-3">
          <div className="mb-1.5 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400">Max Altitude</span>
            <span className="font-mono text-white/90">
              {(settings.maxAltFt ?? 45000) >= 45000
                ? 'All Altitudes'
                : `${(settings.maxAltFt ?? 45000).toLocaleString()} ft`}
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={45000}
            step={1000}
            value={settings.maxAltFt ?? 45000}
            onChange={(e) =>
              onChange({
                ...settings,
                maxAltFt:
                  Number(e.target.value) >= 45000
                    ? undefined
                    : Number(e.target.value),
              })
            }
            className="h-1 w-full cursor-pointer rounded-lg bg-white/15 accent-sky-300"
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2.5 text-[10px] leading-relaxed text-slate-400">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/80" />
          <span>
            Ephemeral session memory only — zero persistent tail history or tracking stored on disk.
          </span>
        </div>
      </div>
    </div>
  );
}
