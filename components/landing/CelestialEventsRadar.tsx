"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MoonPhase,
  Illumination,
  SearchRiseSet,
  Body,
  Observer,
  Horizon,
  Equator,
} from "astronomy-engine";
import { Sparkles, Sunrise, Sunset, Moon, Eye, ArrowRight } from "lucide-react";

interface CelestialEventData {
  moonPhaseName: string;
  moonIlluminationPercent: number;
  sunriseTime: string;
  sunsetTime: string;
  moonriseTime: string;
  moonsetTime: string;
  visiblePlanets: { name: string; altitude: number; isVisible: boolean; constellation: string }[];
}

export default function CelestialEventsRadar() {
  const [data, setData] = useState<CelestialEventData | null>(null);

  useEffect(() => {
    try {
      const now = new Date();
      const observer = new Observer(-6.595, 106.79, 250);

      // Moon calculations
      const phaseDeg = MoonPhase(now);
      const moonIllum = Illumination(Body.Moon, now);
      const illuminationPercent = Math.round(moonIllum.phase_fraction * 100);

      let phaseName = "New Moon";
      if (phaseDeg > 10 && phaseDeg < 80) phaseName = "Waxing Crescent";
      else if (phaseDeg >= 80 && phaseDeg <= 100) phaseName = "First Quarter";
      else if (phaseDeg > 100 && phaseDeg < 170) phaseName = "Waxing Gibbous";
      else if (phaseDeg >= 170 && phaseDeg <= 190) phaseName = "Full Moon";
      else if (phaseDeg > 190 && phaseDeg < 260) phaseName = "Waning Gibbous";
      else if (phaseDeg >= 260 && phaseDeg <= 280) phaseName = "Third Quarter";
      else if (phaseDeg > 280 && phaseDeg < 350) phaseName = "Waning Crescent";

      const formatTime = (evt: { date: Date } | null) => {
        if (!evt || !evt.date) return "--:--";
        return evt.date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      };

      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const sunRise = SearchRiseSet(Body.Sun, observer, 1, startOfDay, 1);
      const sunSet = SearchRiseSet(Body.Sun, observer, -1, startOfDay, 1);
      const moonRise = SearchRiseSet(Body.Moon, observer, 1, startOfDay, 1);
      const moonSet = SearchRiseSet(Body.Moon, observer, -1, startOfDay, 1);

      const targetBodies = [
        { name: "Venus", body: Body.Venus, constellation: "Pisces" },
        { name: "Mars", body: Body.Mars, constellation: "Taurus" },
        { name: "Jupiter", body: Body.Jupiter, constellation: "Taurus" },
        { name: "Saturn", body: Body.Saturn, constellation: "Aquarius" },
      ];

      const planetStatuses = targetBodies.map((p) => {
        const hor = Horizon(now, observer, Equator(p.body, now, observer, true, true).ra, Equator(p.body, now, observer, true, true).dec, "normal");
        return {
          name: p.name,
          altitude: Math.round(hor.altitude),
          isVisible: hor.altitude > 0,
          constellation: p.constellation,
        };
      });

      setData({
        moonPhaseName: phaseName,
        moonIlluminationPercent: illuminationPercent,
        sunriseTime: formatTime(sunRise),
        sunsetTime: formatTime(sunSet),
        moonriseTime: formatTime(moonRise),
        moonsetTime: formatTime(moonSet),
        visiblePlanets: planetStatuses,
      });
    } catch (err) {
      console.warn("Astronomy Engine calculation:", err);
    }
  }, []);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>REAL-TIME EPHEMERIS RADAR</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
          Celestial Events &amp; Night Sky Radar
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          Real-time astronomical computations powered by Astronomy Engine with sub-arcminute JPL Horizons accuracy.
        </p>
      </div>

      {/* Grid Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono">
        {/* Panel 1: Moon Phase & Illumination */}
        <div className="rounded-2xl bg-gradient-to-b from-[#0e172e] via-[#091124] to-[#020617] border border-indigo-500/20 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between text-indigo-300 text-xs mb-4">
              <span className="flex items-center gap-2">
                <Moon className="w-4 h-4" />
                LUNAR ILLUMINATION
              </span>
              <span className="text-[10px] bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                REAL-TIME
              </span>
            </div>

            <div className="flex items-baseline gap-3 my-4">
              <div className="text-4xl font-bold text-white tracking-tight">
                {data ? `${data.moonIlluminationPercent}%` : "..."}
              </div>
              <div className="text-xs text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60">
                {data?.moonPhaseName || "Computing phase..."}
              </div>
            </div>

            <p className="text-xs text-slate-400 font-sans leading-relaxed mt-3">
              Moonlight illumination level directly influences telescope visibility for deep-sky faint nebulae and star clusters.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-6 flex justify-between text-xs text-slate-400">
            <span>Moonrise: <strong className="text-white">{data?.moonriseTime || "--:--"}</strong></span>
            <span>Moonset: <strong className="text-white">{data?.moonsetTime || "--:--"}</strong></span>
          </div>
        </div>

        {/* Panel 2: Horizon Sun Cycles */}
        <div className="rounded-2xl bg-gradient-to-b from-[#0e172e] via-[#091124] to-[#020617] border border-cyan-500/20 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between text-cyan-300 text-xs mb-4">
              <span className="flex items-center gap-2">
                <Sunrise className="w-4 h-4" />
                HORIZON SOLAR CYCLE
              </span>
              <span className="text-[10px] text-slate-400">
                OBSERVER LOCAL
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-400 text-xs mb-1">
                  <Sunrise className="w-3.5 h-3.5" />
                  <span>SUNRISE</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {data?.sunriseTime || "--:--"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Azimuth ~92&deg; East</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-orange-400 text-xs mb-1">
                  <Sunset className="w-3.5 h-3.5" />
                  <span>SUNSET</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {data?.sunsetTime || "--:--"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Azimuth ~268&deg; West</div>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-sans leading-relaxed mt-3">
              Astronomical dusk transition marks the optimal window for celestial observation and astrophotography sessions.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-6">
            <Link
              href="/sky"
              className="inline-flex items-center justify-between w-full text-xs text-cyan-400 hover:text-cyan-300 group"
            >
              <span>LAUNCH SKY MAP SIMULATION</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Panel 3: Planet Night Visibility */}
        <div className="rounded-2xl bg-gradient-to-b from-[#0e172e] via-[#091124] to-[#020617] border border-emerald-500/20 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between text-emerald-300 text-xs mb-4">
              <span className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                PLANETARY VISIBILITY
              </span>
              <span className="text-[10px] bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 text-emerald-400">
                TONIGHT
              </span>
            </div>

            <div className="space-y-2.5 my-3">
              {data?.visiblePlanets.map((planet) => (
                <div
                  key={planet.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2 font-sans font-medium text-slate-200">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        planet.isVisible ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"
                      }`}
                    />
                    <span>{planet.name}</span>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    Alt: <span className={planet.isVisible ? "text-emerald-300 font-bold" : "text-slate-500"}>{planet.altitude}&deg;</span>
                    {" "}({planet.constellation})
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-4">
            <Link
              href="/explore"
              className="inline-flex items-center justify-between w-full text-xs text-cyan-400 hover:text-cyan-300 group"
            >
              <span>INSPECT ASTEROID DEFENSE RADAR</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
