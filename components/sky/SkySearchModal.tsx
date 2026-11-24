"use client";

import { useEffect, useRef } from "react";
import {
  Search,
  X,
  Sparkles,
  Orbit,
  Compass,
  Radio,
  Star,
} from "lucide-react";

export interface SkySearchItem {
  id: string;
  name: string;
  category: "planet" | "constellation" | "nebula" | "star" | "satellite";
  categoryLabel: string;
  subtitle: string;
  azimuthDeg: number;
  altitudeDeg: number;
  raDeg?: number;
  decDeg?: number;
  mag?: number;
  colorHex?: string;
  isAboveHorizon: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (val: string) => void;
  category: "all" | "constellation" | "planet" | "star" | "nebula" | "satellite";
  onCategoryChange: (
    cat: "all" | "constellation" | "planet" | "star" | "nebula" | "satellite",
  ) => void;
  results: SkySearchItem[];
  onSelect: (item: SkySearchItem) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "constellation", label: "Constellations" },
  { id: "planet", label: "Planets" },
  { id: "star", label: "Stars" },
  { id: "nebula", label: "Deep Sky" },
  { id: "satellite", label: "Satellites" },
] as const;

function CategoryIcon({ cat }: { cat: SkySearchItem["category"] }) {
  switch (cat) {
    case "planet":
      return <Orbit className="h-3.5 w-3.5 text-amber-300" />;
    case "constellation":
      return <Compass className="h-3.5 w-3.5 text-sky-300" />;
    case "nebula":
      return <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />;
    case "satellite":
      return <Radio className="h-3.5 w-3.5 text-emerald-300" />;
    default:
      return <Star className="h-3.5 w-3.5 text-blue-200" />;
  }
}

export default function SkySearchModal({
  isOpen,
  onClose,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  results,
  onSelect,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-20 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/[0.12] bg-[#040916]/94 shadow-[0_32px_90px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-2xl"
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
          <Search className="h-4 w-4 shrink-0 text-sky-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search Orion, Scorpius, Crux, Sirius, Jupiter, Andromeda, ISS..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="cursor-pointer rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] px-5 py-2.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryChange(c.id)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                category === c.id
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[52vh] overflow-y-auto divide-y divide-white/[0.05]">
          {results.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-slate-500">
              No celestial objects matched &ldquo;{query}&rdquo;.
            </div>
          ) : (
            results.slice(0, 40).map((item) => (
              <button
                key={`${item.category}-${item.id}`}
                type="button"
                onClick={() => onSelect(item)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                    <CategoryIcon cat={item.category} />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium text-white">
                      {item.name}
                    </span>
                    <span className="block truncate text-[10.5px] text-slate-400">
                      {item.subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-0.5 font-mono text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      item.isAboveHorizon ? "text-emerald-300" : "text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.isAboveHorizon ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                    />
                    Alt {item.altitudeDeg >= 0 ? "+" : ""}
                    {item.altitudeDeg.toFixed(1)}°
                  </span>
                  <span className="text-slate-500">
                    Az {Math.round(item.azimuthDeg)}°
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
