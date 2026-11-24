'use client';

/**
 * GEOSINT — Cakrapala Global Earth Intelligence & Situational Awareness.
 *
 * Curated exclusively around 100% live, global, sustainable open data layers
 * driven dynamically from `LAYER_REGISTRY`:
 *   - Satellite Imagery (NASA GIBS daily 250m + Bing Maps Aerial ~1m auto-switch)
 *   - Global Earthquakes (USGS real-time GeoJSON)
 *   - Active Wildfires (NASA FIRMS 375m VIIRS NRT)
 *   - Tropical Cyclones (NOAA NHC + GDACS Global)
 *   - Live Air Traffic (adsb.lol ODbL + 60fps dead-reckoning)
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  Flame,
  CloudLightning,
  Plane,
  Satellite,
  ArrowLeft,
  SlidersHorizontal,
  X,
  ExternalLink,
  Search,
  Globe2,
} from 'lucide-react';
import type { BBox, LayerId, OsintEntity } from '@/lib/osint/types';
import { LAYER_REGISTRY, resolveDisplayMode } from '@/lib/osint/registry';
import { useLayer } from '@/lib/osint/useLayer';
import type { OsintGlobeHandle } from '@/components/osint/OsintGlobe';
import { OSINT_Z_INDEX } from '@/lib/osint/constants/zIndex';
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
import { DebugOverlay } from '@/components/osint/DebugOverlay';

const OsintGlobe = dynamic(() => import('@/components/osint/OsintGlobe'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#01030a]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border border-white/15 border-t-white/80" />
        <span className="font-mono text-[10px] tracking-[0.34em] text-slate-400 uppercase">
          Initializing Earth Intelligence Globe
        </span>
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

type ControlPanelId = 'imagery' | 'fire' | 'storm' | 'air';

const LAYER_ICONS: Partial<
  Record<LayerId, React.ComponentType<{ className?: string }>>
> = {
  imagery: Satellite,
  quake: Activity,
  fire: Flame,
  storm: CloudLightning,
  air: Plane,
};

const CONFIGURABLE_LAYERS = new Set<LayerId>([
  'imagery',
  'fire',
  'storm',
  'air',
]);

const LAYER_ORDER: LayerId[] = ['imagery', 'quake', 'storm', 'fire', 'air'];

const QUICK_VIEWS = [
  { id: 'global', label: 'Global', lat: -2.0, lon: 112.0, altM: 18_500_000 },
  { id: 'indonesia', label: 'Indonesia', lat: -6.21, lon: 106.85, altM: 260_000 },
  { id: 'japan', label: 'Japan', lat: 35.68, lon: 139.69, altM: 280_000 },
  { id: 'europe', label: 'Europe', lat: 48.85, lon: 8.5, altM: 300_000 },
] as const;

/**
 * Clamps a viewport BBox around its center so upstream regional APIs
 * (adsb.lol max 250 nm, NASA FIRMS max 60°x60°) always query cleanly
 * around what the user is viewing without failing silently on wide monitors.
 */
function clampBBoxToCenter(
  bbox: BBox | undefined,
  maxHalfLatDeg: number,
  maxHalfLonDeg: number,
): BBox | undefined {
  if (!bbox) return undefined;
  const [w, s, e, n] = bbox;
  const cLat = Math.max(-85, Math.min(85, (s + n) / 2));
  const cLon = w <= e ? (w + e) / 2 : (((w + e + 360) / 2 + 180) % 360) - 180;
  const halfLat = Math.min(Math.max(Math.abs(n - s) / 2, 0.25), maxHalfLatDeg);
  const cosLat = Math.max(0.25, Math.cos((cLat * Math.PI) / 180));
  const effMaxHalfLon = maxHalfLonDeg / cosLat;
  const rawHalfLon = w <= e ? (e - w) / 2 : (e + 360 - w) / 2;
  const halfLon = Math.min(Math.max(rawHalfLon, 0.25), effMaxHalfLon);
  return [
    Math.max(-180, Number((cLon - halfLon).toFixed(4))),
    Math.max(-89, Number((cLat - halfLat).toFixed(4))),
    Math.min(180, Number((cLon + halfLon).toFixed(4))),
    Math.min(89, Number((cLat + halfLat).toFixed(4))),
  ];
}

function formatAltitude(altM: number): string {
  if (altM >= 1_000_000) return `${(altM / 1_000_000).toFixed(1)}M m`;
  if (altM >= 10_000) return `${Math.round(altM / 1000).toLocaleString()} km`;
  if (altM >= 1_000) return `${(altM / 1000).toFixed(1)} km`;
  return `${Math.round(altM)} m`;
}

export default function OsintPage() {
  const globeRef = useRef<OsintGlobeHandle>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewer, setViewer] = useState<any>(null);
  const [cameraAltM, setCameraAltM] = useState(2e7);
  const displayMode = resolveDisplayMode(cameraAltM);
  const [bbox, setBBox] = useState<BBox | undefined>(undefined);
  const [timeUtc, setTimeUtc] = useState('');

  // Curated enabled layers dynamically read from LAYER_REGISTRY
  const enabledLayerIds = useMemo(
    () => LAYER_ORDER.filter((id) => LAYER_REGISTRY[id]?.enabled),
    [],
  );

  // Start cleanly with global overview layers (no immediate zoom-gate errors on load)
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(
    () => new Set(['imagery', 'quake', 'storm']),
  );
  const [openPanel, setOpenPanel] = useState<ControlPanelId | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<OsintEntity | null>(null);
  const [activeImagerySource, setActiveImagerySource] = useState<string>('');

  useEffect(() => {
    const tick = () =>
      setTimeUtc(new Date().toUTCString().slice(17, 25) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPanel(null);
        setSelectedEntity(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Satellite Imagery settings
  const defaultBase = useMemo(() => getDefaultBaseLayer(), []);
  const [imagerySettings, setImagerySettings] = useState<ImagerySettings>({
    baseLayerId: defaultBase.id,
    dateStr: getMaxDateForLayer(defaultBase),
    hiResMode: 'auto',
    overlays: {
      Coastlines_15m: { enabled: true, opacity: 0.75 },
      Reference_Labels_15m: { enabled: false, opacity: 0.8 },
    },
  });
  const [tileErrorNotice, setTileErrorNotice] = useState<{
    layerId: string;
    message: string;
    fallbackDate: string;
  } | null>(null);

  // Wildfire settings
  const [fireSettings, setFireSettings] = useState<FireSettings>({
    dayRange: 1,
    includeLowConfidence: false,
    nightOnly: false,
    source: 'auto',
  });

  // Storm settings
  const [stormSettings, setStormSettings] = useState<StormSettings>({
    allPast: false,
  });

  // Air traffic settings
  const [airSettings, setAirSettings] = useState<AirFilterSettings>({
    hideOnGround: true,
    militaryOnly: false,
    showTrails: true,
    maxAltFt: undefined,
  });

  // ── Live Data Layer Hooks ────────────────────────────────────────────────

  const quakeEnabled = activeLayers.has('quake');
  const quake = useLayer('quake', bbox, cameraAltM, quakeEnabled);

  const fireEnabled = activeLayers.has('fire');
  const fireZoomAllowed = cameraAltM <= 3_000_000 && Boolean(bbox);
  const fireBBox = useMemo(
    () => clampBBoxToCenter(bbox, 22, 22),
    [bbox],
  );
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
    fireBBox,
    cameraAltM,
    firePollingEnabled,
    fireExtraParams,
  );

  const stormEnabled = activeLayers.has('storm');
  const stormExtraParams = useMemo(
    () => ({ allPast: stormSettings.allPast ? '1' : undefined }),
    [stormSettings],
  );
  const storm = useLayer(
    'storm',
    undefined,
    cameraAltM,
    stormEnabled,
    stormExtraParams,
  );

  const airEnabled = activeLayers.has('air');
  const airZoomAllowed = cameraAltM <= 3_000_000 && Boolean(bbox);
  // Clamp air query to ~2.4° half-span (~200 nm half-diagonal <= adsb.lol 250 nm limit)
  const airBBox = useMemo(
    () => clampBBoxToCenter(bbox, 2.3, 2.3),
    [bbox],
  );
  const airPollingEnabled = airEnabled && airZoomAllowed;
  const air = useLayer('air', airBBox, cameraAltM, airPollingEnabled);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCameraAltChange = useCallback((alt: number) => {
    setCameraAltM(alt);
  }, []);

  const handleBBoxChange = useCallback((newBBox: BBox) => {
    setBBox(newBBox);
  }, []);

  const toggleLayer = useCallback(
    (layerId: LayerId) => {
      const config = LAYER_REGISTRY[layerId];
      if (!config?.enabled) return;

      const wasActive = activeLayers.has(layerId);
      setActiveLayers((prev) => {
        const next = new Set(prev);
        if (next.has(layerId)) {
          next.delete(layerId);
          setOpenPanel((cur) => (cur === layerId ? null : cur));
        } else {
          next.add(layerId);
        }
        return next;
      });

      // If user turns ON a regional live layer (Aircraft or Wildfires) while zoomed out > 3,000 km,
      // smoothly fly closer so live data appears immediately instead of showing an empty screen.
      if (!wasActive && (layerId === 'air' || layerId === 'fire') && cameraAltM > 3_000_000) {
        const targetLat = bbox ? (bbox[1] + bbox[3]) / 2 : -6.21;
        const targetLon = bbox ? (bbox[0] + bbox[2]) / 2 : 106.85;
        const safeLat = Math.abs(targetLat) > 70 ? -6.21 : targetLat;
        const safeLon = Math.abs(targetLat) > 70 ? 106.85 : targetLon;
        globeRef.current?.flyTo(safeLat, safeLon, layerId === 'air' ? 260_000 : 900_000);
      }
    },
    [activeLayers, cameraAltM, bbox],
  );

  const toggleSettingsPanel = useCallback((panelId: ControlPanelId) => {
    setActiveLayers((prev) => {
      if (prev.has(panelId)) return prev;
      const next = new Set(prev);
      next.add(panelId);
      return next;
    });
    setOpenPanel((cur) => (cur === panelId ? null : panelId));
  }, []);

  const handleApplyFallbackDate = useCallback((fallbackDate: string) => {
    setImagerySettings((prev) => ({ ...prev, dateStr: fallbackDate }));
    setTileErrorNotice(null);
  }, []);

  const handleFlyToAircraft = useCallback((entity: OsintEntity) => {
    setSelectedEntity(entity);
    globeRef.current?.flyTo(entity.position.lat, entity.position.lon, 35_000);
  }, []);

  const activeBaseDef: GibsLayer =
    GIBS_LAYERS.find((l) => l.id === imagerySettings.baseLayerId) ?? defaultBase;

  const activeAttributions = useMemo(() => {
    const list: string[] = [];
    if (activeLayers.has('quake')) list.push(LAYER_REGISTRY.quake.attribution);
    if (activeLayers.has('fire')) list.push(LAYER_REGISTRY.fire.attribution);
    if (activeLayers.has('storm')) list.push(LAYER_REGISTRY.storm.attribution);
    if (activeLayers.has('air')) list.push(LAYER_REGISTRY.air.attribution);
    if (activeLayers.has('imagery')) {
      list.push(
        activeImagerySource.includes('Bing')
          ? 'Bing Maps / Microsoft'
          : activeBaseDef.attribution,
      );
      if (imagerySettings.overlays['Coastlines_15m']?.enabled) {
        list.push('Coastlines: OSM / NASA GIBS');
      }
    }
    return Array.from(new Set(list.filter(Boolean)));
  }, [
    activeLayers,
    activeBaseDef.attribution,
    activeImagerySource,
    imagerySettings.overlays,
  ]);

  // Pending zoom hints (only for active layers that need closer altitude)
  const zoomPendingLabels = useMemo(() => {
    const items: string[] = [];
    if (fireEnabled && !fireZoomAllowed) items.push('Wildfires');
    if (airEnabled && !airZoomAllowed) items.push('Aircraft');
    return items;
  }, [fireEnabled, fireZoomAllowed, airEnabled, airZoomAllowed]);

  // Per-layer live status summary for the left rail
  const getLayerMeta = (layerId: LayerId): string => {
    if (!activeLayers.has(layerId)) return 'Off';
    switch (layerId) {
      case 'imagery':
        return activeImagerySource.includes('Bing')
          ? '~1m Aerial'
          : `${activeBaseDef.resolution}`;
      case 'quake':
        return quake.status === 'loading'
          ? 'Syncing'
          : `${quake.entities.length}`;
      case 'storm':
        return storm.status === 'loading'
          ? 'Syncing'
          : `${storm.entities.length}`;
      case 'fire':
        if (fire.error === 'MISSING_KEY') return 'No Key';
        if (!fireZoomAllowed) return 'Zoom in';
        return fire.status === 'loading' ? 'Syncing' : `${fire.entities.length}`;
      case 'air':
        if (!airZoomAllowed) return 'Zoom in';
        return air.status === 'loading' ? 'Syncing' : `${air.entities.length}`;
      default:
        return 'On';
    }
  };

  const debugLayers = useMemo(
    () => [
      { id: 'quake' as LayerId, enabled: quakeEnabled, active: quakeEnabled, displayMode, fetchedCount: quake.entities.length },
      { id: 'fire' as LayerId, enabled: fireEnabled, active: fireEnabled, displayMode, fetchedCount: fire.entities.length },
      { id: 'storm' as LayerId, enabled: stormEnabled, active: stormEnabled, displayMode, fetchedCount: storm.entities.length },
      { id: 'air' as LayerId, enabled: airEnabled, active: airEnabled, displayMode, fetchedCount: air.entities.length },
      { id: 'imagery' as LayerId, enabled: activeLayers.has('imagery'), active: activeLayers.has('imagery'), displayMode, fetchedCount: activeLayers.has('imagery') ? 1 : 0 },
    ],
    [
      activeLayers,
      quakeEnabled,
      quake.entities.length,
      fireEnabled,
      fire.entities.length,
      stormEnabled,
      storm.entities.length,
      airEnabled,
      air.entities.length,
      displayMode,
    ],
  );

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-[#01030a] font-sans text-slate-100 select-none">
      {/* ── Full-Viewport 3D Cesium Globe ─────────────────────────────────── */}
      <div className="absolute inset-0" style={{ zIndex: OSINT_Z_INDEX.globe }}>
        <OsintGlobe
          ref={globeRef}
          onCameraAltChange={handleCameraAltChange}
          onBBoxChange={handleBBoxChange}
          imageryEnabled={activeLayers.has('imagery')}
          activeBaseLayerId={imagerySettings.baseLayerId}
          imageryDate={imagerySettings.dateStr}
          overlaySettings={imagerySettings.overlays}
          hiResMode={imagerySettings.hiResMode}
          onActiveSourceChange={setActiveImagerySource}
          onTileError={setTileErrorNotice}
          onViewerReady={setViewer}
          onViewerDestroy={() => setViewer(null)}
          movingLayersActive={airEnabled && airZoomAllowed}
        />
      </div>

      {/* ── Active Cesium Entity Layers ───────────────────────────────────── */}
      {viewer && quakeEnabled && (
        <QuakeLayer
          viewer={viewer}
          entities={quake.entities}
          cameraAltM={cameraAltM}
          onSelect={setSelectedEntity}
        />
      )}

      {viewer && fireEnabled && (fireZoomAllowed || fire.entities.length > 0) && (
        <FireLayer
          viewer={viewer}
          entities={fire.entities}
          cameraAltM={cameraAltM}
          dayRange={fireSettings.dayRange}
          onSelect={setSelectedEntity}
        />
      )}

      {viewer && stormEnabled && (
        <StormLayer
          viewer={viewer}
          entities={storm.entities}
          cameraAltM={cameraAltM}
          selectedEntity={selectedEntity}
          onSelect={setSelectedEntity}
        />
      )}

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

      {/* ── 1. Minimalist Luxury Top Header Bar ───────────────────────────── */}
      <header
        className="pointer-events-none fixed inset-x-0 top-0 px-4 pt-3.5 sm:px-6 lg:px-8"
        style={{ zIndex: OSINT_Z_INDEX.topBar }}
      >
        <div className="pointer-events-auto mx-auto flex max-w-[1560px] items-center justify-between gap-3">
          {/* Left: Back to Home + Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 rounded-full border border-white/[0.11] bg-[#030714]/58 px-3.5 py-2 text-[11px] font-medium tracking-[0.12em] text-slate-200 uppercase backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Observatory</span>
            </Link>

            <div className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#030714]/50 py-1.5 pr-4 pl-2 backdrop-blur-xl">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] p-1">
                <Image
                  src="/cakrapala.png"
                  alt="Cakrapala"
                  width={24}
                  height={24}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-[family-name:var(--font-orbitron)] text-[11px] font-medium tracking-[0.22em] text-white/95 sm:text-xs">
                GEOINT
              </span>
            </div>
          </div>

          {/* Center: Quiet Telemetry & Active Basemap Pill */}
          <button
            type="button"
            onClick={() => toggleSettingsPanel('imagery')}
            className="hidden cursor-pointer items-center gap-2.5 rounded-full border border-white/[0.09] bg-[#030714]/55 px-4 py-1.5 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.08] md:flex"
            title="Configure Satellite Imagery"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-white/90 uppercase">
              {activeLayers.has('imagery')
                ? activeImagerySource || `${activeBaseDef.label.split(' ')[0]} ${activeBaseDef.resolution}`
                : 'Natural Earth Base'}
            </span>
            <span className="text-white/20">·</span>
            <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
              Alt {formatAltitude(cameraAltM)}
            </span>
          </button>

          {/* Right: Live UTC + Sources Link */}
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-[#030714]/50 px-3.5 py-2 font-mono text-[10px] tracking-[0.14em] text-slate-300 backdrop-blur-xl sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90" />
              <span className="text-white/90">{timeUtc || '00:00:00 UTC'}</span>
            </div>

            <Link
              href="/osint/sumber"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.10] bg-[#030714]/55 px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-slate-300 uppercase backdrop-blur-xl transition-colors hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
            >
              <span>Sources</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2A. Desktop Left Curated Layer Rail (md+) ─────────────────────── */}
      <aside
        aria-label="Earth Intelligence Layers"
        className="pointer-events-auto fixed top-20 left-5 hidden w-52 flex-col gap-3 md:flex"
        style={{ zIndex: OSINT_Z_INDEX.layerRail }}
      >
        <div className="rounded-2xl border border-white/[0.11] bg-[#020612]/74 p-2.5 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          <div className="mb-1.5 flex items-center justify-between px-2.5 pt-0.5 pb-1">
            <span className="font-mono text-[9px] font-medium tracking-[0.24em] text-slate-400 uppercase">
              Live Layers
            </span>
            <span className="font-mono text-[9px] text-slate-500">
              {activeLayers.size}/{enabledLayerIds.length}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {enabledLayerIds.map((layerId) => {
              const config = LAYER_REGISTRY[layerId];
              const isActive = activeLayers.has(layerId);
              const Icon = LAYER_ICONS[layerId] ?? Globe2;
              const isConfigurable = CONFIGURABLE_LAYERS.has(layerId);
              const meta = getLayerMeta(layerId);

              return (
                <div
                  key={layerId}
                  className={`flex items-center justify-between rounded-xl px-2 py-1.5 transition-all ${
                    isActive
                      ? 'bg-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                      : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleLayer(layerId)}
                    aria-pressed={isActive}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors"
                      style={{
                        borderColor: isActive
                          ? `${config.color}55`
                          : 'rgba(255,255,255,0.08)',
                        backgroundColor: isActive
                          ? `${config.color}1c`
                          : 'rgba(255,255,255,0.03)',
                        color: isActive ? config.color : undefined,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium tracking-[0.03em]">
                        {config.nameEn}
                      </span>
                      <span className="block font-mono text-[9px] text-slate-400">
                        {meta}
                      </span>
                    </div>
                  </button>

                  {isConfigurable && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleSettingsPanel(layerId as ControlPanelId)
                      }
                      aria-label={`${config.nameEn} settings`}
                      title={`${config.nameEn} settings`}
                      className={`ml-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                        openPanel === layerId
                          ? 'bg-white/15 text-white'
                          : 'text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Regional Focus Presets (lets users zoom into live ADS-B / FIRMS effortlessly) */}
        <div className="rounded-2xl border border-white/[0.10] bg-[#020612]/70 p-2.5 backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.55)]">
          <span className="mb-1.5 block px-2 font-mono text-[9px] font-medium tracking-[0.24em] text-slate-400 uppercase">
            Quick Focus
          </span>
          <div className="grid grid-cols-2 gap-1">
            {QUICK_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => globeRef.current?.flyTo(v.lat, v.lon, v.altM)}
                className="cursor-pointer rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 font-mono text-[9.5px] text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.09] hover:text-white"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ── 2B. Mobile Horizontal Layer Strip (< md) ──────────────────────── */}
      <div
        className="pointer-events-none fixed inset-x-0 top-16 flex px-3 md:hidden"
        style={{ zIndex: OSINT_Z_INDEX.layerRail }}
      >
        <div className="pointer-events-auto flex w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/[0.09] bg-[#030714]/65 p-1.5 backdrop-blur-xl">
          {enabledLayerIds.map((layerId) => {
            const config = LAYER_REGISTRY[layerId];
            const isActive = activeLayers.has(layerId);
            const Icon = LAYER_ICONS[layerId] ?? Globe2;
            return (
              <button
                key={layerId}
                type="button"
                onClick={() => toggleLayer(layerId)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium tracking-wider uppercase transition-all ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{config.nameEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Bottom-Center Zoom Hint (Only when zoomed out > 3,000 km with Air/Fire active) ── */}
      {zoomPendingLabels.length > 0 && !selectedEntity && (
        <div
          className="pointer-events-auto fixed bottom-12 left-1/2 -translate-x-1/2"
          style={{ zIndex: OSINT_Z_INDEX.topBar }}
        >
          <div className="flex items-center gap-2.5 rounded-full border border-amber-400/35 bg-[#020612]/82 py-1.5 pr-2 pl-4 font-mono text-[10.5px] text-amber-100 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.65)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="whitespace-nowrap">
              Zoom closer for {zoomPendingLabels.join(' & ')}
            </span>
            <button
              type="button"
              onClick={() => globeRef.current?.flyTo(-6.21, 106.85, 260_000)}
              className="cursor-pointer rounded-full border border-amber-300/35 bg-amber-400/20 px-2.5 py-0.5 text-[9.5px] font-semibold tracking-wider text-amber-100 uppercase transition-colors hover:bg-amber-400/35"
            >
              Zoom In
            </button>
          </div>
        </div>
      )}

      {/* ── 4. Single-Active Settings Popovers (Never Overlap) ────────────── */}
      <ImageryControl
        isOpen={openPanel === 'imagery' && activeLayers.has('imagery')}
        onClose={() => setOpenPanel(null)}
        settings={imagerySettings}
        onChange={setImagerySettings}
        tileErrorNotice={tileErrorNotice}
        onDismissError={() => setTileErrorNotice(null)}
        onApplyFallbackDate={handleApplyFallbackDate}
      />

      <FireControl
        isOpen={openPanel === 'fire' && activeLayers.has('fire')}
        onClose={() => setOpenPanel(null)}
        settings={fireSettings}
        onChange={setFireSettings}
        error={fire.error}
      />

      <StormControl
        isOpen={openPanel === 'storm' && activeLayers.has('storm')}
        onClose={() => setOpenPanel(null)}
        settings={stormSettings}
        onChange={setStormSettings}
        error={storm.error}
      />

      <AirControl
        isOpen={openPanel === 'air' && activeLayers.has('air')}
        onClose={() => setOpenPanel(null)}
        settings={airSettings}
        onChange={setAirSettings}
        entities={air.entities}
        onFlyTo={handleFlyToAircraft}
      />

      {/* ── 5. Selected Entity Inspector Card ─────────────────────────────── */}
      {selectedEntity && (
        <div
          className="pointer-events-auto fixed bottom-12 left-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2"
          style={{ zIndex: OSINT_Z_INDEX.topBar }}
        >
          <div className="rounded-2xl border border-white/[0.12] bg-[#030714]/82 p-4 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[9px] tracking-[0.22em] text-slate-400 uppercase">
                  {LAYER_REGISTRY[selectedEntity.layer]?.nameEn ?? selectedEntity.layer}
                </span>
                <h3 className="mt-0.5 truncate text-sm font-semibold text-white">
                  {selectedEntity.label}
                </h3>

                {selectedEntity.layer === 'quake' && (
                  <p className="mt-1.5 font-mono text-[11px] text-slate-300">
                    Magnitude{' '}
                    <strong className="text-fuchsia-300">
                      {selectedEntity.raw?.mag != null
                        ? String(selectedEntity.raw.mag)
                        : '–'}
                    </strong>{' '}
                    · Depth{' '}
                    <strong className="text-white">
                      {Math.abs(selectedEntity.position.altM / 1000).toFixed(1)} km
                    </strong>
                  </p>
                )}

                {selectedEntity.layer === 'fire' && (
                  <p className="mt-1.5 font-mono text-[11px] text-slate-300">
                    Radiative Power{' '}
                    <strong className="text-amber-300">
                      {selectedEntity.raw?.frp != null
                        ? `${selectedEntity.raw.frp} MW`
                        : '–'}
                    </strong>{' '}
                    · Confidence{' '}
                    <strong className="text-white">
                      {String(selectedEntity.raw?.confidence || 'nominal').toUpperCase()}
                    </strong>
                  </p>
                )}

                {selectedEntity.layer === 'air' && (
                  <div className="mt-1.5 space-y-1 font-mono text-[11px] text-slate-300">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sky-300">
                        {Boolean(selectedEntity.raw?.onGround)
                          ? 'On Ground'
                          : `${Math.round(selectedEntity.position.altM * 3.28084).toLocaleString()} ft`}
                      </span>
                      {Boolean(selectedEntity.raw?.acType) && (
                        <span className="text-slate-400">
                          · {String(selectedEntity.raw?.acType)}
                        </span>
                      )}
                      {Boolean(selectedEntity.raw?.isMilitary) && (
                        <span className="rounded-full border border-amber-400/35 bg-amber-400/15 px-2 py-0.5 text-[9px] text-amber-200 uppercase">
                          Military
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400">
                      Speed{' '}
                      <span className="text-white">
                        {Math.round(
                          Number(
                            selectedEntity.raw?.speedKt ??
                              (selectedEntity.speedMs ?? 0) * 1.94384,
                          ),
                        )}{' '}
                        kt
                      </span>
                      {selectedEntity.headingDeg != null && (
                        <span> · Heading {Math.round(selectedEntity.headingDeg)}°</span>
                      )}
                    </p>
                  </div>
                )}

                {selectedEntity.layer === 'storm' && (
                  <div className="mt-1.5 space-y-1 text-xs text-slate-300">
                    <p className="font-mono text-[11px]">
                      Winds{' '}
                      <strong className="text-violet-300">
                        {Math.round(
                          Number(
                            selectedEntity.raw?.windKmh ??
                              selectedEntity.severity * 80 * 3.6,
                          ),
                        )}{' '}
                        km/h
                      </strong>
                      {selectedEntity.raw?.pressureMb != null && (
                        <span> · {String(selectedEntity.raw.pressureMb)} mb</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-0.5 font-mono text-[10px]">
                      {selectedEntity.raw?.advisoryUrl != null && (
                        <a
                          href={String(selectedEntity.raw.advisoryUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 hover:text-white"
                        >
                          NHC Advisory ↗
                        </a>
                      )}
                      {selectedEntity.raw?.reportUrl != null && (
                        <a
                          href={String(selectedEntity.raw.reportUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-300 hover:text-white"
                        >
                          GDACS Report ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <p className="mt-2 font-mono text-[10px] text-slate-500">
                  {selectedEntity.position.lat.toFixed(3)}°,{' '}
                  {selectedEntity.position.lon.toFixed(3)}° ·{' '}
                  {new Date(selectedEntity.observedAt).toUTCString().slice(5, 22)} UTC
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEntity(null)}
                aria-label="Close entity inspector"
                className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/12 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Quiet Minimal Attribution Footer ───────────────────────────── */}
      {activeAttributions.length > 0 && (
        <div
          className="pointer-events-auto fixed right-4 bottom-3 max-w-lg"
          style={{ zIndex: OSINT_Z_INDEX.attribution }}
        >
          <div className="rounded-full border border-white/[0.07] bg-[#020510]/55 px-3.5 py-1 font-mono text-[9.5px] text-slate-400 backdrop-blur-md">
            {activeAttributions.join(' · ')}
          </div>
        </div>
      )}

      {/* ── Development Debug HUD (?debug=1) ──────────────────────────────── */}
      <DebugOverlay
        viewer={viewer}
        cameraAltM={cameraAltM}
        layers={debugLayers}
      />
    </div>
  );
}
