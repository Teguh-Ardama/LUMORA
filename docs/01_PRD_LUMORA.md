# Product Requirements Document (PRD): Lumora Event Photobooth

## 1. Visi & Tujuan
Lumora adalah ekosistem aplikasi (Web Cloud + Desktop Bridge) yang dirancang khusus untuk bisnis **Event Photobooth** dan **Studio Fotografi** (seperti *Wedding, Wisuda, Corporate Events*). Berbeda dengan *vending machine photobooth*, Lumora menitikberatkan pada kendali di tangan fotografer (operator) yang menggunakan kamera profesional (DSLR/Mirrorless) dan laptop.

Tujuan utama Web Lumora (Cloud) adalah sebagai **Pusat Komando (Command Center)** bagi pemilik bisnis untuk mengatur event, mengelola aset visual (frame), dan memberikan pengalaman Galeri Digital (Web Gallery) premium bagi tamu event.

## 2. Target Pengguna (User Roles)

### 2.1. Super Admin (Pemilik Bisnis)
- **Karakteristik:** Berinteraksi dengan Web Dashboard (Cloud).
- **Kebutuhan:** Membutuhkan sistem untuk memanajemen seluruh event klien, memantau *bridge* (laptop operator) yang sedang online, mengatur *frame* kustom per event, dan melihat metrik analitik (jumlah foto tercetak, traffic galeri).

### 2.2. Operator / Fotografer Lapangan
- **Karakteristik:** Menggunakan aplikasi lokal **Lumora Bridge** (Desktop) di lokasi *event*. Terkadang mengakses panel web untuk membuat URL *live gallery*.
- **Kebutuhan:** Memerlukan sistem *offline-first* di lokasi yang bisa menarik foto otomatis dari kamera (Hot Folder), memproses *frame* (menyatukan PNG dengan foto) dalam sepersekian detik secara lokal, dan mencetak ke printer foto lokal tanpa bergantung internet. Saat terhubung WiFi, sistem otomatis *sync* data ke Web Cloud secara *background*.

### 2.3. End-User (Tamu Event / Klien)
- **Karakteristik:** Mengakses **Web Gallery (Guest Portal)** via *scan* QR Code dari hasil cetakan fisik atau dari layar sekunder (*Guest Screen*) di lokasi.
- **Kebutuhan:** Tidak perlu login. Mereka butuh tampilan galeri foto *real-time* yang elegan, responsif di HP, dan bisa mengunduh foto mereka sendiri (resolusi tinggi) dengan sangat cepat.

## 3. Fitur Utama (Core Features) - Web Cloud

1. **Event Management:**
   - Membuat event baru (Nama Klien, Tanggal, Lokasi, Tema).
   - Men-generate *Event Code / API Key* khusus untuk disuntikkan ke Lumora Bridge agar sinkronisasi foto tepat sasaran.
2. **Asset Management (Frame Studio):**
   - Upload desain *frame* berformat PNG berlubang transparan.
   - Mengaitkan frame spesifik hanya untuk event tertentu.
3. **Live Sync (Background Sync Receiver):**
   - Menerima unggahan foto (beserta data metadata exif) dari Lumora Bridge di lapangan secara *asynchronous*.
4. **Guest Web Gallery (White-label):**
   - Halaman pameran foto interaktif untuk tamu.
   - Fitur *Live Slideshow* (jika URL dibuka di layar TV besar di lokasi *event*).
   - Fitur "Cari Wajah Saya" (Opsional masa depan: *Face Recognition* AI).
5. **Analytics & Logs:**
   - Laporan konsumsi kertas printer (dikirim dari Bridge).
   - Statistik jumlah *download* oleh tamu per event.

## 4. Alur Kerja Ideal (End-to-End Flow)

1. **[Pre-Event]** Admin membuat Event "Pernikahan Budi & Ani" di Web Lumora. Mengunggah 2 pilihan Frame. Mendapatkan *Event Key*.
2. **[On-Site]** Fotografer memasukkan *Event Key* ke Lumora Bridge (Laptop). Aplikasi menarik aset Frame dari Web.
3. **[On-Site]** Event berjalan. Fotografer memotret dengan DSLR. Foto otomatis masuk ke *Hot Folder* Laptop.
4. **[On-Site]** Lumora Bridge mendeteksi foto -> Operator memencet *Apply Frame* -> *Print*.
5. **[On-Site]** Lumora Bridge di *background* mengirim (Upload) versi digital (dengan & tanpa frame) ke Web Lumora menggunakan MinIO/S3.
6. **[Post-Capture]** Tamu men-scan QR di kertas cetak, otomatis terbuka halaman Web Gallery milik mereka dan bisa menekan tombol Download.
