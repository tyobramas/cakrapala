'use client';
// components/osint/StormControl.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Control panel popover for the Tropical Cyclone layer (NHC + GDACS).
//
// Settings:
//   - Toggle to include recent storms concluded within past 7 days (allPast)
//   - Transparency / Legend explanation for GDACS Alert Levels
//   - Mandatory coverage disclosure: NHC (Atlantic & East/Central Pacific) + GDACS (Global)
// ─────────────────────────────────────────────────────────────────────────────

export interface StormSettings {
  allPast: boolean;
}

export interface StormControlProps {
  settings: StormSettings;
  onChange: (settings: StormSettings) => void;
  isOpen: boolean;
  onClose: () => void;
  error?: string | null;
}

export default function StormControl({
  settings,
  onChange,
  isOpen,
  onClose,
  error,
}: StormControlProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Pengaturan Siklon Tropis"
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
          <span className="text-base" aria-hidden="true">🌀</span>
          <h2 className="text-sm font-semibold text-slate-100">
            Siklon Tropis (NHC + GDACS)
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

      {error && (
        <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2">
          <span className="text-sm shrink-0">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Toggles */}
      <div className="mt-4 space-y-4 text-xs">
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-slate-300 font-medium">Sertakan badai lampau</span>
            <input
              type="checkbox"
              checked={settings.allPast}
              onChange={(e) =>
                onChange({ ...settings, allPast: e.target.checked })
              }
              className="accent-violet-500 rounded w-4 h-4 cursor-pointer"
            />
          </label>
          <p className="text-[11px] text-slate-400 mt-1">
            Menampilkan badai yang telah reda dalam 7 hari terakhir untuk konteks OSINT pascabencana.
          </p>
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-slate-800/80">
          <p className="text-slate-400 font-medium mb-2 uppercase text-[10px] tracking-wider">
            Tingkat Siaga GDACS
          </p>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              <span className="text-slate-300">Merah: Bahaya tinggi / dampak parah</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
              <span className="text-slate-300">Oranye: Dampak signifikan terhadap populasi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
              <span className="text-slate-300">Hijau / Standar: Siklon / Depresi aktif</span>
            </div>
          </div>
        </div>

        {/* Coverage Note (Mandatory Step 7) */}
        <div className="pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-4 -mb-4 p-4 rounded-b-2xl text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <span>ℹ️</span>
            <span>Cakupan Sumber Data</span>
          </div>
          <p className="leading-relaxed">
            Data telemetri presisi tinggi berasal dari <strong>NOAA NHC</strong> (khusus Atlantik & Pasifik Timur). Cakupan global (Pasifik Barat, Samudra Hindia) disediakan oleh <strong>GDACS</strong> (JRC Komisi Eropa).
          </p>
        </div>
      </div>
    </div>
  );
}
