# 📋 LUMORA Implementation Plan — Steps 1-4

## Overview

Gua udah:
1. ✅ Hapus semua WhatsApp reference dari docs
2. ✅ Hapus `guestWaNumber` field dari Prisma schema
3. ✅ Buat guide cara running LUMORA locally (`.RUNNING_LOCALLY.md`)
4. ✅ Create task list untuk steps 1-4

## Key Finding

**Schema yang actual jauh lebih complete** daripada yang di docs awal:
- Multi-tenant support (organizationId everywhere)
- Billing system (prepaid credit wallet, credit transactions, topups)
- Audit logs
- Bridge device management
- Advanced delivery tracking

**This is GOOD** — schema-nya production-ready, tidak cuma MVP skeleton.

## Implementation Order (Step by Step)

### Step 0: Setup Local Dev Environment (PREREQUISITE)
**Goal**: Website running di http://localhost:3000

```bash
# Copy .env dan set JWT secrets
cp .env.example .env
# Edit AUTH_JWT_SECRET dan SIGNED_URL_SECRET

# Start Docker
docker compose up -d

# Setup database
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Run servers
pnpm dev  # atau pnpm dev:web + pnpm dev:worker di terminal terpisah
```

**Expected result**: Login dengan `admin@lumora.dev` / `Lumora123!` works ✅

---

### Step 1: Setup `packages/db` (Schema + Migrations + Seed)
**Goal**: Database schema final, migrations bersih, seed data complete

**What to check/verify:**
- [ ] Migration files tersimpan di `packages/db/prisma/migrations/`
- [ ] `guestWaNumber` field sudah dihapus dari schema
- [ ] Seed script berjalan tanpa error: `pnpm db:seed`
- [ ] Demo data ada:
  - 2 demo users (admin@lumora.dev, operator@lumora.dev)
  - 1 demo organization
  - 3+ global borders/layouts/filters (dengan `organizationId = NULL`)
  - 3+ default filters (NORMAL, GRAYSCALE, VINTAGE)

**Files to check:**
- `packages/db/prisma/schema.prisma` — final schema
- `packages/db/src/seed/index.ts` — seed script
- `packages/db/prisma/migrations/` — all migration files

**Success criteria:**
```bash
pnpm db:generate  # ✓ no errors
pnpm db:migrate   # ✓ no errors  
pnpm db:seed      # ✓ no errors
psql -U lumora -h localhost -p 5434 -d lumora -c "SELECT COUNT(*) FROM users;"  # returns 2
```

---

### Step 2: Auth Admin + CRUD Events (`apps/web` routes)
**Goal**: Login works, admin can CRUD events + upload templates

**Endpoints to implement:**
1. `POST /api/auth/login` — JWT + httpOnly cookie
2. `POST /api/auth/logout` — clear cookie
3. `GET /api/auth/me` — current user info
4. `POST /api/events` — create event
5. `GET /api/events` — list user's events
6. `GET /api/events/:id` — detail event
7. `PATCH /api/events/:id` — update status/default templates
8. `DELETE /api/events/:id` — soft-delete
9. `POST /api/borders` — upload border image
10. `GET /api/borders?eventId=:id` — list borders (event + global templates)

**UI to implement:**
- Admin dashboard (basic list of events)
- Event creation form
- Event detail + template picker

**Success criteria:**
- Login berhasil → session cookie set
- POST /api/events berhasil buat event
- GET /api/events return list
- Upload border berhasil simpan ke storage

---

### Step 3: Operator Console UI (`apps/web` page)
**Goal**: `/operator/[eventId]` halaman dengan live capture

**Features:**
- Camera source picker (webcam / DSLR bridge)
- Live preview (WebRTC getUserMedia)
- Filter selector dropdown (NORMAL, GRAYSCALE, VINTAGE)
- Capture button (ambil 3-4 foto)
- Status polling via TanStack Query
- QR display saat ready
- Email form untuk guest delivery

**Pages to implement:**
- `app/operator/[eventId]/page.tsx` — main operator console
- `app/operator/[eventId]/display/page.tsx` — dual-screen display mode (optional fase 1)

**Success criteria:**
- Page loads
- Camera preview works (permissions granted)
- Can select filter
- Can click capture button
- QR code renders saat session ready

---

### Step 4: Background Workers (`apps/worker` BullMQ jobs)
**Goal**: Compose job + retention job running

**Jobs to implement:**
1. **`compose-photo`** — merge photos + border + filter via Sharp
   - Input: sessionId
   - Process: Load photos → apply filter → add border → output 4R 300dpi image
   - Output: Save to storage, create photo_result record
   
2. **`retention-cleanup`** — repeatable job, jalankan daily
   - Query sessions > 30 hari
   - Delete files dari storage
   - Delete session + cascade (photos, photo_results, print_jobs)

**Job handlers:**
- `apps/worker/src/jobs/compose.ts`
- `apps/worker/src/jobs/retention.ts`

**Success criteria:**
- Jobs dapat enqueued dari API
- Jobs dapat dijalankan
- Compose job output file tersimpan di storage
- Retention job dapat schedule + run tanpa error

---

## Next Steps (After 1-4)

5. Result page tamu `/r/[resultSlug]` + email delivery
6. Desktop bridge folder watcher
7. Print job queue
8. Security hardening (rate limiting, CORS, audit)

---

## Running Locally (Quick Reference)

```bash
# Terminal 1
docker compose up -d

# Terminal 2
pnpm dev  # runs web + worker

# Terminal 3 (optional, untuk debugging)
pnpm dev:worker  # see job logs

# Access
http://localhost:3000
Login: admin@lumora.dev / Lumora123!
```

Full guide: `.RUNNING_LOCALLY.md`
