# LUMORA

**Enterprise Operator-Assisted Photobooth Platform (B2B SaaS)** — implements PRD v3.0 (Operator-Assisted Web Photobooth & Desktop Bridge).

Event/Wedding Organizers run professional photobooth sessions from a laptop (Print Station), capturing via **Webcam (WebRTC)** or **DSLR (Desktop Bridge folder watcher)**, with server-side composition (border + filter + 4R layout), dynamic-QR guest delivery, WhatsApp/email delivery, printing, galleries, analytics, and full audit trails — multi-tenant with RBAC.

---

## Monorepo layout

```
apps/
  web/        Next.js 15 (App Router) — dashboard, Operator Workspace, guest gallery, Hono API
  worker/     BullMQ workers — compose (Sharp), delivery (email/WA), notifications, cleanup
  bridge/     Electron Desktop Bridge — DSLR tether folder watcher, offline queue, uploader
packages/
  contracts/  Zod schemas, enums, permissions, layout contract (FR-07) — single validation truth
  core/       Env, crypto, JWT, Redis, BullMQ queues, rate limiting, storage adapters, realtime
  db/         Prisma schema + repositories + seed (global templates, filters, demo org)
  image/      FR-03 compression (browser + server) and FR-04 compose engine (Sharp)
  ui/         Design system (Tailwind preset + shadcn-style components)
```

## Requirements

- Node.js ≥ 20, pnpm 9 (`npm i -g pnpm@9`)
- Docker (for local PostgreSQL + Redis) — or a Supabase Postgres + any Redis

## Quick start (local)

```bash
# 1. Infrastructure
docker compose up -d               # Postgres :5432, Redis :6379

# 2. Environment
cp .env.example .env               # then set AUTH_JWT_SECRET + SIGNED_URL_SECRET (32+ chars)

# 3. Install & database
pnpm install
pnpm db:generate
pnpm db:push                       # or: pnpm db:migrate (creates migration files)
pnpm db:seed                       # global layouts/borders/filters + demo accounts

# 4. Run (two terminals)
pnpm dev:web                       # http://localhost:3000
pnpm dev:worker                    # compose/delivery/notification/cleanup workers

# 5. Desktop Bridge (optional, DSLR flow)
pnpm dev:bridge
```

**Demo accounts** (seeded): `admin@lumora.dev` / `operator@lumora.dev` — password `Lumora123!`.

## The session flow (PRD §3)

1. **Admin** → Events → New event → pick default border/layout → share the Operator URL (or assign operators).
2. **Operator** opens `/operator/<eventId>` → picks Webcam or DSLR Bridge → guest requests a filter → operator sets it → captures 3–4 frames (client-side compressed to ≤1.5 MB, FR-03).
3. **Compose** → worker merges photos + filter + layout + border with Sharp (FR-04/07) → operator screen flips to READY over SSE.
4. **Delivery** → dynamic QR (FR-06), WhatsApp, or email → optional 4R print → **New Session** revokes the previous QR server-side.

## Storage drivers

| Driver | Config | Notes |
|---|---|---|
| `local` (default) | `LOCAL_STORAGE_DIR` | Objects on disk; HMAC-signed URLs served by the web app. Zero-config dev. |
| `supabase` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | Private bucket + signed URLs. Create the bucket once (private). |

## Delivery providers

- **Email**: `EMAIL_DRIVER=console` (dev, logs the mail) or `smtp` (+ SMTP_* vars).
- **WhatsApp**: `WHATSAPP_DRIVER=link` (zero-config wa.me click-to-chat opened on the operator screen) or `twilio` (WhatsApp Business API push).

## Billing (prepaid credit)

Prepaid wallet per organization; **one charge per composed session** (default `PRICE_PER_SESSION_IDR=2000`, per-org override via `organizations.session_price_idr`).

- **Ledger, not a balance column**: `credit_transactions` is append-only; balance = `SUM(amount)`. Charges and top-up credits are idempotent via unique `(session_id|topup_id, type)` constraints.
- **Guest-safe by design**: starting a *new* session requires credit (`402 PAYMENT_REQUIRED`), but an in-flight session always finishes — balance may dip negative and settles on the next top-up. Billing failures never fail a compose.
- **Low-balance notification** fires when the balance crosses `LOW_BALANCE_THRESHOLD_IDR`.
- **Payment drivers**: `PAYMENT_DRIVER=dev` (local; settle via *Simulate paid* on the Billing page — refused on non-localhost deployments) or `xendit` (Invoice API: QRIS/VA/e-wallet; set `XENDIT_SECRET_KEY` + `XENDIT_CALLBACK_TOKEN`, point the Xendit callback to `POST /api/billing/webhook`).

Dashboard → **Billing**: balance, sessions remaining, top-up (presets + custom), pending invoice, full ledger.

## Dual-device mode (Display Screen)

For the phone-camera + laptop-display setup: open **`/operator/<eventId>/display`** on the laptop (button "Display" in the operator console header) and run the session from the operator console on a phone. The display listens to the event SSE stream:

- idle → welcome screen; capturing → live frame progress; composing → spinner;
- **READY → big QR auto-appears** (auto-minted) + WhatsApp/email form + print — no refresh;
- starting a new session kills the QR instantly (server-side revocation, FR-06).

## Desktop Bridge pairing

Dashboard → Event → **Pair Bridge** → an 8-char code (10 min TTL). Enter it in the Bridge app with the server URL. The bridge receives a device JWT, heartbeats every 15 s, watches the tether folder (`awaitWriteFinish` debounce), compresses with Sharp, and uploads with a durable offline queue + exponential backoff. Photos arriving with no active bridge session are **quarantined** and can be attached from the operator's Inbox.

## Security model

- JWT access (15 min) + rotating refresh tokens (hashed at rest), httpOnly SameSite=Lax cookies
- CSRF: Origin check + `x-lumora-csrf` custom-header requirement on all mutations
- RBAC: OWNER / ADMIN / OPERATOR with a permission catalog (`packages/contracts/src/permissions.ts`); operators are event-scoped
- Redis rate limiting per route class (login, uploads, guest views, pairing)
- All media private; access only via time-limited signed URLs; delivery tokens stored hashed with server-side revocation (FR-06)
- Uploads validated by decoding (Sharp), never by MIME header; size caps enforced server-side
- Full audit log (who/what/when/IP) on every consequential mutation

## Scripts

| Command | What |
|---|---|
| `pnpm dev` | web + worker (+bridge) via turbo |
| `pnpm typecheck` | typecheck every workspace |
| `pnpm build` | production builds |
| `pnpm db:migrate` / `db:push` / `db:seed` / `db:generate` | Prisma lifecycle |
| `pnpm --filter @lumora/bridge dist` | package the Bridge installer (electron-builder) |

## Production notes

- Run `apps/web` with `next start` (Node runtime — SSE and Sharp need it) behind TLS; set `APP_URL` accordingly.
- Run at least one `apps/worker` instance; scale compose concurrency via more workers.
- Use `pnpm db:migrate` (migration files) rather than `db:push` for schema changes.
- Set strong `AUTH_JWT_SECRET` / `SIGNED_URL_SECRET`; rotate refresh tokens are revoked on password change.
- Seed skips demo accounts when `NODE_ENV=production` (force with `SEED_DEMO=true`).
