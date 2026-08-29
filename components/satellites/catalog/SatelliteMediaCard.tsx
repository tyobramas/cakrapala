"use client";

import { useState } from "react";
import Image from "next/image";
import {
    Satellite as SatIcon,
    Rocket,
    Disc,
    HelpCircle,
    ExternalLink,
    ShieldAlert,
} from "lucide-react";
import type { SatelliteMediaRecord } from "@/lib/satellites/satelliteMedia";
import type { SatcatObjectType } from "@/lib/satellites/satcatTypes";
import type { SatelliteOwnerDisplay } from "@/lib/satellites/ownerMetadata";

export interface SatelliteMediaCardProps {
    noradId: number;
    objectName: string;
    objectType?: SatcatObjectType | string | null;
    owner?: SatelliteOwnerDisplay | null;
    regime?: string | null;
    media: SatelliteMediaRecord | null;
}

function getObjectTypeIcon(type: string | undefined | null) {
    const upper = (type ?? "UNK").toUpperCase();
    if (upper === "PAY" || upper === "PAYLOAD") {
        return <SatIcon className="h-10 w-10 text-cyan-400" />;
    }
    if (upper === "R/B" || upper === "ROCKET BODY") {
        return <Rocket className="h-10 w-10 text-amber-400" />;
    }
    if (upper === "DEB" || upper === "DEBRIS") {
        return <Disc className="h-10 w-10 text-rose-400" />;
    }
    return <HelpCircle className="h-10 w-10 text-slate-400" />;
}

export default function SatelliteMediaCard({
    noradId,
    objectName,
    objectType = "UNK",
    owner,
    regime = "LEO",
    media,
}: SatelliteMediaCardProps) {
    const [imageFailed, setImageFailed] = useState(false);

    const hasValidImage = media && !imageFailed;

    return (
        <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/70 shadow-inner">
            {/* Media Container with strict 16/9 aspect ratio */}
            <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-b from-[#061021] via-[#030914] to-[#01040d]">
                {hasValidImage ? (
                    <div className="relative h-full w-full flex items-center justify-center p-4">
                        <Image
                            src={media.src}
                            alt={media.alt}
                            fill
                            sizes="(max-width: 640px) 100vw, 380px"
                            className="object-contain p-2 transition-transform duration-500 hover:scale-105"
                            onError={() => setImageFailed(true)}
                            priority={false}
                        />

                        {/* Top Badge for Media Type */}
                        <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-slate-950/80 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-300 backdrop-blur-md">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                            <span>
                                {media.mediaType === "photograph"
                                    ? "PHOTOGRAPH"
                                    : "ARTIST RENDERING"}
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Procedural Space-Themed Placeholder */
                    <div className="relative flex h-full w-full flex-col items-center justify-between p-4 text-center">
                        {/* Background Orbit Grid Effect */}
                        <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

                        {/* Top Metadata Badges */}
                        <div className="relative z-10 flex w-full items-center justify-between font-mono text-[9px]">
                            <span className="flex items-center gap-1 rounded border border-slate-700/60 bg-slate-900/80 px-2 py-0.5 text-slate-400">
                                <ShieldAlert className="h-3 w-3 text-slate-500" />
                                NO VERIFIED IMAGE
                            </span>

                            <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-bold uppercase text-cyan-300">
                                {regime} ORBIT
                            </span>
                        </div>

                        {/* Center Icon & Classification */}
                        <div className="relative z-10 my-auto flex flex-col items-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/80 shadow-[0_0_25px_rgba(6,182,212,0.15)]">
                                {getObjectTypeIcon(objectType)}
                            </div>

                            <p className="mt-2.5 max-w-[260px] truncate font-mono text-xs font-bold text-white">
                                {objectName}
                            </p>

                            <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                                NORAD #{noradId} • {owner?.flag ? `${owner.flag} ` : ""}{owner?.name ?? "Unknown Entity"}
                            </p>
                        </div>

                        {/* Bottom Disclaimer */}
                        <div className="relative z-10 font-mono text-[8.5px] tracking-widest text-slate-500 uppercase">
                            NO VERIFIED IMAGE AVAILABLE
                        </div>
                    </div>
                )}
            </div>

            {/* Media Source & Licensing Credit Bar (if verified image exists) */}
            {hasValidImage && (
                <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/60 px-3 py-1.5 font-mono text-[9px] text-slate-400">
                    <span className="truncate mr-2">
                        CREDIT: <strong className="text-slate-300">{media.credit}</strong> ({media.license})
                    </span>

                    {media.sourceUrl && (
                        <a
                            href={media.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex shrink-0 items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline"
                        >
                            <span>SOURCE</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
