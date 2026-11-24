import Image from "next/image";

export interface ObservatoryLoaderProps {
  /** "fullscreen" covers the entire viewport (route transitions); "container" fills its parent panel. */
  variant?: "fullscreen" | "container";
  /** Brand or module headline shown beneath the reticle. */
  title?: string;
  /** Subtle aerospace telemetry status line. */
  subtitle?: string;
  /** Optional deterministic progress (0–100); omit for sleek indeterminate light beam. */
  progress?: number;
  /** Extra Tailwind classes for container sizing/borders. */
  className?: string;
}

const RETICLE_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

/**
 * ObservatoryLoader — Unified luxury minimalist aerospace loader for Cakrapala.
 * Server-Component safe (pure CSS GPU-composited animations, zero client JS overhead).
 */
export default function ObservatoryLoader({
  variant = "fullscreen",
  title = "CAKRAPALA",
  subtitle = "Synchronizing celestial ephemeris",
  progress,
  className = "",
}: ObservatoryLoaderProps) {
  const isFullscreen = variant === "fullscreen";
  const clampedProgress =
    typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${title} — ${subtitle}`}
      className={[
        isFullscreen ? "fixed inset-0 z-50 h-[100dvh] w-screen" : "relative w-full h-full min-h-[260px]",
        "flex flex-col items-center justify-center overflow-hidden bg-[#02040a] text-slate-100 select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Whisper-subtle deep-space atmospheric radial halo */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 52% 42% at 50% 48%, rgba(56, 189, 248, 0.065) 0%, rgba(15, 23, 42, 0.24) 44%, rgba(2, 4, 10, 0) 78%)",
        }}
      />

      {/* Precision Astrolabe / Orbital Reticle */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Slowly rotating outer celestial degree ring */}
          <svg
            viewBox="0 0 96 96"
            className="animate-cakrapala-reticle absolute inset-0 h-full w-full"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="48"
              cy="48"
              r="45"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="0.75"
            />
            {RETICLE_TICKS.map((deg) => {
              const major = deg % 90 === 0;
              return (
                <line
                  key={deg}
                  x1="48"
                  y1={major ? "2.5" : "4.5"}
                  x2="48"
                  y2={major ? "7.5" : "6.8"}
                  stroke={major ? "rgba(226,232,240,0.45)" : "rgba(148,163,184,0.22)"}
                  strokeWidth={major ? "1" : "0.75"}
                  transform={`rotate(${deg} 48 48)`}
                />
              );
            })}
          </svg>

          {/* Sweeping luminous orbital arc */}
          <svg
            viewBox="0 0 96 96"
            className="animate-cakrapala-orbit absolute inset-0 h-full w-full"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="cakrapalaOrbitArc" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="68%" stopColor="rgba(186,230,253,0.45)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.95)" />
              </linearGradient>
            </defs>
            <circle
              cx="48"
              cy="48"
              r="34"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.75"
            />
            <path
              d="M 48 14 A 34 34 0 0 1 82 48"
              stroke="url(#cakrapalaOrbitArc)"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            {/* Pinpoint satellite glint at leading edge */}
            <circle cx="82" cy="48" r="1.8" fill="#ffffff" />
            <circle cx="82" cy="48" r="4.5" fill="rgba(186,230,253,0.28)" />
          </svg>

          {/* Central frosted obsidian emblem jewel */}
          <div className="animate-cakrapala-breathe relative flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.14] shadow-[0_0_28px_rgba(148,163,184,0.12)] backdrop-blur-md">
            <Image
              src="/cakrapala1.png"
              alt="Cakrapala"
              width={26}
              height={26}
              priority
              className="h-6 w-6 rounded-full object-contain opacity-95"
            />
          </div>
        </div>

        {/* Editorial aerospace typography */}
        <div className="mt-7 flex flex-col items-center gap-2 text-center px-6">
          <span className="font-sans text-[11px] font-medium tracking-[0.42em] text-white/90 uppercase pl-[0.42em]">
            {title}
          </span>
          <p className="font-mono text-[11px] tracking-[0.12em] text-slate-400/85">
            {subtitle}
          </p>
        </div>

        {/* Hairline 1.5px light-beam progress rail */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <div className="relative h-[1.5px] w-44 overflow-hidden rounded-full bg-white/[0.09]">
            {clampedProgress !== null ? (
              <div
                className="h-full rounded-full bg-gradient-to-r from-slate-400/60 via-sky-200 to-white transition-[width] duration-300 ease-out"
                style={{ width: `${clampedProgress}%` }}
              />
            ) : (
              <div className="animate-cakrapala-beam absolute inset-y-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-sky-100/90 to-transparent" />
            )}
          </div>
          {clampedProgress !== null && (
            <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500 tabular-nums">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
