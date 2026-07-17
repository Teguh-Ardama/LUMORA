# Arsitektur Sistem Web Lumora (Cloud & Backend)

Karena Lumora harus menangani sinkronisasi data yang berat (ratusan foto resolusi tinggi dari *event live*) dan harus menyajikan pengalaman *Gallery* tamu yang super cepat, arsitekturnya harus *scalable* dan *modern*.

## 1. Frontend (Web Dashboard & Guest Gallery)
- **Framework:** **Next.js (App Router)**
  - Mengapa? Sempurna untuk SEO (Guest Gallery) dan sangat cepat berkat React Server Components (RSC). Memberikan pengalaman *Premium* layaknya aplikasi Native.
- **Styling:** **Tailwind CSS + Shadcn UI** (Dikustomisasi secara radikal)
  - UI tidak boleh terlihat seperti *template admin* murah. Kita akan membangun token desain (Warna, Tipografi, Radius) khusus agar terlihat seperti *SaaS Creative (misal: Figma, Vercel, Framer)*.
- **State Management:** Zustand (untuk Global UI state) dan React Query (untuk Data fetching/caching).

## 2. Backend (API & Core Logic)
- **Framework:** **Next.js API Routes (Server Actions / Route Handlers)** atau **NestJS** (jika butuh microservices terpisah, tapi untuk awal monorepo turborepo `apps/web` Next.js fullstack sudah cukup).
- **Komunikasi ke Bridge:** 
  - REST API untuk sinkronisasi foto dari `apps/bridge`.
  - **WebSockets / Socket.io** (Sangat direkomendasikan): Agar Web Admin bisa melihat indikator "Bridge Online/Offline" secara *real-time* dan *Live Gallery* tamu bisa *auto-update* saat ada foto baru terunggah (tanpa perlu tamu me-refresh browser).

## 3. Database & Caching
- **Database Utama (RDBMS):** **PostgreSQL** (Bisa di-host di Supabase atau Railway).
  - Skema relasional sangat cocok untuk Entitas (Users -> Events -> Frames -> Photos).
  - ORM: **Prisma** atau **Drizzle** untuk *type-safety* *end-to-end* (TypeScript).
- **Caching & Queue (Redis):** **Redis** 
  - Wajib untuk *Rate Limiting* (mencegah tamu spam *download*).
  - Wajib sebagai *Message Broker* jika kita butuh fitur *Background Jobs* (misalnya men-generate versi *thumbnail* WEBP yang lebih ringan saat foto HD baru saja di-upload dari Bridge).

## 4. Object Storage (File Assets & Photos)
- **Sistem:** **MinIO (S3 Compatible)** atau AWS S3 / Cloudflare R2.
  - Kita TIDAK BOLEH menyimpan *file* gambar di dalam database atau sistem lokal server. Setiap foto yang disinkronisasi dari Bridge akan langsung di-upload ke *bucket* MinIO.
  - Alur: Bridge minta *Presigned URL* ke Backend -> Backend memvalidasi -> Bridge unggah file langsung ke MinIO (bypass server utama agar CPU server tidak terbebani *file upload*).
  - MinIO bisa di-*host* sendiri (Self-hosted) menggunakan Docker (`docker-compose.yml` yang sudah ada di repo).

## 5. Background Jobs (Worker)
- Aplikasi `apps/worker` yang ada di Turborepo akan berfungsi untuk memantau Redis Queue. Tugasnya:
  1. *Image Compression*: Mengecilkan ukuran gambar 10MB menjadi thumbnail 300KB untuk *Grid view* di Galeri Tamu.
  2. *Cleanup*: Menghapus otomatis *event photos* yang umurnya sudah melebihi 30 hari (untuk menghemat *storage* MinIO).
  3. Mengirim email laporan ke Admin setelah *event* selesai.

## Diagram Sederhana
`[Lumora Bridge (Laptop)]` -- (Presigned URL) --> `[MinIO Storage]`
`[Lumora Bridge (Laptop)]` -- (Sync Metadata REST) --> `[Next.js Backend]` --> `[PostgreSQL]`
`[Next.js Backend]` -- (Queue Job) --> `[Redis]` --> `[apps/worker (Compress Image)]`
`[Guest / Tamu (HP)]` <-- (WebSocket / Web Gallery) --> `[Next.js Frontend]` 
