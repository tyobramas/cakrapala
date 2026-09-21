'use client';
// components/osint/FireControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Control panel popover for the NASA FIRMS Active Fire layer.
// Settings:
//   - Day range (1, 2, 3) with quota consumption note
//   - Confidence threshold toggle (include low confidence)
//   - Night-only filter toggle (daynight === 'N')
//   - Upstream satellite sensor selection (Auto / NOAA-20 / SNPP / MODIS)
// ─────────────────────────────────────────────────────────────────────────────

import { FIRMS_SOURCES } from '@/lib/osint/layers/fire';

export interface FireSettings {
  dayRange: number;
  includeLowConfidence: boolean;
  nightOnly: boolean;
  source: string; // 'auto' | 'VIIRS_NOAA20_NRT' | 'VIIRS_SNPP_NRT' | 'MODIS_NRT'
}

export interface FireControlProps {
  settings: FireSettings;
  onChange: (settings: FireSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  error?: string | null;
}

export default function FireControl({
  settings,
  onChange,
  isOpen,
  onClose,
  error,
}: FireControlProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Pengaturan Deteksi Kebakaran FIRMS"
      className="
        absolute z-20 top-16 left-20 max-md:left-4 max-md:top-24 max-md:right-4
        w-80 max-w-[calc(100vw-2rem)]
        bg-slate-900/95 backdrop-blur-md border border-slate-700/60
        rounded-2xl p-4 shadow-2xl text-slate-200
        animate-in fade-in duration-150
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">🔥</span>
          <h2 className="text-sm font-semibold text-slate-100">
            Deteksi Kebakaran (NASA FIRMS)
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 rounded-lg p-1 hover:bg-slate-800 transition-colors"
          aria-label="Tutup panel kebakaran"
        >
          ✕
        </button>
      </div>

      {/* Error notice if MISSING_KEY or AREA_TOO_LARGE */}
      {error === 'MISSING_KEY' && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200">
          <p className="font-semibold">⚠️ Kunci Akses Diperlukan</p>
          <p className="text-[11px] text-amber-300/80 mt-1">
            Layer ini memerlukan konfigurasi MAP_KEY NASA FIRMS pada berkas environment server. Dapatkan kunci gratis di situs resmi NASA FIRMS.
          </p>
        </div>
      )}

      {error === 'AREA_TOO_LARGE' && (
        <div className="mt-3 p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200">
          <p className="font-semibold">🔍 Area Terlalu Luas</p>
          <p className="text-[11px] text-indigo-300/80 mt-1">
            Zoom lebih dekat ke wilayah yang ingin dipantau (maksimal 60° × 60°) untuk menghemat kuota dan memuat titik api aktif.
          </p>
        </div>
      )}

      <div className="mt-3 space-y-4 text-xs">
        {/* Day Range Selection */}
        <div>
          <label className="block font-medium text-slate-400 mb-1.5">
            Rentang Hari Observasi
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map((days) => {
              const isSelected = settings.dayRange === days;
              return (
                <button
                  key={days}
                  onClick={() => onChange({ ...settings, dayRange: days })}
                  className={`
                    py-2 rounded-xl font-medium border text-center transition-all
                    ${
                      isSelected
                        ? 'border-amber-500/60 bg-amber-950/40 text-amber-200 shadow-sm'
                        : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                    }
                  `}
                >
                  {days} Hari {days === 1 && '(Default)'}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Catatan: Rentang multi-hari mengonsumsi lebih banyak transaksi kuota upstream NASA.
          </p>
        </div>

        {/* Toggles */}
        <div className="pt-2 border-t border-slate-800 space-y-2.5">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="font-medium text-slate-300">
              Tampilkan Confidence Rendah
            </span>
            <input
              type="checkbox"
              checked={settings.includeLowConfidence}
              onChange={(e) =>
                onChange({
                  ...settings,
                  includeLowConfidence: e.target.checked,
                })
              }
              className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-medium text-slate-300">
                Hanya Deteksi Malam
              </span>
              <p className="text-[10px] text-slate-500">
                Mengurangi false positive akibat pantulan sinar matahari
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.nightOnly}
              onChange={(e) =>
                onChange({ ...settings, nightOnly: e.target.checked })
              }
              className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
            />
          </label>
        </div>

        {/* Satellite Source Selection */}
        <div className="pt-2 border-t border-slate-800">
          <label htmlFor="fire-source-select" className="block font-medium text-slate-400 mb-1.5">
            Sumber Satelit Sensor
          </label>
          <select
            id="fire-source-select"
            value={settings.source}
            onChange={(e) =>
              onChange({ ...settings, source: e.target.value })
            }
            className="
              w-full bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-2
              text-slate-200 text-xs focus:outline-none focus:border-amber-500
            "
          >
            <option value="auto">Auto (VIIRS NOAA-20 + Fallback)</option>
            <option value={FIRMS_SOURCES[0]}>VIIRS NOAA-20 NRT (375m)</option>
            <option value={FIRMS_SOURCES[1]}>VIIRS Suomi NPP NRT (375m)</option>
            <option value={FIRMS_SOURCES[2]}>MODIS Terra/Aqua NRT (1km)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
