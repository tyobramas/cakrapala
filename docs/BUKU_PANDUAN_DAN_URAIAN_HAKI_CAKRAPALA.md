# BUKU PANDUAN PENGGUNAAN DAN URAIAN CIPTAAN PROGRAM KOMPUTER
## APLIKASI: CAKRAPALA — DEEP SPACE OBSERVATORY & ASTRO-AI CO-PILOT
**Dokumen Kelengkapan Pendaftaran Hak Cipta (Program Komputer)**  
**Direktorat Jenderal Kekayaan Intelektual (DJKI) — Kementerian Hukum dan HAM RI**

---

## DAFTAR ISI

1. [IDENTITAS CIPTAAN](#1-identitas-ciptaan)
2. [LATAR BELAKANG PENCIPTAAN](#2-latar-belakang-penciptaan)
3. [DESKRIPSI UMUM & TUJUAN INOVASI](#3-deskripsi-umum--tujuan-inovasi)
4. [SPESIFIKASI TEKNIS & ARSITEKTUR PERANGKAT LUNAK](#4-spesifikasi-teknis--arsitektur-perangkat-lunak)
5. [KEBUTUHAN SISTEM (SYSTEM REQUIREMENTS)](#5-kebutuhan-sistem-system-requirements)
6. [PANDUAN AKSES LAYANAN APLIKASI DARING (CAKRAPALA.COM)](#6-panduan-akses-layanan-aplikasi-daring-cakrapalacom)
7. [PANDUAN PENGOPERASIAN MODUL LANGKAH DEMI LANGKAH](#7-panduan-pengoperasian-modul-langkah-demi-langkah)
   - 7.1. Antarmuka Utama (Landing Page & Flight-Deck HUD)
   - 7.2. Modul Tata Surya 3D (3D Keplerian Planetary Orrery)
   - 7.3. Modul Sky Map & Peta Bintang Toposentrik
   - 7.4. Modul Radar Asteroid & Pertahanan Planet (NEO Radar)
   - 7.5. Modul Pelacak Satelit & ISS (SGP4 Real-Time Tracking)
   - 7.6. Modul Pusat Kendali Misi (Mission Control Room)
   - 7.7. Modul Ensiklopedia Antariksa (Space Codex)
   - 7.8. Modul Asisten Cerdas Antariksa (Cakrapala SYS-AI Astro-Terminal)
8. [CONTOH POTONGAN KODE PROGRAM (SOURCE CODE SAMPLE)](#8-contoh-potongan-kode-program-source-code-sample)
9. [PANDUAN PRAKTIS PENDAFTARAN ONLINE DI PORTAL DJKI](#9-panduan-praktis-pendaftaran-online-di-portal-djki)

---

## 1. IDENTITAS CIPTAAN

| Parameter | Keterangan |
| :--- | :--- |
| **Judul Ciptaan** | **Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot** |
| **Jenis Ciptaan** | **Program Komputer (Aplikasi Web / Software-as-a-Service)** |
| **Tautan Akses Resmi (URL)** | **https://cakrapala.com** |
| **Sub-Jenis** | Perangkat Lunak Visualisasi Astrofisika, Telemetri Orbit, dan Kecerdasan Buatan |
| **Bahasa Pemrograman** | TypeScript, JavaScript (ECMAScript 2024), GLSL (OpenGL Shading Language) |
| **Framework & Engine** | Next.js (React 19), Three.js (WebGL), Tailwind CSS, CesiumJS |
| **Tahun Pertama Diumumkan** | 2026 |
| **Tempat Pertama Diumumkan** | Indonesia |

---

## 2. LATAR BELAKANG PENCIPTAAN

Eksplorasi luar angkasa dan fenomena benda langit merupakan bidang ilmu sains yang sangat krusial bagi masa depan peradaban manusia. Namun, di Indonesia dan masyarakat dunia pada umumnya, terdapat kesenjangan besar (*information & visualization gap*) antara ketersediaan data primer astrofisika tingkat tinggi dengan pemahaman masyarakat luas.

Latar belakang perancangan dan pembangunan program komputer **Cakrapala** didasari oleh tiga permasalahan fundamental:

1. **Tingginya Sensasionalisme Berita & Hoaks Asteroid:**  
   Sering kali media daring mempublikasikan informasi yang memicu kepanikan publik tanpa dasar ilmiah, seperti berita asteroid berjarak lintang dekat yang diklaim akan menabrak Bumi. Tanpa adanya akses radar visual primer yang mudah diverifikasi secara mandiri oleh masyarakat, publik rentan terjebak dalam disinformasi.
2. **Kompleksitas Data Ephemeris & Koordinat Mentah:**  
   Lembaga riset antariksa dunia (seperti NASA JPL, NORAD CelesTrak, dan IAU) menyediakan API terbuka. Namun, data tersebut disajikan dalam format teks tabel koordinat Keplerian dan format TLE (*Two-Line Element Set*) yang sangat rumit dan abstrak, sehingga hanya dapat dianalisis oleh akademisi atau ilmuwan berlatar belakang astrodinamika.
3. **Ketiadaan Platform Terintegrasi Multi-Skala:**  
   Aplikasi astronomi yang ada saat ini umumnya terfragmentasi: hanya menampilkan peta rasi bintang 2D sederhana, atau hanya kalkulator orbit satelit terpisah. Belum ada platform terpadu berbasis web modern yang mampu mengintegrasikan pemantauan orbit satelit bumi rendah (LEO), radar ancaman asteroid antarplanet (NEO), simulasi gravitasi tata surya, peta langit malam toposentrik lokal, serta asisten kecerdasan buatan (*AI Co-Pilot*) dalam satu kokpit dirgantara terpadu yang efisien dan responsif.

Oleh karena itu, program komputer **Cakrapala** diciptakan sebagai solusi inovatif perangkat lunak observatorium digital interaktif berbasis web untuk mendemokratisasi akses data antariksa secara presisi, edukatif, dan ilmiah.

---

## 3. DESKRIPSI UMUM & TUJUAN INOVASI

**Cakrapala** adalah sistem observatorium digital dan komputasi astrodinamika waktu nyata (*real-time*) yang berjalan langsung di peramban web (*browser*) tanpa memerlukan instalasi perangkat lunak desktop berbayar yang berat.

### Tujuan Utama Ciptaan:
1. **Menyajikan Visualisasi 3D Fotorealistik Berbasis Fisika:** Menghadirkan model 3D Bumi, atmosfer LEO, simulasi orbit planet Keplerian, dan bentang galaksi Bima Sakti secara akurat menggunakan shader WebGL.
2. **Propagasi Orbit Satelit Nyata (SGP4 Model):** Menghitung lintasan dan koordinat stasiun luar angkasa ISS serta ribuan satelit buatan secara matematis berdasarkan model fisika SGP4/SDP4 toposentrik.
3. **Transparansi Pertahanan Planet (Planetary Defense):** Mengontekstualisasikan ukuran batu asteroid dan jarak lintasannya menggunakan analogi fisik dunia nyata (seperti Monas, Menara Eiffel, dan Stadion GBK) serta skala jarak Bulan (*Lunar Distance*).
4. **Integrasi Edukasi Kecerdasan Buatan (AI Astro-Terminal):** Menyediakan asisten AI percakapan berbasis model fondasi astronomi untuk menjawab konsultasi astrodinamika, mekanika orbit, dan data kosmologi bagi pelajar, guru, dan komunitas pengamat langit.

---

## 4. SPESIFIKASI TEKNIS & ARSITEKTUR PERANGKAT LUNAK

Perangkat lunak Cakrapala dibangun menggunakan arsitektur modular modern berbasis *Fullstack Web Application*:

* **Lapisan Antarmuka (Presentation Layer):**
  * **Framework:** Next.js (App Router Architecture), React Server & Client Components.
  * **Engine Grafis 3D:** Three.js, WebGL Shader (GLSL) untuk efek pembiasan atmosfer Rayleigh scattering, pencahayaan surya dinamis (*terminator day/night*), dan pemetaan kubus galaksi Bima Sakti.
  * **Gaya Desain:** Desain HUD Dirgantara (*Aerospace Tactical Flight-Deck*), responsif di perangkat desktop, tablet, maupun ponsel pintar.
* **Lapisan Algoritma & Komputasi (Calculation Layer):**
  * **Propagasi Satelit:** `satellite.js` mengimplementasikan algoritma matematika SGP4/SDP4 standar US Space Command.
  * **Astrometri Bintang:** Basis data Yale Bright Star Catalog (BSC5) mencakup 2.800+ bintang berjarak magnitudo $V \le 5.50$ dan 89 rasi bintang resmi IAU.
  * **Matematika Trajektori Kelengkungan:** Fungsi polinomial kuadratik untuk melengkungkan navbar instrumen secara presisi mengikuti kurva viewport.
* **Lapisan Integrasi Data & API (Data Layer):**
  * **NASA JPL NeoWs REST API:** Pengambilan telemetri asteroid mendekati Bumi secara waktu nyata.
  * **CelesTrak / Space-Track:** Unduhan otomatis data TLE satelit aktif.
  * **IBM Granite / AI Endpoint:** Pemrosesan bahasa alami untuk konsultasi astronomi.

---

## 5. KEBUTUHAN SISTEM (SYSTEM REQUIREMENTS)

Perangkat lunak Cakrapala dirancang ringan dan dapat diakses melalui peramban web modern:

### Kebutuhan Perangkat Keras Minimum:
* **Prosesor:** Dual-Core 1.8 GHz atau lebih tinggi (Intel Core i3 / AMD Ryzen 3 / Apple Silicon M1 atau setara).
* **RAM:** Minimum 4 GB (Disarankan 8 GB untuk simulasi 3D mulus).
* **Kartu Grafis (GPU):** GPU terintegrasi yang mendukung WebGL 2.0 (Intel HD Graphics 620, AMD Radeon, atau Apple GPU).
* **Koneksi Internet:** Minimum 2 Mbps untuk pembaruan telemetri satelit dan aset tekstur 3D.

### Kebutuhan Perangkat Lunak:
* **Sistem Operasi:** Windows 10/11, macOS 11+, Linux (Ubuntu/Debian/Fedora), Android 10+, atau iOS 15+.
* **Peramban Web (Browser):** Google Chrome versi 100+, Mozilla Firefox versi 100+, Safari versi 15+, atau Microsoft Edge versi 100+ dengan akselerasi perangkat keras WebGL aktif.

---

## 6. PANDUAN AKSES LAYANAN APLIKASI DARING (CAKRAPALA.COM)

Program komputer Cakrapala dirilis sebagai perangkat lunak berbasis cloud (*Software-as-a-Service / Web Application*) dengan arsitektur *Zero-Installation*. Seluruh pengguna umum, akademisi, penguji, maupun pemeriksa DJKI **tidak perlu melakukan instalasi perangkat lunak tambahan apa pun** pada perangkat komputer atau ponsel mereka.

Aplikasi dapat diakses secara langsung dan instan melalui peramban web dengan langkah-langkah sebagai berikut:

1. **Persiapan Perangkat:** Siapkan perangkat komputer desktop, laptop, tablet, atau ponsel cerdas yang telah terhubung dengan jaringan internet aktif.
2. **Membuka Peramban Web:** Buka aplikasi peramban web modern yang tersedia di perangkat (disarankan Google Chrome, Mozilla Firefox, Apple Safari, atau Microsoft Edge).
3. **Memasukkan Alamat URL Resmi:** Pada bilah alamat (*address bar*) di bagian atas browser, ketikkan alamat resmi aplikasi:  
   👉 **`https://cakrapala.com`**  
   lalu tekan tombol **Enter**.
4. **Inisialisasi Otomatis:** Sistem web akan secara instan memuat antarmuka kokpit observatorium antariksa 3D. Shader atmosfer LEO, simulasi Bumi berotasi vertikal, dan bentang galaksi Bima Sakti akan aktif secara otomatis tanpa perlu registrasi rumit (*instant guest access*).
5. **Kompatibilitas Layar (Responsive UI):** Tampilan antarmuka bersifat responsif penuh. Pada layar monitor lebar (desktop/laptop), navigasi tampil berupa rel melengkung taktis (*Curved Navbar*). Pada layar tablet dan ponsel, navigasi otomatis menyesuaikan diri menjadi menu taktis yang ringkas dan mudah disentuh.

---

## 7. PANDUAN PENGOPERASIAN MODUL LANGKAH DEMI LANGKAH

### 7.1. Antarmuka Utama (Landing Page & Flight-Deck HUD)
1. **Navigasi Melengkung (Curved Navbar):** Pada layar desktop, navbar atas menampilkan rel lengkung taktis yang memuat stasiun navigasi utama (*Solar System, Mission Control, Sky Map, Asteroid Radar, Satellite, Space Codex*).
2. **Viewport 3D Bumi LEO:** Bagian latar belakang menampilkan bumi realistis berputar vertikal secara mulus sesuai laju wahana antariksa, dihiasi bentang galaksi Bima Sakti yang melintang diagonal secara sinematik.
3. **Bilah Telemetri Bawah (Live Telemetry Strip):** Memantau secara langsung status sistem, waktu UTC real-time, ketinggian orbit ISS (ALT ~418 KM), kecepatan laju (VEL ~27.500 KM/H), dan koordinat nadir (lintang/bujur).
4. **Peluncur AI Terminal:** Klik tombol logo Cakrapala pada navbar tengah untuk membuka terminal interaktif kecerdasan buatan.

### 7.2. Modul Tata Surya 3D (3D Keplerian Planetary Orrery) — `/solar-system`
1. Akses menu **SOLAR SYSTEM** pada bilah navigasi.
2. Pengguna disajikan visualisasi 3D heliosentris interaktif berpusat pada Matahari dan 8 planet utama.
3. **Interaksi Kamera:** Klik kiri dan seret tetikus (*mouse*) untuk merotasi sudut pandang bebas 3D. Gunakan roda tetikus (*scroll*) untuk memperbesar (*zoom-in*) atau memperkecil (*zoom-out*).
4. **Pengaturan Laju Waktu (Time Warp):** Gunakan bilah geser di panel kontrol untuk mempercepat waktu peredaran orbit mulai dari 1× hingga 100.000× kecepatan nyata.
5. **Inspeksi Planet:** Klik salah satu planet untuk mengunci kamera dan memunculkan kartu parameter fisik lengkap (jarak AU, periode orbit, diameter, dan massa).

### 7.3. Modul Sky Map & Peta Bintang Toposentrik — `/sky`
1. Akses menu **SKY MAP**.
2. Sistem akan mendeteksi koordinat geografis lokal pengguna (atau menggunakan opsi manual).
3. Kubah langit menampilkan proyeksi toposentrik stereografis dari 2.800+ bintang nyata dan konfigurasi garis 89 rasi bintang resmi IAU.
4. Terdapat fitur pencarian bintang/rasi, garis ekuator langit, bidang ekliptika, dan pelacakan satelit yang sedang melintas di atas kepala (*overhead satellite pass*).

### 7.4. Modul Radar Asteroid & Pertahanan Planet (NEO Radar) — `/explore`
1. Akses menu **ASTEROID RADAR**.
2. Sistem otomatis mengunduh umpan data paling mutakhir dari **NASA JPL NeoWs**.
3. **Radar Jarak Bulan:** Asteroid ditampilkan dalam lingkaran radius jarak Bulan (*Lunar Distance / LD*). Titik merah menandakan *Potentially Hazardous Asteroid (PHA)*, sedangkan titik biru menandakan asteroid aman.
4. **Analogi Perbandingan Ukuran:** Klik salah satu asteroid untuk memunculkan model perbandingan 3D yang membandingkan dimensi asteroid tersebut terhadap bangunan nyata seperti Monas, Menara Eiffel, atau Pesawat Boeing 747.

### 7.5. Modul Pelacak Satelit & ISS (SGP4 Tracking) — `/iss`
1. Akses menu **SATELLITE**.
2. Globe 3D menampilkan bola dunia interaktif lengkap dengan garis lintasan orbit elips ISS dan satelit cuaca/navigasi terpilih.
3. Pengguna dapat memilih satelit dari katalog untuk memeriksa data NORAD ID, inklinasi, apogee, perigee, dan zona jangkauan penglihatan (*footprint*).

### 7.6. Modul Pusat Kendali Misi (Mission Control Room) — `/mission-control`
1. Akses menu **MISSION CONTROL**.
2. Modul ini menyajikan ringkasan status operasional armada satelit, telemetri kesehatan komunikasi stasiun bumi (Deep Space Network), dan deteksi anomali orbit berbasis kecerdasan buatan.

### 7.7. Modul Ensiklopedia Antariksa (Space Codex) — `/codex`
1. Akses menu **SPACE CODEX**.
2. Pengguna dapat membaca glosarium istilah astrofisika, sejarah misi luar angkasa dunia, klasifikasi spektral bintang (O, B, A, F, G, K, M), dan teori relativitas fisika antariksa.

### 7.8. Modul Asisten Cerdas Antariksa (SYS-AI Astro-Terminal)
1. Klik tombol **SYS-AI // NEURAL LINK** atau ikon tengah logo Cakrapala pada navbar.
2. Jendela terminal melayang (*floating HUD terminal*) akan muncul di layar.
3. Pengguna dapat mengetikkan pertanyaan astronomi secara interaktif (contoh: *"Berapa kecepatan lolos gravitasi Bumi?"* atau *"Kapan ISS melintas di atas langit Jakarta?"*).
4. Model kecerdasan buatan terintegrasi akan menjawab secara real-time berbasis rujukan data astrofisika resmi.

---

## 8. CONTOH POTONGAN KODE PROGRAM (SOURCE CODE SAMPLE)

Sesuai dengan ketentuan DJKI Kemenkumham, berikut dilampirkan representasi struktur logika program utama:

### 8.1. Bagian Awal Program (Inisialisasi Trajektori Navbar Matematis):
```typescript
// Berkas: components/landing/NavbarArc.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    Globe2, RadioTower, Telescope, Radar, SatelliteDish, Atom,
} from "lucide-react";
import AstronomyTerminal from "@/components/ai/AstronomyTerminal";

// ── Mathematical Trajectory ──────────────────────────────────────────────────
const VB_W = 1600;
const VB_H = 124;
const CX = VB_W / 2; // 800
const Y_WING = 46;   // Ketinggian sayap luar
const SAG = 28;       // Kelengkungan turun pada pusat komando

/** Menghitung ketinggian kurva dalam unit viewBox untuk koordinat x */
function getArcY(x: number): number {
    const u = (x - CX) / (CX - 60);
    return Y_WING + SAG * (1 - u * u);
}

/** Menghitung sudut kemiringan tangen dalam derajat */
function getTiltDeg(x: number): number {
    const u = (x - CX) / (CX - 60);
    const slope = (-2 * SAG * u) / (CX - 60);
    const deg = Math.atan(slope) * (180 / Math.PI) * 0.75;
    return Math.max(-4.5, Math.min(4.5, deg));
}
```

### 8.2. Bagian Inti Program (Kompilasi Visualisasi 3D Bola Langit & Bima Sakti):
```typescript
// Berkas: components/landing/CommandCenterGlobe.tsx
// ── Perakitan Bola Langit Bima Sakti & Bintang 3D ────────────────────
const celestialGroup = new THREE.Group();
scene.add(celestialGroup);

// Menyelaraskan orientasi sudut diagonal Bima Sakti (~30 derajat)
skyDome.rotation.x = full ? 0.08 : 0.35;
skyDome.rotation.y = full ? -0.42 : -1.1;
skyDome.rotation.z = full ? -0.52 : 0.0;
skyDome.scale.x = -1;

celestialGroup.add(skyDome);
celestialGroup.add(stars);

// Animasi loop rotasi vertikal sinkron laju orbit wahana
const animate = () => {
    animId = requestAnimationFrame(animate);
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;

    spinAngle += SPIN_RATE_RAD_S * dt;
    if (full) {
        orbitPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
        cloudPitchGroup.quaternion.setFromAxisAngle(SPIN_AXIS, spinAngle);
        celestialGroup.rotation.x -= 0.0006 * dt; // Pergerakan vertikal mulus
    }
    renderer.render(scene, camera);
};
```

---

## 9. PANDUAN PRAKTIS PENDAFTARAN ONLINE DI PORTAL DJKI

Untuk mendaftarkan Hak Cipta Program Komputer ini secara resmi di DJKI Kemenkumham, ikuti langkah berikut:

1. **Masuk ke Portal DJKI:** Buka laman resmi `https://e-hakcipta.dgip.go.id/` dan buat akun perorangan jika belum memiliki akun.
2. **Pilih Menu Ciptaan Baru:** Klik tombol **"Permohonan Baru"**.
3. **Isi Data Identitas:**
   * **Jenis Permohonan:** Umum atau Usaha Mikro/Kecil/Pendidikan.
   * **Jenis Ciptaan:** Pilih **"Program Komputer"**.
   * **Sub-Jenis Ciptaan:** Pilih **"Program Komputer"**.
   * **Judul Ciptaan:** *Cakrapala — Deep Space Observatory & Astro-AI Co-Pilot*.
   * **Uraian Singkat Ciptaan:** Salin ringkasan dari Bab 3 dokumen ini.
   * **Tanggal & Tempat Pertama Kali Diumumkan:** Masukkan tanggal rilis aplikasi dan kota tempat tinggal Anda di Indonesia.
4. **Unggah Berkas Persyaratan (Format PDF):**
   * **Dokumen 1:** Dokumen Buku Panduan Manual ini (konversikan berkas ini menjadi berkas `.pdf`).
   * **Dokumen 2:** Contoh potongan kode program (PDF potongan kode awal, tengah, dan akhir).
   * **Dokumen 3:** KTP Pemohon / Pencipta (scan asli).
   * **Dokumen 4:** Surat Pernyataan Kepemilikan Hak Cipta bermeterai 10.000 (template diunduh otomatis dari portal DJKI).
5. **Pembayaran PNBP:** Lakukan pembayaran melalui kode billing SIMPONI (Teller Bank/M-Banking/ATM).
6. **Penerbitan Sertifikat:** Setelah pembayaran terverifikasi otomatis oleh sistem POP Hak Cipta DJKI, **Surat Pencatatan Ciptaan (Sertifikat HAKI Resmi)** akan langsung terbit dan dapat diunduh dalam format digital dengan barcode resmi Kemenkumham RI.

---
*Dokumen ini disusun secara resmi sebagai spesifikasi teknis dan manual penggunaan program komputer untuk permohonan perlindungan Hak Kekayaan Intelektual.*
