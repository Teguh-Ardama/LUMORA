# Security — LUMORA

Checklist ini wajib dipenuhi sebelum fitur terkait dianggap "done", bukan opsional nice-to-have.

## 1. Autentikasi Admin/Operator

- Password hashing pakai `bcryptjs`, cost factor minimal **12**.
- Tech stack tidak menyediakan library session/JWT — rekomendasi: **`jose`** untuk sign/verify JWT,
  disimpan di **httpOnly, Secure, SameSite=Lax cookie** (bukan localStorage — hindari XSS token theft).
- Rate limit endpoint login (mis. 5 percobaan/menit per IP+email) memakai Redis yang sudah tersedia
  di stack (token bucket sederhana), untuk mencegah brute force.
- Tidak ada requirement multi-role granular di PRD selain `admin`/`superadmin` — jangan over-engineer
  RBAC di MVP, cukup middleware cek `role` di route yang butuh superadmin (mis. manage Global Template).

## 2. Slug & QR (result_slug, session_slug)

- **Wajib pakai `nanoid(12)` atau lebih panjang** — jangan sequential ID, jangan UUID pendek yang
  gampang ditebak sebagian.
- `result_slug` adalah satu-satunya "kunci" ke foto tamu — anggap ini setara password foto orang.
  Jangan log slug secara penuh di access log pihak ketiga (mis. analytics), redaksi kalau perlu.
- QR dinamis (FR-06): begitu operator klik "Sesi Baru", **slug lama tidak boleh diinvalidasi**
  secara hard-delete (fotonya tetap harus bisa diakses tamu sebelumnya) — yang direset hanyalah
  QR yang **ditampilkan di layar operator**, bukan record di database. Jangan sampai fitur ini
  disalahartikan jadi "hapus akses tamu sebelumnya".

## 3. Desktop Bridge Auth

Desktop Bridge jalan di laptop operator, seringkali di jaringan venue yang tidak terpercaya (WiFi
publik acara). Endpoint yang menerima POST dari bridge **tidak boleh** memakai kredensial admin biasa:

- Generate **bridge token** khusus per-event saat event dibuat (random string panjang, disimpan
  ter-hash di DB seperti password).
- Bridge kirim token via header `Authorization: Bearer <token>`, endpoint validasi token tsb
  cocok dengan event yang dituju — token scoped ke satu event saja, bukan akses global.
- Token di-invalidate otomatis saat `event.status` berubah jadi `ended`/`archived`.

## 4. Validasi Upload File

- Compression di client (FR-03) itu **optimisasi**, bukan kontrol keamanan — server tetap wajib
  validasi ulang:
  - Cek **magic bytes**/mime-type asli file (bukan cuma percaya field `Content-Type` dari client
    atau ekstensi nama file), pakai library sniffing yang reliable.
  - Enforce batas ukuran maksimal di server juga (mis. hard cap 5MB), jangan cuma andalkan compression
    client-side.
  - Tolak file yang bukan gambar raster (SVG bisa membawa script — blokir kalau tidak explicitly
    dibutuhkan untuk border upload; kalau border butuh transparansi PNG, batasi ke PNG/WebP saja).

## 5. CORS & Endpoint Exposure

- Hono CORS middleware: origin API guest-facing (`/api/results/*`) boleh public, tapi endpoint
  admin (`/api/events`, `/api/borders`, dst) **wajib** membutuhkan auth cookie dan idealnya restrict
  origin ke domain aplikasi sendiri saja.
- Endpoint desktop bridge (`/api/sessions/:id/photos` saat dipanggil dari bridge) divalidasi lewat
  bridge token (§3), bukan cookie session — beda mekanisme auth untuk dua channel yang berbeda.

## 6. Rate Limiting

Prioritas endpoint yang wajib di-rate-limit (pakai Redis yang sudah ada, tidak perlu servis baru):
1. `POST /api/auth/login` — brute force protection
2. `GET /api/results/:resultSlug` — cegah enumeration/scraping slug orang lain lewat brute force
3. `POST /api/sessions/:id/photos` — cegah spam upload dari satu sesi

## 7. Data Privasi & Retensi

- Foto wajah tamu = data pribadi. Sebelum sesi mulai, tampilkan **consent notice singkat** di layar
  operator (dikonfirmasi operator atas nama tamu, karena tamu tidak berinteraksi dengan sistem
  langsung dalam model operator-assisted ini).
- Retention 30 hari (FR-09) sudah bagus dari sisi privasi — pastikan job ini benar-benar jalan
  (lihat `docs/DATABASE.md` §3 untuk urutan operasi yang benar) dan **dimonitor** (alert kalau job
  gagal beberapa hari berturut-turut, supaya data tidak menumpuk diam-diam).
- *(Catatan: ini bukan nasihat hukum. Untuk kepastian kepatuhan terhadap regulasi perlindungan data
  pribadi yang berlaku, sebaiknya dikonsultasikan ke pihak yang berkompeten sebelum go-live publik.)*

## 8. Secrets Management

- Semua kredensial (`DATABASE_URL`, `S3_SECRET_KEY`, `JWT_SECRET`, `BRIDGE_TOKEN_SECRET`,
  `SMTP_PASS`, dll) hidup di `.env`, **tidak pernah** di-commit — pastikan `.env` ada di
  `.gitignore` sejak commit pertama.
- Secret berbeda per environment (dev/staging/production) — jangan reuse `JWT_SECRET` yang sama
  antara staging dan production.
- Simpan secrets production di secret store CI/CD (lihat `docs/CICD.md`), bukan hardcoded di
  workflow file.

## 9. Dependency Hygiene

- `pnpm audit` dijalankan di CI (lihat `docs/CICD.md`) — build gagal kalau ada vulnerability
  severity high/critical yang belum di-patch.
- Aktifkan Dependabot/Renovate untuk update rutin.

## 10. HTTPS

- Wajib HTTPS di semua environment non-local — akses kamera browser (`getUserMedia`, dipakai di
  webcam capture FR-01) tidak akan berfungsi di HTTP biasa, baik di desktop maupun browser mobile.
