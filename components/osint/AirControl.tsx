'use client';
// components/osint/AirControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Control panel popover for ADS-B Flight Tracking layer.
//
// Settings:
//   - Altitude range filter (feet)
//   - Hide grounded aircraft toggle (default: true)
//   - Military-only filter toggle (dbFlags bit 0)
//   - Show 60s flight trails toggle (default: true)
//   - Search callsign/registration/hex with fly-to
//
// PRIVACY SAFEGUARD:
//   - No persistent tail tracking / notifications.
//   - Position history is strictly in-memory per session (never written to disk).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
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

  const filteredSearchResults = searchQuery.trim().length >= 2
    ? entities.filter((e) => {
        const q = searchQuery.trim().toUpperCase();
        const callsign = String(e.raw?.callsign || '').toUpperCase();
        const reg = String(e.raw?.registration || '').toUpperCase();
        const hex = String(e.raw?.hex || '').toUpperCase();
        return callsign.includes(q) || reg.includes(q) || hex.includes(q);
      }).slice(0, 5)
    : [];

  return (
    <div
      role="dialog"
      aria-label="Pengaturan Lalu Lintas Udara"
      className="
        absolute z-20 top-16 left-20 max-md:left-4 max-md:top-24 max-md:right-4
        w-84 max-w-[calc(100vw-2rem)]
        bg-slate-900/95 backdrop-blur-md border border-slate-700/60
        rounded-2xl p-4 shadow-2xl text-slate-200
        animate-in fade-in duration-150
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">✈️</span>
          <h2 className="text-sm font-semibold text-slate-100">
            Lalu Lintas Udara (ADS-B)
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 rounded-lg p-1 hover:bg-slate-800 transition-colors"
          aria-label="Tutup panel"
        >
          ✕
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-3">
        <label className="text-[11px] text-slate-400 block mb-1">
          Cari Callsign / Registrasi / Hex:
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="mis. CTV918, PK-GQD, 8a04a7…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700
              text-slate-100 text-xs placeholder:text-slate-500 font-mono
              focus:outline-none focus:border-cyan-400 transition-colors
            "
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {filteredSearchResults.length > 0 && (
          <div className="mt-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            {filteredSearchResults.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  if (onFlyTo) onFlyTo(e);
                  setSearchQuery('');
                }}
                className="
                  w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-slate-800/80
                  flex items-center justify-between transition-colors
                "
              >
                <div className="font-mono">
                  <span className="font-semibold text-cyan-300">{e.label}</span>
                  {Boolean(e.raw?.acType) && (
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({String(e.raw?.acType)})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {Math.round(e.position.altM * 3.28084)} ft
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls and Toggles */}
      <div className="mt-4 space-y-3.5 text-xs">
        {/* Hide on ground toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-300">Sembunyikan pesawat di darat</span>
          <input
            type="checkbox"
            checked={settings.hideOnGround ?? true}
            onChange={(e) =>
              onChange({ ...settings, hideOnGround: e.target.checked })
            }
            className="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
          />
        </label>

        {/* Military only toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-slate-300">Hanya pesawat militer</span>
          </div>
          <input
            type="checkbox"
            checked={settings.militaryOnly ?? false}
            onChange={(e) =>
              onChange({ ...settings, militaryOnly: e.target.checked })
            }
            className="accent-amber-500 rounded w-4 h-4 cursor-pointer"
          />
        </label>

        {/* Show trails toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-300">Tampilkan jejak penerbangan</span>
          <input
            type="checkbox"
            checked={settings.showTrails ?? true}
            onChange={(e) =>
              onChange({ ...settings, showTrails: e.target.checked })
            }
            className="accent-cyan-400 rounded w-4 h-4 cursor-pointer"
          />
        </label>

        {/* Altitude Range Filter */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Filter Ketinggian Maksimum:</span>
            <span className="font-mono text-cyan-300">
              {(settings.maxAltFt ?? 45000) >= 45000
                ? 'Semua Ketinggian'
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
                maxAltFt: Number(e.target.value) >= 45000 ? undefined : Number(e.target.value),
              })
            }
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Privacy Note */}
        <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed">
          🔒 <strong>Privasi & Keamanan Data:</strong> Pelacakan berbasis sesi memori sementara. Tidak ada penyimpanan permanen riwayat lintasan maupun notifikasi persisten per pesawat.
        </div>
      </div>
    </div>
  );
}
