# PRD v3.2 — Operator-Assisted Web Photobooth & Desktop Bridge (Sumber Asli)

> Salinan verbatim dari `PRD-Photobooth-v3_2-SuperComplete.pdf` yang diupload. Jangan diedit
> langsung — kalau ada perubahan requirement, buat file amandemen terpisah dan rujuk balik ke sini.

**Versi**: 3.2 (Final Consolidated + Data Retention & Full DB)
**Tanggal**: 14 Juli 2026
**Status**: Approved for Development

## Ringkasan Perubahan Utama (V3.2)

Model resmi **Operator-Assisted**, penambahan Global Template Border, Dynamic Layout/Strip 4R,
filter dinamis oleh tamu, Smart Auto-Compression lokal, Automated Data Retention (30 hari), dan
Full Database Schema (9 tabel).

## 1. Executive Summary & Tujuan

Platform Photobooth B2B SaaS untuk EO/WO. Operator mengendalikan seluruh sesi dari laptop (Print
Station) tanpa tamu perlu buka browser/app sendiri. Hardware-agnostic (Webcam HD maupun DSLR).

- **Tujuan Bisnis**: SaaS mudah setup, memangkas biaya alat, siap pakai berbagai acara, ramah
  biaya server (Zero-Cost/Low-Cost infra).
- **Tujuan Guest**: hasil foto (cetak & digital) cepat, privasi terjaga, data dihapus setelah
  batas waktu.

## 2. Scope & Fitur Utama (MVP)

- **Multi-Source Capture**: Webcam HD (WebRTC) & DSLR/Mirrorless (Desktop Folder Watcher)
- **Smart Auto-Compression**: kompresi lokal sebelum upload, resolusi tetap layak cetak 4R
- **Dynamic Template & Border**: upload sendiri atau Global Template Library
- **Dynamic Grid & Layout**: JSON config, mendukung Photo Strip (duplikasi kolom kiri↔kanan)
  dan Grid standar
- **Dynamic Filter Selection**: Normal, B&W, Vintage per sesi
- **Secure Delivery (QR Dinamis)**: Email + QR di layar operator yang reset tiap sesi baru
- **Automated Data Retention**: cleanup file + row DB untuk sesi > 30 hari (Cron Job)

## 3. User Journey & Flow

| Fase | Alur |
|---|---|
| A. Setup Event (Admin) | Login → Buat Event → Pilih/Upload Border → Konfigurasi Layout → generate URL Event untuk Operator |
| B. Sesi Foto (Operator) | Buka URL Event di laptop → Pilih sumber kamera → tamu request filter → operator set filter → capture 3-4 frame |
| C. Proses & Delivery | Auto-Compress & Upload → Server Compose → QR Dinamis + form WA/Email → tamu scan/input → cetak (opsional) → operator klik "Sesi Baru" |
| D. Maintenance | Cron harian → scan data > 30 hari → hapus file storage → hapus row DB |

## 4. Functional Requirements

| ID | Fitur | Spesifikasi |
|---|---|---|
| FR-01 | Web Capture Engine | WebRTC untuk akses Webcam HD eksternal |
| FR-02 | Desktop Bridge App | GUI (Electron/Tauri) memantau folder tethering DSLR, POST ke API |
| FR-03 | Smart Auto-Compress | Client-side, target maksimal ~1.5MB per foto (optimal 4R 300dpi) |
| FR-04 | Composer Engine | Backend (Node.js/Sharp) menyatukan koordinat foto+border+filter |
| FR-05 | Filter Selection UI | Dropdown/thumbnail di layar operator, disimpan via `filter_id` |
| FR-06 | Privacy & QR Dinamis | QR wajib reset otomatis saat "Mulai Sesi Baru" ditekan |
| FR-07 | Layout Engine | Mapping X,Y,W,H dari JSON, otomatisasi duplikasi mode Photo Strip |
| FR-08 | Template System | Global Template jika `event_id` NULL di `borders`/`layouts` |
| FR-09 | Data Retention & Cleanup | Cron harian, hapus fisik di Storage lalu row sesi, via `ON DELETE CASCADE` |

## 5. Arsitektur & Teknologi (asumsi awal PRD — lihat `ARCHITECTURE.md` untuk penyesuaian final)

- Frontend & Backend API: Next.js (App Router), React, Tailwind CSS
- Desktop Bridge: Electron.js atau Tauri
- Database & Realtime: PostgreSQL via Supabase *(disesuaikan jadi self-hosted + MinIO, lihat ARCHITECTURE.md §5-6)*
- Image Processing: Sharp (Node.js)
- Task Scheduling: Vercel Cron Jobs / pg_cron *(disesuaikan jadi BullMQ repeatable job, lihat ARCHITECTURE.md §3)*

## 6. Skema Database

Lihat `docs/DATABASE.md` untuk schema Prisma final. DDL PostgreSQL mentah asli dari PRD:

```sql
-- 1. USERS
CREATE TABLE users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL,
 password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'admin',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. EVENTS
CREATE TABLE events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name VARCHAR(255) NOT NULL, event_date DATE,
 status VARCHAR(20) NOT NULL DEFAULT 'draft', session_slug VARCHAR(64) UNIQUE NOT NULL,
 max_photos_per_guest INT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. BORDERS (Mendukung Global Templates - event_id NULL)
CREATE TABLE borders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID REFERENCES events(id) ON DELETE CASCADE,
 name VARCHAR(255) NOT NULL, image_url TEXT NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. FILTERS
CREATE TABLE filters (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID REFERENCES events(id) ON DELETE CASCADE,
 name VARCHAR(100) NOT NULL, config JSONB NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. LAYOUTS
CREATE TABLE layouts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID REFERENCES events(id) ON DELETE CASCADE,
 name VARCHAR(100) NOT NULL, photo_count INT NOT NULL,
 template_config JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. SESSIONS (Instance Perekaman)
CREATE TABLE sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
 border_id UUID REFERENCES borders(id), layout_id UUID REFERENCES layouts(id),
 filter_id UUID REFERENCES filters(id), guest_email VARCHAR(255),
 capture_source VARCHAR(30) CHECK (capture_source IN ('webcam','desktop_bridge')),
 status VARCHAR(20) NOT NULL DEFAULT 'capturing',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ
);

-- 7. PHOTOS
CREATE TABLE photos (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 file_url TEXT NOT NULL, sequence_order INT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. PHOTO RESULTS
CREATE TABLE photo_results (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
 result_slug VARCHAR(32) UNIQUE NOT NULL, file_url TEXT NOT NULL,
 thumbnail_url TEXT, expires_at TIMESTAMPTZ, view_count INT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_photo_results_slug ON photo_results(result_slug);

-- 9. PRINT JOBS
CREATE TABLE print_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 photo_result_id UUID NOT NULL REFERENCES photo_results(id) ON DELETE CASCADE,
 status VARCHAR(20) NOT NULL DEFAULT 'queued',
 printed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
