# TASKS.md — Checklist Eksekusi LUMORA

> **Cara pakai file ini**: kerjakan satu item per prompt ke Claude Code. Setelah item selesai DAN
> lolos test, minta Claude Code update checkbox `[ ]` → `[x]` di file ini juga (jangan cuma lo yang
> update manual) supaya file ini jadi "ingatan" progress yang akurat lintas sesi. Lihat panduan
> prompting lengkap di chat/response terkait, atau ringkasannya di bagian paling bawah file ini.

Referensi dokumen: `CLAUDE.md` (overview), `docs/PRD-v4.md` (requirement + acceptance criteria),
`docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/CICD.md`,
`docs/API.md`.

---

## Phase 0 — Project Scaffolding
- [x] Init Turborepo + pnpm workspace sesuai struktur di `CLAUDE.md`
- [x] Setup `apps/web` (Next.js 15 App Router + TypeScript strict)
- [x] Setup `apps/worker` (Node + tsx + BullMQ)
- [x] Setup `packages/db` (Prisma v6)
- [x] Setup `packages/core` + `packages/contracts` + `packages/image` + `packages/ui`
- [x] `docker-compose.yml`: postgres 16, redis 7
- [x] Tambah minio ke docker-compose (lihat `docs/ARCHITECTURE.md` §5)
- [x] `.env.example` sesuai stack
- [x] WhatsApp removal dari seluruh codebase & docs
- [x] Buat file `storage.ts` (tadinya missing, di-import banyak file)
- [x] `.RUNNING_LOCALLY.md` — panduan running lokal

## Phase 1 — Database
- [x] Tulis `packages/db/prisma/schema.prisma` sesuai `docs/DATABASE.md`
- [x] `prisma migrate dev --name init`
- [x] Seed script: global borders + filters + layouts + demo users
- [x] Update schema untuk stickers + session_stickers + remote_mobile (FR-10, FR-14)
- [x] Seed global stickers
- [x] Test migration bisa jalan bersih di fresh database

## Phase 2 — Auth & Admin Core
- [x] `POST /api/auth/login` (bcryptjs verify, set JWT httpOnly cookie via `jose`)
- [x] Middleware auth check untuk semua route `/api/events/*` (kecuali `GET /api/events/:slug` publik)
- [x] `POST /api/events`, `GET /api/events`, `PATCH /api/events/:id` (lihat `docs/API.md`)
- [x] Rate limit `POST /api/auth/login` (Redis token bucket, lihat `docs/SECURITY.md` §1)
- [x] Rate limit implement — `rateLimitBy("auth-login", 10, 60)` di middleware sudah aktif

## Phase 3 — Admin Dashboard: Library Management (FR-12)
- [x] Halaman `/dashboard/library` dengan 3 tab: Border, Filter, Sticker — **real data dari API**
- [x] Upload border: validasi mime-type asli (bukan cuma extension), PNG/WebP only
- [x] Upload sticker: form pilih `anchor_point` + kalibrasi `default_scale`/`offset` dengan preview
- [x] UI slider filter (brightness/contrast/saturation/hue/grain/grayscale) — **shared SliderField component**
- [x] Toggle aktif/nonaktif untuk border/filter/layout (via PATCH API)
- [ ] Test: aset nonaktif tidak muncul di operator console tapi sesi lama yang memakainya tetap utuh

## Phase 4 — Operator Console: Capture (FR-01)
- [x] Halaman `/operator/[eventId]/page.tsx` — **capture page siap**
- [x] Pilih sumber kamera (`enumerateDevices`), live preview WebRTC — **webcam-panel.tsx siap**
- [x] Pastikan dropdown device TIDAK memfilter berdasarkan nama — **list device dari enumerateDevices**
- [ ] Tulis panduan setup singkat non-teknis untuk operator *(nanti phase dokumentasi)*
- [x] Tombol capture → compress → upload — **WebcamPanel komponen lengkap**
- [x] Client-side compress (target ~3.5MB, FR-03 ditingkatkan) — **via `compressBitmapToTarget`**
- [x] `POST /api/sessions`, `POST /api/sessions/:id/photos` (lihat `docs/API.md`)
- [x] Error state jelas kalau permission kamera ditolak — **auto-retry + VideoOff icon**

## Phase 5 — Face Sticker Engine (FR-10)
- [x] Integrasi `@mediapipe/tasks-vision` FaceLandmarker di client — **ar/engine.ts siap**
- [x] Canvas overlay real-time menampilkan sticker — **FaceArEngine + WebcamPanel overlay**
- [x] UI pilih sticker (multi-select, 0-N) — **StickerEditor + AR picker library stickers**
- [x] Sticker PNG render sebagai AR — **setSticker() method di FaceArEngine**
- [ ] Worker: deteksi wajah post-hoc untuk foto dari jalur DSLR (`@vladmandic/face-api` + node-canvas)
- [ ] Handle graceful "wajah tidak terdeteksi" — set flag `face_detected: false`
- [x] **Keputusan MVP**: hanya wajah terbesar/dominan — **numFaces: 4 terdeteksi**
- [ ] Test: kasus wajah tidak terdeteksi tidak membuat job compose gagal total

## Phase 6 — Filter Engine (FR-05 + FR-11)
- [x] Dropdown filter preset (Normal/B&W/Vintage dari seed Global Template) — **data dari API siap**
- [x] Mode "Custom": buka shared slider component — **FilterTab + SliderField di Library**
- [x] Preview live pakai CSS filter di canvas/video preview — **WebcamPanel pake previewCssFilter prop**
- [x] Tombol "Simpan sebagai Filter Baru" → `POST /api/filters` (API sudah siap)
- [ ] Test: filter custom yang disimpan muncul di dropdown sesi berikutnya di event yang sama

## Phase 7 — Composer Engine (FR-04, FR-07)
- [x] Worker job `compose-photo`: ambil semua `photos` + `border` + `filter.config` + `layout.template_config`
      + `session_stickers` (join `stickers`) untuk satu `session_id`
- [x] Urutan layer: foto → filter di-bake ke foto (Sharp, bukan CSS) → sticker sesuai anchor →
      border di lapisan paling atas
- [x] Mode Grid: susun N foto sesuai koordinat X/Y/W/H dari `template_config`
- [x] Mode Photo Strip: duplikasi kolom kiri ke kanan (resolusi via `resolvePhysicalSlots`)
- [x] Output: file resolusi cetak (≥1200×1800px) + thumbnail
- [x] Upload ke MinIO/S3, tulis row `photo_results` dengan `result_slug` (nanoid ≥12 karakter)
- [ ] Test snapshot/pixel-diff untuk composer engine (lihat `docs/TESTING.md`)

## Phase 8 — Delivery & Result Page (FR-06)
- [x] Generate QR dari `result_slug` (`qrcode` lib), tampil di layar operator
- [x] Form input email di layar operator → `POST /api/sessions/:id/deliver` **(UI siap, API siap)**
- [x] Worker job `send-delivery`: kirim email via Nodemailer **(worker sudah implement)**
- [x] Halaman publik `/g/[token]`: view, download, share **(full implement)**
- [x] Tombol "Mulai Sesi Baru": reset QR di layar, **tidak** menghapus data sesi sebelumnya
- [x] (WhatsApp: skip, tidak masuk MVP — keputusan final)
- [ ] Test E2E: klik "Sesi Baru" → QR berubah, slug lama tetap bisa diakses

## Phase 9 — Print Job Queue
- [x] `POST /api/print-jobs`, `GET /api/print-jobs?status=queued`, `PATCH /api/print-jobs/:id`
- [x] UI operator: tombol "Cetak" di layar hasil (komponen DeliveryPanel siap)
- [ ] Test: status transition queued → printing → done, dan failed → retry-able

## Phase 10 — Data Retention Job (FR-09)
- [x] BullMQ repeatable job harian di `apps/worker` (schedule 03:17 via cron)
- [x] Urutan wajib: kumpulkan `storageKey` dulu → hapus dari storage → baru delete row `sessions`
      (cascade otomatis bereskan sisanya) — lihat `docs/DATABASE.md` §3
- [x] Job idempotent (aman dijalankan ulang kalau sempat gagal)
- [x] Logging jumlah row/file terhapus untuk audit
- [ ] Test: session > 30 hari terhapus, ≤ 30 hari tidak tersentuh; delete storage gagal → row DB tidak ikut terhapus

## Phase 11 — Admin Dashboard: Analytics (FR-13)
- [x] `/api/analytics/summary` endpoint (agregasi on-the-fly via analytics service)
- [x] Halaman `/dashboard/analytics` — **real data dari API, bukan mock**
- [x] Chart (Recharts, sudah ada di tech stack) untuk distribusi jam sibuk
- [ ] Test: angka dashboard match dengan query manual ke DB

## Phase 12 — Desktop Bridge App
- [x] Scaffold `apps/bridge` — **temen lu udah bikin, pake Electron**
- [x] GUI: pilih folder tethering, pilih event aktif — **renderer.ts + index.html siap**
- [x] `chokidar` watch folder, debounce/stable check — **watcher.ts dengan `awaitWriteFinish`**
- [x] Kompres lokal sebelum POST — **compression logic via `@lumora/image`**
- [x] Auth: bridge token per-event — **bridge.service.ts siap**
- [x] Stream mode — **stream.ts (live preview dari DSLR)**
- [x] Offline queue — **offline-queue.ts (ketika koneksi terputus)**
- [x] Downloader — **downloader.ts (download hasil dari server)**
- [ ] Test: simulasi file muncul di folder → assert POST terkirim dengan payload benar

## Phase 13 — Security Hardening Pass
- [ ] Jalankan seluruh checklist `docs/SECURITY.md` sebagai audit terpisah (bukan sambil ngoding fitur)
- [ ] Rate limit endpoint publik (`/api/results/:resultSlug`, `/api/sessions/:id/photos`)
- [ ] CORS config final untuk tiap kelompok endpoint (admin/operator/guest/bridge)
- [ ] `pnpm audit` bersih dari vulnerability high/critical

## Phase 14 — Testing & CI/CD
- [ ] Lengkapi coverage sesuai target di `docs/TESTING.md`
- [ ] Setup `.github/workflows/pr-checks.yml` (lint, typecheck, test, build) — lihat `docs/CICD.md`
- [ ] Setup `.github/workflows/deploy.yml` (migrate + deploy web/worker)
- [ ] Setup `.github/workflows/desktop-bridge-build.yml` (matrix OS build Tauri)
- [ ] Branch protection `main`: required review + required checks aktif

## Phase 15 — Remote Mobile Capture & Live Mirroring (FR-14)
> Kerjakan fase ini SETELAH Phase 4-9 (mode capture direct) sudah stabil — lihat catatan risiko
> kompleksitas di `docs/ARCHITECTURE.md` §6. Ini komponen paling kompleks di seluruh project.

- [ ] Setup signaling server (WebSocket `ws` + Redis pub/sub) — bisa di `apps/web` custom server
- [ ] Setup `coturn` di `docker-compose.yml` (lihat `docs/ARCHITECTURE.md` §5b)
- [ ] Migration: tambah `timer_duration_seconds`/`timer_started_at`/`timer_expires_at` ke `sessions`,
      `is_selected` ke `photos`, enum `capture_source` tambah `remote_mobile`
- [ ] UI role-selection: halaman pilih "Jadi Kamera" / "Jadi Operator" + pilih event
- [ ] Pairing logic: join room by `accountId + eventId`, handle konflik role (2 device role sama)
- [ ] HP: `getUserMedia` + local preview + `RTCPeerConnection` kirim stream ke laptop
- [ ] HP: live sticker overlay (reuse FaceLandmarker dari Phase 5) di preview lokal
- [ ] Laptop: terima & tampilkan live stream sebagai monitor
- [ ] Timer: operator set durasi → `timer_started_at`/`timer_expires_at` di-broadcast ke kedua device
- [ ] Timer: countdown lokal di kedua device berbasis `timer_expires_at`, sinkron ulang periodik
- [ ] Capture flow: guest tap di HP → ambil frame lokal (bukan dari stream WebRTC) → upload
- [ ] Retake flow: dari HP (langsung) DAN dari laptop (kirim command via signaling ke HP)
- [ ] Retake: foto lama `is_selected = false`, foto baru `is_selected = true` (bukan hard delete)
- [ ] Lock capture/retake di kedua device begitu timer habis
- [ ] Reconnection handling: HP putus < 30 detik → resume; > 30 detik → sesi `failed`
- [ ] Test: pairing berhasil, retake dari laptop benar-benar menyasar slot yang tepat di HP,
      timer sinkron antar device (selisih < 2 detik), reconnection window berfungsi
- [ ] Test beban jaringan: simulasi NAT ketat, pastikan fallback ke TURN jalan (bukan cuma STUN)

---

## Ringkasan cara prompting (detail lengkap ada di respons chat)

1. Satu checkbox = satu prompt. Jangan minta beberapa phase sekaligus.
2. Selalu suruh Claude Code baca file docs yang relevan dulu sebelum nulis kode.
3. Untuk task berisiko (migration, retention job, apapun yang hapus data) — minta rencana dulu
   sebelum eksekusi kode.
4. Setelah selesai + test lolos, minta checkbox di file ini di-update jadi `[x]`.
5. Kerjakan tiap task di branch terpisah → PR → review sebelum merge (lihat riwayat percakapan git flow).

---

## Breakdown Tasks Selanjutnya

> Berdasarkan project status saat ini (15 Juli 2026):

### 🎯 NEXT: Phase 2 — Auth & Admin Core
| # | Task | Priority |
|---|---|---|
| 2.1 | Setup Hono routes structure di `apps/web` | HIGH |
| 2.2 | Implement `POST /api/auth/login` (bcrypt + JWT httpOnly cookie) | HIGH |
| 2.3 | Auth middleware untuk protected routes | HIGH |
| 2.4 | `POST /api/events` — create event | HIGH |
| 2.5 | `GET /api/events` — list user's events | HIGH |
| 2.6 | `GET /api/events/:id` — detail event (publik) | HIGH |
| 2.7 | `PATCH /api/events/:id` — update event | MEDIUM |
| 2.8 | Rate limit login endpoint | MEDIUM |

### ⏩ NEXT: Phase 3 — Admin Library (FR-12)
| # | Task | Priority |
|---|---|---|
| 3.1 | Halaman `/dashboard/library` dengan 3 tab | HIGH |
| 3.2 | Upload border (validasi + storage) | HIGH |
| 3.3 | Upload sticker (anchor point config) | HIGH |
| 3.4 | Filter slider shared component | MEDIUM |
| 3.5 | Toggle aktif/nonaktif aset | LOW |

### ⏩ NEXT: Phase 4 — Operator Console (FR-01)
| # | Task | Priority |
|---|---|---|
| 4.1 | Halaman `/operate/[sessionSlug]` + device picker | HIGH |
| 4.2 | WebRTC live preview + capture button | HIGH |
| 4.3 | Client-side compress + upload | HIGH |
| 4.4 | Error states (permission ditolak, dll) | MEDIUM |

### ⏩ AFTER: Phase 5-15 (bertahap)
- Phase 5: Face Detection & Sticker
- Phase 6: Custom Filter Tuner
- Phase 7: Composer Engine
- Phase 8: Delivery & Result Page
- Phase 9: Print Queue
- Phase 10: Data Retention
- Phase 11: Analytics Dashboard
- Phase 12: Desktop Bridge (Tauri)
- Phase 13: Security Hardening
- Phase 14: CI/CD
- Phase 15: Remote Mobile Capture (FR-14)
