"use client";

/**
 * NavbarArc — Refined Luxury Aerospace Navigation Bar for the Landing Viewport.
 *
 * Replaces the busy tactical laser-rail / mission-control HUD with a balanced,
 * minimalist glassmorphic top bar that frames the 3D Earth & Milky Way cleanly
 * across desktop, tablet, and mobile viewports.
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Menu, X, Sparkles, ArrowUpRight } from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

interface NavItem {
  id: string;
  label: string;
  href: string;
  desc: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "solar",
    label: "Solar System",
    href: "/solar-system",
    desc: "3D Keplerian planetary orrery",
  },
  {
    id: "osint",
    label: "GeoINT",
    href: "/osint",
    desc: "Global Earth intelligence layers",
  },
  {
    id: "sky",
    label: "Sky Map",
    href: "/sky",
    desc: "IAU constellations & celestial sphere",
  },
  {
    id: "asteroids",
    label: "Asteroids",
    href: "/explore",
    desc: "Near-Earth object defense radar",
  },
  {
    id: "satellites",
    label: "Satellites",
    href: "/iss",
    desc: "Real-time SGP4 orbital tracker",
  },
  {
    id: "codex",
    label: "Codex",
    href: "/codex",
    desc: "Astrophysics reference archive",
  },
];

export default function NavbarArc() {
  const pathname = usePathname();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-0 z-50 select-none">
      {/* Delicate top gradient scrim for contrast without hiding the Milky Way */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#01030a]/85 via-[#01030a]/35 to-transparent" />

      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-10 lg:py-5">
        {/* ── Brand Mark ─────────────────────────────────────────────── */}
        <Link
          href="/"
          className="group flex items-center gap-3 transition-opacity hover:opacity-95"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] p-1.5 backdrop-blur-md transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/[0.08]">
            <Image
              src="/cakrapala.png"
              alt="Cakrapala"
              width={32}
              height={32}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <span className="font-[family-name:var(--font-orbitron)] text-[13px] font-medium tracking-[0.28em] text-white/95 sm:text-sm">
            CAKRAPALA
          </span>
        </Link>

        {/* ── Center Navigation Pill (Desktop) ───────────────────────── */}
        <nav
          aria-label="Primary Observatory Navigation"
          className="hidden items-center gap-0.5 rounded-full border border-white/[0.09] bg-[#040814]/55 p-1 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] lg:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`rounded-full px-4 py-1.5 text-[11px] font-medium tracking-[0.12em] uppercase transition-all duration-200 ${
                  active
                    ? "bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                    : "text-slate-300/75 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Right Actions ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAiOpen(true)}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-[11px] font-medium tracking-[0.12em] text-white/90 uppercase backdrop-blur-xl transition-all duration-300 hover:border-white/30 hover:bg-white/[0.11] hover:shadow-[0_0_24px_rgba(148,197,255,0.18)]"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-300/90 transition-transform duration-300 group-hover:scale-110" />
            <span className="hidden sm:inline">AI Co-Pilot</span>
            <span className="sm:hidden">AI</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-slate-200 backdrop-blur-xl transition-colors hover:bg-white/[0.1] lg:hidden"
          >
            {isMobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Refined Mobile Navigation Drawer ─────────────────────────── */}
      {isMobileOpen && (
        <div className="mx-4 mt-1 rounded-2xl border border-white/10 bg-[#040814]/92 p-3 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] lg:hidden">
          <div className="grid grid-cols-1 gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <div>
                    <div className="text-xs font-medium tracking-[0.14em] uppercase">
                      {item.label}
                    </div>
                    <p className="mt-0.5 text-[11px] font-light text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <AstronomyTerminal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
    </header>
  );
}
