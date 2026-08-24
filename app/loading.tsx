export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] text-slate-100 font-mono">
      {/* Background radial cosmic glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

      {/* Futuristic Orbit Preloader Animation */}
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Outer Pulsing Radar Ring */}
        <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping opacity-75" />

        {/* Orbit Ring 1 */}
        <div className="absolute inset-2 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 border-r-transparent animate-spin" style={{ animationDuration: "2s" }} />

        {/* Orbit Ring 2 */}
        <div className="absolute inset-5 rounded-full border border-amber-400/50 border-b-amber-400 border-l-transparent animate-spin" style={{ animationDuration: "1.4s", animationDirection: "reverse" }} />

        {/* Central Core */}
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.8)]" />
      </div>

      {/* Telemetry Status Text */}
      <div className="mt-8 text-center space-y-2 relative z-10">
        <div className="text-xs font-bold tracking-[0.3em] uppercase text-cyan-400 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>INITIALIZING DEEP SPACE TELEMETRY...</span>
        </div>
        <p className="text-[11px] text-slate-500 font-sans tracking-wide">
          Calibrating astronomical coordinates &amp; WebGL acceleration
        </p>
      </div>
    </div>
  );
}
