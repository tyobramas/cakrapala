"use client";

/**
 * SpaceCodexContainer — 100% English Astronomical Encyclopedia & Aerospace Almanac HUD.
 * 
 * Features:
 *   - Real-time search across terms, definitions, formulas, and tags
 *   - Category filtering across 6 core astrophysics & planetary defense domains
 *   - A–Z quick alphabet scrubber bar & difficulty level filter
 *   - Featured "Astronomical Entry of the Day" spotlight
 *   - Deep-Dive Technical Inspector Modal with mathematical equations & real-world scales
 *   - Direct SYS-AI Terminal Bridge to query the AI assistant on any term with 1 click
 */

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Search,
  BookOpen,
  Atom,
  ShieldAlert,
  Compass,
  Orbit,
  Sparkles,
  Globe,
  X,
  Bot,
  Layers,
  ChevronRight,
  Zap,
  Tag,
  BookMarked,
  ArrowRight,
  Filter,
  Check,
  Copy,
} from "lucide-react";

import {
  CODEX_ENTRIES,
  CODEX_CATEGORIES,
  type CodexEntry,
  type CodexCategory,
} from "@/lib/astronomy/spaceCodexData";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

const CATEGORY_ICONS: Record<string, any> = {
  Atom,
  ShieldAlert,
  Compass,
  Orbit,
  Sparkles,
  Globe,
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function SpaceCodexContainer() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<CodexCategory | "all">("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedLetter, setSelectedLetter] = useState<string>("all");
  const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(null);

  // AI Terminal Modal Integration
  const [isAiTerminalOpen, setIsAiTerminalOpen] = useState<boolean>(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>("");

  const [copiedFormula, setCopiedFormula] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut: Press '/' to focus search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && activeEntry) {
        setActiveEntry(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeEntry]);

  // Filtered entries memo
  const filteredEntries = useMemo(() => {
    return CODEX_ENTRIES.filter((entry) => {
      // Category filter
      if (selectedCategory !== "all" && entry.category !== selectedCategory) {
        return false;
      }
      // Difficulty filter
      if (selectedDifficulty !== "all" && entry.difficulty !== selectedDifficulty) {
        return false;
      }
      // A-Z Alphabet filter
      if (selectedLetter !== "all") {
        if (!entry.term.toUpperCase().startsWith(selectedLetter)) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTerm = entry.term.toLowerCase().includes(q);
        const matchesShort = entry.shortDefinition.toLowerCase().includes(q);
        const matchesFull = entry.fullExplanation.toLowerCase().includes(q);
        const matchesTags = entry.tags.some((t) => t.toLowerCase().includes(q));
        const matchesExample = entry.realWorldExample.toLowerCase().includes(q);
        return matchesTerm || matchesShort || matchesFull || matchesTags || matchesExample;
      }
      return true;
    });
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedLetter]);

  // Featured Term of the Day (Deterministic daily rotation based on day of year)
  const featuredEntry = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return CODEX_ENTRIES[dayOfYear % CODEX_ENTRIES.length];
  }, []);

  const handleLaunchAiWithTerm = (term: CodexEntry) => {
    const prompt = `Provide a comprehensive technical briefing on "${term.term}" (${CODEX_CATEGORIES[term.category].name}). Detail its mathematical formulation, astronomical applications, and recent discoveries.`;
    setAiInitialPrompt(prompt);
    setIsAiTerminalOpen(true);
  };

  const handleCopyFormula = (latex: string) => {
    navigator.clipboard.writeText(latex);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* ── Top Ambient Cosmic Radial Glows ─────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-10 left-10 w-[450px] h-[450px] bg-purple-500/08 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        
        {/* ══════════════════════════════════════════════════════════════════════
            HEADER HUD: BRANDING & SEARCH COMMAND DECK
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-6 text-center max-w-4xl mx-auto mb-10">
          
          {/* Tactical Status Reticle */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] font-mono text-xs">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 font-bold tracking-widest uppercase text-[10px] sm:text-xs">
              CAKRAPALA // SPACE CODEX
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400 text-[10px] hidden sm:inline">IAU J2000 COMPLIANT</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight font-sans">
            The Universal{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
              Space Codex
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            The comprehensive interactive encyclopedia and astrophysical almanac. Explore certified definitions, mathematical formulations, orbital mechanics, and planetary defense protocols.
          </p>

          {/* ── Real-Time Interactive Search Command Bar ────────────────────────── */}
          <div className="relative max-w-2xl mx-auto mt-4">
            <div className="relative flex items-center rounded-2xl bg-[#070e22]/90 border border-cyan-500/40 shadow-[0_0_35px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-2xl focus-within:border-cyan-400 focus-within:shadow-[0_0_40px_rgba(6,182,212,0.4)] transition-all">
              <Search className="w-5 h-5 ml-4 text-cyan-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search astronomical terms, formulas, satellites, asteroids... (Press '/' to focus)"
                className="w-full px-4 py-3.5 bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mr-3 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="mr-4 hidden sm:flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-400 select-none">
                <kbd>/</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            FEATURED SPOTLIGHT: ASTRONOMICAL TERM OF THE DAY
        ══════════════════════════════════════════════════════════════════════ */}
        {featuredEntry && !searchQuery && selectedCategory === "all" && (
          <div className="mb-10 rounded-3xl bg-gradient-to-r from-[#0b162f]/90 via-[#0a1b38]/80 to-[#121132]/90 border border-cyan-500/40 p-6 sm:p-8 shadow-[0_16px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2.5 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    FEATURED CELESTIAL METRIC
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[10px]">
                    {CODEX_CATEGORIES[featuredEntry.category].name}
                  </span>
                  {featuredEntry.iauStandardNotation && (
                    <span className="font-mono text-[10px] text-slate-400">
                      IAU: {featuredEntry.iauStandardNotation}
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans group-hover:text-cyan-300 transition-colors">
                  {featuredEntry.term}
                </h2>

                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {featuredEntry.shortDefinition}
                </p>

                {featuredEntry.formula && (
                  <div className="inline-block p-2.5 rounded-xl bg-[#040817]/90 border border-cyan-500/30 font-mono text-xs text-cyan-300">
                    <code>{featuredEntry.formula.latex}</code>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveEntry(featuredEntry)}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <span>INSPECT CODEX ENTRY</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleLaunchAiWithTerm(featuredEntry)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ASK SYS-AI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            CATEGORY FILTER TABS WITH ENTRY COUNTERS
        ══════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              SCIENTIFIC DOMAINS
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Showing {filteredEntries.length} of {CODEX_ENTRIES.length} entries
            </span>
          </div>

          {/* Categories Horizontal Scroll / Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer font-mono text-xs flex flex-col justify-between ${
                selectedCategory === "all"
                  ? "bg-[#16233b] border-cyan-500/70 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-bold"
                  : "bg-[#060b18]/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700">
                  {CODEX_ENTRIES.length}
                </span>
              </div>
              <span className="truncate">ALL DOMAINS</span>
            </button>

            {Object.values(CODEX_CATEGORIES).map((cat) => {
              const Icon = CATEGORY_ICONS[cat.icon] || BookOpen;
              const count = CODEX_ENTRIES.filter((e) => e.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer font-mono text-xs flex flex-col justify-between ${
                    isSelected
                      ? "bg-[#16233b] border-cyan-500/70 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-bold"
                      : "bg-[#060b18]/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon className="w-4 h-4" style={{ color: cat.colorHex }} />
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700">
                      {count}
                    </span>
                  </div>
                  <span className="truncate">{cat.name.split(" ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── A–Z Alphabet Scrubber & Difficulty Selector ───────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl bg-[#050b1a]/90 border border-slate-800/80 mb-8 font-mono text-xs">
          
          {/* Alphabet Quick Scrubber */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedLetter("all")}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors shrink-0 ${
                selectedLetter === "all"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ALL
            </button>
            {ALPHABET.map((char) => {
              const hasEntries = CODEX_ENTRIES.some((e) => e.term.toUpperCase().startsWith(char));
              return (
                <button
                  key={char}
                  type="button"
                  disabled={!hasEntries}
                  onClick={() => setSelectedLetter(char)}
                  className={`px-1.5 py-1 rounded text-[10px] font-bold transition-colors shrink-0 ${
                    selectedLetter === char
                      ? "bg-cyan-500 text-slate-950"
                      : hasEntries
                      ? "text-slate-300 hover:text-cyan-300 hover:bg-slate-800"
                      : "text-slate-700 cursor-not-allowed"
                  }`}
                >
                  {char}
                </button>
              );
            })}
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500 text-[10px] hidden md:inline">LEVEL:</span>
            {["all", "Fundamental", "Intermediate", "Advanced"].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSelectedDifficulty(level)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                  selectedDifficulty === level
                    ? "bg-indigo-500/25 border border-indigo-500/50 text-indigo-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {level === "all" ? "ANY LEVEL" : level}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ENTRIES GRID: RESPONSIVE CARDS
        ══════════════════════════════════════════════════════════════════════ */}
        {filteredEntries.length === 0 ? (
          <div className="text-center py-20 rounded-3xl bg-[#060b18]/60 border border-slate-800/80 p-8">
            <BookMarked className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Codex Entries Found</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-4 font-sans">
              No astronomical terms matched your active filters for "{searchQuery}". Try clearing your search or switching domains.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedDifficulty("all");
                setSelectedLetter("all");
              }}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold hover:bg-cyan-500/30 transition-all cursor-pointer"
            >
              RESET ALL FILTERS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredEntries.map((entry) => {
              const cat = CODEX_CATEGORIES[entry.category];
              const Icon = CATEGORY_ICONS[cat.icon] || BookOpen;

              return (
                <div
                  key={entry.id}
                  onClick={() => setActiveEntry(entry)}
                  className="rounded-2xl bg-gradient-to-b from-[#0b1428]/90 to-[#060c1c]/95 border border-slate-800/90 hover:border-cyan-500/50 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.2)] backdrop-blur-xl transition-all duration-200 flex flex-col justify-between group cursor-pointer"
                >
                  <div className="space-y-3">
                    {/* Card Top Category & Difficulty Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold flex items-center gap-1.5"
                        style={{
                          backgroundColor: `${cat.colorHex}15`,
                          borderColor: `${cat.colorHex}40`,
                          color: cat.colorHex,
                        }}
                      >
                        <Icon className="w-3 h-3" />
                        {cat.name.split("&")[0].trim()}
                      </span>

                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          entry.difficulty === "Fundamental"
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                            : entry.difficulty === "Intermediate"
                            ? "text-amber-400 bg-amber-500/10 border border-amber-500/30"
                            : "text-purple-400 bg-purple-500/10 border border-purple-500/30"
                        }`}
                      >
                        {entry.difficulty}
                      </span>
                    </div>

                    {/* Term Title */}
                    <div>
                      <h3 className="text-lg font-bold text-white font-sans group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                        <span>{entry.term}</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      {entry.iauStandardNotation && (
                        <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                          IAU Notation: {entry.iauStandardNotation}
                        </span>
                      )}
                    </div>

                    {/* Short Definition */}
                    <p className="text-xs text-slate-300 font-sans leading-relaxed line-clamp-3">
                      {entry.shortDefinition}
                    </p>

                    {/* Formula Teaser (if present) */}
                    {entry.formula && (
                      <div className="p-2 rounded-lg bg-[#030612]/90 border border-slate-800 text-[11px] font-mono text-cyan-300 truncate">
                        <code>{entry.formula.latex}</code>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Meta & Tags */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                      <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{entry.tags.slice(0, 2).join(", ")}</span>
                    </div>
                    <span className="text-cyan-400 font-bold group-hover:underline shrink-0">
                      EXPLORE &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DEEP-DIVE INSPECTOR MODAL: COMPLETE SCIENTIFIC BREAKDOWN
      ══════════════════════════════════════════════════════════════════════ */}
      {activeEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveEntry(null);
          }}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#060c1d] border border-cyan-500/50 shadow-[0_0_60px_rgba(0,0,0,0.95),0_0_35px_rgba(6,182,212,0.25)] p-6 sm:p-8 font-sans animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button & Reticle */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5"
                  style={{
                    backgroundColor: `${CODEX_CATEGORIES[activeEntry.category].colorHex}15`,
                    borderColor: `${CODEX_CATEGORIES[activeEntry.category].colorHex}40`,
                    color: CODEX_CATEGORIES[activeEntry.category].colorHex,
                  }}
                >
                  {CODEX_CATEGORIES[activeEntry.category].name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {activeEntry.difficulty}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveEntry(null)}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-6 mt-5">
              
              {/* Header Title & Pronunciation */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans">
                  {activeEntry.term}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-mono text-slate-400">
                  {activeEntry.pronunciation && (
                    <span className="text-cyan-300">{activeEntry.pronunciation}</span>
                  )}
                  {activeEntry.iauStandardNotation && (
                    <span>&bull; IAU Notation: <strong className="text-white">{activeEntry.iauStandardNotation}</strong></span>
                  )}
                </div>
              </div>

              {/* Core Definition Box */}
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/40 text-cyan-100 text-sm sm:text-base leading-relaxed">
                {activeEntry.shortDefinition}
              </div>

              {/* Full Scientific Explanation */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  ASTROPHYSICAL EXPLANATION & MECHANICS
                </h3>
                <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {activeEntry.fullExplanation}
                </div>
              </div>

              {/* Mathematical Formula Section (if applicable) */}
              {activeEntry.formula && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      MATHEMATICAL FORMULATION
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopyFormula(activeEntry.formula!.latex)}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedFormula ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedFormula ? "COPIED" : "COPY LATEX"}</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#030614] border border-cyan-500/40 font-mono text-sm sm:text-base text-cyan-300 overflow-x-auto shadow-inner">
                    <code>{activeEntry.formula.latex}</code>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {activeEntry.formula.explanation}
                  </p>
                </div>
              )}

              {/* Real World Astronomical Example */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  OBSERVED CELESTIAL EXAMPLE & SCALE
                </h3>
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                  {activeEntry.realWorldExample}
                </div>
              </div>

              {/* Astronomical Relevance */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Compass className="w-4 h-4 text-purple-400" />
                  ASTROPHYSICAL RELEVANCE & MISSIONS
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {activeEntry.astronomicalRelevance}
                </p>
              </div>

              {/* Related Terms Link Chips */}
              {activeEntry.relatedTermIds.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">
                    RELATED CODEX TERMS:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeEntry.relatedTermIds.map((relId) => {
                      const relTerm = CODEX_ENTRIES.find((e) => e.id === relId);
                      if (!relTerm) return null;
                      return (
                        <button
                          key={relId}
                          type="button"
                          onClick={() => setActiveEntry(relTerm)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{relTerm.term}</span>
                          <ArrowRight className="w-3 h-3 text-cyan-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Bottom Actions: AI Terminal Query Trigger */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleLaunchAiWithTerm(activeEntry)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold font-mono text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-slate-950" />
                  <span>ASK SYS-AI IN ASTRO-TERMINAL</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEntry(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs transition-colors cursor-pointer text-center"
                >
                  CLOSE INSPECTOR (ESC)
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Integrated AI Terminal Modal Instance ────────────────────────────── */}
      <AstronomyTerminal
        isOpen={isAiTerminalOpen}
        onClose={() => setIsAiTerminalOpen(false)}
        initialPrompt={aiInitialPrompt}
      />
    </div>
  );
}
