'use client';
// components/osint/SeaControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Popover UI control for the OSINT Sea Layer.
//
// Features:
//   - Filter by ship category (cargo, tanker, passenger, fishing, military, other)
//   - Toggle to hide anchored or moored vessels (navStat 1 & 5)
//   - Toggle to hide positions older than 1 hour (default active)
//   - Toggle to show historical motion trails
//   - Search by ship name / MMSI / IMO with fly-to target
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react';
import type { OsintEntity } from '@/lib/osint/types';
import type { SeaFilterSettings } from './layers/SeaLayer';

export interface SeaControlProps {
  settings: SeaFilterSettings;
  onChange: (settings: SeaFilterSettings) => void;
  vessels: OsintEntity[];
  onFlyTo?: (entity: OsintEntity) => void;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'tanker', label: 'Tanker' },
  { id: 'passenger', label: 'Passenger' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'military', label: 'Military' },
  { id: 'other', label: 'Other' },
];

export default function SeaControl({
  settings,
  onChange,
  vessels,
  onFlyTo,
  isOpen,
  onClose,
}: SeaControlProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSearchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return vessels
      .filter((e) => {
        const name = e.label.toLowerCase();
        const mmsi = String(e.raw?.mmsi || '').toLowerCase();
        const imo = String(e.raw?.imo || '').toLowerCase();
        const callsign = String(e.raw?.callsign || '').toLowerCase();
        return name.includes(q) || mmsi.includes(q) || imo.includes(q) || callsign.includes(q);
      })
      .slice(0, 8);
  }, [vessels, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Sea Traffic Layer Settings"
      className="
        absolute top-16 left-16 z-30 w-80 rounded-xl
        bg-slate-900/95 border border-teal-500/40 p-4 shadow-2xl backdrop-blur-md
        text-slate-200 text-xs flex flex-col gap-3 font-sans
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
          <h2 className="font-semibold text-sm text-teal-300">Sea Traffic (AIS) Filters</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Search with Fly-To */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-slate-400">Search Vessels (Name / MMSI / IMO)</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="e.g. FINNSTAR / 230981000..."
          className="
            w-full px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700
            text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-teal-400
          "
        />
        {filteredSearchResults.length > 0 && (
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto bg-slate-950/80 rounded-lg p-1 border border-slate-800">
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
                <div className="font-mono truncate pr-2">
                  <span className="font-semibold text-teal-300">{e.label}</span>
                  {Boolean(e.raw?.shipTypeLabel) && (
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({String(e.raw?.shipTypeLabel)})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                  {Math.round(Number(e.raw?.sogKnots) || 0)} kt
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-slate-400">Vessel Category</label>
        <div className="grid grid-cols-4 gap-1">
          {CATEGORIES.map((cat) => {
            const isSelected = (settings.category || 'all') === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onChange({ ...settings, category: cat.id })}
                className={`
                  px-2 py-1 rounded text-[11px] font-medium transition-all text-center
                  ${
                    isSelected
                      ? 'bg-teal-500 text-slate-950 shadow-sm font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }
                `}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-300">Hide anchored / moored vessels</span>
          <input
            type="checkbox"
            checked={Boolean(settings.hideAnchoredMoored)}
            onChange={(e) =>
              onChange({ ...settings, hideAnchoredMoored: e.target.checked })
            }
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-teal-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-300">Hide positions older than 1 hour</span>
          <input
            type="checkbox"
            checked={settings.hideOlderThan1Hour !== false}
            onChange={(e) =>
              onChange({ ...settings, hideOlderThan1Hour: e.target.checked })
            }
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-teal-500 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-300">Show movement trails (detail zoom)</span>
          <input
            type="checkbox"
            checked={settings.showTrails !== false}
            onChange={(e) =>
              onChange({ ...settings, showTrails: e.target.checked })
            }
            className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-teal-500 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>

      {/* Legend & Note */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-teal-400" /> Active
          <span className="w-2 h-2 rounded-full bg-amber-400 ml-1" /> Degraded
          <span className="w-2 h-2 rounded-full bg-red-400 ml-1" /> Emergency
        </div>
        <span>Baltic Sea (Phase 1)</span>
      </div>
    </div>
  );
}
