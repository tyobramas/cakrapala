'use client';
// components/osint/ImageryControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Control panel for the NASA GIBS satellite imagery basemap.
// Includes:
//   - Base layer selection (VIIRS SNPP, MODIS Terra, VIIRS Night Band)
//   - Overlay toggles + opacity sliders (Coastlines, Reference Labels)
//   - Date selector (constrained to 30 days back up to layer's latencyDays)
//   - Quick "Kemarin" button
//   - Soft error notification banner
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  GIBS_LAYERS,
  getBaseLayers,
  getOverlayLayers,
  type GibsLayer,
} from '@/lib/osint/imagery/catalog';
import {
  getMaxDateForLayer,
  getMinDate,
  formatUtcDate,
  parseUtcDate,
} from '@/lib/osint/imagery/time';

export interface OverlayConfig {
  enabled: boolean;
  opacity: number; // 0.0 .. 1.0
}

export interface ImagerySettings {
  baseLayerId: string;
  dateStr: string;
  overlays: Record<string, OverlayConfig>;
}

export interface ImageryControlProps {
  settings: ImagerySettings;
  onChange: (settings: ImagerySettings) => void;
  isOpen: boolean;
  onClose: () => void;
  tileErrorNotice?: {
    layerId: string;
    message: string;
    fallbackDate: string;
  } | null;
  onDismissError?: () => void;
  onApplyFallbackDate?: (fallbackDate: string) => void;
}

export default function ImageryControl({
  settings,
  onChange,
  isOpen,
  onClose,
  tileErrorNotice,
  onDismissError,
  onApplyFallbackDate,
}: ImageryControlProps) {
  const baseLayers = getBaseLayers();
  const overlayLayers = getOverlayLayers();

  const currentBaseLayer =
    baseLayers.find((l) => l.id === settings.baseLayerId) ?? baseLayers[0];

  const maxDate = getMaxDateForLayer(currentBaseLayer);
  const minDate = getMinDate();

  const handleBaseLayerSelect = (layer: GibsLayer) => {
    // When changing base layer, ensure date is clamped to new layer's maxDate
    const newMaxDate = getMaxDateForLayer(layer);
    let newDate = settings.dateStr;
    if (newDate > newMaxDate) {
      newDate = newMaxDate;
    }
    onChange({
      ...settings,
      baseLayerId: layer.id,
      dateStr: newDate,
    });
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    let clamped = newDateStr;
    if (clamped > maxDate) clamped = maxDate;
    if (clamped < minDate) clamped = minDate;
    onChange({
      ...settings,
      dateStr: clamped,
    });
  };

  const handleStepDay = (deltaDays: number) => {
    const current = parseUtcDate(settings.dateStr) ?? new Date();
    current.setUTCDate(current.getUTCDate() + deltaDays);
    handleDateChange(formatUtcDate(current));
  };

  const handleOverlayToggle = (layerId: string, enabled: boolean) => {
    const existing = settings.overlays[layerId] ?? { enabled: false, opacity: 0.8 };
    onChange({
      ...settings,
      overlays: {
        ...settings.overlays,
        [layerId]: { ...existing, enabled },
      },
    });
  };

  const handleOverlayOpacity = (layerId: string, opacity: number) => {
    const existing = settings.overlays[layerId] ?? { enabled: true, opacity: 0.8 };
    onChange({
      ...settings,
      overlays: {
        ...settings.overlays,
        [layerId]: { ...existing, opacity },
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Pengaturan Citra Satelit GIBS"
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
          <span className="text-base" aria-hidden="true">🛰️</span>
          <h2 className="text-sm font-semibold text-slate-100">
            Citra Satelit (NASA GIBS)
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 rounded-lg p-1 hover:bg-slate-800 transition-colors"
          aria-label="Tutup panel citra"
        >
          ✕
        </button>
      </div>

      {/* Tile Error Notification Banner (if any) */}
      {tileErrorNotice && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-medium">⚠️ Sebagian tile belum tersedia</p>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                {tileErrorNotice.message}
              </p>
            </div>
            {onDismissError && (
              <button
                onClick={onDismissError}
                className="text-amber-400 hover:text-amber-200 text-sm font-bold"
                aria-label="Tutup notifikasi error"
              >
                ✕
              </button>
            )}
          </div>
          {onApplyFallbackDate && tileErrorNotice.fallbackDate && (
            <button
              onClick={() => onApplyFallbackDate(tileErrorNotice.fallbackDate)}
              className="
                mt-2 w-full py-1 px-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50
                border border-amber-500/40 text-amber-200 text-[11px] font-medium
                transition-colors
              "
            >
              Gunakan tanggal sebelumnya ({tileErrorNotice.fallbackDate})
            </button>
          )}
        </div>
      )}

      <div className="mt-3 space-y-4 text-xs">
        {/* Base Layer Radio Selector */}
        <div>
          <label className="block font-medium text-slate-400 mb-1.5">
            Lapisan Dasar (Resolusi Nominal)
          </label>
          <div className="space-y-1.5">
            {baseLayers.map((layer) => {
              const isSelected = layer.id === settings.baseLayerId;
              return (
                <label
                  key={layer.id}
                  className={`
                    flex items-center justify-between p-2 rounded-xl cursor-pointer
                    border transition-all duration-150
                    ${
                      isSelected
                        ? 'border-indigo-500/60 bg-indigo-950/40 text-indigo-100 shadow-sm'
                        : 'border-slate-800 bg-slate-800/30 hover:bg-slate-800/60 text-slate-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gibsBaseLayer"
                      checked={isSelected}
                      onChange={() => handleBaseLayerSelect(layer)}
                      className="text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                    />
                    <span className="font-medium">{layer.label}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400">
                    {layer.resolution}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Date Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="gibs-date-picker" className="font-medium text-slate-400">
              Tanggal Pengambilan (UTC)
            </label>
            <button
              onClick={() => handleDateChange(maxDate)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline"
            >
              Kemarin ({maxDate})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleStepDay(-1)}
              disabled={settings.dateStr <= minDate}
              aria-label="Satu hari sebelumnya"
              className="
                p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700
                disabled:opacity-30 disabled:cursor-not-allowed text-slate-200
              "
            >
              ◀
            </button>
            <input
              id="gibs-date-picker"
              type="date"
              min={minDate}
              max={maxDate}
              value={settings.dateStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="
                flex-1 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1.5
                text-slate-100 font-mono text-center focus:outline-none focus:border-indigo-500
              "
            />
            <button
              onClick={() => handleStepDay(1)}
              disabled={settings.dateStr >= maxDate}
              aria-label="Satu hari sesudahnya"
              className="
                p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700
                disabled:opacity-30 disabled:cursor-not-allowed text-slate-200
              "
            >
              ▶
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Rentang riwayat: 30 hari ke belakang (latensi produk: {currentBaseLayer.latencyDays} hari).
          </p>
        </div>

        {/* Overlays */}
        <div className="pt-2 border-t border-slate-800">
          <label className="block font-medium text-slate-400 mb-2">
            Lapisan Batas & Label (15m)
          </label>
          <div className="space-y-3">
            {overlayLayers.map((layer) => {
              const cfg = settings.overlays[layer.id] ?? {
                enabled: layer.defaultActive ?? false,
                opacity: 0.8,
              };
              return (
                <div key={layer.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) =>
                          handleOverlayToggle(layer.id, e.target.checked)
                        }
                        className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
                      />
                      <span className="font-medium text-slate-300">
                        {layer.label}
                      </span>
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round(cfg.opacity * 100)}%
                    </span>
                  </div>

                  {cfg.enabled && (
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={cfg.opacity}
                      onChange={(e) =>
                        handleOverlayOpacity(
                          layer.id,
                          parseFloat(e.target.value),
                        )
                      }
                      aria-label={`Transparansi ${layer.label}`}
                      className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
