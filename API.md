# API Contract — LUMORA

Semua route diimplementasikan via Hono, terintegrasi di Next.js route handler
(`apps/web/app/api/**/route.ts`). Semua body/query **wajib** divalidasi Zod sebelum menyentuh
DB — lihat `docs/SECURITY.md`.

## Auth

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/auth/login` | public (rate-limited) | Login admin/operator, set httpOnly cookie |
| POST | `/api/auth/logout` | session | Hapus cookie session |

## Events (Admin)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/events` | session (admin) | Buat event baru, generate `session_slug` (nanoid) + `bridge_token` |
| GET | `/api/events` | session (admin) | List event milik user |
| GET | `/api/events/:slug` | public* | Detail event by slug — dipakai operator console saat load. *dibatasi hanya field non-sensitif |
| PATCH | `/api/events/:id` | session (admin) | Update status, border/layout/filter aktif |
| DELETE | `/api/events/:id` | session (admin) | Soft-delete (set status `archived`), bukan hard delete |

## Template Assets (Border, Filter, Layout)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/borders` | session (admin) | Upload border custom (validasi mime-type, lihat SECURITY.md §4) |
| GET | `/api/borders?eventId=` | session | List border milik event + Global Template (`event_id IS NULL`) |
| POST | `/api/filters` | session (admin) | Buat filter preset custom untuk event |
| GET | `/api/filters?eventId=` | session | List filter milik event + global default |
| POST | `/api/layouts` | session (admin) | Buat layout (grid/strip) via `template_config` JSON |
| GET | `/api/layouts?eventId=` | session | List layout milik event + global default |

## Sessions (Operator)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/sessions` | session (operator) atau bridge token | Mulai sesi baru: `eventId`, `borderId`, `layoutId`, `filterId`, `captureSource` |
| POST | `/api/sessions/:id/photos` | session ATAU bridge token (§Security) | Upload 1 foto mentah (dari webcam browser maupun desktop bridge), body: file + `sequenceOrder` |
| POST | `/api/sessions/:id/complete` | session (operator) | Tandai sesi selesai capture → **enqueue job `compose-photo`** |
| GET | `/api/sessions/:id` | session (operator) | Poll status sesi (`capturing`/`processing`/`completed`/`failed`) — dipakai TanStack Query refetch, lihat ARCHITECTURE.md §4 |
| POST | `/api/sessions/:id/deliver` | session (operator) | Kirim `guestEmail` → **enqueue job `send-delivery`** |

## Results (Guest-facing, public tapi slug-protected)

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | `/api/results/:resultSlug` | public (rate-limited) | Ambil data hasil foto untuk render result page |
| POST | `/api/results/:resultSlug/view` | public | Increment `view_count` (best-effort, non-critical) |

## Print Jobs

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | `/api/print-jobs` | session (operator) | Tambah job cetak untuk `photoResultId` |
| GET | `/api/print-jobs?status=queued&eventId=` | session (print station) | Polling job yang belum dicetak |
| PATCH | `/api/print-jobs/:id` | session (print station) | Update status `printing`/`done`/`failed` |

## Contoh Zod schema (`POST /api/sessions`)

```ts
import { z } from "zod";

export const createSessionSchema = z.object({
  eventId: z.string().uuid(),
  borderId: z.string().uuid().nullable().optional(),
  layoutId: z.string().uuid().nullable().optional(),
  filterId: z.string().uuid().nullable().optional(),
  captureSource: z.enum(["webcam", "desktop_bridge"]),
});
```

## Contoh route Hono (pola yang dipakai di semua endpoint)

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createSessionSchema } from "./schema";

const app = new Hono();

app.post("/", zValidator("json", createSessionSchema), async (c) => {
  const input = c.req.valid("json");
  // ... auth check, insert via Prisma, return response
});

export default app;
```

## Job payloads (internal, BullMQ — bukan HTTP, tapi didokumentasikan di sini karena bagian dari kontrak antar service)

```ts
// compose-photo job payload
type ComposePhotoJob = {
  sessionId: string;
};

// send-delivery job payload
type SendDeliveryJob = {
  photoResultId: string;
  recipient: string; // email address
};

// retention-cleanup job — tidak butuh payload, repeatable job tanpa argumen
```
