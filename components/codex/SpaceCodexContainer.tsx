"use client";

/**
 * SpaceCodexContainer — Luxury Compact Split-Pane Astronomy, NASA & Astrophysics Encyclopedia (/codex).
 *
 * Features:
 *   - 110+ IAU & NASA-verified space, orbital, cosmological, and planetary defense terms
 *   - Unified corner-pinned compact header ([ ← | logo SPACE CODEX ]) + instant Spotlight Search ('/' or ⌘K)
 *   - 7 scientific domains, A–Z scrubber, Difficulty filter, Bookmarks (localStorage), and Random Discovery
 *   - Split-pane master-detail reading observatory on desktop + clean full-screen sheet on mobile
 *   - Clickable cross-referenced hypertext graph, formula copy, and 1-click Cakrapala AI Terminal bridge
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Search,
  Rocket,
  Atom,
  ShieldAlert,
  Compass,
  Orbit,
  Sparkles,
  Globe,
  X,
  Bot,
  Check,
  Copy,
  Bookmark,
  Shuffle,
  ArrowUpRight,
  Sigma,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  CODEX_ENTRIES,
  CODEX_CATEGORIES,
  type CodexEntry,
  type CodexCategory,
} from "@/lib/astronomy/spaceCodexData";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rocket,
  Atom,
  ShieldAlert,
  Compass,
  Orbit,
  Sparkles,
  Globe,
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const BOOKMARKS_KEY = "cakrapala_codex_bookmarks_v1";

/**
 * Converts clean LaTeX math strings into crisp readable Unicode aerospace notation
 * while preserving the raw LaTeX for 1-click copy.
 */
function formatReadableFormula(latex: string): string {
  return latex
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1) / ($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\pm/g, "±")
    .replace(/\\le/g, "≤")
    .replace(/\\ge/g, "≥")
    .replace(/\\implies/g, "⇒")
    .replace(/\\quad/g, "  ")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\Lambda/g, "Λ")
    .replace(/\\Omega/g, "Ω")
    .replace(/\\pi/g, "π")
    .replace(/\\mu/g, "μ")
    .replace(/\\nu/g, "ν")
    .replace(/\\alpha/g, "α")
    .replace(/\\rho/g, "ρ")
    .replace(/\\hbar/g, "ℏ")
    .replace(/\\dot\{m\}/g, "ṁ")
    .replace(/\^\{([^}]*)\}/g, "^$1")
    .replace(/_\{([^}]*)\}/g, "_$1")
    .replace(/\\/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SpaceCodexContainer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CodexCategory | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    "all" | "Fundamental" | "Intermediate" | "Advanced"
  >("all");
  const [selectedLetter, setSelectedLetter] = useState<string>("all");
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Active reading term (always populated on desktop; mobile opens sheet explicitly)
  const [selectedId, setSelectedId] = useState<string>(CODEX_ENTRIES[0]?.id ?? "");
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // AI Terminal Bridge
  const [isAiTerminalOpen, setIsAiTerminalOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState("");
  const [copiedFormula, setCopiedFormula] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved bookmarks cleanly
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          queueMicrotask(() => setBookmarks(parsed.filter((x) => typeof x === "string")));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Fast ID lookup map for cross-referenced related terms
  const entryMap = useMemo(() => {
    const m = new Map<string, CodexEntry>();
    for (const e of CODEX_ENTRIES) m.set(e.id, e);
    return m;
  }, []);

  // Category counts & available letters
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: CODEX_ENTRIES.length };
    for (const e of CODEX_ENTRIES) {
      counts[e.category] = (counts[e.category] || 0) + 1;
    }
    return counts;
  }, []);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const e of CODEX_ENTRIES) {
      const ch = e.term.trim()[0]?.toUpperCase();
      if (ch) set.add(ch);
    }
    return set;
  }, []);

  // Deterministic Term of the Day
  const featuredEntry = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
    return CODEX_ENTRIES[dayOfYear % CODEX_ENTRIES.length];
  }, []);

  // Filtered & alphabetically sorted entries
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CODEX_ENTRIES.filter((entry) => {
      if (bookmarksOnly && !bookmarks.includes(entry.id)) return false;
      if (selectedCategory !== "all" && entry.category !== selectedCategory) return false;
      if (selectedDifficulty !== "all" && entry.difficulty !== selectedDifficulty) return false;
      if (selectedLetter !== "all" && !entry.term.toUpperCase().startsWith(selectedLetter)) {
        return false;
      }
      if (q) {
        return (
          entry.term.toLowerCase().includes(q) ||
          entry.shortDefinition.toLowerCase().includes(q) ||
          entry.fullExplanation.toLowerCase().includes(q) ||
          entry.realWorldExample.toLowerCase().includes(q) ||
          (entry.iauStandardNotation?.toLowerCase().includes(q) ?? false) ||
          entry.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => a.term.localeCompare(b.term));
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedLetter, bookmarksOnly, bookmarks]);

  const activeEntry = useMemo(() => {
    return (
      entryMap.get(selectedId) ??
      filteredEntries[0] ??
      CODEX_ENTRIES[0]
    );
  }, [entryMap, selectedId, filteredEntries]);

  const handleSelectEntry = useCallback((entry: CodexEntry, openMobile = true) => {
    setSelectedId(entry.id);
    setCopiedFormula(false);
    if (openMobile) setMobileSheetOpen(true);
  }, []);

  const handleRandomEntry = useCallback(() => {
    const pool = filteredEntries.length > 0 ? filteredEntries : CODEX_ENTRIES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) handleSelectEntry(pick, true);
  }, [filteredEntries, handleSelectEntry]);

  // Keyboard shortcuts: '/' or ⌘K search, ↑/↓ cycle entries, Esc clear/close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === "Escape") {
        if (mobileSheetOpen) {
          setMobileSheetOpen(false);
        } else if (searchQuery) {
          setSearchQuery("");
        }
        return;
      }
      if (!isInput && (e.key === "ArrowDown" || e.key === "ArrowUp") && filteredEntries.length > 0) {
        e.preventDefault();
        const idx = filteredEntries.findIndex((x) => x.id === activeEntry?.id);
        const nextIdx =
          e.key === "ArrowDown"
            ? (idx + 1) % filteredEntries.length
            : (idx - 1 + filteredEntries.length) % filteredEntries.length;
        setSelectedId(filteredEntries[nextIdx].id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredEntries, activeEntry, mobileSheetOpen, searchQuery]);

  const handleLaunchAi = useCallback((entry: CodexEntry) => {
    const catName = CODEX_CATEGORIES[entry.category].name;
    setAiInitialPrompt(
      `Provide a concise, rigorous astrophysics briefing on "${entry.term}" (${catName}). Include its mathematical formulation, NASA/observational applications, and recent discoveries.`,
    );
    setIsAiTerminalOpen(true);
  }, []);

  const handleCopyFormula = useCallback((latex: string) => {
    navigator.clipboard?.writeText(latex);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 1800);
  }, []);

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedDifficulty("all");
    setSelectedLetter("all");
    setBookmarksOnly(false);
  };

  const hasFilters =
    searchQuery.trim() !== "" ||
    selectedCategory !== "all" ||
    selectedDifficulty !== "all" ||
    selectedLetter !== "all" ||
    bookmarksOnly;

  const renderDetailContent = (entry: CodexEntry) => {
    const cat = CODEX_CATEGORIES[entry.category];
    const CatIcon = CATEGORY_ICONS[cat.icon] || Atom;
    const isBookmarked = bookmarks.includes(entry.id);
    const related = entry.relatedTermIds
      .map((id) => entryMap.get(id))
      .filter((x): x is CodexEntry => Boolean(x));

    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Top Dossier Header */}
        <div className="border-b border-white/[0.08] px-5 pt-5 pb-4 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium"
                style={{
                  borderColor: `${cat.colorHex}40`,
                  background: `${cat.colorHex}14`,
                  color: cat.colorHex,
                }}
              >
                <CatIcon className="h-3 w-3" />
                <span>{cat.name}</span>
              </span>

              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-medium ${
                  entry.difficulty === "Fundamental"
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                    : entry.difficulty === "Intermediate"
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                      : "border-rose-400/25 bg-rose-400/10 text-rose-300"
                }`}
              >
                {entry.difficulty}
              </span>

              {entry.iauStandardNotation && (
                <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                  {entry.iauStandardNotation}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleBookmark(entry.id)}
                title={isBookmarked ? "Remove bookmark" : "Bookmark term"}
                className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] transition-all ${
                  isBookmarked
                    ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                    : "border-white/[0.10] bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white"
                }`}
              >
                <Bookmark className={`h-3 w-3 ${isBookmarked ? "fill-amber-300" : ""}`} />
                <span className="hidden sm:inline">{isBookmarked ? "Saved" : "Save"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleLaunchAi(entry)}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-400/15 px-3 font-mono text-[10px] font-medium text-sky-200 transition-all hover:bg-sky-400/25 hover:text-white"
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Ask AI</span>
              </button>

              {mobileSheetOpen && (
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05] text-slate-300 lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <h1 className="mt-3 font-sans text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {entry.term}
          </h1>

          {entry.pronunciation && (
            <p className="mt-1 font-mono text-xs text-slate-400">{entry.pronunciation}</p>
          )}

          <p className="mt-3 text-sm leading-relaxed text-slate-200 sm:text-[15px]">
            {entry.shortDefinition}
          </p>
        </div>

        {/* Scrollable Editorial Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          {/* Mathematical Formula Card */}
          {entry.formula && (
            <div className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[9.5px] tracking-[0.16em] text-slate-400 uppercase">
                <span className="flex items-center gap-1.5 text-sky-300">
                  <Sigma className="h-3.5 w-3.5" />
                  Mathematical Formulation
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyFormula(entry.formula!.latex)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[9.5px] text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
                >
                  {copiedFormula ? (
                    <>
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                      <span>Copied LaTeX</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-2.5 w-2.5" />
                      <span>Copy LaTeX</span>
                    </>
                  )}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg bg-black/45 px-4 py-3 font-mono text-sm font-medium text-sky-100">
                {formatReadableFormula(entry.formula.latex)}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {entry.formula.explanation}
              </p>
            </div>
          )}

          {/* Full Scientific Context */}
          <section className="space-y-2">
            <h2 className="font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
              Technical Overview
            </h2>
            <p className="text-sm leading-7 text-slate-300">{entry.fullExplanation}</p>
          </section>

          {/* Two-Column NASA Example & Relevance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="mb-1.5 font-mono text-[9.5px] font-semibold tracking-[0.16em] text-sky-300 uppercase">
                Real-World &amp; NASA Example
              </div>
              <p className="text-xs leading-6 text-slate-300">{entry.realWorldExample}</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="mb-1.5 font-mono text-[9.5px] font-semibold tracking-[0.16em] text-emerald-300 uppercase">
                Astronomical Relevance
              </div>
              <p className="text-xs leading-6 text-slate-300">{entry.astronomicalRelevance}</p>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {entry.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearchQuery(tag);
                  setMobileSheetOpen(false);
                }}
                className="cursor-pointer rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-sky-400/40 hover:text-sky-200"
              >
                #{tag}
              </button>
            ))}
          </div>

          {/* Cross-Referenced Related Terms */}
          {related.length > 0 && (
            <section className="border-t border-white/[0.08] pt-4">
              <div className="mb-2.5 font-mono text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">
                Related Codex Entries
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {related.map((rel) => {
                  const rCat = CODEX_CATEGORIES[rel.category];
                  return (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => handleSelectEntry(rel, true)}
                      className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-left transition-all hover:border-white/[0.20] hover:bg-white/[0.06]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: rCat.colorHex }}
                          />
                          <span className="truncate font-mono text-[11px] font-semibold text-white group-hover:text-sky-200">
                            {rel.term}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10.5px] text-slate-400">
                          {rel.shortDefinition}
                        </p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#02040a] font-sans text-slate-100 select-none">
      {/* Whisper-subtle atmospheric top radial light */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 38% at 50% 0%, rgba(56,189,248,0.06) 0%, rgba(15,23,42,0.16) 45%, rgba(2,4,10,0) 80%)",
        }}
      />

      {/* ── 1. Compact Corner-Pinned Top Command Bar ──────────────────────── */}
      <header className="relative z-30 shrink-0 border-b border-white/[0.07] bg-[#02040a]/85 px-2 py-2 backdrop-blur-2xl sm:px-3">
        <div className="flex w-full items-center justify-between gap-2">
          {/* Top-Left Corner Capsule (matches /solar-system, /sky, /asteroids, /satellites) */}
          <div className="flex h-8 shrink-0 items-center rounded-full border border-white/[0.10] bg-[#030714]/75 p-0.5 pr-3">
            <Link
              href="/"
              aria-label="Back to Home"
              title="Back to Home"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.10] hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            </Link>

            <span className="mx-1 h-3.5 w-px bg-white/[0.12]" />

            <div className="flex items-center gap-1.5 pl-1">
              <Image
                src="/cakrapala1.png"
                alt="Cakrapala"
                width={18}
                height={18}
                className="h-[18px] w-[18px] rounded-full object-contain opacity-95"
              />
              <span className="font-[family-name:var(--font-orbitron)] text-[10px] font-medium tracking-[0.18em] text-white/95">
                SPACE CODEX
              </span>
            </div>
          </div>

          {/* Center: Compact Spotlight Search */}
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${CODEX_ENTRIES.length} NASA, astronomy, orbit & physics terms...`}
              className="h-8 w-full rounded-full border border-white/[0.10] bg-white/[0.04] pr-14 pl-8 font-mono text-[11px] text-white placeholder:text-slate-500 transition-colors focus:border-sky-400/50 focus:bg-white/[0.06] focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-slate-400 sm:inline">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Right: Random, Saved Bookmarks, AI Terminal */}
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleRandomEntry}
              title="Discover random astronomy term"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.10] bg-[#030714]/75 text-slate-300 transition-colors hover:border-white/25 hover:text-white"
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setBookmarksOnly((v) => !v)}
              title="Filter saved bookmarks"
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] transition-all ${
                bookmarksOnly
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : "border-white/[0.10] bg-[#030714]/75 text-slate-300 hover:border-white/25 hover:text-white"
              }`}
            >
              <Bookmark className={`h-3 w-3 ${bookmarksOnly ? "fill-amber-300" : ""}`} />
              <span className="hidden sm:inline tabular-nums">{bookmarks.length}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiInitialPrompt("");
                setIsAiTerminalOpen(true);
              }}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/12 px-3 font-mono text-[10px] font-medium text-sky-200 transition-colors hover:bg-sky-400/22 hover:text-white"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden md:inline">AI Brief</span>
            </button>
          </div>
        </div>

        {/* ── 2. Compact Category & A–Z Filter Ribbon ─────────────────────── */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {/* Categories */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
                selectedCategory === "all"
                  ? "border-white/25 bg-white/[0.13] font-semibold text-white"
                  : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.16] hover:text-slate-200"
              }`}
            >
              <span>All</span>
              <span className="text-[9px] text-slate-400 tabular-nums">
                {categoryCounts.all}
              </span>
            </button>

            {(Object.keys(CODEX_CATEGORIES) as CodexCategory[]).map((catKey) => {
              const cat = CODEX_CATEGORIES[catKey];
              const active = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all ${
                    active
                      ? "border-white/25 bg-white/[0.12] font-semibold text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.16] hover:text-slate-200"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: cat.colorHex }}
                  />
                  <span>{cat.name}</span>
                  <span className="text-[9px] opacity-65 tabular-nums">
                    {categoryCounts[catKey] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Difficulty Segmented Control */}
          <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5 font-mono text-[9.5px] xl:flex">
            {(["all", "Fundamental", "Intermediate", "Advanced"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedDifficulty(lvl)}
                className={`cursor-pointer rounded-full px-2 py-0.5 transition-colors ${
                  selectedDifficulty === lvl
                    ? "bg-white/[0.14] font-semibold text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl === "all" ? "All Levels" : lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Ultra-Slim A–Z Scrubber Strip */}
        <div className="mt-1.5 flex items-center gap-0.5 overflow-x-auto font-mono text-[9.5px]">
          <button
            type="button"
            onClick={() => setSelectedLetter("all")}
            className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors ${
              selectedLetter === "all"
                ? "bg-sky-400/20 font-semibold text-sky-200"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            A–Z
          </button>
          {ALPHABET.map((letter) => {
            const hasAny = availableLetters.has(letter);
            const active = selectedLetter === letter;
            return (
              <button
                key={letter}
                type="button"
                disabled={!hasAny}
                onClick={() => setSelectedLetter(active ? "all" : letter)}
                className={`w-5 shrink-0 cursor-pointer rounded py-0.5 text-center transition-colors disabled:cursor-default disabled:opacity-25 ${
                  active
                    ? "bg-sky-400/25 font-bold text-white"
                    : "text-slate-400 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                {letter}
              </button>
            );
          })}

          {hasFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-auto shrink-0 cursor-pointer rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9px] text-slate-300 hover:bg-white/[0.12] hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {/* ── 3. Split-Pane Master-Detail Observatory Workspace ─────────────── */}
      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {/* Left Master Index Column */}
        <aside className="flex h-full w-full flex-col border-r border-white/[0.07] bg-[#02050d]/85 lg:w-[400px] xl:w-[440px]">
          {/* Daily Term Spotlight Banner (when no filters active) */}
          {!hasFilters && featuredEntry && (
            <button
              type="button"
              onClick={() => handleSelectEntry(featuredEntry, true)}
              className="group m-2.5 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-sky-400/25 bg-gradient-to-r from-sky-500/[0.10] via-indigo-500/[0.06] to-transparent px-3.5 py-2.5 text-left transition-all hover:border-sky-400/45"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.16em] text-sky-300 uppercase">
                  <Sparkles className="h-3 w-3" />
                  <span>Term of the Day</span>
                </div>
                <div className="mt-0.5 truncate font-mono text-xs font-semibold text-white">
                  {featuredEntry.term}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-sky-300 transition-transform group-hover:translate-x-0.5" />
            </button>
          )}

          {/* Result Count Strip */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-1.5 font-mono text-[9.5px] text-slate-500">
            <span>
              {filteredEntries.length} of {CODEX_ENTRIES.length} entries
            </span>
            <span className="hidden sm:inline">↑/↓ Navigate · / Search</span>
          </div>

          {/* Scrollable Term Index */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center font-mono">
                <BookOpen className="mb-2.5 h-6 w-6 text-slate-600" />
                <p className="text-xs text-slate-300">No matching astronomy terms</p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-3 cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1 text-[10px] text-sky-200 hover:bg-white/[0.12]"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const cat = CODEX_CATEGORIES[entry.category];
                const isSelected = activeEntry?.id === entry.id;
                const isSaved = bookmarks.includes(entry.id);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelectEntry(entry, true)}
                    className={`group relative flex w-full cursor-pointer flex-col gap-1 px-3.5 py-3 text-left transition-colors ${
                      isSelected ? "bg-sky-400/[0.10]" : "hover:bg-white/[0.035]"
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 bottom-2 left-0 w-[2.5px] rounded-r-full bg-sky-300" />
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: cat.colorHex }}
                        />
                        <span
                          className={`truncate font-mono text-[12px] font-semibold ${
                            isSelected ? "text-white" : "text-slate-100 group-hover:text-white"
                          }`}
                        >
                          {entry.term}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {entry.formula && (
                          <span
                            title="Includes mathematical equation"
                            className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[8.5px] text-sky-300"
                          >
                            fx
                          </span>
                        )}
                        {isSaved && (
                          <Bookmark className="h-3 w-3 fill-amber-300 text-amber-300" />
                        )}
                      </div>
                    </div>

                    <p className="line-clamp-2 pl-3.5 text-[11.5px] leading-relaxed text-slate-400">
                      {entry.shortDefinition}
                    </p>

                    <div className="mt-0.5 flex items-center gap-2 pl-3.5 font-mono text-[9px] text-slate-500">
                      <span>{cat.name}</span>
                      <span>·</span>
                      <span>{entry.difficulty}</span>
                      {entry.iauStandardNotation && (
                        <>
                          <span>·</span>
                          <span className="truncate text-slate-400">
                            {entry.iauStandardNotation}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Full Editorial Technical Dossier (Desktop Permanent Pane) */}
        <main className="hidden h-full flex-1 overflow-hidden bg-[#030714]/65 lg:block">
          {activeEntry && renderDetailContent(activeEntry)}
        </main>
      </div>

      {/* Mobile Full-Screen Reading Sheet */}
      {mobileSheetOpen && activeEntry && (
        <div className="fixed inset-0 z-50 bg-[#02050e] lg:hidden">
          {renderDetailContent(activeEntry)}
        </div>
      )}

      {/* Cakrapala AI Terminal Bridge */}
      <AstronomyTerminal
        isOpen={isAiTerminalOpen}
        onClose={() => setIsAiTerminalOpen(false)}
        initialPrompt={aiInitialPrompt}
      />
    </div>
  );
}
