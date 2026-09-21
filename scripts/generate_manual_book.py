import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import os
import shutil

def set_cell_background(cell, fill_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_color)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def generate_manual():
    doc = docx.Document()

    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Color Palette
    COLOR_PRIMARY = RGBColor(14, 116, 144)    # Cyan / Deep Teal #0e7490
    COLOR_SECONDARY = RGBColor(30, 41, 59)   # Slate 800
    COLOR_TEXT = RGBColor(15, 23, 42)        # Slate 900
    COLOR_MUTED = RGBColor(71, 85, 105)      # Slate 600

    # Helper functions
    def add_heading_1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(16)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.font.size = Pt(13.5)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY
        return h

    def add_heading_2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.font.size = Pt(11.5)
        r.font.bold = True
        r.font.color.rgb = COLOR_SECONDARY
        return h

    def add_heading_3(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(8)
        h.paragraph_format.space_after = Pt(3)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.font.size = Pt(10.5)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY
        return h

    def add_body(text, bold_prefix=None, space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.bold = True
            r_pre.font.size = Pt(10)
            r_pre.font.color.rgb = COLOR_TEXT
        r = p.add_run(text)
        r.font.size = Pt(10)
        r.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.bold = True
            r_pre.font.size = Pt(9.5)
            r_pre.font.color.rgb = COLOR_TEXT
        r = p.add_run(text)
        r.font.size = Pt(9.5)
        r.font.color.rgb = COLOR_TEXT
        return p

    def add_screenshot(img_path, caption):
        if os.path.exists(img_path):
            p_img = doc.add_paragraph()
            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_img.paragraph_format.space_before = Pt(8)
            p_img.paragraph_format.space_after = Pt(3)
            p_img.paragraph_format.keep_with_next = True
            r_img = p_img.add_run()
            r_img.add_picture(img_path, width=Inches(6.0))

            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_after = Pt(10)
            r_cap = p_cap.add_run(caption)
            r_cap.font.italic = True
            r_cap.font.size = Pt(8.5)
            r_cap.font.color.rgb = COLOR_MUTED
        else:
            p_err = doc.add_paragraph()
            r_err = p_err.add_run(f"[Gambar: {caption} - Berkas {img_path} tidak ditemukan]")
            r_err.font.italic = True
            r_err.font.size = Pt(9)
            r_err.font.color.rgb = RGBColor(220, 38, 38)

    # ── COVER & TITLE ──────────────────────────────────────────────────────────
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_inst = p_inst.add_run("KEMENTERIAN HUKUM DAN HAM REPUBLIK INDONESIA\nDIREKTORAT JENDERAL KEKAYAAN INTELEKTUAL (DJKI)\n")
    r_inst.font.size = Pt(10)
    r_inst.font.bold = True
    r_inst.font.color.rgb = COLOR_MUTED

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("BUKU PANDUAN PENGGUNAAN PROGRAM KOMPUTER\n(MANUAL BOOK & URAIAN CIPTAAN RESMI)")
    r_title.font.size = Pt(18)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("CAKRAPALA — DEEP SPACE OBSERVATORY & ASTRO-AI CO-PILOT\n")
    r_sub.font.size = Pt(13)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_SECONDARY
    r_sub2 = p_sub.add_run("Platform Observatorium Digital, Astrometri Toposentrik, dan Radar Pertahanan Planet Berbasis Web 3D (cakrapala.com)")
    r_sub2.font.size = Pt(10)
    r_sub2.font.italic = True
    r_sub2.font.color.rgb = COLOR_MUTED

    doc.add_paragraph().paragraph_format.space_after = Pt(12)

    # ── METADATA BOX TABLE ───────────────────────────────────────────────────
    meta_table = doc.add_table(rows=8, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Judul Ciptaan", "Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot"),
        ("Jenis Ciptaan", "Program Komputer (Aplikasi Web / Software-as-a-Service)"),
        ("Tautan Akses Resmi (URL)", "https://cakrapala.com"),
        ("Bahasa Pemrograman", "TypeScript, JavaScript (ES2024), GLSL (OpenGL Shading Language)"),
        ("Framework & Engine 3D", "Next.js 16 (React 19), Three.js (WebGL), Tailwind CSS, CesiumJS"),
        ("Algoritma Komputasi", "SGP4/SDP4 Orbital Propagator, NASA NeoWs Harvester, Keplerian Engine"),
        ("Tahun Pertama Diumumkan", "2026"),
        ("Negara Pertama Diumumkan", "Indonesia"),
    ]
    for i, (label, val) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, 80, 80, 100, 100)
        set_cell_margins(c1, 80, 80, 100, 100)

        p0 = c0.paragraphs[0]
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(9.5)
        r0.font.color.rgb = COLOR_SECONDARY

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(val)
        r1.font.size = Pt(9.5)
        r1.font.color.rgb = COLOR_TEXT

    doc.add_page_break()

    # ── BAB 1: IDENTITAS DAN INFORMASI UMUM ───────────────────────────────────
    add_heading_1("BAB 1: IDENTITAS DAN INFORMASI UMUM CIPTAAN")
    add_body("Buku Panduan Manual Penggunaan Program Komputer (Manual Book) ini disusun secara khusus dan komprehensif sebagai dokumen pemenuhan syarat substantif pendaftaran Hak Cipta atas Program Komputer pada Direktorat Jenderal Kekayaan Intelektual (DJKI), Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia.")
    add_body("Cakrapala adalah karya cipta perangkat lunak berwujud program komputer berbasis web interaktif (Software-as-a-Service / Web Application) yang dapat diakses secara publik dan langsung melalui alamat domain resmi https://cakrapala.com. Program ini memadukan komputasi astrodinamika mekanika orbital, simulasi grafis 3D WebGL fotorealistik, propagasi satelit real-time SGP4, radar pendeteksi asteroid Near-Earth Object (NEO) NASA JPL, serta asisten kecerdasan buatan cerdas dalam satu antarmuka terpadu bergaya kokpit kedirgantaraan.")

    # ── BAB 2: LATAR BELAKANG PENCIPTAAN & TUJUAN INOVASI ─────────────────────
    add_heading_1("BAB 2: LATAR BELAKANG PENCIPTAAN DAN TUJUAN INOVASI")
    add_body("Penciptaan perangkat lunak Cakrapala dilatarbelakangi oleh beberapa tantangan nyata dalam edukasi dan sains antariksa di Indonesia:")
    add_bullet("Publikasi media massa yang kerap mengangkat isu potensi tabrakan asteroid mendekati Bumi dengan judul bombastis yang memicu kepanikan tanpa menyajikan visualisasi jarak ilmiah yang terukur.", "1. Bahaya Misinformasi dan Hoaks Asteroid:")
    add_bullet("Data orbit satelit dan koordinat ephemeris benda langit yang dirilis oleh badan antariksa dunia seperti NASA JPL dan NORAD disajikan dalam bentuk deret angka TLE (Two-Line Element) dan tabel numerik yang sangat teknis dan sukar dicerna oleh masyarakat awam.", "2. Tingginya Hambatan Pemahaman Data Mentah Antariksa:")
    add_bullet("Aplikasi astronomi konvensional umumnya terpisah-pisah (hanya sebatas peta bintang darat 2D atau kalkulator orbit terisolasi), tanpa adanya kokpit visualisasi terpadu multi-skala yang menghubungkan orbit rendah bumi (LEO), tata surya heliosentris, dan radar ancaman objek langit.", "3. Fragmentasi Software Astronomi Konvensional:")
    add_body("Tujuan inovasi dari program komputer Cakrapala adalah menyediakan sistem observatorium antariksa digital yang terbuka, akurat secara fisika, dan mudah digunakan langsung dari web browser tanpa instalasi.")

    # ── BAB 3: SPESIFIKASI TEKNIS & KEBUTUHAN SISTEM ───────────────────────────
    add_heading_1("BAB 3: SPESIFIKASI TEKNIS DAN ARSITEKTUR PERANGKAT LUNAK")
    add_body("Cakrapala dibangun menggunakan standar rekayasa perangkat lunak modern tingkat tinggi:")
    add_bullet("TypeScript 5.x dan ECMAScript 2024 (JavaScript modern).", "Bahasa Pemrograman: ")
    add_bullet("Next.js 16 (React 19 Server/Client Components) dengan styling Tailwind CSS.", "Framework Web: ")
    add_bullet("Three.js (WebGL 2.0 Shader Engine) dan CesiumJS untuk komputasi spasial 3D bola dunia.", "Engine Grafis 3D: ")
    add_bullet("satellite.js (SGP4/SDP4 Perturbation Model) dan Keplerian Orbital Elements J2000.0.", "Algoritma Astrodinamika: ")
    add_bullet("NASA JPL NeoWs (Near-Earth Object Web Service), Space-Track TLE, Yale Bright Star Catalog (BSC5).", "Sumber Data Eksternal: ")
    add_body("Kebutuhan Sistem Pengguna:", bold_prefix="Spesifikasi Kebutuhan Sistem: ")
    add_bullet("Komputer/Laptop/Tablet/Smartphone dengan koneksi internet aktif minimal 2 Mbps.")
    add_bullet("Peramban web modern yang mendukung WebGL (Google Chrome, Mozilla Firefox, Apple Safari, Microsoft Edge).")
    add_bullet("Memori RAM minimal 4 GB (disarankan 8 GB untuk simulasi 3D 60 FPS optimal).")

    # ── BAB 4: PANDUAN AKSES DARING (CAKRAPALA.COM) ───────────────────────────
    add_heading_1("BAB 4: PANDUAN AKSES LAYANAN APLIKASI SECARA DARING (CAKRAPALA.COM)")
    add_body("Program komputer Cakrapala dirilis dengan arsitektur cloud Zero-Installation (Software-as-a-Service). Pengguna maupun tim pemeriksa substantif DJKI tidak diwajibkan menginstal perangkat lunak atau plugin tambahan apapun.")
    add_bullet("Pastikan komputer, laptop, atau perangkat pintar telah menyala dan terhubung ke internet.", "Langkah 1 (Konektivitas): ")
    add_bullet("Jalankan salah satu aplikasi peramban web modern (Google Chrome, Firefox, Safari, atau Edge).", "Langkah 2 (Buka Browser): ")
    add_bullet("Ketikkan alamat resmi: https://cakrapala.com pada bilah alamat (address bar) browser, lalu tekan tombol Enter.", "Langkah 3 (Akses URL): ")
    add_bullet("Sistem secara otomatis memuat kokpit antariksa 3D, shader atmosfer LEO, rotasi bola Bumi vertikal, dan simulasi Bima Sakti secara instan.", "Langkah 4 (Inisialisasi Otomatis): ")

    doc.add_page_break()

    # ── BAB 5: PANDUAN LENGKAP SEMUA MENU BESERTA SCREENSHOT ───────────────────
    add_heading_1("BAB 5: PANDUAN LENGKAP PENGOPERASIAN SEMUA MENU BESERTA TAMPILAN SCREENSHOT")
    add_body("Aplikasi Cakrapala memiliki 8 modul antarmuka utama yang saling terhubung. Setiap modul dilengkapi screenshot tampilan nyata antarmuka, penjelasan elemen fungsi, serta panduan operasional langkah demi langkah:")

    # 5.1 LANDING PAGE
    add_heading_2("5.1. Modul 1: Landing Page & Kokpit Dirgantara LEO (Overview Deck — '/')")
    add_body("Modul ini merupakan gerbang utama aplikasi yang menyajikan pemandangan LEO (Low Earth Orbit) beresolusi tinggi langsung dari jendela observasi wahana ruang angkasa.")
    add_screenshot("docs/screenshots/landing.png", "Gambar 5.1: Tampilan Nyata Landing Page & Kokpit Dirgantara LEO (cakrapala.com)")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Terletak di bagian atas layar desktop berupa rel melengkung matematis (parabola sag) yang menempatkan stasiun navigasi (Solar System, Sky Map, Asteroid Radar, Satellite, dan Space Codex). Stasiun aktif disorot dengan pendaran warna cyan laser.", "1. Curved NavbarArc:")
    add_bullet("Simulasi 3D fotorealistik bola dunia yang bergerak berputar vertikal ke bawah, mensimulasikan laju maju wahana antariksa mengelilingi Bumi. Latar belakang menampilkan galaksi Bima Sakti dengan kemiringan diagonal estetik (~30°).", "2. Viewport 3D Bumi LEO & Bima Sakti:")
    add_bullet("Menampilkan logo resmi Cakrapala serta deskripsi kapabilitas: 'Orbital mechanics, planetary defense & astrometry · computed from first principles'.", "3. Banner Identitas & Tagline:")
    add_bullet("Tombol futuristik dengan retikel sudut aktif yang memicu terbukanya jendela dialog asisten kecerdasan buatan.", "4. Launcher SYS-AI // NEURAL LINK:")
    add_bullet("Bilah kaca transparan melayang di dasar layar yang menyajikan data primer telemetri ISS dari API: Status (SYS-LIVE), Jam UTC, Ketinggian Orbit (ALT ~439 KM), Kecepatan Laju (VEL 27.528 KM/H), Sudut Inklinasi (INC 51.64°), Periode Orbit (92.68 MIN), dan Koordinat Nadir Bumi.", "5. Bilah Telemetri Waktu Nyata (Bottom Telemetry Strip):")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Buka URL https://cakrapala.com pada browser. Layar secara otomatis memuat kokpit Bumi LEO berotasi penuh.", "Langkah 1: ")
    add_bullet("Amati bilah telemetri di bagian bawah layar untuk memantau data posisi dan kecepatan aktual ISS yang diperbarui setiap detik.", "Langkah 2: ")
    add_bullet("Arahkan kursor tetikus ke bilah navigasi lengkung di bagian atas untuk memilih modul eksplorasi yang ingin dituju.", "Langkah 3: ")
    add_bullet("Klik tombol 'LAUNCH TERMINAL' di tengah layar untuk membuka dialog asisten kecerdasan buatan SYS-AI.", "Langkah 4: ")

    # 5.2 SYS-AI TERMINAL
    add_heading_2("5.2. Modul 2: Asisten AI Antariksa (SYS-AI Astro-Terminal Modal)")
    add_body("Modul asisten kecerdasan buatan interaktif yang bertindak sebagai Flight Director & Planetary Defense Intelligence Unit untuk konsultasi astrofisika dan mekanika orbital.")
    add_screenshot("docs/screenshots/ai_terminal.png", "Gambar 5.2: Tampilan Nyata Asisten AI Antariksa (SYS-AI Astro-Terminal Modal)")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Bingkai terminal CRT sci-fi retro-futuristik dengan efek scanlines, indikator status [NODE ONLINE], serta tombol kontrol TTS (Text-to-Speech), Reset Session Buffer, Maximize Screen, dan Close Window.", "1. Header Kontrol Terminal:")
    add_bullet("Tombol pintasan cepat di bawah judul terminal untuk menanyakan skenario astrodinamika populer secara instan (> /mission-planning, > /asteroid-defense, > /iss-telemetry, > /planetarium-stars, > /jwst-lagrange).", "2. Bilah Perintah Cepat (Quick Chips):")
    add_bullet("Area output riwayat percakapan yang menyajikan teks jawaban dengan animasi mesin ketik (typewriter effect), pemformatan Markdown matematis, tombol salin ke clipboard, dan tombol pemutar suara TTS.", "3. Konsol Dialog Percakapan:")
    add_bullet("Bilah masukan baris perintah interaktif dengan prompt format shell Linux kedirgantaraan ($ CAKRAPALA:~$) lengkap dengan tombol 'SEND' dan deteksi otomatis bahasa Indonesia/Inggris.", "4. Input Box Command Line:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik tombol 'LAUNCH TERMINAL' pada landing page atau logo Cakrapala pada bilah navigasi atas.", "Langkah 1: ")
    add_bullet("Klik salah satu chip perintah cepat (misal '> /asteroid-defense') atau ketik pertanyaan langsung pada kotak teks (misal: 'Jelaskan bagaimana ISS tidak jatuh ke Bumi').", "Langkah 2: ")
    add_bullet("Tekan tombol Enter atau klik 'SEND'. Sistem AI akan menganalisis pertanyaan dan mengetikkan jawaban ilmiah secara real-time.", "Langkah 3: ")
    add_bullet("Klik tombol ikon pengeras suara di samping pesan jika ingin mendengarkan pembacaan suara audio TTS, atau tombol salin untuk menyalin teks penjelasan.", "Langkah 4: ")

    # 5.3 SOLAR SYSTEM
    add_heading_2("5.3. Modul 3: Simulator Tata Surya 3D (Planetary Orrery — '/solar-system')")
    add_body("Modul orrery tata surya 3D matematis yang memodelkan pergerakan revolusi heliosentris Matahari dan delapan planet utama berdasarkan mekanika orbital Keplerian.")
    add_screenshot("docs/screenshots/solar_system.png", "Gambar 5.3: Tampilan Nyata Modul Tata Surya 3D (Planetary Orrery Helosentris)")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Kanvas 3D WebGL Three.js yang menampilkan Matahari bercahaya menyilaukan di pusat sistem, lintasan elips orbit planet, ribuan partikel sabuk asteroid (Main Asteroid Belt) di antara Mars dan Jupiter, serta tekstur fotorealistik setiap planet.", "1. Viewport 3D Heliosentris:")
    add_bullet("Daftar benda langit di sisi kiri (Matahari, Merkurius, Venus, Bumi, Mars, Jupiter, Saturnus dengan cincin, Uranus, Neptunus) lengkap dengan jarak rata-rata Astronomical Unit (AU).", "2. Panel Daftar Benda Langit (Celestial Bodies):")
    add_bullet("Bilah di bagian bawah untuk mengatur percepatan waktu revolusi (Speed: 0.25x, 0.5x, 1x, 2x, 5x, 10x), tombol jeda (PAUSE/PLAY), toggle penampil garis orbit (ORBITS), penampil label nama (LABELS), dan reset sudut pandang kamera (RESET CAM).", "3. Bilah Kontrol Waktu & Visual:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik menu 'SOLAR SYSTEM' pada bilah navigasi utama atau akses https://cakrapala.com/solar-system.", "Langkah 1: ")
    add_bullet("Klik kiri dan tahan pada area kanvas, lalu geser kursor tetikus untuk merotasi sudut pandang kamera 3D ke segala arah. Gunakan roda tetikus (scroll wheel) untuk zoom-in atau zoom-out.", "Langkah 2: ")
    add_bullet("Klik salah satu nama planet pada daftar kiri (atau klik objek planet di kanvas) untuk mengunci bidikan kamera ke planet tersebut.", "Langkah 3: ")
    add_bullet("Pilih percepatan waktu (misal 5x atau 10x) untuk melihat gerak peredaran revolusi planet secara dinamis mengitari Matahari.", "Langkah 4: ")

    # 5.4 SKY MAP
    add_heading_2("5.4. Modul 4: Peta Langit & Planetarium Toposentrik (Sky Map — '/sky')")
    add_body("Modul observatorium langit toposentrik berbasis darat yang menyajikan proyeksi posisi benda langit akurat sesuai garis lintang dan bujur pengamat di permukaan Bumi.")
    add_screenshot("docs/screenshots/sky_map.png", "Gambar 5.4: Tampilan Nyata Modul Peta Langit & Radar Toposentrik WGS-84")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Peta proyeksi bola dunia datar interaktif yang menampilkan kurva batas siang dan malam (Day/Night Terminator) waktu nyata, posisi titik zenith Matahari (Daylight Zenith), dan target stasiun observasi aktif.", "1. Radar Toposentrik WGS-84:")
    add_bullet("Panel status di sebelah kanan yang memuat nama stasiun (misal: Bogor Indonesia 6.5950° S, 106.8166° E), waktu lokal stasiun, status visibilitas atmosfer (DAYLIGHT / NIGHT), serta sudut elevasi dan azimuth Matahari.", "2. Kartu Stasiun Observasi:")
    add_bullet("Katalog stasiun di bagian bawah layar untuk berpindah observasi dengan 1 klik: Observatorium Bosscha Lembang, Planetarium Jakarta, Mauna Kea Hawaii, Paranal VLT Chili, Roque de los Muchachos Spanyol, Tokyo, dan London Greenwich.", "3. Tombol Stasiun Global & Metropolis:")
    add_bullet("Tombol utama 'ENTER 3D SKY DOME OBSERVATORY' untuk masuk ke dalam kubah langit malam 3D yang memproyeksikan 2.800+ bintang nyata Yale BSC5 dan garis 89 rasi bintang IAU.", "4. Peluncur Kubah Langit 3D:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik menu 'SKY MAP' pada bilah navigasi utama atau akses https://cakrapala.com/sky.", "Langkah 1: ")
    add_bullet("Pilih stasiun pengamatan yang diinginkan pada daftar di bagian bawah (misal 'Bogor (Bosscha Sector)').", "Langkah 2: ")
    add_bullet("Periksa kartu stasiun di panel kanan untuk mengetahui apakah lokasi saat ini berada dalam zona siang (Daylight) atau malam (Night Sky).", "Langkah 3: ")
    add_bullet("Klik tombol biru cerah 'ENTER 3D SKY DOME OBSERVATORY' untuk mengamati bintang dan konstelasi rasi IAU secara virtual dari sudut pandang lokasi tersebut.", "Langkah 4: ")

    # 5.5 ASTEROID RADAR
    add_heading_2("5.5. Modul 5: Radar Asteroid & Pertahanan Planet (NEO Radar — '/explore')")
    add_body("Modul pusat pemantauan asteroid dekat Bumi (Near-Earth Object / NEO) yang terhubung langsung dengan basis data telemetri primer NASA Jet Propulsion Laboratory (JPL).")
    add_screenshot("docs/screenshots/asteroid_radar.png", "Gambar 5.5: Tampilan Nyata Modul Radar Asteroid & Pertahanan Planet NASA JPL")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Visualisasi ruang angkasa 3D yang menampilkan model fisik asteroid bertekstur kawah, garis trajektori lintasannya, dan retikel pelacak otomatis yang mengunci target.", "1. Viewport Radar 3D Interaktif:")
    add_bullet("Tabel di panel kanan yang memuat daftar asteroid mendekati Bumi pada tanggal terpilih (ID Asteroid, Jarak dalam Satuan Lunar Distance / LD, Estimasi Diameter meter, Kecepatan km/jam, dan Label Keamanan SAFE / PHA).", "2. NEO Ephemeris Deck:")
    add_bullet("Bilah skala perbandingan fisik di dasar layar yang menyandingkan rentang ukuran asteroid terhadap bangunan ikonik dunia nyata: Bus Kota (12m), Patung Liberty (76m), Stadion GBK (105m), Monas Jakarta (132m), Menara Eiffel (330m), Empire State (443m), dan Burj Khalifa (828m).", "3. Penggaris Ketidakpastian Diameter (Diameter Uncertainty Ruler):")
    add_bullet("Menampilkan status pertahanan planet (NOMINAL), jumlah objek terlacak, status PHA (Potentially Hazardous Asteroid), dan skor Skala Bahaya Torino (Torino Scale).", "4. Bilah Status Pertahanan Planet (Planetary Defense Header):")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik menu 'ASTEROID RADAR' pada bilah navigasi atau akses https://cakrapala.com/explore.", "Langkah 1: ")
    add_bullet("Gunakan pemilih tanggal (date picker) pada panel kanan untuk melihat daftar asteroid yang berpapasan pada tanggal tertentu.", "Langkah 2: ")
    add_bullet("Klik tombol 'DETAIL' atau baris salah satu asteroid pada tabel (misal: '2016 HF2') untuk mengarahkan radar 3D ke objek tersebut.", "Langkah 3: ")
    add_bullet("Amati penggaris skala di bagian bawah untuk melihat apakah ukuran asteroid tersebut sebanding dengan Monas, Stadion GBK, atau Menara Eiffel.", "Langkah 4: ")

    # 5.6 SATELLITE FLEET (2D/3D TRACKER)
    add_heading_2("5.6. Modul 6: Pelacak Satelit & ISS Waktu Nyata (Satellite Operations — '/iss')")
    add_body("Modul pemantauan telemetri posisi Stasiun Luar Angkasa Internasional (ISS) dan wahana antariksa menggunakan model propagasi matematis orbit SGP4.")
    add_screenshot("docs/screenshots/satellite_fleet.png", "Gambar 5.6: Tampilan Nyata Modul Pelacak Satelit & Lintasan Sinusoidal ISS")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Peta proyeksi silindris dunia yang menampilkan kurva sinusoidal orbit ISS: lintasan yang baru dilewati (warna hijau - Past Pass) dan lintasan yang akan dituju pada orbit berikutnya (warna oranye - Next Pass).", "1. Peta Lintasan Sinusoidal 2D (Ground Track):")
    add_bullet("Ikon wahana ISS fotorealistik dengan panel surya yang bergerak secara dinamis sesuai koordinat garis bujur (Longitude) dan garis lintang (Latitude) nadir saat ini.", "2. Ikon Wahana ISS & Titik Nadir:")
    add_bullet("Badge angka waktu nyata yang menunjukkan: Longitude (57.29°), Latitude (-49.44°), Ketinggian Altitude (439.47 km), dan Kecepatan Orbital (27.527 km/jam).", "3. Indikator Telemetri Presisi:")
    add_bullet("Menampilkan kalkulasi jarak garis lurus (great-circle distance) dari koordinat tempat tinggal pengguna ke posisi ISS saat ini (misal: '6.660 km from you').", "4. Komputasi Jarak Pengamat:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik menu 'SATELLITE' pada bilah navigasi atau buka https://cakrapala.com/iss.", "Langkah 1: ")
    add_bullet("Amati pergerakan ikon ISS pada peta lintasan sinusoidal ground track.", "Langkah 2: ")
    add_bullet("Gunakan tombol pengalih '2D MAP' / '3D GLOBE' untuk mengubah visualisasi menjadi bola bumi 3D jika diinginkan.", "Langkah 3: ")
    add_bullet("Catat badge kecepatan laju ISS (~27.500 km/jam) yang menunjukkan wahana mengelilingi Bumi satu putaran penuh setiap ~92 menit.", "Langkah 4: ")

    # 5.7 SATELLITE CATALOG (1,000+ SATELLITES)
    add_heading_2("5.7. Modul 7: Konsol Konstelasi 1.000+ Satelit Orbit Bumi (Orbital Catalog — '/iss/catalog')")
    add_body("Modul komputasi skala besar yang memvisualisasikan lebih dari 1.000 satelit aktif mengelilingi Bumi secara serentak menggunakan mesin propagasi SGP4 WebGL.")
    add_screenshot("docs/screenshots/satellite_catalog.png", "Gambar 5.7: Tampilan Nyata Konsol Konstelasi 1.000+ Satelit Aktif Orbit Bumi")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Simulasi 3D bola dunia Bumi yang dikelilingi ribuan titik partikel satelit aktif yang bergerak pada orbit masing-masing secara real-time.", "1. Globe 3D Konstelasi Satelit:")
    add_bullet("Tombol penyaring sabuk orbit: LEO (< 2.000 km, 680 satelit), MEO / GNSS (159 satelit navigasi seperti GPS/Galileo), dan GEO Belt (161 satelit geostasioner pada ketinggian 35.786 km).", "2. Tab Kategori Sabuk Ketinggian (Regime Filter):")
    add_bullet("Pintasan untuk memutar sudut kamera ke zona strategis dunia (Global 3D, Polar Rings, Geo Belt, Asia-Pacific, Americas, Europe).", "3. Filter Wilayah Geografis:")
    add_bullet("Kolom pencarian untuk mencari satelit spesifik berdasarkan nama wahana atau nomor katalog NORAD ID (misal: Hubble, Starlink, Tiangong, NOAA).", "4. Bilah Pencarian Satelit:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Pada halaman satelit, klik tab 'ORBITAL CATALOG' di sudut atas atau akses https://cakrapala.com/iss/catalog.", "Langkah 1: ")
    add_bullet("Klik tab 'LEO' untuk mengamati kepadatan konstelasi orbit rendah bumi, atau klik 'GEO BELT' untuk melihat cincin satelit geostasioner khatulistiwa.", "Langkah 2: ")
    add_bullet("Gunakan tombol 'ASIA-PACIFIC' untuk memusatkan kamera ke atas wilayah kepulauan Indonesia dan Asia Tenggara.", "Langkah 3: ")
    add_bullet("Ketikkan kata kunci (misal 'Starlink') pada kotak pencarian untuk melihat sebaran konstelasi megasatelit internet.", "Langkah 4: ")

    # 5.8 SPACE CODEX
    add_heading_2("5.8. Modul 8: Ensiklopedia Antariksa & Almanak Astrofisika (Space Codex — '/codex')")
    add_body("Perpustakaan digital interaktif yang menyajikan dokumentasi ilmiah konsep astrofisika, mekanika orbital, skala bahaya antariksa, dan glosarium bersertifikasi IAU.")
    add_screenshot("docs/screenshots/space_codex.png", "Gambar 5.8: Tampilan Nyata Ensiklopedia Antariksa (The Universal Space Codex)")
    add_heading_3("A. Penjelasan Elemen Antarmuka (UI Breakdown):")
    add_bullet("Bilah pencarian cepat bersimbol kaca pembesar untuk menemukan istilah astronomi, persamaan rumus, satelit, atau fenomena kosmik secara instan.", "1. Mesin Pencari Ensiklopedia:")
    add_bullet("Banner sorotan di bagian atas yang menyajikan konsep metrik astronomi penting lengkap dengan formulasi matematika LaTeX (misal: Palermo Technical Impact Hazard Scale untuk kalkulasi risiko asteroid).", "2. Kartu Metrik Antariksa Terpilih (Featured Celestial Metric):")
    add_bullet("Tombol penyaring artikel berdasarkan disiplin ilmu: Semua Topik (All Domains), Astrofisika (Astrophysics), Ilmu Planet (Planetary), Astrometri (Astrometry), Penerbangan Luar Angkasa (Spaceflight), dan Evolusi Bintang (Stellar).", "3. Tab Domain Sains:")
    add_bullet("Koleksi kartu glosarium (seperti Astronomical Unit, Parsec, Light-Year, Escape Velocity) yang dilengkapi tombol 'ASK SYS-AI' untuk berdiskusi langsung dengan asisten AI mengenai istilah tersebut.", "4. Kartu Glosarium & Integrasi AI:")
    add_heading_3("B. Panduan Langkah Pengoperasian:")
    add_bullet("Klik menu 'SPACE CODEX' pada bilah navigasi atau buka https://cakrapala.com/codex.", "Langkah 1: ")
    add_bullet("Pilih domain sains yang diminati (misal 'Astrophysics') atau ketikkan istilah pada kolom pencarian.", "Langkah 2: ")
    add_bullet("Klik kartu istilah yang ingin dipelajari (misal: 'Astronomical Unit (AU)') untuk membaca definisi baku, rumus konversi, dan contoh penerapannya dalam tata surya.", "Langkah 3: ")
    add_bullet("Klik tombol 'ASK SYS-AI' pada artikel jika ingin mengajukan pertanyaan pendalaman ilmiah kepada asisten AI.", "Langkah 4: ")

    doc.add_page_break()

    # ── BAB 6: LAMPIRAN CONTOH SOURCE CODE PROGRAM ───────────────────────────
    add_heading_1("BAB 6: LAMPIRAN CONTOH KODE SUMBER PROGRAM (SOURCE CODE SAMPLE)")
    add_body("Sebagai pemenuhan persyaratan formal pemeriksaan substantif Program Komputer pada DJKI Kemenkumham RI, berikut dilampirkan potongan kode program inti (source code) yang membuktikan keaslian ciptaan dan logika komputasi grafis 3D:")

    add_heading_2("6.1. Logika Trajektori Parabola Lengkung Navbar (components/landing/NavbarArc.tsx)")
    p_code1 = doc.add_paragraph()
    p_code1.paragraph_format.line_spacing = 1.0
    p_code1.paragraph_format.space_after = Pt(8)
    r_c1 = p_code1.add_run(
        "// File: components/landing/NavbarArc.tsx\n"
        "const VB_W = 1600;\n"
        "const VB_H = 124;\n"
        "const CX = VB_W / 2;\n"
        "const Y_WING = 46;\n"
        "const SAG = 28;\n\n"
        "// Menghitung posisi koordinat Y lengkungan parabola rel navigasi\n"
        "function getArcY(x: number): number {\n"
        "    const u = (x - CX) / (CX - 60);\n"
        "    return Y_WING + SAG * (1 - u * u);\n"
        "}\n\n"
        "// Menghitung sudut kemiringan (tilt) taktis tombol navigasi selaras kelengkungan\n"
        "function getTiltDeg(x: number): number {\n"
        "    const u = (x - CX) / (CX - 60);\n"
        "    const slope = (-2 * SAG * u) / (CX - 60);\n"
        "    const deg = Math.atan(slope) * (180 / Math.PI) * 0.75;\n"
        "    return Math.max(-4.5, Math.min(4.5, deg));\n"
        "}"
    )
    r_c1.font.name = "Courier New"
    r_c1.font.size = Pt(8.5)
    r_c1.font.color.rgb = RGBColor(30, 41, 59)

    add_heading_2("6.2. Logika Animasi Bola Langit Bima Sakti & Rotasi Bumi (CommandCenterGlobe.tsx)")
    p_code2 = doc.add_paragraph()
    p_code2.paragraph_format.line_spacing = 1.0
    p_code2.paragraph_format.space_after = Pt(8)
    r_c2 = p_code2.add_run(
        "// File: components/landing/CommandCenterGlobe.tsx\n"
        "const celestialGroup = new THREE.Group();\n"
        "scene.add(celestialGroup);\n\n"
        "// Konfigurasi sudut kemiringan diagonal Bima Sakti (~30 derajat) yang estetik\n"
        "skyDome.rotation.x = full ? 0.08 : 0.35;\n"
        "skyDome.rotation.y = full ? -0.42 : -1.1;\n"
        "skyDome.rotation.z = full ? -0.52 : 0.0;\n"
        "skyDome.scale.x = -1;\n\n"
        "celestialGroup.add(skyDome);\n"
        "celestialGroup.add(stars);\n\n"
        "// Loop animasi pergerakan vertikal sinkron wahana LEO dan latar belakang langit\n"
        "const animate = () => {\n"
        "    animId = requestAnimationFrame(animate);\n"
        "    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);\n"
        "    lastFrameMs = nowMs;\n"
        "    spinAngle += SPIN_RATE_RAD_S * dt;\n"
        "    if (full) {\n"
        "        orbitPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);\n"
        "        cloudPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);\n"
        "        celestialGroup.rotation.x -= 0.0006 * dt;\n"
        "    }\n"
        "    renderer.render(scene, camera);\n"
        "};"
    )
    r_c2.font.name = "Courier New"
    r_c2.font.size = Pt(8.5)
    r_c2.font.color.rgb = RGBColor(30, 41, 59)

    # ── BAB 7: TATA CARA PENDAFTARAN RESMI DJKI ───────────────────────────────
    add_heading_1("BAB 7: PANDUAN TEKNIS PENDAFTARAN HAK CIPTA DI PORTAL POP HAK CIPTA DJKI")
    add_body("Berikut adalah alur pendaftaran mandiri secara online melalui sistem Persetujuan Otomatis Pelayanan Hak Cipta (POP Hak Cipta) Direktorat Jenderal Kekayaan Intelektual:")
    add_bullet("Akses peramban web dan buka situs resmi: https://e-hakcipta.dgip.go.id/ lalu masuk (login) menggunakan akun pemohon.", "Langkah 1 (Akses Portal DJKI): ")
    add_bullet("Pada dashboard utama, pilih menu 'Permohonan Baru'.", "Langkah 2 (Mulai Permohonan): ")
    add_bullet("Pilih Jenis Permohonan ('Umum' atau 'Usaha Mikro/Kecil/Pendidikan'). Pada kolom Jenis Ciptaan, pilih 'Program Komputer'. Pada Sub-Jenis Ciptaan, pilih 'Program Komputer'.", "Langkah 3 (Kategori Ciptaan): ")
    add_bullet("Isi data judul: 'Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot'. Masukkan URL resmi https://cakrapala.com pada uraian ciptaan.", "Langkah 4 (Pengisian Judul & Uraian): ")
    add_bullet("Masukkan tanggal pertama kali diumumkan beserta nama kota tempat pengumuman di wilayah Indonesia.", "Langkah 5 (Tanggal & Tempat Pengumuman): ")
    add_bullet("Unggah berkas Buku Panduan Manual ini (disimpan ke format .pdf), lampiran contoh source code (.pdf), scan KTP Pencipta/Pemegang Hak Cipta, dan Surat Pernyataan Hak Cipta bermeterai Rp 10.000.", "Langkah 6 (Unggah Lampiran Persyaratan): ")
    add_bullet("Lakukan pembayaran Penerimaan Negara Bukan Pajak (PNBP) ke kas negara menggunakan kode billing SIMPONI melalui ATM, Internet Banking, atau Teller Bank.", "Langkah 7 (Pembayaran Billing SIMPONI): ")
    add_bullet("Setelah pembayaran terkonfirmasi oleh sistem SIMPONI Kemenkeu, Surat Pencatatan Ciptaan resmi ber-QR Code dari Kemenkumham RI akan diterbitkan secara otomatis dan dapat langsung diunduh.", "Langkah 8 (Penerbitan Sertifikat HAKI): ")

    doc.add_paragraph().paragraph_format.space_after = Pt(16)
    p_close = doc.add_paragraph()
    p_close.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_close = p_close.add_run("— DOKUMEN RESMI BUKU PANDUAN PROGRAM KOMPUTER CAKRAPALA —\nDIREKTORAT JENDERAL KEKAYAAN INTELEKTUAL (DJKI) KEMENKUMHAM REPUBLIK INDONESIA")
    r_close.font.size = Pt(9.5)
    r_close.font.bold = True
    r_close.font.color.rgb = COLOR_MUTED

    # Save outputs
    out_docx = "docs/MANUAL_BOOK_CAKRAPALA.docx"
    out_doc = "docs/MANUAL_BOOK_CAKRAPALA.doc"
    doc.save(out_docx)
    shutil.copyfile(out_docx, out_doc)
    print(f"Generated: {out_docx} and {out_doc}")

    # Also update BUKU_PANDUAN_HAKI_CAKRAPALA to have the exact same rich contents
    shutil.copyfile(out_docx, "docs/BUKU_PANDUAN_HAKI_CAKRAPALA.docx")
    shutil.copyfile(out_doc, "docs/BUKU_PANDUAN_HAKI_CAKRAPALA.doc")
    print("Also updated docs/BUKU_PANDUAN_HAKI_CAKRAPALA.docx and .doc")

if __name__ == "__main__":
    generate_manual()
