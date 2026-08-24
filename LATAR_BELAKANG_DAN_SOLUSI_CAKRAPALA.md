# CAKRAPALA — Space Observatory & Planetary Defense
## Dokumen Latar Belakang, Identifikasi Masalah, dan Solusi Produk
**Kerangka Kerja: Design Thinking (Empathize, Persona, Define, Ideate, Prototype)**

---

## 1. Eksekutif Ringkasan (Executive Summary)

**Cakrapala** adalah platform observatorium digital dan sistem pertahanan planet (*Planetary Defense*) berbasis komputasi spasial 3D dan telemetri astronomi *real-time*. Platform ini mengintegrasikan data terbuka dari **NASA JPL NeoWs**, **NORAD CelesTrak (SGP4)**, **IAU Sky Catalog**, dan **NASA Horizons** menjadi satu ekosistem visualisasi interaktif yang presisi, mendidik, dan bebas bias.

---

## 2. Latar Belakang Lahirnya Cakrapala (Background)

Eksplorasi luar angkasa dan fenomena benda langit selalu menarik perhatian umat manusia. Namun, di era digital saat ini, terdapat kesenjangan besar (*information & visualization gap*) antara **data astronomi ilmiah tingkat tinggi** dan **pemahaman masyarakat umum**:

1. **Sensasionalisme Berita & Kepanikan Asteroid**: 
   Sering kali media massa mempublikasikan berita dengan judul bombastis seperti *"Asteroid Raksasa Mengancam Menabrak Bumi Besok"*. Tanpa akses ke data radar primer, publik mudah termakan hoaks dan kepanikan yang tidak berdasar.
2. **Kompleksitas Data Ephemeris Mentah**: 
   Badan antariksa dunia seperti NASA dan ESA menyediakan API terbuka (misalnya *NASA JPL SBDB / NeoWs*). Namun, data tersebut disajikan dalam format teks/tabel koordinat Keplerian yang sangat kaku, abstrak, dan sulit dipahami tanpa latar belakang astrofisika.
3. **Ketiadaan Platform Terintegrasi Multi-Skala**: 
   Sebagian besar aplikasi astronomi hanya fokus pada satu hal terpisah—hanya menampilkan peta bintang 2D, atau hanya pelacak satelit, atau hanya simulasi gravitasi planet. Tidak ada kokpit terpadu yang menghubungkan orbit satelit bumi rendah (LEO), langit malam lokal (toposentrik), dan radar ancaman asteroid antarplanet (NEO).

---

## 3. Analisis Design Thinking (5 Pertanyaan Kunci)

Berdasarkan framework *Design Thinking*, berikut adalah pembedahan mendalam mengenai mengapa dan bagaimana solusi Cakrapala dibangun:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐     ┌───────────────┐
│ 1. EMPATHIZE    │ ──> │  2. PERSONA  │ ──> │  3. DEFINE  │ ──> │ 4. IDEATE  │ ──> │ 5. PROTOTYPE  │
│ Siapa User Kita?│     │Siapa Dibantu?│     │Apa Masalah? │     │Solusi Tepat│     │Sudah Diuji?   │
└─────────────────┘     └──────────────┘     └─────────────┘     └────────────┘     └───────────────┘
```

---

### Tahap 1: EMPATHIZE (Siapa User Kita?)

Melalui observasi dan wawancara mendalam terhadap calon pengguna di lingkungan edukasi, komunitas astronomi amatir, dan masyarakat umum, ditemukan keresahan utama:

* **Insight 1 (Edukator & Mahasiswa Sains)**: *"Saya kesulitan mengajarkan konsep jarak Lunar Distance (LD) dan orbit elips kepada siswa jika hanya menggunakan diagram 2D di buku teks. Siswa tidak bisa membayangkan seberapa dekat 0.5 LD itu di ruang nyata."*
* **Insight 2 (Pengamat Langit Amatir / Stargazers)**: *"Saat ada satelit ISS atau asteroid melintas, saya butuh tahu posisi pastinya dari koordinat bujur/lintang tempat saya berdiri sekarang (Azimuth/Altitude), bukan sekadar posisi koordinat heliosentris abstrak."*
* **Insight 3 (Masyarakat Umum / Netizen)**: *"Ketika membaca berita asteroid melintas dekat Bumi, saya ingin melihat sendiri jalur lintasannya secara 3D, seberapa besar batunya dibanding Monas atau Menara Eiffel, dan apakah benar-benar berbahaya."*

---

### Tahap 2: PERSONA (Siapa yang Kita Bantu?)

| Atribut | Persona 1: Mahasiswa / Peneliti Muda | Persona 2: Guru / Edukator Sains | Persona 3: Masyarakat / Enthusiast |
| :--- | :--- | :--- | :--- |
| **Nama & Usia** | Aditya (21 thn) | Ibu Ratna (36 thn) | Dimas (29 thn) |
| **Peran** | Mahasiswa Fisika / Astronomi | Guru IPA / Fisika Sekolah Menengah | Pekerja IT & Pengamat Langit Amatir |
| **Goal** | Memverifikasi parameter orbit Keplerian dan kecepatan objek NEO secara presisi. | Menyediakan alat peraga visual interaktif 3D agar materi tata surya dan satelit mudah dipahami. | Memantau lintasan asteroid dan stasiun luar angkasa secara real-time tanpa terjebak berita hoaks. |
| **Pain Points** | API NASA mentah sulit divisualisasikan secara cepat tanpa koding visual 3D sendiri. | Software astronomi lama terlalu berat, berbayar mahal, atau berbasis desktop kuno. | Tidak punya latar belakang matematika untuk membaca tabel koordinat NASA JPL. |

---

### Tahap 3: DEFINE (Apa Masalah Sesungguhnya?)

#### 🔴 Problem Statement:
> *"Publik, pelajar, dan komunitas astronomi kekurangan akses ke platform observatorium digital berbasis web yang interaktif, presisi, dan real-time, yang mampu menerjemahkan data telemetri antariksa kompleks (NASA JPL, NORAD, IAU) menjadi visualisasi 3D yang intuitif dan edukatif."*

#### 💡 How Might We (HMW) Statements:
1. **HMW (How Might We)** menyajikan data ancaman asteroid NASA secara transparan, berbasis data nyata, dan bebas kepanikan yang bias?
2. **HMW** mengontekstualisasikan ukuran batu asteroid dan jarak ruang angkasa yang abstrak ke dalam analogi dunia nyata (seperti Monas, Boeing 747, dan jarak Bumi-Bulan)?
3. **HMW** menghadirkan kokpit luar angkasa dengan akurasi koordinat toposentrik (sesuai posisi lintang/bujur dan waktu lokal pengamat di Indonesia)?

---

### Tahap 4: IDEATE (Ide Apa yang Paling Tepat?)

Kami mengeksplorasi beberapa opsi solusi sebelum menetapkan arsitektur final Cakrapala:

| Opsi Solusi | Kelebihan | Kekurangan | Status |
| :--- | :--- | :--- | :--- |
| **Opsi A: Portal Berita & Artikel Astronomi Sederhana** | Mudah dibuat, cepat dimuat. | Pasif, tidak interaktif, tidak menyelesaikan masalah abstraksi data 3D. | ❌ Ditolak |
| **Opsi B: Dashboard Tabel Statistik Angka NASA** | Menyajikan data lengkap. | Terlalu teknis, membosankan bagi siswa dan masyarakat umum. | ❌ Ditolak |
| **Opsi C: Integrated 3D Aerospace Observatory Cockpit (Cakrapala)** | Interaktif, visual 3D mendalam (*depth & physics*), memadukan telemetri NASA dengan analogi visual intuitif. | Memerlukan komputasi WebGL/Three.js performa tinggi dan sinkronisasi ephemeris presisi. | ✅ **DIPILIH** |

---

### Tahap 5: PROTOTYPE & SOLUTION (Apakah Ini Solusi?)

**YA, Cakrapala adalah solusi menyeluruh (*End-to-End Holistic Solution*).** Cakrapala merealisasikan solusi melalui 4 pilar sistem kokpit:

#### 1. 🛡️ Modul SYS-03: Asteroid Defense & Near-Earth Object (NEO) Radar
* **Solusi yang Diberikan**:
  * Mengambil data langsung dari **NASA JPL NeoWs API** secara *real-time*.
  * Menampilkan radar jarak dekat Bumi (*Lunar Distance Rings: 1 LD s.d. 50 LD*) dengan lintasan orbit hiperbolik yang membentang luas.
  * **Indikator Taktikal**: Ikon chevron laju kecepatan, klasifikasi ancaman bahaya (*Potentially Hazardous Asteroid / PHA*), dan peringatan DEFCON.
  * **Analogi Ukuran Fisik Nyata**: Membandingkan diameter asteroid dengan *Bus Kota (12m), Boeing 747 (70m), Stadion GBK (105m), Monas Jakarta (132m), Menara Eiffel (330m), dan Burj Khalifa (828m)*.

#### 2. 🪐 Modul SYS-01: 3D Keplerian Planetary Orrery
* **Solusi yang Diberikan**:
  * Mensimulasikan orbit heliosentris 8 planet tata surya berdasarkan kalkulasi Keplerian J2000.0 yang presisi terhadap gravitasi Matahari.

#### 3. 🌌 Modul SYS-02: IAU Ground Sky Dome Planetarium
* **Solusi yang Diberikan**:
  * Menghitung posisi bintang (Katalog Yale BSC5 - 9.000+ bintang), konstelasi resmi IAU, dan garis horizon siang/malam (*Day/Night Terminator*) berdasarkan koordinat bujur dan lintang lokal pengamat di Bumi.

#### 4. 🛰️ Modul SYS-04: NORAD SGP4 Satellite & ISS Fleet Tracker
* **Solusi yang Diberikan**:
  * Mempropagasi elemen TLE *real-time* dari CelesTrak untuk melacak ISS, Tiangong CSS, Teleskop Hubble, dan armada satelit LEO lengkap dengan kerucut jejak tanah (*footprint visibility*).

---

## 4. Dampak & Nilai Tambah Solusi (Value Proposition & Impact)

1. **Demokratisasi Sains & Literasi Antariksa**:
   Mengubah data sains bernilai miliaran dollar dari badan antariksa dunia menjadi pengalaman visual yang dapat diakses gratis oleh siapa saja langsung melalui browser.
2. **Mitigasi Hoaks & Kepanikan Informasi**:
   Memberikan instrumen independen bagi masyarakat untuk memverifikasi kebenaran lintasan asteroid secara ilmiah dan transparan.
3. **Presisi Tinggi & Identitas Nasional**:
   Dilengkapi perhitungan toposentrik dari sudut pandang pengamat di Indonesia (WGS-84 dan GMST Sidereal Time) serta perbandingan landmark ikonik nasional seperti Monumen Nasional (Monas) dan Stadion Gelora Bung Karno.

---

*Dokumen ini disusun sebagai cetak biru filosofi produk, justifikasi arsitektur, dan landasan perancangan platform Cakrapala.*
