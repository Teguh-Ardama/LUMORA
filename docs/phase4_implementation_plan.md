# Phase 4: Guest Web Gallery Implementation Plan

Melanjutkan kesuksesan Phase 3, Phase 4 berfokus pada pengalaman End-User (tamu acara) yang akan mengakses galeri acara melalui portal web (Guest Web Gallery). 

Galeri ini akan menampilkan koleksi foto acara secara *real-time* (Live Photo Grid) dalam tampilan bergaya Pinterest/Masonry yang elegan dan *mobile-first*.

## User Review Required

> [!IMPORTANT]
> **Arsitektur Rute Guest Gallery**
> Kami mengusulkan penggunaan URL `/gallery/[eventKey]` (contoh: `http://localhost:3000/gallery/abc123xyz`) sebagai titik akses galeri publik. URL ini berbeda dari portal tamu yang sudah ada (`/g/[token]`), yang ditujukan secara spesifik untuk sesi tunggal.

> [!NOTE]
> **Autentikasi PIN (Otomatis & Tanpa Gesekan)**
> Jika acara dilindungi PIN (sesuai field `pinCode` di skema `Event`), tamu akan diminta memasukkan PIN satu kali saja. Sesi tersebut akan dikunci di *browser* menggunakan HTTP-Only Cookie.

## Proposed Changes

---

### API Contracts (`@lumora/contracts`)

#### [NEW] `packages/contracts/src/guest.ts`
Mendefinisikan skema Zod dan *interface* TypeScript untuk API Guest Event Gallery:
- `GuestEventInfo`: Metadata acara publik (Nama, Organisasi, apakah butuh PIN).
- `verifyEventPinSchema`: Input untuk validasi PIN.
- `GuestPhotoItem`: Objek representasi foto di galeri.

---

### Backend API (`apps/web`)

#### [MODIFY] `apps/web/src/server/api/routes/guest.route.ts`
Menambahkan *endpoints* publik baru di belakang *rate-limiter* (untuk mencegah *brute-force* PIN):
- `GET /events/:eventKey` — Mengembalikan `GuestEventInfo`.
- `POST /events/:eventKey/pin` — Memvalidasi PIN dan memasang *signed cookie* (JWT) bernama `lumora_guest_{eventKey}`.
- `GET /events/:eventKey/photos` — Mengembalikan foto (dengan URL yang di-*presign*) dalam bentuk paginasi (descending/terbaru di atas).
- `GET /events/:eventKey/photos/:sessionId/download` — Mencatat *download analytics* (Track), lalu me-*redirect* tamu ke URL asli S3/Local Storage dengan *header download*.

---

### Frontend UI (`apps/web`)

#### [NEW] `apps/web/src/app/gallery/[eventKey]/page.tsx`
Halaman utama Galeri Acara:
- **State 1: PIN Required:** Form input PIN elegan jika akses belum dibuka.
- **State 2: Masonry Photo Grid:** Menggunakan `useInfiniteQuery` dan *polling* otomatis setiap 15 detik agar foto terbaru dari *photobooth* terus muncul (*Live Grid*).
- **Desain Mobile-First:** *Image Lightbox* saat foto di-*tap* (mendukung *swipe* untuk navigasi, dan tombol besar untuk *"Download Full Resolution"*).

## Verification Plan

### Automated Tests
- Menjalankan `pnpm typecheck` di level *workspace*.

### Manual Verification
- Menjalankan *Desktop Bridge*, mengambil foto, lalu membuka halaman `/gallery/demo-event-key` dan memverifikasi bahwa:
  1. Foto tersebut langsung muncul di galeri secara otomatis.
  2. Gambar berkualitas tinggi ketika diperbesar.
  3. Form PIN bekerja mencegah akses tanpa izin, dan tidak memblokir akses ketika *cookie* aktif.
  4. Unduhan foto memicu analitik dengan benar.
