# CLAUDE.md — LUMORA Project Context

> File ini adalah entry point yang otomatis dibaca Claude Code saat bekerja di repo ini.
> Detail lengkap ada di `docs/`. Jangan mulai coding sebelum baca `docs/ARCHITECTURE.md`.

## Apa ini

**LUMORA** — Operator-Assisted Web Photobooth & Desktop Bridge (B2B SaaS untuk EO/WO).
Operator mengendalikan seluruh sesi dari laptop (Print Station); tamu tidak perlu buka
browser/app sendiri. Hardware-agnostic: mendukung Webcam HD maupun DSLR (via Desktop Bridge).

Sumber kebenaran produk: **`docs/PRD-v4.md`** (versi aktif, lebih detail & mencakup fitur sticker
face-tracking, custom filter operator, dan admin dashboard). `docs/PRD-source.md` (v3.2) disimpan
sebagai arsip historis — jangan dipakai sebagai acuan implementasi lagi.

Checklist eksekusi ada di **`TASKS.md`** (root) — progress-nya di-update langsung di file itu
(centang `[x]`) setiap satu task selesai, supaya jadi "memory" yang persisten lintas sesi Claude Code.

## Monorepo structure

```
lumora/
├── apps/
│   ├── web/              # Next.js 15 (App Router) — UI operator + admin + guest result page
│   │                     # API routes via Hono, integrated in Next.js route handlers
│   ├── worker/           # Background jobs: compose, email, retention cleanup (BullMQ)
│   └── desktop-bridge/   # [BARU] Tauri app — folder watcher utk tethering DSLR
├── packages/
│   ├── db/               # Prisma schema, migrations, seed scripts
│   └── config/           # (opsional) shared eslint/tsconfig
├── docker-compose.yml    # postgres, redis, minio (lokal dev)
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── SECURITY.md
    ├── TESTING.md
    ├── CICD.md
    └── API.md
```

## Tech stack (ringkas — detail penuh di TECH_STACK.md asli)

| Layer | Pilihan |
|---|---|
| Monorepo | Turborepo + pnpm |
| Bahasa | TypeScript (strict mode wajib) |
| Web framework | Next.js 15 (App Router) + React 19 |
| API layer | Hono, terintegrasi di route handler Next.js |
| Validasi | Zod di setiap boundary (request body, query param, job payload) |
| Data fetching | TanStack React Query |
| Form | React Hook Form + @hookform/resolvers |
| Styling | Tailwind CSS + Framer Motion |
| ORM | Prisma v6 |
| DB | PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Image processing | Sharp |
| Email | Nodemailer |
| Password hashing | bcryptjs |
| QR generation | `qrcode` |

## Dependency yang perlu ditambahkan (tidak ada di TECH_STACK.md asli)

Jangan asumsikan ini sudah terpasang — cek `package.json` dulu sebelum pakai:

- `nanoid` — generate `session_slug` & `result_slug` yang unguessable
- `jose` — signing/verifikasi JWT untuk auth admin/operator (rekomendasi, ringan & edge-compatible)
- `@aws-sdk/client-s3` — client S3-compatible untuk MinIO
- `chokidar` — folder watcher di `apps/desktop-bridge`
- `@tauri-apps/cli` — build tooling desktop bridge
- Testing: `vitest`, `@testing-library/react`, `@playwright/test`, `pixelmatch` (lihat `docs/TESTING.md`)
- WhatsApp provider SDK — **belum diputuskan**, lihat catatan di `docs/ARCHITECTURE.md` §6

## Perintah dasar

```bash
pnpm install
docker compose up -d          # postgres, redis, minio
pnpm --filter db prisma migrate dev
pnpm dev                      # jalankan semua app via turbo
pnpm test                     # jalankan semua test via turbo
pnpm build
```

## Environment variables (`.env.example`)

```
DATABASE_URL=postgresql://user:pass@localhost:5432/lumora
REDIS_URL=redis://localhost:6379
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=lumora-photos
JWT_SECRET=
BRIDGE_TOKEN_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
APP_BASE_URL=http://localhost:3000
WA_PROVIDER_API_KEY=          # TBD — belum ada provider dipilih
```

## Konvensi kerja untuk Claude Code

- TypeScript strict, tidak ada `any` tanpa komentar alasan.
- Setiap Hono route wajib validasi input dengan Zod sebelum menyentuh DB.
- Semua perubahan lewat branch + Pull Request (lihat riwayat percakapan soal git flow) — jangan commit langsung ke `main`.
- Setiap PR wajib lolos: lint, typecheck, test, build (lihat `docs/CICD.md`).
- Baca `docs/SECURITY.md` sebelum implementasi apapun yang menyentuh auth, upload file, atau data tamu.
- Baca `docs/DATABASE.md` untuk schema Prisma final (sudah diterjemahkan dari DDL PRD, jangan menulis schema dari nol).

## Urutan implementasi yang disarankan

1. `packages/db` — schema Prisma + migration awal + seed global template
2. `apps/web` — auth admin, CRUD event, upload border/filter/layout
3. `apps/web` — operator console (pilih sumber kamera, capture, filter selection)
4. `apps/worker` — compose job (Sharp) + retention job (BullMQ repeatable)
5. `apps/web` — result page tamu + delivery (email dulu, WA menyusul)
6. `apps/desktop-bridge` — folder watcher + POST ke API
7. Print job queue + operator print trigger
8. Hardening: rate limiting, CORS, audit `docs/SECURITY.md` checklist
