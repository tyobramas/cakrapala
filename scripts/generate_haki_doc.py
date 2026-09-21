import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
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

def create_document():
    doc = docx.Document()

    # Set Margins (1 inch all sides)
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Palette
    COLOR_PRIMARY = RGBColor(14, 116, 144)    # Cyan / Dark Teal #0e7490
    COLOR_SECONDARY = RGBColor(30, 41, 59)   # Slate 800
    COLOR_TEXT = RGBColor(15, 23, 42)        # Slate 900
    COLOR_MUTED = RGBColor(71, 85, 105)      # Slate 600

    # ── COVER / TITLE ──────────────────────────────────────────────────────────
    p_pre = doc.add_paragraph()
    p_pre.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_pre = p_pre.add_run("KEMENTERIAN HUKUM DAN HAM REPUBLIK INDONESIA\nDIREKTORAT JENDERAL KEKAYAAN INTELEKTUAL (DJKI)\n")
    r_pre.font.size = Pt(11)
    r_pre.font.bold = True
    r_pre.font.color.rgb = COLOR_MUTED

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_title = p_title.add_run("BUKU PANDUAN PENGGUNAAN PROGRAM KOMPUTER\nDAN URAIAN CIPTAAN")
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("CAKRAPALA — DEEP SPACE OBSERVATORY & ASTRO-AI CO-PILOT\n")
    r_sub.font.size = Pt(14)
    r_sub.font.bold = True
    r_sub.font.color.rgb = COLOR_SECONDARY
    r_sub2 = p_sub.add_run("Platform Observatorium Digital, Astrometri Toposentrik, dan Radar Pertahanan Planet Berbasis Web 3D (cakrapala.com)")
    r_sub2.font.size = Pt(11)
    r_sub2.font.italic = True
    r_sub2.font.color.rgb = COLOR_MUTED

    doc.add_paragraph().paragraph_format.space_after = Pt(20)

    # ── METADATA BOX TABLE ───────────────────────────────────────────────────
    meta_table = doc.add_table(rows=7, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Judul Ciptaan", "Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot"),
        ("Jenis Ciptaan", "Program Komputer (Aplikasi Web / Software-as-a-Service)"),
        ("Tautan Akses Resmi (URL)", "https://cakrapala.com"),
        ("Bahasa Pemrograman", "TypeScript, JavaScript (ES2024), GLSL (OpenGL Shading Language)"),
        ("Framework & Engine", "Next.js (React 19), Three.js (WebGL), Tailwind CSS, CesiumJS"),
        ("Tahun Pertama Diumumkan", "2026"),
        ("Negara Pertama Diumumkan", "Indonesia"),
    ]
    for i, (label, val) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.3)
        c1.width = Inches(4.2)
        set_cell_background(c0, "F1F5F9")
        set_cell_background(c1, "F8FAFC")
        set_cell_margins(c0, 100, 100, 120, 120)
        set_cell_margins(c1, 100, 100, 120, 120)

        p0 = c0.paragraphs[0]
        r0 = p0.add_run(label)
        r0.font.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = COLOR_SECONDARY

        p1 = c1.paragraphs[0]
        r1 = p1.add_run(val)
        r1.font.size = Pt(10)
        r1.font.color.rgb = COLOR_TEXT

    doc.add_page_break()

    # ── HELPER FUNCTIONS ─────────────────────────────────────────────────────
    def add_heading_1(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(16)
        h.paragraph_format.space_after = Pt(6)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = COLOR_PRIMARY
        return h

    def add_heading_2(text):
        h = doc.add_paragraph()
        h.paragraph_format.space_before = Pt(12)
        h.paragraph_format.space_after = Pt(4)
        h.paragraph_format.keep_with_next = True
        r = h.add_run(text)
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = COLOR_SECONDARY
        return h

    def add_body(text, bold_prefix=None, space_after=6):
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.15
        if bold_prefix:
            r_pre = p.add_run(bold_prefix)
            r_pre.font.bold = True
            r_pre.font.size = Pt(10.5)
            r_pre.font.color.rgb = COLOR_TEXT
        r = p.add_run(text)
        r.font.size = Pt(10.5)
        r.font.color.rgb = COLOR_TEXT
        return p

    def add_bullet(text, bold_prefix=None):
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
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

    # ── BAB 1: IDENTITAS CIPTAAN & PENCIPTA ────────────────────────────────────
    add_heading_1("BAB 1: IDENTITAS DAN INFORMASI UMUM CIPTAAN")
    add_body("Dokumen ini disusun sebagai petunjuk teknis operasional (Buku Panduan Manual Program Komputer) dan dokumen Uraian Ciptaan dalam rangka permohonan pendaftaran Hak Cipta atas Program Komputer pada Direktorat Jenderal Kekayaan Intelektual (DJKI), Kementerian Hukum dan Hak Asasi Manusia Republik Indonesia.")
    add_body("Cakrapala adalah karya cipta perangkat lunak berwujud program komputer berbasis web (Web-Based Application) yang diakses secara daring melalui alamat resmi https://cakrapala.com. Program ini mengintegrasikan komputasi astrodinamika, visualisasi spasial 3D fotorealistik, propagasi orbit satelit SGP4, radar benda dekat bumi (Near-Earth Object), serta asisten kecerdasan buatan dalam satu ekosistem terpadu.")

    # ── BAB 2: LATAR BELAKANG PENCIPTAAN ──────────────────────────────────────
    add_heading_1("BAB 2: LATAR BELAKANG PENCIPTAAN (BACKGROUND)")
    add_body("Eksplorasi antariksa dan pemahaman benda langit adalah pilar kemajuan sains dan teknologi peradaban modern. Namun, dalam ekosistem sains dan pendidikan di Indonesia saat ini, terdapat kesenjangan yang sangat besar antara ketersediaan data astronomi ilmiah tingkat tinggi dengan pemahaman masyarakat luas.")
    add_body("Latar belakang terciptanya perangkat lunak Cakrapala berakar pada tiga permasalahan fundamental yang diidentifikasi di lapangan:")
    
    add_bullet(" Sering kali media daring mempublikasikan berita bertajuk ancaman asteroid menabrak Bumi dengan judul sensasional yang tidak didukung data proporsional. Tanpa adanya instrumen radar primer yang transparan dan mudah diakses publik, masyarakat rentan mengalami kecemasan dan kepanikan akibat informasi keliru.", "1. Sensasionalisme Berita dan Hoaks Asteroid:")
    add_bullet(" Badan antariksa internasional seperti NASA JPL dan US Space Command (NORAD) membuka data ephemeris dan TLE satelit secara gratis. Namun, format data yang disajikan berupa tabel koordinat Keplerian dan deret angka TLE (Two-Line Element) yang sangat abstrak dan sulit dipahami tanpa latar belakang keilmuan astrofisika.", "2. Kompleksitas Data Koordinat Ephemeris Mentah:")
    add_bullet(" Sebagian besar perangkat lunak astronomi yang ada di pasar bersifat terpisah-pisah: hanya aplikasi peta bintang 2D sederhana, atau kalkulator orbit terisolasi. Tidak ada sistem kokpit dirgantara terintegrasi yang mampu menyatukan sudut pandang orbit rendah bumi (LEO), tata surya heliosentris, peta bintang toposentrik lokal, dan radar ancaman asteroid secara harmonis.", "3. Ketiadaan Platform Terintegrasi Multi-Skala:")

    # ── BAB 3: DESKRIPSI DAN TUJUAN INOVASI ───────────────────────────────────
    add_heading_1("BAB 3: DESKRIPSI UMUM DAN TUJUAN INOVASI CIPTAAN")
    add_body("Cakrapala memecahkan seluruh kendala di atas dengan menghadirkan kokpit luar angkasa digital terpadu berbasis web. Program ini dirancang dengan prinsip keterbukaan data, akurasi fisika komputasional, serta antarmuka intuitif yang mengedukasi.")
    add_body("Tujuan inovasi dari program komputer Cakrapala mencakup:", bold_prefix="Tujuan Utama Inovasi: ")
    add_bullet("Menghadirkan simulasi visualisasi 3D matematis real-time berbasis WebGL/Three.js yang ringan dan dapat diakses langsung melalui peramban web tanpa memerlukan instalasi rumit.")
    add_bullet("Menghitung propagasi lintasan orbit satelit ISS dan ribuan satelit buatan secara presisi menggunakan model matematika SGP4/SDP4 standar astrodinamika internasional.")
    add_bullet("Mendemokratisasi data bahaya asteroid NASA NeoWs dengan menyediakan radar interaktif cincin jarak Bulan (Lunar Distance) dan analogi ukuran fisik nyata (Monas, Menara Eiffel, Stadion GBK).")
    add_bullet("Menyediakan asisten kecerdasan buatan (SYS-AI Astro-Terminal) sebagai sarana konsultasi interaktif konsep astrofisika dan mekanika orbital bagi siswa, guru, dan pengamat amatir.")

    # ── BAB 4: SPESIFIKASI TEKNIS & ARSITEKTUR ─────────────────────────────────
    add_heading_1("BAB 4: SPESIFIKASI TEKNIS DAN ARSITEKTUR PERANGKAT LUNAK")
    add_body("Program komputer Cakrapala dikembangkan dengan arsitektur rekayasa perangkat lunak modern (Next.js App Router Architecture):")
    add_bullet("TypeScript 5.x dan JavaScript (ECMAScript 2024 modern standard).", "Bahasa Pemrograman: ")
    add_bullet("Next.js 16 (React 19 Server & Client Components), Tailwind CSS untuk styling.", "Framework Web: ")
    add_bullet("Three.js, GLSL Custom Shader (Rayleigh scattering atmosfer, dynamic day/night terminator lighting), CesiumJS 3D geospatial engine.", "Engine Grafis 3D: ")
    add_bullet("satellite.js (SGP4/SDP4 orbital perturbation propagator), NASA Horizons ephemeris model.", "Algoritma Astrodinamika: ")
    add_bullet("NASA JPL NeoWs (Near-Earth Object Web Service), Space-Track / CelesTrak TLE Catalog, Yale Bright Star Catalog (BSC5 - 2.800+ bintang).", "Integrasi Sumber Data Eksternal: ")

    # ── BAB 5: KEBUTUHAN SISTEM ───────────────────────────────────────────────
    add_heading_1("BAB 5: KEBUTUHAN SISTEM (SYSTEM REQUIREMENTS)")
    add_body("Perangkat lunak Cakrapala beroperasi sepenuhnya di sisi peramban web (browser-based) dan tidak menuntut instalasi perangkat keras khusus berdaya tinggi:")
    add_bullet("Intel Core i3 / AMD Ryzen 3 / Apple Silicon M1 atau prosesor dengan kecepatan minimal 1.8 GHz.", "Prosesor (CPU): ")
    add_bullet("Minimal 4 GB RAM (Disarankan 8 GB RAM untuk performa visual 3D 60 FPS maksimal).", "Memori (RAM): ")
    add_bullet("Kartu grafis yang mendukung WebGL 2.0 (Intel HD Graphics 620+, AMD Radeon, NVIDIA, Apple GPU).", "Pengolah Grafis (GPU): ")
    add_bullet("Windows 10/11, macOS 11+, Linux (Ubuntu/Debian), Android 10+, atau iOS 15+.", "Sistem Operasi: ")
    add_bullet("Google Chrome 100+, Mozilla Firefox 100+, Apple Safari 15+, atau Microsoft Edge 100+.", "Peramban Web: ")
    add_bullet("Koneksi internet minimal 2 Mbps untuk pembaruan data telemetri satelit dan aset citra NASA.", "Konektivitas Internet: ")

    # ── BAB 6: PANDUAN AKSES DARING (CAKRAPALA.COM) ───────────────────────────
    add_heading_1("BAB 6: PANDUAN AKSES LAYANAN APLIKASI SECARA DARING (CAKRAPALA.COM)")
    add_body("Program komputer Cakrapala dirilis sebagai perangkat lunak berbasis cloud (Software-as-a-Service / Web Application) dengan arsitektur Zero-Installation. Seluruh pengguna, penguji, akademisi, dan pemeriksa DJKI tidak perlu melakukan instalasi software atau konfigurasi teknis apa pun pada perangkat komputer mereka.")
    add_body("Berikut adalah panduan langkah demi langkah untuk mengakses dan membuka aplikasi Cakrapala:")

    add_bullet("Nyalakan perangkat komputer, laptop, tablet, atau ponsel cerdas yang telah terhubung dengan jaringan internet.", "Langkah 1 (Persiapan Perangkat): ")
    add_bullet("Buka salah satu aplikasi peramban web modern yang tersedia di perangkat (disarankan Google Chrome, Mozilla Firefox, Apple Safari, atau Microsoft Edge).", "Langkah 2 (Membuka Browser Web): ")
    add_bullet("Pada bilah alamat pencarian (address bar) di bagian atas browser, ketikkan alamat resmi aplikasi: https://cakrapala.com lalu tekan tombol Enter.", "Langkah 3 (Memasukkan Alamat URL): ")
    add_bullet("Sistem web akan secara instan memuat antarmuka kokpit observatorium antariksa 3D. Shader atmosfer LEO, simulasi Bumi berotasi vertikal, dan bentang galaksi Bima Sakti akan aktif secara otomatis tanpa perlu registrasi rumit.", "Langkah 4 (Inisialisasi Otomatis): ")
    add_bullet("Tampilan antarmuka bersifat responsif penuh (Responsive Aerospace HUD). Pada layar monitor lebar (desktop/laptop), navigasi tampil berupa rel melengkung taktis. Pada layar tablet dan ponsel, navigasi otomatis menyesuaikan diri menjadi menu taktis yang ringkas dan mudah disentuh.", "Langkah 5 (Kompatibilitas Layar): ")

    doc.add_page_break()

    # ── BAB 7: PANDUAN LENGKAP SEMUA MENU ────────────────────────────────────
    add_heading_1("BAB 7: PANDUAN PENGOPERASIAN LENGKAP SELURUH MENU APLIKASI")
    add_body("Program komputer Cakrapala tersusun atas 7 modul menu utama yang saling terintegrasi. Pengguna dapat berpindah antar menu secara langsung melalui bilah navigasi atas (Navbar). Berikut panduan lengkap untuk setiap menu:")

    # 7.1 Landing Page
    add_heading_2("7.1. Menu 1: Landing Page & Kokpit Dirgantara (Overview Deck — '/')")
    add_body("Halaman beranda merupakan gerbang utama sistem yang menyajikan pemandangan LEO (Low Earth Orbit) beresolusi tinggi langsung dari jendela observasi wahana ruang angkasa.")
    add_bullet("Pada layar monitor desktop, bagian atas menampilkan rel lengkung taktis yang memuat stasiun navigasi utama (Solar System, Sky Map, Asteroid Radar, Satellite, dan Space Codex). Stasiun yang aktif ditandai pendaran cyan laser.", "1. Navigasi Rel Melengkung (Curved NavbarArc): ")
    add_bullet("Menampilkan bola dunia 3D fotorealistik yang berputar secara vertikal ke bawah, mensimulasikan pergerakan maju wahana antariksa mengitari orbit. Di latar belakang langit, galaksi Bima Sakti membentang secara diagonal (~30°) dan bergeser perlahan ke bawah selaras dengan laju orbit.", "2. Viewport 3D Bumi LEO & Bima Sakti: ")
    add_bullet("Terletak di bagian tengah atas, menampilkan identitas resmi 'CAKRAPALA DEEP SPACE OBSERVATORY' beserta ringkasan kapabilitas sistem.", "3. Banner Identitas & Tagline: ")
    add_bullet("Bilah kaca melayang di bagian bawah layar yang menyajikan data primer ISS dari API telemetri: status live (SYS-LIVE), waktu UTC, ketinggian orbit (ALT ~418 KM), kecepatan laju (VEL ~27.500 KM/H), inklinasi sudut (INC 51.6°), periode keliling (92.9 menit), dan koordinat nadir (lintang & bujur).", "4. Bilah Telemetri Waktu Nyata (Bottom Telemetry Strip): ")
    add_bullet("Pengguna dapat mengklik tombol logo Cakrapala pada navbar tengah atau tombol CTA 'SYS-AI // NEURAL LINK' untuk memunculkan modal terminal asisten cerdas.", "5. Peluncur Terminal AI: ")

    # 7.2 Solar System
    add_heading_2("7.2. Menu 2: Modul Tata Surya 3D (Planetary Orrery — '/solar-system')")
    add_body("Modul simulator tata surya 3D yang memodelkan pergerakan revolusi heliosentris Matahari dan 8 planet utama berdasarkan mekanika Keplerian J2000.0.")
    add_bullet("Buka bilah navigasi dan klik menu 'SOLAR SYSTEM'. Halaman akan memuat canvas 3D heliosentris.", "Langkah 1 (Akses): ")
    add_bullet("Klik kiri dan tahan pada layar, lalu geser tetikus (mouse drag) untuk mengubah sudut rotasi kamera 3D secara bebas 360 derajat. Gunakan roda tetikus (scroll wheel) untuk memperbesar jarak (zoom-in) atau memperkecil (zoom-out).", "Langkah 2 (Navigasi Kamera): ")
    add_bullet("Pada panel kontrol bawah, geser bilah Time Warp Slider untuk mempercepat peredaran orbit mulai dari kecepatan normal 1× hingga kecepatan percepatan 100.000×. Tombol 'Pause/Play' dapat digunakan untuk membekukan waktu.", "Langkah 3 (Kontrol Waktu Orbital): ")
    add_bullet("Klik langsung pada salah satu planet (misal Mars, Jupiter, atau Saturnus) untuk mengunci bidikan kamera (Auto-Tracking). Sistem otomatis memunculkan kartu informasi fisik planet yang memuat data jarak Astronomical Unit (AU), periode orbit hari, diameter kilometer, dan massa.", "Langkah 4 (Inspeksi Planet): ")

    # 7.3 Sky Map
    add_heading_2("7.3. Menu 3: Modul Peta Langit & Planetarium Toposentrik (Sky Map — '/sky')")
    add_body("Modul observatorium langit malam berbasis darat yang menyajikan simulasi kubah langit toposentrik akurat sesuai lokasi pengamat di permukaan Bumi.")
    add_bullet("Klik menu 'SKY MAP' pada navbar. Aplikasi akan meminta izin akses geolokasi pengguna (atau menggunakan opsi koordinat astronomi default).", "Langkah 1 (Deteksi Posisi): ")
    add_bullet("Kubah langit menampilkan proyeksi stereografis dari 2.800+ bintang nyata yang bersumber dari Yale Bright Star Catalog (BSC5) lengkap dengan perbedaan magnitudo kecerahan dan temperatur warna spektral (O, B, A, F, G, K, M).", "Langkah 2 (Peta Bintang & Rasi): ")
    add_bullet("Gunakan tombol panel untuk menyalakan/mematikan garis penghubung 89 rasi bintang resmi IAU, label nama konstelasi, garis ekuator langit, dan bidang ekliptika tata surya.", "Langkah 3 (Garis Rasi Bintang IAU): ")
    add_bullet("Ketikkan nama rasi atau bintang pada kolom pencarian cepat untuk memfokuskan lensa teleskop digital ke objek langit yang dicari.", "Langkah 4 (Pencarian Objek): ")
    add_bullet("Sistem secara real-time memproyeksikan lintasan satelit buatan (termasuk ISS) yang sedang melintas di atas horizon lokal pengguna.", "Langkah 5 (Overhead Satellite Pass): ")

    # 7.4 Asteroid Radar
    add_heading_2("7.4. Menu 4: Modul Radar Asteroid & Pertahanan Planet (NEO Radar — '/explore')")
    add_body("Modul pusat pemantauan asteroid mendekati Bumi (Near-Earth Objects / NEO) yang terhubung langsung dengan basis data primer NASA Planetary Defense Coordination Office.")
    add_bullet("Klik menu 'ASTEROID RADAR' pada navbar. Sistem akan melakukan sinkronisasi data telemetri mutakhir dari API NASA JPL NeoWs.", "Langkah 1 (Sinkronisasi Data): ")
    add_bullet("Asteroid dipetakan dalam diagram radar lingkaran jarak konsentris berbasis satuan Lunar Distance (1 LD = 384.400 km) mulai dari 1 LD hingga 50 LD.", "Langkah 2 (Membaca Radar Jarak Bulan): ")
    add_bullet("Warna merah menyala menandakan asteroid tergolong Potentially Hazardous Asteroid (PHA) dengan jarak sangat dekat (< 0.05 AU) dan diameter besar (> 140 m). Warna biru menandakan asteroid berjarak aman. Panel status menampilkan level DEFCON dan kecepatan laju (km/jam).", "Langkah 3 (Indikator Ancaman Bahaya): ")
    add_bullet("Klik salah satu asteroid pada tabel atau radar untuk membuka panel perbandingan ukuran visual. Sistem menyandingkan model 3D asteroid terhadap objek perbandingan dunia nyata: Bus Kota (12m), Boeing 747 (70m), Stadion GBK (105m), Monas Jakarta (132m), Menara Eiffel (330m), dan Burj Khalifa (828m).", "Langkah 4 (Analogi Ukuran Fisik Nyata): ")

    # 7.5 Satellite Tracker
    add_heading_2("7.5. Menu 5: Modul Pelacak Satelit & ISS 3D (Satellite Fleet — '/iss' & '/iss/catalog')")
    add_body("Modul pelacakan satelit antariksa bumi rendah (LEO) menggunakan mesin propagasi fisika orbital SGP4 real-time.")
    add_bullet("Klik menu 'SATELLITE' pada navbar. Halaman memuat globe 3D Bumi beresolusi tinggi dengan garis lintasan orbit elips ISS.", "Langkah 1 (Akses Globe Satelit): ")
    add_bullet("Gunakan menu pengalih katalog untuk memilih wahana antariksa yang ingin dilacak: Stasiun Luar Angkasa Internasional (ISS), Teleskop Luar Angkasa Hubble (HST), Stasiun Tiangong, Satelit Cuaca NOAA, atau konstelasi Starlink.", "Langkah 2 (Memilih Armada Satelit): ")
    add_bullet("Panel kanan menyajikan telemetri hidup: NORAD Catalog ID, Altitude ketinggian (km), Orbital Velocity (km/jam), Inclination kemiringan orbit, serta status visibilitas siang/malam (Daylight / Eclipse penumbra).", "Langkah 3 (Memeriksa Telemetri Orbital): ")
    add_bullet("Lingkaran pendaran pada permukaan Bumi di bawah satelit menandakan cakupan zona komunikasi radio dan visibilitas langsung dari darat.", "Langkah 4 (Radius Jangkauan / Footprint): ")

    # 7.6 Space Codex
    add_heading_2("7.6. Menu 6: Modul Ensiklopedia Antariksa (Space Codex — '/codex')")
    add_body("Perpustakaan digital interaktif yang menyajikan pengetahuan dasar astrofisika dan dokumentasi sejarah eksplorasi antariksa.")
    add_bullet("Klik menu 'SPACE CODEX' pada navbar.", "Langkah 1 (Akses): ")
    add_bullet("Pengguna dapat menelusuri artikel glosarium astrofisika: Hukum Gravitasi Newton, Tiga Hukum Kepler, Titik Lagrange (L1-L5), Kecepatan Lolos (Escape Velocity), dan Fenomena Lubang Hitam.", "Langkah 2 (Membaca Glosarium Sains): ")
    add_bullet("Mempelajari klasifikasi warna dan suhu bintang berdasarkan standar Morgan-Keenan (O, B, A, F, G, K, M).", "Langkah 3 (Klasifikasi Bintang): ")

    # 7.7 SYS-AI Terminal
    add_heading_2("7.7. Menu 7: Modul Asisten AI Antariksa (SYS-AI Astro-Terminal)")
    add_body("Asisten percakapan cerdas yang dirancang khusus untuk memandu pengguna dalam memahami data astronomi dan astrofisika secara interaktif.")
    add_bullet("Klik tombol logo Cakrapala pada navbar atau klik tombol 'SYS-AI // NEURAL LINK' pada landing page.", "Langkah 1 (Membuka Terminal): ")
    add_bullet("Ketikkan pertanyaan ilmiah pada kotak teks terminal (misal: 'Bagaimana cara ISS mempertahankan ketinggian orbitnya?' atau 'Jelaskan perbedaan meteoroid, meteor, dan meteorit').", "Langkah 2 (Mengajukan Pertanyaan): ")
    add_bullet("Model kecerdasan buatan terintegrasi akan menganalisis pertanyaan dan memberikan jawaban berbasis prinsip fisika astronomi yang akurat dan mudah dipahami.", "Langkah 3 (Menerima Hasil Analisis): ")

    doc.add_page_break()

    # ── BAB 8: CONTOH KODE PROGRAM ───────────────────────────────────────────
    add_heading_1("BAB 8: CONTOH POTONGAN KODE PROGRAM (SOURCE CODE SAMPLE)")
    add_body("Sesuai ketentuan administratif pemeriksaan substantif Program Komputer DJKI Kemenkumham, berikut dilampirkan cuplikan source code program utama yang merepresentasikan logika inisialisasi dan komputasi grafis 3D:")

    add_heading_2("8.1. Logika Inisialisasi Trajektori Navbar Matematis (NavbarArc.tsx)")
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
        "function getArcY(x: number): number {\n"
        "    const u = (x - CX) / (CX - 60);\n"
        "    return Y_WING + SAG * (1 - u * u);\n"
        "}\n\n"
        "function getTiltDeg(x: number): number {\n"
        "    const u = (x - CX) / (CX - 60);\n"
        "    const slope = (-2 * SAG * u) / (CX - 60);\n"
        "    const deg = Math.atan(slope) * (180 / Math.PI) * 0.75;\n"
        "    return Math.max(-4.5, Math.min(4.5, deg));\n"
        "}"
    )
    r_c1.font.name = "Courier New"
    r_c1.font.size = Pt(9)
    r_c1.font.color.rgb = RGBColor(30, 41, 59)

    add_heading_2("8.2. Logika Komputasi Bola Langit dan Bima Sakti (CommandCenterGlobe.tsx)")
    p_code2 = doc.add_paragraph()
    p_code2.paragraph_format.line_spacing = 1.0
    p_code2.paragraph_format.space_after = Pt(8)
    r_c2 = p_code2.add_run(
        "// File: components/landing/CommandCenterGlobe.tsx\n"
        "const celestialGroup = new THREE.Group();\n"
        "scene.add(celestialGroup);\n\n"
        "// Orientasi diagonal estetik Bima Sakti (~30 derajat)\n"
        "skyDome.rotation.x = full ? 0.08 : 0.35;\n"
        "skyDome.rotation.y = full ? -0.42 : -1.1;\n"
        "skyDome.rotation.z = full ? -0.52 : 0.0;\n"
        "skyDome.scale.x = -1;\n\n"
        "celestialGroup.add(skyDome);\n"
        "celestialGroup.add(stars);\n\n"
        "// Animasi rotasi vertikal selaras laju orbit wahana\n"
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
    r_c2.font.size = Pt(9)
    r_c2.font.color.rgb = RGBColor(30, 41, 59)

    # ── BAB 9: PROSEDUR PENDAFTARAN DJKI ──────────────────────────────────────
    add_heading_1("BAB 9: PANDUAN TEKNIS PENDAFTARAN HAK CIPTA DI PORTAL RESMI DJKI")
    add_body("Berikut adalah alur pendaftaran mandiri secara online melalui sistem POP Hak Cipta Kemenkumham RI:")
    add_bullet("Kunjungi tautan portal resmi: https://e-hakcipta.dgip.go.id/ dan masuk menggunakan akun pengguna terdaftar (atau registrasi akun baru jika belum memiliki).", "Langkah 1 (Akses Portal): ")
    add_bullet("Pada dashboard pengguna, klik menu 'Permohonan Baru'.", "Langkah 2 (Inisiasi Permohonan): ")
    add_bullet("Pilih Jenis Permohonan (Umum atau Usaha Mikro/Kecil/Pendidikan). Pada kolom Jenis Ciptaan, pilih 'Program Komputer'. Pada Sub-Jenis Ciptaan, pilih 'Program Komputer'.", "Langkah 3 (Kategori Ciptaan): ")
    add_bullet("Masukkan judul resmi: 'Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot'. Masukkan tautan https://cakrapala.com pada uraian ciptaan.", "Langkah 4 (Pengisian Data Ciptaan): ")
    add_bullet("Isikan tanggal pertama kali program diumumkan ke publik beserta kota tempat pengumuman di Indonesia.", "Langkah 5 (Tanggal & Tempat Pengumuman): ")
    add_bullet("Unggah berkas Buku Panduan Manual ini (dalam format .pdf), lampiran potongan source code program (.pdf), scan KTP pemohon/pencipta, dan Surat Pernyataan Kepemilikan Hak Cipta bermeterai Rp 10.000.", "Langkah 6 (Unggah Berkas Persyaratan): ")
    add_bullet("Lakukan pembayaran tagihan PNBP melalui kanal SIMPONI Bank/ATM/Mobile Banking menggunakan kode billing yang diterbitkan sistem.", "Langkah 7 (Pembayaran PNBP): ")
    add_bullet("Setelah pembayaran terverifikasi otomatis oleh sistem POP Hak Cipta DJKI, Surat Pencatatan Ciptaan (Sertifikat HAKI Resmi ber-QR Code Kemenkumham) akan langsung terbit secara elektronik dan dapat diunduh.", "Langkah 8 (Penerbitan Sertifikat): ")

    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    p_close = doc.add_paragraph()
    p_close.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_close = p_close.add_run("— DOKUMEN RESMI PENGURUSAN HAK CIPTA PROGRAM KOMPUTER CAKRAPALA —\nDIREKTORAT JENDERAL KEKAYAAN INTELEKTUAL KEMENKUMHAM RI")
    r_close.font.size = Pt(9.5)
    r_close.font.bold = True
    r_close.font.color.rgb = COLOR_MUTED

    # Save both docx and doc
    out_docx = "docs/BUKU_PANDUAN_HAKI_CAKRAPALA.docx"
    out_doc = "docs/BUKU_PANDUAN_HAKI_CAKRAPALA.doc"
    doc.save(out_docx)
    shutil.copyfile(out_docx, out_doc)
    print(f"Successfully generated: {out_docx} and {out_doc}")

if __name__ == "__main__":
    create_document()
