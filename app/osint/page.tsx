'use client';
// app/osint/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// OSINT module main page.
//
// Layout:
//   - Fullscreen Cesium globe (NaturalEarthII base + NASA GIBS satellite imagery)
//   - Left rail: 7 layer icons from registry (disabled → dimmed + "Segera" tooltip)
//   - DataAgeBadge for active layers (top-left overlay)
//   - Imagery Date & Nominal Resolution chip (top-left / header)
//   - ImageryControl popover for base layer, date, and overlay settings
//   - FireControl popover for FIRMS settings (day range, night-only, source)
//   - Attribution chip (bottom-right, permanent)
//   - Responsive: rail → horizontal bar on mobile
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { BBox, LayerId } from '@/lib/osint/types';
import { LAYER_REGISTRY } from '@/lib/osint/registry';
import { useLayer } from '@/lib/osint/useLayer';
import DataAgeBadge from '@/components/osint/DataAgeBadge';
import type { OsintGlobeHandle } from '@/components/osint/OsintGlobe';
import {
  GIBS_LAYERS,
  getDefaultBaseLayer,
  type GibsLayer,
} from '@/lib/osint/imagery/catalog';
import { getMaxDateForLayer } from '@/lib/osint/imagery/time';
import ImageryControl, {
  type ImagerySettings,
} from '@/components/osint/ImageryControl';
import FireControl, {
  type FireSettings,
} from '@/components/osint/FireControl';
import { isBBoxAreaAllowed } from '@/lib/osint/layers/fire';

// Dynamic imports for Cesium components (no SSR).
const OsintGlobe = dynamic(() => import('@/components/osint/OsintGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950">
      <div className="text-slate-400 animate-pulse font-mono text-sm">
        Memuat globe…
      </div>
    </div>
  ),
});

const QuakeLayer = dynamic(
  () => import('@/components/osint/layers/QuakeLayer'),
  { ssr: false },
);

const FireLayer = dynamic(
  () => import('@/components/osint/layers/FireLayer'),
  { ssr: false },
);

// ── Layer icon mapping ──────────────────────────────────────────────────────

const LAYER_ICONS: Record<LayerId, string> = {
  quake: '🌋',
  fire: '🔥',
  storm: '🌀',
  air: '✈️',
  sea: '🚢',
  eyes: '👁️',
  imagery: '🛰️',
};

const LAYER_ORDER: LayerId[] = [
  'quake',
  'air',
  'sea',
  'fire',
  'storm',
  'eyes',
  'imagery',
];

// ── Page component ──────────────────────────────────────────────────────────

export default function OsintPage() {
  const globeRef = useRef<OsintGlobeHandle>(null);
  const [cameraAltM, setCameraAltM] = useState(2e7);
  const [bbox, setBBox] = useState<BBox | undefined>(undefined);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    new Set(['quake', 'imagery', 'fire']),
  );
  const [selectedEntity, setSelectedEntity] = useState<
    import('@/lib/osint/types').OsintEntity | null
  >(null);

  // GIBS Imagery settings.
  const defaultBase = useMemo(() => getDefaultBaseLayer(), []);
  const [imagerySettings, setImagerySettings] = useState<ImagerySettings>({
    baseLayerId: defaultBase.id,
    dateStr: getMaxDateForLayer(defaultBase),
    overlays: {
      Coastlines_15m: { enabled: true, opacity: 0.8 },
      Reference_Labels_15m: { enabled: false, opacity: 0.8 },
    },
  });
  const [isImageryControlOpen, setIsImageryControlOpen] = useState(false);
  const [tileErrorNotice, setTileErrorNotice] = useState<{
    layerId: string;
    message: string;
    fallbackDate: string;
  } | null>(null);

  // FIRMS Fire settings.
  const [fireSettings, setFireSettings] = useState<FireSettings>({
    dayRange: 1,
    includeLowConfidence: false,
    nightOnly: false,
    source: 'auto',
  });
  const [isFireControlOpen, setIsFireControlOpen] = useState(false);

  // Quake layer hook.
  const quakeEnabled = activeLayers.has('quake');
  const quake = useLayer('quake', bbox, cameraAltM, quakeEnabled);

  // Fire layer hook:
  // Aggregate mode restriction: only fetch if camera <= 3M meters AND area <= 60°x60°
  const fireEnabled = activeLayers.has('fire');
  const fireZoomAllowed = cameraAltM <= 3_000_000 && isBBoxAreaAllowed(bbox);
  const firePollingEnabled = fireEnabled && fireZoomAllowed;

  const fireExtraParams = useMemo(
    () => ({
      range: fireSettings.dayRange,
      low: fireSettings.includeLowConfidence ? '1' : '0',
      night: fireSettings.nightOnly ? '1' : '0',
      source: fireSettings.source !== 'auto' ? fireSettings.source : undefined,
    }),
    [fireSettings],
  );

  const fire = useLayer(
    'fire',
    bbox,
    cameraAltM,
    firePollingEnabled,
    fireExtraParams,
  );

  // ── Callbacks ───────────────────────────────────────────────────────────

  const handleCameraAltChange = useCallback((alt: number) => {
    setCameraAltM(alt);
  }, []);

  const handleBBoxChange = useCallback((newBBox: BBox) => {
    setBBox(newBBox);
  }, []);

  const toggleLayer = useCallback(
    (layerId: LayerId) => {
      const config = LAYER_REGISTRY[layerId];
      if (!config.enabled) return; // Disabled layers can't be toggled.

      setActiveLayers((prev) => {
        const next = new Set(prev);
        if (next.has(layerId)) {
          next.delete(layerId);
          if (layerId === 'imagery') setIsImageryControlOpen(false);
          if (layerId === 'fire') setIsFireControlOpen(false);
        } else {
          next.add(layerId);
          if (layerId === 'fire') setIsFireControlOpen(true);
        }
        return next;
      });
    },
    [],
  );

  const handleApplyFallbackDate = useCallback((fallbackDate: string) => {
    setImagerySettings((prev) => ({ ...prev, dateStr: fallbackDate }));
    setTileErrorNotice(null);
  }, []);

  // ── Active base layer info ──────────────────────────────────────────────

  const activeBaseDef: GibsLayer =
    GIBS_LAYERS.find((l) => l.id === imagerySettings.baseLayerId) ?? defaultBase;

  // ── Active attributions ─────────────────────────────────────────────────

  const activeAttributions = useMemo(() => {
    const list: string[] = [];

    // Quake
    if (activeLayers.has('quake')) {
      list.push(LAYER_REGISTRY.quake.attribution);
    }

    // Fire
    if (activeLayers.has('fire')) {
      list.push(LAYER_REGISTRY.fire.attribution);
    }

    // Imagery
    if (activeLayers.has('imagery')) {
      list.push(activeBaseDef.attribution);
      if (imagerySettings.overlays['Coastlines_15m']?.enabled) {
        list.push('Coastlines: OSM / NASA GIBS');
      }
      if (imagerySettings.overlays['Reference_Labels_15m']?.enabled) {
        list.push('Labels: OSM / NASA GIBS');
      }
    }

    // Deduplicate
    return Array.from(new Set(list.filter(Boolean)));
  }, [activeLayers, activeBaseDef.attribution, imagerySettings.overlays]);

  // ── Viewer from globe ref ───────────────────────────────────────────────

  const viewer = globeRef.current?.getViewer();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Globe */}
      <OsintGlobe
        ref={globeRef}
        onCameraAltChange={handleCameraAltChange}
        onBBoxChange={handleBBoxChange}
        imageryEnabled={activeLayers.has('imagery')}
        activeBaseLayerId={imagerySettings.baseLayerId}
        imageryDate={imagerySettings.dateStr}
        overlaySettings={imagerySettings.overlays}
        onTileError={setTileErrorNotice}
      />

      {/* Quake entities rendered on globe */}
      {viewer && quakeEnabled && (
        <QuakeLayer
          viewer={viewer}
          entities={quake.entities}
          cameraAltM={cameraAltM}
          onSelect={setSelectedEntity}
        />
      )}

      {/* Fire entities rendered on globe */}
      {viewer && fireEnabled && fireZoomAllowed && (
        <FireLayer
          viewer={viewer}
          entities={fire.entities}
          cameraAltM={cameraAltM}
          dayRange={fireSettings.dayRange}
          onSelect={setSelectedEntity}
        />
      )}

      {/* ── Layer Rail (left on desktop, top on mobile) ─────────────────── */}
      <nav
        aria-label="OSINT layer controls"
        className="
          absolute z-10
          left-3 top-1/2 -translate-y-1/2
          flex flex-col gap-2
          md:flex-col md:left-3 md:top-1/2 md:-translate-y-1/2
          max-md:flex-row max-md:left-1/2 max-md:-translate-x-1/2 max-md:top-3
          max-md:translate-y-0
        "
      >
        {LAYER_ORDER.map((layerId) => {
          const config = LAYER_REGISTRY[layerId];
          const isActive = activeLayers.has(layerId);
          const isDisabled = !config.enabled;

          return (
            <button
              key={layerId}
              onClick={() => toggleLayer(layerId)}
              disabled={isDisabled}
              title={
                isDisabled
                  ? `${config.nameId} — Segera`
                  : `${config.nameId} (${config.nameEn})`
              }
              aria-label={`${config.nameId}: ${isDisabled ? 'Segera' : isActive ? 'aktif' : 'nonaktif'}`}
              aria-pressed={isActive}
              className={`
                relative w-11 h-11 rounded-xl flex items-center justify-center
                text-lg transition-all duration-200
                border backdrop-blur-md
                ${
                  isDisabled
                    ? 'opacity-30 cursor-not-allowed border-slate-700/40 bg-slate-800/30'
                    : isActive
                      ? 'border-white/20 bg-slate-800/70 shadow-lg shadow-purple-500/10 scale-105'
                      : 'border-slate-700/40 bg-slate-800/50 hover:bg-slate-700/60 hover:scale-105'
                }
              `}
              style={
                isActive && !isDisabled
                  ? { boxShadow: `0 0 12px ${config.color}40` }
                  : undefined
              }
            >
              <span aria-hidden="true">{LAYER_ICONS[layerId]}</span>
              {/* Active indicator dot */}
              {isActive && !isDisabled && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: config.color }}
                />
              )}
              {/* "Segera" tooltip for disabled */}
              {isDisabled && (
                <span className="absolute -bottom-5 text-[9px] text-slate-500 font-medium whitespace-nowrap">
                  Segera
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Top Bar / Badges (top-left) ──────────────────────────────────── */}
      <div className="absolute z-10 top-4 left-20 max-md:left-4 max-md:top-20 flex flex-wrap items-center gap-2">
        {/* Quake freshness badge */}
        {quakeEnabled && quake.status !== 'idle' && (
          <DataAgeBadge
            name={LAYER_REGISTRY.quake.nameId}
            ageMs={quake.ageMs}
            status={quake.status}
            refreshMs={LAYER_REGISTRY.quake.refreshMs}
          />
        )}

        {/* Fire freshness badge / Missing key warning */}
        {fireEnabled && fire.error === 'MISSING_KEY' && (
          <button
            onClick={() => setIsFireControlOpen(true)}
            className="
              px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-500/50
              text-[11px] text-amber-200 font-mono flex items-center gap-1.5 shadow
              hover:bg-amber-900/80 transition-colors
            "
            title="Kunci MAP_KEY FIRMS belum dikonfigurasi pada environment server"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Kebakaran: Perlu konfigurasi</span>
          </button>
        )}

        {fireEnabled && fire.status !== 'idle' && !fire.error && (
          <div title="Data NRT NASA FIRMS berlatensi 1-3 jam sejak pengamatan satelit.">
            <DataAgeBadge
              name={LAYER_REGISTRY.fire.nameId}
              ageMs={fire.ageMs}
              status={fire.status}
              refreshMs={LAYER_REGISTRY.fire.refreshMs}
            />
          </div>
        )}

        {/* Zoom Chip when Fire is enabled but zoom is too wide */}
        {fireEnabled && !fireZoomAllowed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs shadow-lg backdrop-blur-md">
            <span>🔍</span>
            <span>Zoom untuk memuat data kebakaran</span>
          </div>
        )}

        {/* Fire active chip */}
        {fireEnabled && fireZoomAllowed && (
          <button
            onClick={() => setIsFireControlOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700/60
              text-slate-200 text-xs font-mono shadow-lg backdrop-blur-md
              transition-all duration-150 hover:border-amber-500/50 cursor-pointer
            "
            title="Buka pengaturan deteksi kebakaran NASA FIRMS"
            aria-label="Pengaturan deteksi kebakaran NASA FIRMS"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold text-slate-100">
              Api: {fireSettings.dayRange}h ({fire.entities.length} titik)
            </span>
            <span className="text-[10px] text-slate-400 ml-0.5">⚙️</span>
          </button>
        )}

        {/* Imagery Chip with nominal resolution & date */}
        {activeLayers.has('imagery') && (
          <button
            onClick={() => setIsImageryControlOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700/60
              text-slate-200 text-xs font-mono shadow-lg backdrop-blur-md
              transition-all duration-150 hover:border-slate-500 cursor-pointer
            "
            title="Buka pengaturan citra satelit NASA GIBS"
            aria-label="Pengaturan citra satelit NASA GIBS"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-100">
              Citra: {imagerySettings.dateStr}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 font-sans">
              {activeBaseDef.label.split(' ')[0]} {activeBaseDef.resolution}
            </span>
            <span className="text-[10px] text-slate-400 ml-0.5">⚙️</span>
          </button>
        )}
      </div>

      {/* ── Imagery Control Popover ──────────────────────────────────────── */}
      <ImageryControl
        isOpen={isImageryControlOpen && activeLayers.has('imagery')}
        onClose={() => setIsImageryControlOpen(false)}
        settings={imagerySettings}
        onChange={setImagerySettings}
        tileErrorNotice={tileErrorNotice}
        onDismissError={() => setTileErrorNotice(null)}
        onApplyFallbackDate={handleApplyFallbackDate}
      />

      {/* ── Fire Control Popover ─────────────────────────────────────────── */}
      <FireControl
        isOpen={isFireControlOpen && activeLayers.has('fire')}
        onClose={() => setIsFireControlOpen(false)}
        settings={fireSettings}
        onChange={setFireSettings}
        error={fire.error}
      />

      {/* ── Selected Entity Panel (minimal) ─────────────────────────────── */}
      {selectedEntity && (
        <div className="absolute z-10 bottom-16 left-1/2 -translate-x-1/2 max-w-sm w-full mx-4">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-100 truncate">
                  {selectedEntity.label}
                </h3>
                {selectedEntity.layer === 'quake' && (
                  <p className="text-xs text-slate-400 mt-1">
                    Mag:{' '}
                    {selectedEntity.raw?.mag != null
                      ? String(selectedEntity.raw.mag)
                      : '–'}{' '}
                    · Kedalaman:{' '}
                    {Math.abs(selectedEntity.position.altM / 1000).toFixed(1)} km
                  </p>
                )}
                {selectedEntity.layer === 'fire' && (
                  <p className="text-xs text-slate-400 mt-1">
                    Intensitas:{' '}
                    {selectedEntity.raw?.frp != null
                      ? `${selectedEntity.raw.frp} MW`
                      : '–'}{' '}
                    · Confidence:{' '}
                    {String(selectedEntity.raw?.confidence || 'nominal').toUpperCase()} ·{' '}
                    {selectedEntity.raw?.daynight === 'N' ? '🌙 Malam' : '☀️ Siang'}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedEntity.position.lat.toFixed(3)}°,{' '}
                  {selectedEntity.position.lon.toFixed(3)}° ·{' '}
                  {new Date(selectedEntity.observedAt).toLocaleString('id-ID')}
                </p>
              </div>
              <button
                onClick={() => setSelectedEntity(null)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
                aria-label="Tutup panel"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attribution Chip (bottom-right, permanent) ──────────────────── */}
      {activeAttributions.length > 0 && (
        <div className="absolute z-10 bottom-2 right-2 max-w-md">
          <div className="bg-black/60 backdrop-blur-sm rounded px-2.5 py-1 text-[10px] text-slate-400 leading-tight">
            {activeAttributions.map((attr, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                {attr}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
