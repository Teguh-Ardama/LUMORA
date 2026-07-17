# Spesifikasi Teknis Lumora Bridge (Aplikasi Lokal)

Lumora Bridge adalah "nyawa" di lapangan. Aplikasi ini berjalan di laptop fotografer/operator, harus ringan, stabil, dan bisa berkomunikasi dengan perangkat keras (Kamera & Printer).

## 1. Rekomendasi Tech Stack: Tauri + React
Ketimbang menggunakan Electron yang boros RAM (bisa memakan 500MB+ per aplikasi), kita akan menggunakan **Tauri (v2)**.
- **Frontend (UI):** React / Next.js (Static Export). Kode UI bisa *sharing* komponen dengan `apps/web` lewat *turborepo packages*.
- **Backend (Core):** Rust (Bawaan Tauri). Sangat aman, memakan RAM di bawah 50MB, dan sangat cepat untuk akses *file system* lokal (membaca folder foto dari kamera).

## 2. Fitur Inti (Rust / Core level)
### A. File System Watcher (Hot Folder)
- Menggunakan library Rust (misal: `notify`) untuk memantau perubahan pada folder `C:\Photos\WeddingBudi`.
- Begitu kamera DSLR menembakkan foto ke folder tersebut (via *tethering* USB), Tauri mendeteksi *event* `Modify` atau `Create` dalam hitungan milidetik.
- Aplikasi merespons dengan menampilkan *pop-up* di UI: "1 Foto Baru Terdeteksi" atau langsung memasangkannya ke *Frame* secara otomatis (Auto-Apply mode).

### B. Print Spooler Integration
- Tauri/Rust bisa memanggil perintah *system-level* untuk mencetak dokumen.
- Di Windows: Menggunakan *powershell* `Out-Printer` atau integrasi PDF *printing*.
- Alur: Foto + Frame digabung (bisa pakai HTML5 Canvas di React lalu di- *export* ke Base64, atau di-*process* di Rust) -> Dikirim ke *default printer* OS tanpa memunculkan dialog Print Windows (Silent Printing) agar proses *seamless*.

## 3. Local State & Database
- Mengingat internet event sering putus-nyambung, Bridge menggunakan database lokal seperti **SQLite** (via *plugin* Tauri SQLite) atau sekadar **IndexedDB** di sisi *browser window*.
- Menyimpan tabel lokal: `local_photos` (status: `synced` / `pending`).
- Jika aplikasi tertutup (crash) lalu dibuka lagi, ia membaca DB lokal dan langsung melanjutkan *upload queue* (antrean upload) tanpa mengulang dari awal.
