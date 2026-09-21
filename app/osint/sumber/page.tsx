import Link from 'next/link';

export const metadata = {
  title: 'Data Sources & License Attributions — Cakrapala OSINT',
  description: 'List of public data providers, official license attributions, and ethical observation safeguards for Cakrapala OSINT.',
};

export default function SourcesPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="space-y-4">
          <Link
            href="/osint"
            className="inline-flex items-center gap-2 text-xs font-mono text-lime-400 hover:text-lime-300 transition-colors"
          >
            ← Back to OSINT Globe
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Data Sources, License Attributions &amp; Ethical Safeguards
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Cakrapala integrates 7 global situational intelligence layers from open source providers.
            All data is presented strictly for non-commercial public situational awareness with complete license compliance.
          </p>
        </div>

        {/* 1. License Table */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-100 border-b border-neutral-800 pb-2">
            1. Data Source Registry &amp; Licenses (7 Layers)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 font-medium">
                  <th className="p-3.5">Layer</th>
                  <th className="p-3.5">Data Provider</th>
                  <th className="p-3.5">License / Terms</th>
                  <th className="p-3.5">Official Attribution &amp; Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                {/* 1. Quake */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-fuchsia-400">Earthquakes (quake)</td>
                  <td className="p-3.5">U.S. Geological Survey (USGS)</td>
                  <td className="p-3.5 text-neutral-400">Public Domain (US Gov)</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      USGS Earthquake Hazards Program
                    </a>
                  </td>
                </tr>

                {/* 2. Imagery */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-sky-400">Satellite Imagery (imagery)</td>
                  <td className="p-3.5">NASA EOSDIS GIBS</td>
                  <td className="p-3.5 text-neutral-400">NASA Open Data Policy</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      NASA GIBS / Worldview
                    </a>
                  </td>
                </tr>

                {/* 3. Fire */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-amber-400">Wildfires (fire)</td>
                  <td className="p-3.5">NASA FIRMS (LANCE/EOSDIS)</td>
                  <td className="p-3.5 text-neutral-400">NASA Open Data Policy</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      NASA Fire Information for Resource Management System
                    </a>
                  </td>
                </tr>

                {/* 4. Storm */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-purple-400">Storms (storm)</td>
                  <td className="p-3.5">NOAA NHC &amp; GDACS (JRC European Commission)</td>
                  <td className="p-3.5 text-neutral-400">Public Domain (NOAA) &amp; Open Attribution (JRC)</td>
                  <td className="p-3.5 text-neutral-300 space-y-1">
                    <div>
                      <a href="https://www.nhc.noaa.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                        National Hurricane Center (NOAA)
                      </a>
                    </div>
                    <div>
                      <a href="https://www.gdacs.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                        Global Disaster Alert and Coordination System (GDACS)
                      </a>
                    </div>
                  </td>
                </tr>

                {/* 5. Air */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-cyan-400">Aircraft (air)</td>
                  <td className="p-3.5">adsb.lol community</td>
                  <td className="p-3.5 text-neutral-400">Open Database License (ODbL) 1.0</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://adsb.lol/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      Flight data: adsb.lol contributors (ODbL)
                    </a>
                  </td>
                </tr>

                {/* 6. Sea */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-teal-400">Vessels (sea)</td>
                  <td className="p-3.5">Fintraffic Digitraffic (Finland)</td>
                  <td className="p-3.5 text-neutral-400">Creative Commons Attribution 4.0 (CC BY 4.0)</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://www.digitraffic.fi/en/marine-traffic/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      Vessel data: Fintraffic Digitraffic
                    </a>
                  </td>
                </tr>

                {/* 7. Eyes */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-lime-400">Webcams (eyes)</td>
                  <td className="p-3.5">Windy.com &amp; Official Transportation Agencies</td>
                  <td className="p-3.5 text-neutral-400">Windy Webcams API License (Free Tier) &amp; Public Feeds</td>
                  <td className="p-3.5 text-neutral-300 space-y-1">
                    <div>
                      Webcams provided by{' '}
                      <a href="https://www.windy.com/" target="_blank" rel="noopener noreferrer" className="text-lime-400 underline hover:text-lime-300">
                        windy.com
                      </a>{' '}
                      -{' '}
                      <a href="https://www.windy.com/webcams/add" target="_blank" rel="noopener noreferrer" className="text-lime-400 underline hover:text-lime-300">
                        add new webcam
                      </a>
                    </div>
                    <div className="text-neutral-400 font-sans text-[10px]">
                      Official Agency Feeds: Jakarta, Bandung, Surabaya, Semarang, Yogyakarta, Bali, London JamCams (TfL), WSDOT.
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Mandatory Attribution Windy (L7) */}
        <section className="space-y-3 p-5 rounded-xl border border-lime-500/30 bg-lime-950/10">
          <h2 className="text-base font-semibold text-lime-300 flex items-center gap-2">
            <span>📷</span> Mandatory Windy.com Attribution (Clause L7)
          </h2>
          <div className="text-sm text-neutral-200 leading-relaxed font-normal">
            Pursuant to the Windy Webcams API terms of service, all public webcam data provided through the Windy platform is attributed with the official clause:
          </div>
          <blockquote className="p-3 rounded bg-neutral-900/80 border-l-4 border-lime-500 text-sm text-neutral-100 font-medium">
            Webcams provided by{' '}
            <a href="https://www.windy.com/" target="_blank" rel="noopener noreferrer" className="text-lime-400 underline hover:text-lime-300">
              windy.com
            </a>{' '}
            -{' '}
            <a href="https://www.windy.com/webcams/add" target="_blank" rel="noopener noreferrer" className="text-lime-400 underline hover:text-lime-300">
              add new webcam
            </a>
          </blockquote>
        </section>

        {/* 3. Ethical Boundaries */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-100 border-b border-neutral-800 pb-2">
            2. Ethical Safeguards &amp; Privacy Protections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-neutral-300">
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>🚫</span> No Insecure Feeds or Exploitation
              </div>
              <p>
                Cakrapala ONLY indexes cameras that are officially published by public authorities and registered platforms. We strictly prohibit open-port scanning, default credential access, Shodan, or Insecam feeds.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>👤</span> Prohibition of Individual Tracking (L9)
              </div>
              <p>
                No facial recognition, extreme digital magnification, or individual person tracking is supported. This system is designed purely for macro-level traffic, weather, and environmental situational awareness.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>💾</span> No Permanent Position Storage
              </div>
              <p>
                Aircraft and vessel positions are never persisted to a database. Motion trails remain for a maximum of 5 minutes in transient browser memory and are destroyed when the session terminates.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>⏱️</span> Quota Compliance &amp; Token Lifecycles (L1, L2)
              </div>
              <p>
                Webcam retrieval is strictly user-triggered (no background polling loops) to protect upstream API limits. Preview tokens expire after 8 minutes in cache and are renewed on demand.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Takedown Contact */}
        <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🛡️</span> Content Takedown Requests
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            If you are an authorized operator of any camera facility or public broadcast and wish to have your feed delisted from Cakrapala, we provide an expedited takedown procedure:
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="mailto:takedown@cakrapala.id"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:text-white hover:bg-neutral-700 text-xs font-mono transition-colors"
            >
              ✉️ Contact: takedown@cakrapala.id
            </a>
            <a
              href="https://github.com/tyobramas/cakrapala/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:text-white hover:bg-neutral-700 text-xs font-mono transition-colors"
            >
              🐙 Create GitHub Issue
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
