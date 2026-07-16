# Testing Strategy — LUMORA

TECH_STACK.md tidak mencantumkan test runner apapun — ini rekomendasi yang perlu ditambahkan ke
`package.json` sebelum implementasi dimulai:

| Kebutuhan | Tools |
|---|---|
| Unit & component test | `vitest` + `@testing-library/react` |
| API route test (Hono) | `vitest` + Hono's built-in test client (`app.request(...)`) |
| E2E test | `@playwright/test` |
| Image output diff (composer engine) | `pixelmatch` + `pngjs` |
| Job/queue test | `vitest` dengan BullMQ in-memory/test Redis instance |

## 1. Piramida testing

```
        ▲  E2E (Playwright) — sedikit, mahal, high-value
       ▲▲▲ Integration (API route + DB test container)
     ▲▲▲▲▲ Unit (komponen React, fungsi murni, job handler)
```

## 2. Prioritas testing per FR (bukan semua butuh coverage sama rata)

### Composer Engine (FR-04, FR-07) — **prioritas tertinggi**
Ini logika paling gampang salah diam-diam (posisi geser sedikit, hasil tetap "kelihatan benar"
sekilas tapi salah saat dicetak).
- Unit test: kasih input koordinat `template_config` yang diketahui, assert posisi X/Y/W/H tiap
  foto di canvas output sesuai ekspektasi.
- Snapshot/pixel-diff test: render 1 layout referensi, bandingkan dengan golden image pakai
  `pixelmatch`, toleransi diff kecil (mis. < 0.1% pixel berbeda) untuk antisipasi perbedaan minor
  antar versi Sharp.
- **Mode Photo Strip**: test eksplisit bahwa foto di kolom kiri terduplikasi persis ke kolom kanan
  (FR-07) — ini requirement yang gampang salah kalau logic-nya di-generalize tanpa hati-hati.

### Retention Job (FR-09) — **prioritas tinggi, resiko kehilangan data kalau salah**
- Gunakan fake timers / seed data dengan `created_at` yang dimanipulasi manual di test DB.
- Assert: session > 30 hari terhapus, session ≤ 30 hari **tidak** tersentuh.
- Assert urutan operasi benar: file storage dihapus SEBELUM row DB (lihat `docs/DATABASE.md` §3) —
  test dengan mock S3 client, verifikasi `deleteObject` dipanggil dengan url yang tepat sebelum
  `prisma.session.delete` dipanggil.
- Test failure path: kalau delete dari storage gagal (network error), row DB **tidak** boleh
  terlanjur terhapus (supaya tidak orphan reference).

### QR Dinamis (FR-06)
- E2E (Playwright): operator klik "Mulai Sesi Baru" → assert QR yang ditampilkan berubah (value
  berbeda dari sebelumnya) → assert slug lama di database (`photo_results` sesi sebelumnya) tetap
  ada dan masih bisa diakses (bukan dihapus, lihat `docs/SECURITY.md` §2).

### Desktop Bridge folder watcher
- Unit test `chokidar` handler pakai mock filesystem (mis. `mock-fs` atau temp directory nyata
  di test environment) — simulasikan file baru muncul, assert POST request terkirim dengan
  payload & bearer token yang benar.

### Upload & Compression (FR-01, FR-03)
- Integration test endpoint upload: kirim file valid → assert tersimpan, ukuran final sesuai
  target; kirim file dengan mime-type dipalsukan → assert ditolak (lihat `docs/SECURITY.md` §4).

## 3. E2E scenario wajib (Playwright)

1. Admin bikin event baru → pilih Global Template border → set layout Grid 4 foto → dapat
   `session_slug`.
2. Operator buka URL event → pilih webcam sebagai sumber → ambil 4 foto dummy → pilih filter
   B&W → sistem compose → QR muncul di layar.
3. Simulasi tamu buka `resultSlug` di tab baru → lihat hasil foto → klik download.
4. Operator klik "Mulai Sesi Baru" → assert QR sebelumnya berubah, sesi baru dimulai bersih.
5. Operator trigger print job → assert status job berubah `queued` → `done` (mock print station).

## 4. CI Gating

Semua PR wajib lolos `pnpm test` (unit + integration) sebelum bisa merge. E2E (Playwright) jalan
di CI juga tapi boleh non-blocking di awal (nightly/on-demand) sampai suite-nya stabil — baru
dijadikan required check setelah flaky rate rendah. Detail pipeline di `docs/CICD.md`.

## 5. Coverage target

| Modul | Target |
|---|---|
| Composer engine (`apps/worker` compose logic) | ≥ 85% |
| Retention job | ≥ 85% |
| Prisma query layer (`packages/db`) | ≥ 70% |
| API routes (Hono) | ≥ 75% |
| React components (UI) | ≥ 50% (fokus ke logic-heavy component, bukan styling) |
