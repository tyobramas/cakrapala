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
import type { BBox, LayerId, OsintEntity } from '@/lib/osint/types';
import { LAYER_REGISTRY, resolveDisplayMode } from '@/lib/osint/registry';
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
import StormControl, {
  type StormSettings,
} from '@/components/osint/StormControl';
import AirControl from '@/components/osint/AirControl';
import type { AirFilterSettings } from '@/components/osint/layers/AirLayer';
import SeaControl from '@/components/osint/SeaControl';
import type { SeaFilterSettings } from '@/components/osint/layers/SeaLayer';
import { isBBoxAreaAllowed } from '@/lib/osint/layers/fire';
import { bboxToCenterRadius } from '@/lib/osint/layers/air/geo';
import { isWithinSeaCoverage } from '@/lib/osint/layers/sea';

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

const StormLayer = dynamic(
  () => import('@/components/osint/layers/StormLayer'),
  { ssr: false },
);

const AirLayer = dynamic(
  () => import('@/components/osint/layers/AirLayer'),
  { ssr: false },
);

const SeaLayer = dynamic(
  () => import('@/components/osint/layers/SeaLayer'),
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
  const displayMode = resolveDisplayMode(cameraAltM);
  const [bbox, setBBox] = useState<BBox | undefined>(undefined);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    new Set(['quake', 'imagery', 'fire', 'storm', 'air']),
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

  // Storm Tropical Cyclone settings.
  const [stormSettings, setStormSettings] = useState<StormSettings>({
    allPast: false,
  });
  const [isStormControlOpen, setIsStormControlOpen] = useState(false);

  // Air (ADS-B Flight Tracking) settings.
  const [airSettings, setAirSettings] = useState<AirFilterSettings>({
    hideOnGround: true,
    militaryOnly: false,
    showTrails: true,
    maxAltFt: undefined,
  });
  const [isAirControlOpen, setIsAirControlOpen] = useState(false);

  // Sea (AIS Vessel Tracking) settings.
  const [seaSettings, setSeaSettings] = useState<SeaFilterSettings>({
    category: 'all',
    hideAnchoredMoored: false,
    hideOlderThan1Hour: true,
    showTrails: true,
  });
  const [isSeaControlOpen, setIsSeaControlOpen] = useState(false);

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

  // Storm layer hook:
  // Global scope: active in all zoom levels, does not require bbox gating
  const stormEnabled = activeLayers.has('storm');
  const stormExtraParams = useMemo(
    () => ({
      allPast: stormSettings.allPast ? '1' : undefined,
    }),
    [stormSettings],
  );
  const storm = useLayer(
    'storm',
    undefined,
    cameraAltM,
    stormEnabled,
    stormExtraParams,
  );

  // Air layer hook:
  // Restricted: only fetch if camera <= 3M meters AND radius <= 250 nm
  const airEnabled = activeLayers.has('air');
  const airRadiusCheck = bbox ? bboxToCenterRadius(bbox) : null;
  const airZoomAllowed =
    cameraAltM <= 3_000_000 &&
    (airRadiusCheck ? !airRadiusCheck.isTooLarge : false);
  const airPollingEnabled = airEnabled && airZoomAllowed;

  const air = useLayer(
    'air',
    bbox,
    cameraAltM,
    airPollingEnabled,
  );

  // Sea layer hook:
  // Disabled in aggregate mode (> 3,000,000 m). Regional coverage handled gracefully.
  const seaEnabled = activeLayers.has('sea');
  const seaZoomAllowed = cameraAltM <= 3_000_000;
  const seaPollingEnabled = seaEnabled && seaZoomAllowed;

  const sea = useLayer(
    'sea',
    bbox,
    cameraAltM,
    seaPollingEnabled,
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
          if (layerId === 'storm') setIsStormControlOpen(false);
          if (layerId === 'air') setIsAirControlOpen(false);
          if (layerId === 'sea') setIsSeaControlOpen(false);
        } else {
          next.add(layerId);
          if (layerId === 'fire') setIsFireControlOpen(true);
          if (layerId === 'storm') setIsStormControlOpen(true);
          if (layerId === 'air') setIsAirControlOpen(true);
          if (layerId === 'sea') setIsSeaControlOpen(true);
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

  const handleFlyToAircraft = useCallback((entity: OsintEntity) => {
    setSelectedEntity(entity);
    globeRef.current?.flyTo(entity.position.lat, entity.position.lon, 25000);
  }, []);

  const handleFlyToVessel = useCallback((entity: OsintEntity) => {
    setSelectedEntity(entity);
    globeRef.current?.flyTo(entity.position.lat, entity.position.lon, 25000);
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

    // Storm
    if (activeLayers.has('storm')) {
      list.push(LAYER_REGISTRY.storm.attribution);
    }

    // Air
    if (activeLayers.has('air')) {
      list.push(LAYER_REGISTRY.air.attribution);
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

      {/* Storm entities rendered on globe */}
      {viewer && stormEnabled && (
        <StormLayer
          viewer={viewer}
          entities={storm.entities}
          cameraAltM={cameraAltM}
          selectedEntity={selectedEntity}
          onSelect={setSelectedEntity}
        />
      )}

      {/* Air entities rendered on globe */}
      {viewer && airEnabled && airZoomAllowed && (
        <AirLayer
          viewer={viewer}
          entities={air.entities}
          cameraAltM={cameraAltM}
          filterSettings={airSettings}
          selectedEntity={selectedEntity}
          onSelect={setSelectedEntity}
        />
      )}

      {/* Sea entities rendered on globe */}
      {viewer && seaEnabled && seaZoomAllowed && (
        <SeaLayer
          viewer={viewer}
          entities={sea.entities}
          displayMode={displayMode}
          filters={seaSettings}
          selectedEntityId={selectedEntity?.id}
          onSelectEntity={setSelectedEntity}
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

        {/* Storm freshness badge */}
        {stormEnabled && storm.status !== 'idle' && (
          <div title="Advisory siklon tropis diterbitkan setiap 6 jam (03/09/15/21 UTC).">
            <DataAgeBadge
              name={LAYER_REGISTRY.storm.nameId}
              ageMs={storm.ageMs}
              status={storm.status}
              refreshMs={LAYER_REGISTRY.storm.refreshMs}
            />
          </div>
        )}

        {/* Storm active chip */}
        {stormEnabled && (
          <button
            onClick={() => setIsStormControlOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700/60
              text-slate-200 text-xs font-mono shadow-lg backdrop-blur-md
              transition-all duration-150 hover:border-violet-500/50 cursor-pointer
            "
            title="Buka pengaturan siklon tropis"
            aria-label="Pengaturan siklon tropis"
          >
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="font-semibold text-slate-100">
              Badai: {storm.entities.length} aktif
            </span>
            <span className="text-[10px] text-slate-400 ml-0.5">⚙️</span>
          </button>
        )}

        {/* Empty state when storm has 0 active entities */}
        {stormEnabled && storm.status === 'ok' && storm.entities.length === 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/40 text-slate-400 text-xs shadow-lg backdrop-blur-md">
            <span>🌀</span>
            <span>Tidak ada siklon tropis aktif saat ini</span>
          </div>
        )}

        {/* Air freshness badge */}
        {airEnabled && airZoomAllowed && air.status !== 'idle' && (
          <div title="Data ADS-B langsung dari kontributor adsb.lol (ODbL)">
            <DataAgeBadge
              name={LAYER_REGISTRY.air.nameId}
              ageMs={air.ageMs}
              status={air.status}
              refreshMs={LAYER_REGISTRY.air.refreshMs}
            />
          </div>
        )}

        {/* Zoom Chip when Air is enabled but zoom is too wide */}
        {airEnabled && !airZoomAllowed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs shadow-lg backdrop-blur-md">
            <span>🔍</span>
            <span>Zoom untuk memuat lalu lintas udara</span>
          </div>
        )}

        {/* Air active chip */}
        {airEnabled && airZoomAllowed && (
          <button
            onClick={() => setIsAirControlOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700/60
              text-slate-200 text-xs font-mono shadow-lg backdrop-blur-md
              transition-all duration-150 hover:border-cyan-500/50 cursor-pointer
            "
            title="Buka pengaturan lalu lintas udara ADS-B"
            aria-label="Pengaturan lalu lintas udara ADS-B"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-100">
              Udara: {air.entities.length}
              {air.entities[0]?.raw?.prunedCount
                ? ` (${air.entities.length} dari ${Number(air.entities[0].raw.totalFound)} terdekat)`
                : ' pesawat'}
            </span>
            <span className="text-[10px] text-slate-400 ml-0.5">⚙️</span>
          </button>
        )}

        {/* Sea freshness badge */}
        {seaEnabled && seaZoomAllowed && sea.status !== 'idle' && (
          <div title="Data AIS dari Fintraffic Digitraffic (CC BY 4.0)">
            <DataAgeBadge
              name={LAYER_REGISTRY.sea.nameId}
              ageMs={sea.ageMs}
              status={sea.status}
              refreshMs={LAYER_REGISTRY.sea.refreshMs}
            />
          </div>
        )}

        {/* Zoom Chip when Sea is enabled but in aggregate mode */}
        {seaEnabled && !seaZoomAllowed && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-teal-200 text-xs shadow-lg backdrop-blur-md">
            <span>🔍</span>
            <span>Zoom untuk memuat lalu lintas laut</span>
          </div>
        )}

        {/* Coverage Notice Chip when Sea is out of coverage (e.g. Indonesia) */}
        {seaEnabled && seaZoomAllowed && (sea.error === 'OUT_OF_COVERAGE' || (bbox && !isWithinSeaCoverage(bbox))) && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-teal-500/40 text-teal-300 text-xs shadow-lg backdrop-blur-md">
            <span>ℹ️</span>
            <span>Cakupan AIS saat ini terbatas pada Laut Baltik dan Norwegia. Cakupan global menyusul.</span>
          </div>
        )}

        {/* Sea active chip */}
        {seaEnabled && seaZoomAllowed && sea.error !== 'OUT_OF_COVERAGE' && (!bbox || isWithinSeaCoverage(bbox)) && (
          <button
            onClick={() => setIsSeaControlOpen((prev) => !prev)}
            className="
              flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-slate-900/85 hover:bg-slate-800/95 border border-slate-700/60
              text-slate-200 text-xs font-mono shadow-lg backdrop-blur-md
              transition-all duration-150 hover:border-teal-500/50 cursor-pointer
            "
            title="Buka pengaturan lalu lintas laut AIS"
            aria-label="Pengaturan lalu lintas laut AIS"
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="font-semibold text-slate-100">
              Laut: {sea.entities.length}
              {Boolean(sea.entities[0]?.raw?.cutCount)
                ? ` (menampilkan ${sea.entities.length} dari ${Number(sea.entities[0]?.raw?.totalFound)} terdekat)`
                : ' kapal'}
            </span>
            <span className="text-[10px] text-slate-400 ml-0.5">⚙️</span>
          </button>
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

      {/* ── Storm Control Popover ────────────────────────────────────────── */}
      <StormControl
        isOpen={isStormControlOpen && activeLayers.has('storm')}
        onClose={() => setIsStormControlOpen(false)}
        settings={stormSettings}
        onChange={setStormSettings}
        error={storm.error}
      />

      {/* ── Air Control Popover ──────────────────────────────────────────── */}
      <AirControl
        isOpen={isAirControlOpen && activeLayers.has('air')}
        onClose={() => setIsAirControlOpen(false)}
        settings={airSettings}
        onChange={setAirSettings}
        entities={air.entities}
        onFlyTo={handleFlyToAircraft}
      />

      {/* ── Sea Control Popover ──────────────────────────────────────────── */}
      <SeaControl
        isOpen={isSeaControlOpen && activeLayers.has('sea')}
        onClose={() => setIsSeaControlOpen(false)}
        settings={seaSettings}
        onChange={setSeaSettings}
        vessels={sea.entities}
        onFlyTo={handleFlyToVessel}
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
                {selectedEntity.layer === 'air' && (
                  <div className="space-y-1 mt-1 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cyan-300 font-mono">
                        {Boolean(selectedEntity.raw?.onGround)
                          ? 'DI DARAT'
                          : `${Math.round(selectedEntity.position.altM * 3.28084).toLocaleString()} ft (${Math.round(selectedEntity.position.altM)} m)`}
                      </span>
                      {Boolean(selectedEntity.raw?.acType) && (
                        <span className="text-slate-300 font-mono">
                          · {String(selectedEntity.raw?.acType)}
                        </span>
                      )}
                      {Boolean(selectedEntity.raw?.isMilitary) && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-semibold text-[10px]">
                          MILITER
                        </span>
                      )}
                    </div>
                    <p>
                      Kecepatan:{' '}
                      <span className="font-mono text-slate-200">
                        {Math.round(Number(selectedEntity.raw?.speedKt ?? ((selectedEntity.speedMs ?? 0) * 1.94384)))} kt
                      </span>
                      {' '}({Math.round((selectedEntity.speedMs ?? 0) * 3.6)} km/h)
                      {selectedEntity.headingDeg != null && (
                        <span> · Arah: {Math.round(selectedEntity.headingDeg)}°</span>
                      )}
                    </p>
                    {selectedEntity.raw?.verticalRateMs != null && (
                      <p>
                        Laju Vertikal:{' '}
                        <span className="font-mono text-slate-200">
                          {Math.round(Number(selectedEntity.raw.verticalRateMs) / 0.00508)} ft/min
                        </span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                      {Boolean(selectedEntity.raw?.registration) && (
                        <span>Reg: {String(selectedEntity.raw?.registration)}</span>
                      )}
                      {Boolean(selectedEntity.raw?.squawk) && (
                        <span>· Squawk: {String(selectedEntity.raw?.squawk)}</span>
                      )}
                      {Boolean(selectedEntity.raw?.hex) && (
                        <span>· Hex: {String(selectedEntity.raw?.hex).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                      <span>Sumber: {String(selectedEntity.raw?.posSource || 'adsb_icao')}</span>
                      <span>Posisi: {selectedEntity.raw?.seenPosS != null ? `${selectedEntity.raw.seenPosS}s lalu` : 'segar'}</span>
                    </div>
                  </div>
                )}
                {selectedEntity.layer === 'sea' && (
                  <div className="space-y-1 mt-1 text-xs text-slate-400">
                    {/* Emergency SART Alert Banner */}
                    {Boolean(selectedEntity.raw?.isEmergency) && (
                      <div className="px-2 py-1 rounded bg-red-950/90 border border-red-500/80 text-red-200 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                        <span>🚨</span>
                        <span>{String(selectedEntity.raw?.navStatLabel || 'SINYAL DARURAT AIS AKTIF')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-teal-300 font-mono">
                        {String(selectedEntity.raw?.shipTypeLabel || 'Kapal')}
                      </span>
                      {Boolean(selectedEntity.raw?.navStatLabel) && !selectedEntity.raw?.isEmergency && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                            selectedEntity.raw?.isSpecialNav
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {String(selectedEntity.raw?.navStatLabel)}
                        </span>
                      )}
                    </div>
                    <p>
                      Kecepatan:{' '}
                      <span className="font-mono text-slate-200">
                        {selectedEntity.raw?.sogKnots != null ? `${selectedEntity.raw.sogKnots} kt` : '–'}
                      </span>
                      {' '}({selectedEntity.speedMs != null ? `${Math.round(selectedEntity.speedMs * 3.6)} km/h` : '–'})
                      {selectedEntity.raw?.cogRaw != null && Number(selectedEntity.raw.cogRaw) < 360 && (
                        <span> · COG: {Math.round(Number(selectedEntity.raw.cogRaw))}°</span>
                      )}
                      {selectedEntity.headingDeg != null && (
                        <span> · Haluan: {Math.round(selectedEntity.headingDeg)}°</span>
                      )}
                      {selectedEntity.raw?.headingRaw === 511 && (
                        <span className="text-[10px] text-slate-500"> (Haluan n/a)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>MMSI: {String(selectedEntity.raw?.mmsi)}</span>
                      {Boolean(selectedEntity.raw?.imo) && (
                        <span>· IMO: {String(selectedEntity.raw?.imo)}</span>
                      )}
                      {Boolean(selectedEntity.raw?.callsign) && (
                        <span>· Call: {String(selectedEntity.raw?.callsign)}</span>
                      )}
                    </div>
                    {(selectedEntity.raw?.destination != null || selectedEntity.raw?.draughtM != null || selectedEntity.raw?.lengthM != null) && (
                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
                        {Boolean(selectedEntity.raw?.destination) && (
                          <span>Tujuan: {String(selectedEntity.raw?.destination)}</span>
                        )}
                        {Boolean(selectedEntity.raw?.draughtM) && (
                          <span>Sarat: {Number(selectedEntity.raw?.draughtM).toFixed(1)} m</span>
                        )}
                        {Boolean(selectedEntity.raw?.lengthM) && (
                          <span>Dimensi: {String(selectedEntity.raw?.lengthM)}x{String(selectedEntity.raw?.widthM || '?')} m</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                      <span>
                        Keandalan:{' '}
                        {selectedEntity.raw?.positionReliable !== false ? (
                          <span className="text-teal-400">Akurat (GNSS)</span>
                        ) : (
                          <span className="text-amber-400">Terdegradasi</span>
                        )}
                      </span>
                      <span>
                        Posisi:{' '}
                        {selectedEntity.raw?.ageS != null ? (
                          Number(selectedEntity.raw.ageS) < 60
                            ? `${selectedEntity.raw.ageS}s lalu`
                            : Number(selectedEntity.raw.ageS) < 3600
                              ? `${Math.round(Number(selectedEntity.raw.ageS) / 60)}m lalu`
                              : `${Math.round(Number(selectedEntity.raw.ageS) / 3600)}j lalu`
                        ) : 'segar'}
                      </span>
                    </div>
                  </div>
                )}
                {selectedEntity.layer === 'storm' && (
                  <div className="space-y-1 mt-1 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">
                        {Math.round(Number(selectedEntity.raw?.windKmh ?? (selectedEntity.severity * 80 * 3.6)))} km/h
                        {' '}({Math.round(Number(selectedEntity.raw?.windKt ?? (selectedEntity.severity * 80 / 0.514444)))} kt)
                      </span>
                      {selectedEntity.raw?.pressureMb != null && (
                        <span>· {String(selectedEntity.raw.pressureMb)} mb</span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          selectedEntity.raw?.alertLevel === 'Red'
                            ? 'bg-red-950 text-red-300 border border-red-800/60'
                            : selectedEntity.raw?.alertLevel === 'Orange'
                              ? 'bg-orange-950 text-orange-300 border border-orange-800/60'
                              : 'bg-violet-950 text-violet-300 border border-violet-800/60'
                        }`}
                      >
                        Siaga {String(selectedEntity.raw?.alertLevel || 'Green')}
                      </span>
                    </div>
                    {selectedEntity.raw?.movementDir != null && (
                      <p>
                        Arah: {String(selectedEntity.raw.movementDir)}°
                        {selectedEntity.raw?.movementSpeedKt != null
                          ? ` · Kecepatan: ${Math.round(Number(selectedEntity.raw.movementSpeedKt))} kt`
                          : ''}
                      </p>
                    )}
                    {Array.isArray(selectedEntity.raw?.affectedCountries) &&
                      selectedEntity.raw.affectedCountries.length > 0 && (
                        <p className="text-slate-300">
                          Wilayah: {selectedEntity.raw.affectedCountries.join(', ')}
                        </p>
                      )}
                    {selectedEntity.raw?.advisoryNum != null && (
                      <p className="text-slate-400 text-[11px]">
                        Advisory #{String(selectedEntity.raw.advisoryNum)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedEntity.raw?.advisoryUrl != null && (
                        <a
                          href={String(selectedEntity.raw.advisoryUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-400 hover:text-sky-300 underline inline-flex items-center gap-0.5"
                        >
                          Advisory NHC ↗
                        </a>
                      )}
                      {selectedEntity.raw?.reportUrl != null && (
                        <a
                          href={String(selectedEntity.raw.reportUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-violet-400 hover:text-violet-300 underline inline-flex items-center gap-0.5"
                        >
                          Laporan GDACS ↗
                        </a>
                      )}
                    </div>
                  </div>
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
