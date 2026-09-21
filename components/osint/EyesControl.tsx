'use client';
// components/osint/EyesControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Eyes Layer Filter & Settings Popover Control.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import type { EyesFilterSettings } from './layers/EyesLayer';

export interface EyesControlProps {
  filters: EyesFilterSettings;
  onChange: (filters: EyesFilterSettings) => void;
}

export default function EyesControl({ filters, onChange }: EyesControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  const provider = filters.provider ?? 'all';
  const hideInactive = filters.hideInactive !== false;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          border backdrop-blur-md shadow-sm
          ${
            isOpen
              ? 'bg-lime-500/20 text-lime-300 border-lime-500/50 ring-1 ring-lime-500/30'
              : 'bg-neutral-900/80 text-neutral-300 border-neutral-700/60 hover:bg-neutral-800/80 hover:text-white'
          }
        `}
      >
        <span className="w-2 h-2 rounded-full bg-lime-400" />
        <span>Filter Kamera</span>
        <span className="text-[10px] text-neutral-400">▾</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 mt-2 w-64 z-50 rounded-xl bg-neutral-900/95 border border-neutral-700/80 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 text-xs text-neutral-200">
            <div className="font-semibold text-neutral-100 border-b border-neutral-800 pb-2 mb-3 flex items-center justify-between">
              <span>Pengaturan Kamera</span>
              <span className="text-[10px] text-lime-400 font-mono">Eyes v1</span>
            </div>

            {/* Provider Filter */}
            <div className="mb-3">
              <label className="block text-[11px] font-medium text-neutral-400 mb-1.5">
                Penyedia Kamera:
              </label>
              <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                {(['all', 'official', 'windy'] as const).map((p) => {
                  const labelMap = { all: 'Semua', official: 'Resmi', windy: 'Windy' };
                  const active = provider === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onChange({ ...filters, provider: p })}
                      className={`
                        py-1 rounded text-[11px] font-medium transition-colors text-center
                        ${active ? 'bg-lime-500 text-black font-semibold shadow' : 'text-neutral-400 hover:text-white'}
                      `}
                    >
                      {labelMap[p]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hide Inactive Toggle */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-neutral-300">
                  Sembunyikan kamera tidak aktif
                </div>
                <div className="text-[10px] text-neutral-500">
                  Tidak diperbarui &gt;24 jam
                </div>
              </div>
              <input
                type="checkbox"
                checked={hideInactive}
                onChange={(e) => onChange({ ...filters, hideInactive: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-700 bg-neutral-800 text-lime-500 focus:ring-lime-400"
              />
            </div>

            {/* Disclaimer */}
            <div className="rounded-lg bg-neutral-950/80 p-2 border border-neutral-800/80 text-[10px] text-neutral-400 leading-relaxed">
              ℹ️ Webcam publik bukan siaran video langsung. Sebagian besar berupa pembaruan citra berkala.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
