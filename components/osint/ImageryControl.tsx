'use client';

/**
 * ImageryControl — Refined Glassmorphic Satellite Basemap Controls (NASA GIBS + Bing Aerial).
 */

import { Satellite, X, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import type { HiResMode } from '@/components/osint/OsintGlobe';
import {
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
  opacity: number;
}

export interface ImagerySettings {
  baseLayerId: string;
  dateStr: string;
  overlays: Record<string, OverlayConfig>;
  hiResMode: HiResMode;
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
  const baseLayers = getBaseLayers().filter((l) => !l.isCesiumIon);
  const overlayLayers = getOverlayLayers();

  const currentBaseLayer =
    baseLayers.find((l) => l.id === settings.baseLayerId) ?? baseLayers[0];

  const maxDate = getMaxDateForLayer(currentBaseLayer);
  const minDate = getMinDate();

  const handleBaseLayerSelect = (layer: GibsLayer) => {
    const newMaxDate = getMaxDateForLayer(layer);
    const newDate = settings.dateStr > newMaxDate ? newMaxDate : settings.dateStr;
    onChange({ ...settings, baseLayerId: layer.id, dateStr: newDate });
  };

  const handleDateChange = (newDateStr: string) => {
    if (!newDateStr) return;
    let clamped = newDateStr;
    if (clamped > maxDate) clamped = maxDate;
    if (clamped < minDate) clamped = minDate;
    onChange({ ...settings, dateStr: clamped });
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
      overlays: { ...settings.overlays, [layerId]: { ...existing, enabled } },
    });
  };

  const handleOverlayOpacity = (layerId: string, opacity: number) => {
    const existing = settings.overlays[layerId] ?? { enabled: true, opacity: 0.8 };
    onChange({
      ...settings,
      overlays: { ...settings.overlays, [layerId]: { ...existing, opacity } },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Satellite Imagery Settings"
      className="
        fixed z-30 top-20 left-60 max-md:inset-x-4 max-md:top-28
        w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-7.5rem)] overflow-y-auto
        rounded-2xl border border-white/[0.10] bg-[#030714]/78 p-4 text-slate-200
        backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
            <Satellite className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-orbitron)] text-xs font-medium tracking-[0.14em] text-white uppercase">
              Satellite Imagery
            </h2>
            <p className="text-[10px] text-slate-400">NASA GIBS · Bing Aerial</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close imagery settings"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tile Error Notice */}
      {tileErrorNotice && (
        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              <div>
                <p className="font-medium">Tiles not yet published</p>
                <p className="mt-0.5 text-[11px] text-amber-200/80">
                  {tileErrorNotice.message}
                </p>
              </div>
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="cursor-pointer text-amber-300 hover:text-white"
                aria-label="Dismiss error"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {onApplyFallbackDate && tileErrorNotice.fallbackDate && (
            <button
              type="button"
              onClick={() => onApplyFallbackDate(tileErrorNotice.fallbackDate)}
              className="mt-2.5 w-full cursor-pointer rounded-lg border border-amber-400/30 bg-amber-400/15 py-1.5 text-[11px] font-medium text-amber-100 transition-colors hover:bg-amber-400/25"
            >
              Use previous date ({tileErrorNotice.fallbackDate})
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-4 text-xs">
        {/* Resolution Mode */}
        <div>
          <span className="mb-2 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
            Resolution Mode
          </span>
          <div className="space-y-1.5">
            {(
              [
                {
                  value: 'auto' as const,
                  label: 'Auto (Recommended)',
                  desc: 'NASA GIBS > 600 km · Bing ~1m < 400 km',
                },
                {
                  value: 'always-gibs' as const,
                  label: 'NASA GIBS Only',
                  desc: 'Daily global imagery (250m, unlimited)',
                },
                {
                  value: 'always-hires' as const,
                  label: 'High-Res Aerial',
                  desc: 'Bing Maps Aerial (~1m)',
                },
              ] satisfies { value: HiResMode; label: string; desc: string }[]
            ).map((opt) => {
              const selected = settings.hiResMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...settings, hiResMode: opt.value })}
                  className={`flex w-full cursor-pointer flex-col rounded-xl border px-3 py-2 text-left transition-all ${
                    selected
                      ? 'border-white/25 bg-white/[0.11] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="text-[11px] font-medium">{opt.label}</span>
                  <span className="mt-0.5 text-[10px] text-slate-400">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Base Layer */}
        <div>
          <span className="mb-2 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
            NASA Sensor Feed
          </span>
          <div className="space-y-1.5">
            {baseLayers.map((layer) => {
              const selected = layer.id === settings.baseLayerId;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => handleBaseLayerSelect(layer)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-left transition-all ${
                    selected
                      ? 'border-white/25 bg-white/[0.11] text-white'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-300 hover:border-white/15 hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="text-[11px] font-medium">{layer.label}</span>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-slate-300">
                    {layer.resolution}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Acquisition Date */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="gibs-date-picker"
              className="font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase"
            >
              Acquisition Date (UTC)
            </label>
            <button
              type="button"
              onClick={() => handleDateChange(maxDate)}
              className="cursor-pointer font-mono text-[10px] text-sky-300 transition-colors hover:text-white"
            >
              Latest ({maxDate})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStepDay(-1)}
              disabled={settings.dateStr <= minDate}
              aria-label="Previous day"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <input
              id="gibs-date-picker"
              type="date"
              min={minDate}
              max={maxDate}
              value={settings.dateStr}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-8 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 text-center font-mono text-[11px] text-white focus:border-white/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleStepDay(1)}
              disabled={settings.dateStr >= maxDate}
              aria-label="Next day"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            30-day archive · sensor latency {currentBaseLayer.latencyDays}d UTC.
          </p>
        </div>

        {/* Overlays */}
        <div className="border-t border-white/[0.08] pt-3">
          <span className="mb-2.5 block font-mono text-[9.5px] tracking-[0.2em] text-slate-400 uppercase">
            Cartographic Overlays
          </span>
          <div className="space-y-3">
            {overlayLayers.map((layer) => {
              const cfg = settings.overlays[layer.id] ?? {
                enabled: layer.defaultActive ?? false,
                opacity: 0.8,
              };
              return (
                <div key={layer.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) =>
                          handleOverlayToggle(layer.id, e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-sky-400"
                      />
                      <span className="text-[11px] font-medium text-slate-200">
                        {layer.label}
                      </span>
                    </label>
                    <span className="font-mono text-[10px] text-slate-400">
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
                        handleOverlayOpacity(layer.id, parseFloat(e.target.value))
                      }
                      aria-label={`${layer.label} opacity`}
                      className="h-1 w-full cursor-pointer rounded-lg bg-white/15 accent-sky-300"
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
