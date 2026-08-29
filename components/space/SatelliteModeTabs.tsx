import Link from "next/link";
import { Crosshair, Globe2, Sparkles, Activity } from "lucide-react";

interface SatelliteModeTabsProps {
    active: "focus" | "catalog";
}

const tabs = [
    {
        id: "focus" as const,
        href: "/iss",
        label: "FOCUS TRACKER",
        tagline: "Single-Object Telemetry & Fly-Around",
        badge: "6 FLAGSHIP CRAFT",
        icon: Crosshair,
    },
    {
        id: "catalog" as const,
        href: "/iss/catalog",
        label: "ORBITAL CATALOG",
        tagline: "1,000+ Multi-Object Earth Constellations",
        badge: "SGP4 PROPAGATOR",
        icon: Globe2,
    },
];

export default function SatelliteModeTabs({
    active,
}: SatelliteModeTabsProps) {
    return (
        <nav
            aria-label="Satellite operation mode"
            className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-slate-900/90 via-[#050e1f]/80 to-[#020617]/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {tabs.map((tab) => {
                    const isActive = active === tab.id;
                    const Icon = tab.icon;

                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            aria-current={isActive ? "page" : undefined}
                            className={[
                                "group relative flex min-h-[72px] items-center justify-between gap-4 overflow-hidden rounded-xl px-4 py-3.5 transition-all duration-300",
                                isActive
                                    ? "border border-cyan-400/40 bg-gradient-to-r from-cyan-950/40 via-cyan-900/20 to-blue-950/30 text-white shadow-[0_0_30px_rgba(6,182,212,0.18),inset_0_1px_1px_rgba(255,255,255,0.15)]"
                                    : "border border-transparent bg-slate-950/40 text-slate-400 hover:border-slate-700/60 hover:bg-slate-900/60 hover:text-slate-200",
                            ].join(" ")}
                        >
                            {/* Subtle active glow bar on top */}
                            {isActive && (
                                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_rgba(34,211,238,1)]" />
                            )}

                            <div className="flex items-center gap-3.5">
                                <div
                                    className={[
                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300",
                                        isActive
                                            ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                                            : "border-slate-800 bg-slate-900/80 text-slate-500 group-hover:border-slate-700 group-hover:text-slate-300",
                                    ].join(" ")}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>

                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold tracking-[0.14em] text-white">
                                            {tab.label}
                                        </span>
                                        <span
                                            className={[
                                                "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider",
                                                isActive
                                                    ? "border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                                                    : "border border-slate-800 bg-slate-900 text-slate-500 group-hover:text-slate-400",
                                            ].join(" ")}
                                        >
                                            {tab.badge}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        {tab.tagline}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pr-1">
                                {isActive ? (
                                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                                        ACTIVE
                                    </span>
                                ) : (
                                    <span className="font-mono text-[11px] text-slate-600 transition-transform group-hover:translate-x-1 group-hover:text-cyan-400">
                                        SWITCH →
                                    </span>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}

