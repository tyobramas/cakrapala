'use client';

import React, { useEffect, useState } from 'react';
import type { LayerId } from '@/lib/osint/types';
import type { DisplayMode } from '@/lib/osint/registry';
import { getViewerConstructionCount } from './OsintGlobe';

export interface LayerDebugInfo {
  id: LayerId;
  enabled: boolean;
  active: boolean;
  displayMode: DisplayMode;
  fetchedCount: number;
}

export interface DebugOverlayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  cameraAltM: number;
  layers: LayerDebugInfo[];
}

export function DebugOverlay({ viewer, cameraAltM, layers }: DebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsVisible(params.get('debug') === '1');
    }
  }, []);

  // Poll live Cesium counts every 500ms
  useEffect(() => {
    if (!isVisible) return;
    if (viewer && typeof window !== 'undefined') {
      (window as any).__cesiumViewer = viewer;
    }
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 500);
    return () => clearInterval(interval);
  }, [isVisible, viewer]);

  if (!isVisible) return null;

  const isViewerReady = Boolean(viewer && !viewer.isDestroyed?.());
  const entities = isViewerReady && viewer.entities?.values ? viewer.entities.values : [];
  
  // Calculate rendered counts per layer
  let quakeRendered = 0;
  let fireRendered = 0;
  let stormRendered = 0;
  let airRendered = 0;

  for (const e of entities) {
    const id = String(e.id || '');
    if (id.startsWith('quake:')) quakeRendered++;
    else if (id.startsWith('fire:')) fireRendered++;
    else if (id.startsWith('storm:')) stormRendered++;
    else if (id.startsWith('air:')) airRendered++;
  }

  const seaDs = isViewerReady ? viewer.dataSources?.getByName?.('osint-sea-layer')?.[0] : null;
  const seaRendered = (seaDs?.entities?.values?.length ?? 0) + entities.filter((e: any) => String(e.id || '').startsWith('sea:')).length;

  const eyesDs = isViewerReady ? viewer.dataSources?.getByName?.('osint:eyes')?.[0] : null;
  const eyesRendered = (eyesDs?.entities?.values?.length ?? 0) + entities.filter((e: any) => String(e.id || '').startsWith('eyes:')).length;

  // Non-base imagery layers count (e.g. VIIRS + overlays)
  const imageryLayersCount = isViewerReady ? (viewer.imageryLayers?.length ?? 0) : 0;
  const imageryRendered = Math.max(0, imageryLayersCount - 1);

  const renderedMap: Record<LayerId, number> = {
    quake: quakeRendered,
    fire: fireRendered,
    storm: stormRendered,
    air: airRendered,
    sea: seaRendered,
    eyes: eyesRendered,
    imagery: imageryRendered,
  };

  const primitivesCount = isViewerReady && viewer.scene?.primitives ? viewer.scene.primitives.length : 0;
  const constructionCount = getViewerConstructionCount();

  return (
    <div
      data-testid="osint-debug-overlay"
      className="fixed bottom-12 left-4 z-[9999] max-w-sm rounded-xl border border-emerald-500/50 bg-slate-950/90 p-3 font-mono text-xs text-emerald-400 shadow-2xl backdrop-blur-md pointer-events-auto select-text"
    >
      <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5 font-bold tracking-wider text-emerald-300">
        <span>OSINT ENGINE DEBUG (?debug=1)</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${isViewerReady ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
          {isViewerReady ? 'VIEWER READY' : 'NO VIEWER'}
        </span>
      </div>

      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
        <div className="flex justify-between">
          <span className="text-slate-400">Camera Alt:</span>
          <span>{Math.round(cameraAltM).toLocaleString()} m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Total Entities:</span>
          <span>{entities.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Primitives:</span>
          <span>{primitivesCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Imagery Layers:</span>
          <span>{imageryLayersCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Viewer Destroyed:</span>
          <span>{String(Boolean(viewer?.isDestroyed?.()))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Viewer Constructions:</span>
          <span className="text-amber-300 font-semibold">{constructionCount}</span>
        </div>
      </div>

      <div className="mt-2 border-t border-slate-800 pt-1.5">
        <div className="grid grid-cols-5 text-[10px] text-slate-400 font-semibold pb-1">
          <span>LAYER</span>
          <span>ACT</span>
          <span>MODE</span>
          <span className="text-right">FETCH</span>
          <span className="text-right">REND</span>
        </div>
        <div className="space-y-1">
          {layers.map((l) => (
            <div key={l.id} className="grid grid-cols-5 text-[11px] items-center">
              <span className="font-semibold text-slate-200 capitalize">{l.id}</span>
              <span>
                <span className={`inline-block w-2 h-2 rounded-full ${l.active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </span>
              <span className="text-[10px] text-slate-400">{l.displayMode.slice(0, 4)}</span>
              <span className="text-right text-slate-300">{l.fetchedCount}</span>
              <span className={`text-right font-bold ${renderedMap[l.id] > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {renderedMap[l.id]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
