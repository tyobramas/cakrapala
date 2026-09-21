import Link from 'next/link';

export const metadata = {
  title: 'Sumber Data & Atribusi Lisensi — Cakrapala OSINT',
  description: 'Daftar penyedia data publik, atribusi lisensi resmi, dan batasan etika pengamatan Cakrapala OSINT.',
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
            ← Kembali ke Globe OSINT
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Sumber Data, Atribusi Lisensi &amp; Batasan Etika
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Cakrapala mengintegrasikan 7 layer informasi situasi global dari sumber-sumber terbuka (open source intelligence).
            Seluruh data disajikan secara non-komersial untuk kesadaran situasional publik dengan kepatuhan lisensi penuh.
          </p>
        </div>

        {/* 1. License Table */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-neutral-100 border-b border-neutral-800 pb-2">
            1. Registri Sumber Data &amp; Lisensi (7 Layer)
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 font-medium">
                  <th className="p-3.5">Layer</th>
                  <th className="p-3.5">Penyedia Data</th>
                  <th className="p-3.5">Lisensi / Ketentuan</th>
                  <th className="p-3.5">Atribusi Resmi &amp; Tautan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                {/* 1. Quake */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-fuchsia-400">Gempa (quake)</td>
                  <td className="p-3.5">U.S. Geological Survey (USGS)</td>
                  <td className="p-3.5 text-neutral-400">Domain Publik (US Gov)</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      USGS Earthquake Hazards Program
                    </a>
                  </td>
                </tr>

                {/* 2. Imagery */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-sky-400">Citra Satelit (imagery)</td>
                  <td className="p-3.5">NASA EOSDIS GIBS</td>
                  <td className="p-3.5 text-neutral-400">Kebijakan Data Terbuka NASA</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      NASA GIBS / Worldview
                    </a>
                  </td>
                </tr>

                {/* 3. Fire */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-amber-400">Kebakaran (fire)</td>
                  <td className="p-3.5">NASA FIRMS (LANCE/EOSDIS)</td>
                  <td className="p-3.5 text-neutral-400">Kebijakan Data Terbuka NASA</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      NASA Fire Information for Resource Management System
                    </a>
                  </td>
                </tr>

                {/* 4. Storm */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-purple-400">Badai (storm)</td>
                  <td className="p-3.5">NOAA NHC &amp; GDACS (JRC Komisi Eropa)</td>
                  <td className="p-3.5 text-neutral-400">Domain Publik (NOAA) &amp; Atribusi Terbuka (JRC)</td>
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
                  <td className="p-3.5 font-sans font-medium text-cyan-400">Lalu Lintas Udara (air)</td>
                  <td className="p-3.5">Komunitas adsb.lol</td>
                  <td className="p-3.5 text-neutral-400">Open Database License (ODbL) 1.0</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://adsb.lol/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      Flight data: adsb.lol contributors (ODbL)
                    </a>
                  </td>
                </tr>

                {/* 6. Sea */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-teal-400">Lalu Lintas Laut (sea)</td>
                  <td className="p-3.5">Fintraffic Digitraffic (Finlandia)</td>
                  <td className="p-3.5 text-neutral-400">Creative Commons Attribution 4.0 (CC BY 4.0)</td>
                  <td className="p-3.5 text-neutral-300">
                    <a href="https://www.digitraffic.fi/en/marine-traffic/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      Vessel data: Fintraffic Digitraffic
                    </a>
                  </td>
                </tr>

                {/* 7. Eyes */}
                <tr className="hover:bg-neutral-800/30">
                  <td className="p-3.5 font-sans font-medium text-lime-400">Kamera Publik (eyes)</td>
                  <td className="p-3.5">Windy.com &amp; ATCS Dinas Perhubungan</td>
                  <td className="p-3.5 text-neutral-400">Windy Webcams API License (Free Tier) &amp; Siaran Publik Pemda</td>
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
                      ATCS Dishub: DKI Jakarta, Bandung, Surabaya, Semarang, Yogyakarta, Denpasar, London JamCams (TfL), WSDOT.
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
            <span>📷</span> Atribusi Wajib Windy.com (Klausul L7)
          </h2>
          <div className="text-sm text-neutral-200 leading-relaxed font-normal">
            Sesuai ketentuan penggunaan Windy Webcams API, seluruh data webcam publik yang disediakan melalui platform Windy diatribusikan dengan klausul resmi:
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
            2. Batasan Etis &amp; Perlindungan Privasi
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-neutral-300">
            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>🚫</span> Tanpa Kamera Tidak Aman / Eksploitasi
              </div>
              <p>
                Cakrapala HANYA mengindeks kamera yang secara resmi dipublikasikan oleh operator pemerintah dan platform terdaftar. Kami secara tegas melarang dan tidak menggunakan pemindaian port terbuka, kredensial default, Shodan, atau Insecam.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>👤</span> Larangan Pelacakan Individu (L9)
              </div>
              <p>
                Tidak ada fitur pengenalan wajah, peningkatan gambar digital ekstrem, atau penandaan individu pada citra webcam maupun tracking kendaraan pribadi. Sistem ini ditujukan murni untuk pemantauan makro lalu lintas dan cuaca.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>💾</span> Tanpa Penyimpanan Riwayat Posisi Permanen
              </div>
              <p>
                Posisi pesawat dan kapal tidak disimpan ke database permanen. Rekam jejak gerakan (trail) hanya bertahan maksimal 5 menit di memori lokal peramban pengguna dan segera musnah saat tab ditutup.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2">
              <div className="font-semibold text-white flex items-center gap-2">
                <span>⏱️</span> Kepatuhan Kuota &amp; Siklus Hidup Token (L1, L2)
              </div>
              <p>
                Pengambilan data webcam strictly user-triggered (tanpa polling background otomatis) untuk menghormati batas upstream server. Token gambar kedaluwarsa setelah 8 menit di cache dan diambil ulang sesuai kebutuhan.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Takedown Contact */}
        <section className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/60 space-y-3">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>🛡️</span> Permintaan Penurunan Konten (Takedown Notice)
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Jika Anda adalah operator resmi dari salah satu fasilitas kamera atau penyedia siaran publik dan menghendaki kamera Anda dinonaktifkan dari indeks Cakrapala, kami menyediakan mekanisme takedown cepat:
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="mailto:takedown@cakrapala.id"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:text-white hover:bg-neutral-700 text-xs font-mono transition-colors"
            >
              ✉️ Hubungi: takedown@cakrapala.id
            </a>
            <a
              href="https://github.com/tyobramas/cakrapala/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-200 hover:text-white hover:bg-neutral-700 text-xs font-mono transition-colors"
            >
              🐙 Buat Isu GitHub
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
