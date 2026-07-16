# Product Requirements Document — LUMORA v4.0

| | |
|---|---|
| **Menggantikan** | v3.2 (diarsipkan di `docs/PRD-source.md`) |
| **Tanggal** | 15 Juli 2026 |
| **Status** | Draft — untuk direview sebelum eksekusi |
| **Alasan revisi** | v3.2 dinilai terlalu general di beberapa FR; v4.0 menambah detail acceptance criteria + 3 fitur baru: Face Sticker Engine, Operator Custom Filter, Admin Dashboard (Library Management + Analytics) |

---

## 1. Executive Summary & Tujuan

Platform Photobooth B2B SaaS, model **Operator-Assisted**: operator mengendalikan seluruh sesi dari
satu device (laptop/print station), tamu tidak perlu interaksi teknis apapun. Hardware-agnostic
(Webcam HD maupun DSLR/Mirrorless via Desktop Bridge).

**Tujuan Bisnis** (target terukur, bukan hanya kualitatif):
- Setup satu event baru oleh admin < 10 menit dari nol.
- Satu sesi tamu (dari capture sampai QR muncul) selesai < 15 detik.
- Operasional tanpa hardware kamera proprietary — cukup laptop + webcam/DSLR biasa.

**Tujuan Guest**: hasil foto instan, opsi mempercantik hasil (sticker, filter) tanpa perlu skill
edit, privasi terjaga (retensi 30 hari otomatis).

**Tujuan Admin/EO** (baru di v4): bisa mengelola aset visual (border, filter, sticker) dan memantau
performa tiap event lewat satu dashboard, tanpa perlu bantuan teknis developer.

## 2. Persona

| Persona | Deskripsi | Kebutuhan Utama |
|---|---|---|
| **Admin/EO Owner** | Pemilik akun, kelola banyak event | Setup cepat, kelola library aset, lihat analytics |
| **Operator** | Orang yang jaga booth saat acara | UI simpel di satu layar, bisa tweak filter real-time, minim klik |
| **Guest** | Tamu acara | Hasil cepat, terlihat bagus (sticker/filter), gampang di-download/share |

## 3. Scope v4.0

### In Scope (MVP v4)
Semua scope v3.2 **plus**:
- **FR-01 (diperluas)**: dokumentasi eksplisit dukungan HP-sebagai-webcam-tethered (DroidCam/Iriun/EpocCam) sebagai setup capture pihak ketiga yang murah tapi dapat fitur live sticker penuh
- **FR-10**: Face Detection & AR Sticker Overlay (webcam live-preview + DSLR post-hoc)
- **FR-11**: Operator Custom Filter Tuning (live slider, save-as-preset)
- **FR-12**: Admin Dashboard — Border/Filter/Sticker Library Management
- **FR-13**: Admin Dashboard — Analytics per Event
- **FR-14**: Remote Mobile Capture & Live Mirroring (HP sebagai kamera, laptop sebagai monitor +
  kontrol, guest jepret sendiri, timer per sesi, retake dari kedua device) — **komponen paling
  kompleks di v4**, lihat catatan risiko di §6

### Out of Scope (Phase 2 — didokumentasikan, bukan dihapus)
- Multi-face sticker (MVP: sticker hanya diterapkan ke wajah paling dominan/terbesar di frame)
- Live video preview untuk jalur DSLR (MVP: DSLR tetap folder-watcher, sticker diterapkan post-hoc
  ke foto statis, bukan live-tracked)
- Pengiriman via WhatsApp (tidak masuk MVP — lihat keputusan di `docs/ARCHITECTURE.md` §6; email via
  Nodemailer tetap jalan di v4)
- Multi-tenant white-label penuh, custom domain per klien
- Export analytics ke CSV/PDF (v4 cukup tampilan dashboard)

## 4. User Journey (diperbarui)

| Fase | Alur |
|---|---|
| A. Setup Event (Admin) | Login → Buat Event → pilih border/filter/sticker dari Library (Global atau upload sendiri lewat Dashboard) → konfigurasi layout → generate URL Event |
| B. Sesi Foto — **Mode Direct** (FR-01/FR-02) | Operator buka URL Event → pilih sumber kamera (webcam/HP-tethered/DSLR) → **pilih sticker (0-N)** → pilih filter preset **atau buka Custom Filter Tuner** → tamu pose, live preview menampilkan sticker (khusus webcam/HP-tethered) → operator capture 3-4 frame |
| B-alt. Sesi Foto — **Mode Remote Mobile** (FR-14) | HP & laptop login akun sama, pilih peran (Kamera/Operator) → live mirror tersambung → operator set border/filter/sticker/layout/**timer** → operator "Mulai Sesi" → **guest jepret sendiri dari HP** (sticker live di layar HP) → guest/operator bisa **retake** slot manapun sebelum timer habis |
| C. Proses & Delivery | Auto-compress & upload → worker: deteksi wajah (kalau webcam/HP-tethered/remote-mobile pakai koordinat live, kalau DSLR deteksi ulang dari foto statis) → composer bakar sticker+border+filter+layout → QR dinamis + form email tampil → operator klik "Sesi Baru" untuk reset |
| D. Maintenance | Cron/BullMQ repeatable job harian → hapus data > 30 hari (file dulu, baru row DB) |
| E. Admin Dashboard | Admin login ke `/dashboard` → tab **Library** (upload/kelola border, filter, sticker) → tab **Analytics** (pilih event → lihat metrik) |

## 5. Functional Requirements — Detail & Acceptance Criteria

### FR-01 — Web Capture Engine (Multi Camera Source) *(diperluas v4)*

**Spesifikasi**: WebRTC (`getUserMedia`) untuk akses kamera apapun yang terdaftar sebagai video
input device di OS laptop operator. Browser tidak membedakan sumber hardware-nya secara teknis —
artinya **3 setup fisik berikut otomatis didukung tanpa kode tambahan**, operator tinggal pilih
dari dropdown device:

1. **Laptop webcam** (built-in atau USB webcam biasa) — setup paling murah/simpel.
2. **HP sebagai webcam eksternal (tethered ke laptop operator)** — ini yang sebelumnya belum
   tertulis eksplisit. HP disambungkan ke laptop operator yang standby di booth, **disarankan via
   kabel USB** (bukan WiFi, supaya tidak kena latensi/drop dari WiFi venue yang biasanya padat saat
   acara ramai), memakai app tethering seperti **DroidCam**, **Iriun Webcam**, atau **EpocCam**
   (tersedia untuk Android & iOS). HP kemudian muncul sebagai video input device biasa di laptop,
   dan browser mengaksesnya persis seperti webcam biasa — operator tidak perlu app/website
   terpisah di HP-nya selain app tethering itu. Kualitas kamera HP modern umumnya jauh lebih baik
   dari webcam laptop, jadi ini jadi opsi "sweet spot" populer: murah, tapi hasil foto lebih bagus.
3. **DSLR via HDMI capture card** (opsional, berbeda dari jalur Desktop Bridge di FR-02) — kalau
   DSLR disambungkan ke laptop lewat capture card HDMI (bukan software tethering), DSLR juga
   otomatis terdeteksi sebagai video input device dan dapat live preview penuh.

**Kenapa dibedakan dari FR-02 (Desktop Bridge)**: setup #2 dan #3 di atas memberi **live video
feed** langsung ke browser — artinya face-sticker live-tracking (FR-10) jalan penuh sama seperti
laptop webcam biasa. FR-02 (Desktop Bridge/folder-watcher) TIDAK punya live feed ke browser (DSLR
menyimpan file ke folder, bukan streaming), jadi sticker di jalur itu tetap post-hoc saja (lihat
FR-10). Ini alasan kenapa opsi #2 (HP tethered) sering jadi pilihan terbaik secara cost-benefit:
kualitas bagus, murah, DAN dapat fitur live sticker penuh — sesuatu yang bahkan DSLR (jalur
folder-watcher) tidak dapat.

**Acceptance Criteria**:
- Operator bisa memilih device kamera dari daftar (`enumerateDevices`), termasuk device dengan
  nama non-standar (mis. "DroidCam Source 2", "Iriun Webcam") — UI tidak boleh memfilter/blokir
  device berdasarkan nama, tampilkan semua video input device yang terdeteksi OS.
- Live preview minimal 720p, frame rate stabil ≥ 24fps, berlaku untuk ketiga jenis sumber di atas.
- Kalau permission kamera ditolak, tampilkan pesan jelas + tombol retry — jangan silent fail.
- Tersedia panduan setup singkat untuk operator (non-teknis, bukan bagian dari kode aplikasi)
  yang mencantumkan app tethering yang direkomendasikan (DroidCam/Iriun/EpocCam) dan catatan
  "pakai kabel USB, hindari WiFi venue" — lihat `TASKS.md` Phase 4.

### FR-02 — Desktop Bridge App
**Spesifikasi**: Tauri app, watch folder tethering DSLR, kompres lokal, POST ke API dengan bridge token.
**Acceptance Criteria**:
- Deteksi file baru di folder maksimal 1 detik setelah file selesai ditulis (bukan saat masih partial write — pakai debounce/`stable` check dari chokidar).
- Retry otomatis (exponential backoff, maks 3x) kalau POST gagal karena jaringan venue tidak stabil.
- Status koneksi ke server ditampilkan jelas di GUI bridge (connected/disconnected).

### FR-03 — Smart Auto-Compression
**Acceptance Criteria**: file akhir ~1.5MB per foto, resolusi tetap layak cetak 4R 300dpi (minimal
1200×1800px), proses kompresi < 2 detik per foto di device rata-rata.

### FR-04 — Composer Engine
**Spesifikasi**: Sharp menyatukan foto + border + filter + layout + **sticker (baru v4)**.
**Acceptance Criteria**: urutan layer benar (foto → filter diterapkan ke foto → sticker di atas foto
sesuai anchor point → border di lapisan paling atas, karena border biasanya frame/bingkai yang
harus terlihat utuh menutupi tepi).

### FR-05 — Filter Selection (diperluas jadi FR-05 + FR-11, lihat di bawah)

### FR-06 — Privacy & QR Dinamis
**Acceptance Criteria**: klik "Sesi Baru" mengganti QR yang **ditampilkan**, tapi tidak menghapus
akses tamu sesi sebelumnya (slug lama tetap valid sampai retention 30 hari habis).

### FR-07 — Layout Engine
**Acceptance Criteria**: mode Photo Strip menduplikasi kolom kiri ke kanan **pixel-perfect** (test
wajib ada di `docs/TESTING.md`), mode Grid mendukung 3-6 foto per lembar sesuai `template_config`.

### FR-08 — Template System (Global Template)
**Acceptance Criteria**: border/filter/layout/**sticker** dengan `event_id = NULL` muncul otomatis
sebagai pilihan default di event manapun tanpa admin perlu assign manual.

### FR-09 — Data Retention & Cleanup
**Acceptance Criteria**: lihat urutan operasi wajib di `docs/DATABASE.md` §3 (hapus file dulu,
baru row DB). Job harus idempotent (aman dijalankan ulang kalau sempat gagal di tengah jalan).

---

### FR-10 — Face Detection & AR Sticker Overlay *(baru)*

**Deskripsi**: Operator bisa memilih sticker (topi, kacamata, kumis, telinga hewan, dll — PNG
transparan) yang otomatis menempel & mengikuti posisi wajah tamu.

**Spesifikasi teknis**:
- **Jalur webcam**: deteksi landmark wajah real-time di browser menggunakan
  `@mediapipe/tasks-vision` (FaceLandmarker, berjalan via WASM, tidak perlu server call — privasi
  lebih baik karena tidak ada frame video yang dikirim ke server hanya untuk deteksi). Sticker
  digambar di atas `<canvas>` overlay mengikuti titik anchor (mis. dahi, mata kiri/kanan, hidung,
  dagu, telinga kiri/kanan) secara real-time selama live preview.
- **Jalur DSLR**: tidak ada live preview (folder-watcher based, lihat FR-02) — deteksi wajah
  dilakukan **post-hoc** di worker terhadap foto statis yang sudah diupload, sebelum tahap compose.
  Rekomendasi library Node: `@vladmandic/face-api` (fork face-api.js yang aktif dimaintain, jalan
  di server dengan `node-canvas`). Kalau akurasi kurang memadai saat pengujian, pertimbangkan
  microservice Python terpisah berbasis MediaPipe — dicatat sebagai fallback plan, bukan default.
- **Multi-wajah dalam satu frame**: MVP hanya menerapkan sticker ke wajah **terbesar/paling
  dominan** yang terdeteksi (asumsi: 1 tamu utama per sesi foto). Dukungan multi-wajah penuh masuk
  Phase 2.
- **Wajah tidak terdeteksi** (miring ekstrem, pencahayaan buruk, dll): foto tetap tersimpan tanpa
  sticker (bukan gagal total), flag `face_detected: false` disimpan untuk keperluan QA.

**Acceptance Criteria**:
- Live preview webcam menampilkan sticker mengikuti gerakan wajah dengan latensi terasa < 100ms.
- Foto hasil DSLR (post-hoc detection) tetap punya sticker terpasang dengan posisi wajar meski
  tanpa live-tracking.
- Ada minimal 1 test kasus "wajah tidak terdeteksi" yang membuktikan sistem tidak crash/gagal
  total (lihat `docs/TESTING.md`).

**Skema DB baru** (detail penuh di `docs/DATABASE.md`):
- `stickers` — asset sticker + `anchor_point` (enum: forehead, left_eye, right_eye, nose, mouth,
  chin, left_ear, right_ear, full_face), `event_id` nullable (Global Template support, konsisten
  dengan FR-08).
- `session_stickers` — join table (satu sesi bisa pakai 0-N sticker sekaligus, tiap instance bisa
  override offset/scale dari default sticker-nya).

---

### FR-11 — Operator Custom Filter Tuning *(baru)*

**Deskripsi**: Selain memilih preset filter (Normal/B&W/Vintage dari FR-05), operator bisa membuka
mode **Custom** dengan slider live: brightness, contrast, saturation, hue rotate, vignette
on/off, grain intensity.

**Spesifikasi teknis**:
- Preview slider pakai CSS filter (cepat, responsif) — **tapi** hasil final tetap wajib dibakar via
  Sharp di worker (konsisten dengan prinsip di `docs/ARCHITECTURE.md`: CSS preview ≠ output final).
- Tombol **"Simpan sebagai Filter Baru"**: menyimpan kombinasi slider sebagai row baru di tabel
  `filters` (tabel yang sudah ada, **tidak perlu skema baru** — `config` JSONB sudah cukup fleksibel
  menampung parameter ini), di-scope ke `event_id` event tsb sehingga bisa dipakai ulang di sesi
  berikutnya tanpa tuning ulang.

**Acceptance Criteria**:
- Perubahan slider terefleksi di preview dalam < 50ms (CSS filter, bukan re-render canvas berat).
- Filter custom yang disimpan muncul di dropdown filter event tsb pada sesi berikutnya.
- Output final (setelah compose) secara visual match dengan preview (toleransi wajar untuk
  perbedaan CSS-filter-preview vs Sharp-render, didokumentasikan sebagai known limitation kecil).

---

### FR-12 — Admin Dashboard: Library Management *(baru)*

**Deskripsi**: Halaman `/dashboard/library` dengan 3 tab: **Border**, **Filter**, **Sticker**.

**Spesifikasi per tab**:
- **Border**: grid thumbnail semua border (Global + milik event tertentu), tombol upload (validasi
  PNG/WebP, transparansi dicek — lihat `docs/SECURITY.md` §4), toggle aktif/nonaktif, badge
  "Global" vs nama event kalau event-scoped.
- **Filter**: list semua filter preset (Global + per event), admin bisa buat filter Global baru
  pakai UI slider yang **sama** dengan Operator Custom Filter Tuner (FR-11) — reuse komponen,
  bedanya hasil admin di-scope `event_id = NULL` (jadi Global Template, tersedia di semua event).
- **Sticker**: grid thumbnail sticker, upload PNG transparan + pilih `anchor_point` dari dropdown +
  kalibrasi `default_scale`/`default_offset` lewat live preview di atas contoh wajah generik.

**Acceptance Criteria**:
- Admin bisa upload border/filter/sticker baru dan langsung melihatnya tersedia di operator
  console pada percobaan berikutnya tanpa perlu reload manual/deploy ulang.
- Aset yang di-nonaktifkan (`is_active = false`) tidak muncul lagi sebagai pilihan operator, tapi
  sesi lama yang sudah memakainya tidak terganggu (foreign key tetap valid, tidak di-cascade-delete).

---

### FR-13 — Admin Dashboard: Analytics per Event *(baru)*

**Deskripsi**: Halaman `/dashboard/analytics?eventId=`, menampilkan metrik performa satu event
(atau ringkasan semua event untuk admin dengan banyak event).

> **Catatan asumsi**: user tidak menspesifikasikan metrik detail — daftar di bawah adalah usulan
> default berdasar data yang sudah tersedia di skema. Konfirmasi/sesuaikan sebelum implementasi.

**Metrik yang diusulkan (dihitung on-the-fly via agregasi Prisma/SQL, tidak perlu tabel baru)**:
| Metrik | Sumber data |
|---|---|
| Total sesi dimulai vs selesai (completion rate) | `COUNT(sessions)` group by `status` |
| Rata-rata waktu proses per sesi | `AVG(completed_at - created_at)` |
| Border/filter/sticker terpopuler | `GROUP BY border_id/filter_id` join `session_stickers` |
| Distribusi jam sibuk | `GROUP BY date_trunc('hour', created_at)` |
| Success rate print job | `COUNT(print_jobs)` group by `status` |
| Jumlah pengiriman berhasil (email) | dari job `send-delivery` (perlu logging status, lihat catatan di `docs/ARCHITECTURE.md`) |

**Acceptance Criteria**:
- Dashboard load < 2 detik untuk event dengan hingga ~2000 sesi (perlu index yang tepat di
  `sessions.created_at`, `sessions.event_id` — pastikan tercantum di migration).
- Angka yang ditampilkan match dengan query manual ke DB (test integrasi wajib, lihat
  `docs/TESTING.md`).

### FR-14 — Remote Mobile Capture & Live Mirroring *(baru, paling kompleks di v4)*

**Deskripsi**: Dua device standby di lapangan: **Mobile (HP)** sebagai kamera yang dipegang/dilihat
langsung oleh guest, dan **Laptop** sebagai operator yang mengatur border/filter/sticker/layout
dan memantau. Kedua device login dengan **akun yang sama**, lalu masing-masing memilih peran
("Jadi Kamera" di HP / "Jadi Operator" di laptop). Video dari kamera HP di-mirror live ke laptop
lewat jaringan (bukan kabel USB — beda dari FR-01 opsi tethering), guest jepret foto sendiri dari
layar HP (gaya selfie/timer), dan ada batas waktu per sesi yang bisa diatur operator.

> **Catatan arsitektur penting**: fitur ini butuh **WebRTC peer-to-peer streaming** + **signaling
> server realtime**. Ini membalikkan keputusan sebelumnya di `docs/ARCHITECTURE.md` §4 yang bilang
> "tidak perlu WebSocket" — keputusan itu berlaku untuk mode capture FR-01/FR-02 (operator capture
> langsung), **tidak** berlaku untuk FR-14. Lihat pembaruan arsitektur di `docs/ARCHITECTURE.md` §4b.

#### 14.1 Device Pairing
- Setelah login, tiap device pilih peran: **"Jadi Kamera"** atau **"Jadi Operator"**, lalu pilih
  event yang sedang aktif.
- Pairing key = `accountId + eventId` — **tidak perlu kode/QR pairing manual tambahan**, karena
  `eventId` sudah unik per acara. Kalau satu akun EO menjalankan 2 event bersamaan (2 booth
  sekaligus), tetap aman selama tiap device memilih event yang benar dari dropdown.
- Konflik role (mis. 2 laptop sama-sama pilih "Operator" untuk event yang sama): device kedua
  ditolak dengan pesan jelas ("Sudah ada operator aktif untuk event ini").
- **Reconnection**: kalau HP kehilangan koneksi (WiFi venue putus-putus) di tengah sesi, begitu
  browser reconnect, otomatis rejoin room yang sama (pairing key tidak berubah) dan resume sesi
  yang sedang berjalan — bukan mulai dari nol.

#### 14.2 Live Video Mirroring
- HP: `getUserMedia` → tampilkan preview lokal (guest lihat diri sendiri, seperti kamera selfie
  normal) **dan** kirim stream yang sama via `RTCPeerConnection` ke laptop.
- Laptop: terima stream via WebRTC, tampilkan sebagai live preview monitor bagi operator (dan bisa
  dilihat guest juga kalau posisi laptop terlihat dari booth).
- **Sticker live-preview (FR-10) dijalankan di sisi HP**, bukan laptop — karena guest melihat
  dirinya sendiri di layar HP, sticker harus ter-render di situ juga (real-time, sama seperti
  filter Snapchat/Instagram). Laptop hanya menerima video mentah untuk monitoring operator, tidak
  perlu render sticker duplikat di sisi laptop.
- **Foto final yang diupload tetap foto mentah (tanpa sticker dibakar)** — diambil langsung dari
  stream lokal HP (kualitas penuh, bukan dari video WebRTC yang sudah dikompres buat transmisi).
  Sticker & filter tetap dibakar final di worker (FR-04/FR-10), konsisten dengan pipeline yang
  sudah ada — live preview di HP murni untuk membantu guest posisi berpose, bukan sumber file final.

#### 14.3 Timer Sesi
- Operator set durasi sesi sebelum mulai (mis. 60 atau 120 detik) → tersimpan sebagai
  `timer_duration_seconds` di `sessions`.
- Saat operator klik "Mulai Sesi": `timer_started_at` dicatat, `timer_expires_at` dihitung dan
  dikirim ke kedua device via signaling channel.
- Kedua device menghitung mundur **secara lokal** berdasarkan `timer_expires_at` (hindari
  ketergantungan tick-per-detik dari server yang rawan delay), dengan sinkronisasi ulang periodik
  lewat channel realtime untuk jaga-jaga clock drift.
- Begitu waktu habis: tombol capture & retake otomatis terkunci di **kedua** device.

#### 14.4 Capture & Retake
- **Capture**: guest yang jepret dari layar HP (dikonfirmasi user — bukan operator). Tiap slot
  foto (sesuai jumlah grid, mis. 4 foto) dijepret satu-satu.
- **Retake**: **operator maupun guest bisa memicu retake** (dikonfirmasi user) untuk slot manapun
  yang sudah terisi, selama sesi belum habis waktu:
  - Guest retake langsung dari HP (tap ulang slot yang sudah ada fotonya).
  - Operator retake dari laptop → mengirim command "retake slot N" ke HP lewat signaling channel
    → HP menyorot slot tsb sebagai aktif → guest jepret ulang.
- Foto lama saat di-retake **tidak dihapus**, hanya ditandai tidak terpilih (`is_selected = false`)
  — foto baru jadi `is_selected = true`. Ini menjaga histori untuk analytics (rata-rata jumlah
  retake per sesi, lihat FR-13) tanpa kompleksitas tambahan yang berarti.
- Setelah waktu habis dan/atau semua slot terisi, operator klik "Selesai" → trigger
  `POST /api/sessions/:id/complete` seperti alur FR-01/FR-02 yang sudah ada.

**Acceptance Criteria**:
- Guest bisa melihat preview diri sendiri (dengan sticker kalau dipilih) di layar HP dengan
  latensi lokal < 100ms (preview lokal, bukan round-trip via laptop).
- Laptop menerima live mirror dari HP dengan latensi terasa wajar (< 1 detik) di jaringan venue
  normal.
- Timer di kedua device tetap sinkron (selisih < 2 detik) sepanjang sesi.
- Retake dari laptop benar-benar menyorot slot yang tepat di HP (bukan slot lain).
- Kalau HP terputus < 30 detik, sesi bisa dilanjutkan tanpa reset progress; kalau lebih dari itu,
  sesi ditandai `failed` dan operator diberi opsi mulai ulang.

**Skema DB baru/berubah** (detail penuh di `docs/DATABASE.md`):
- `sessions` — tambah `timer_duration_seconds`, `timer_started_at`, `timer_expires_at`; enum
  `capture_source` ditambah nilai baru `remote_mobile`.
- `photos` — tambah `is_selected` (boolean, default true) untuk histori retake.
- Pairing/room state **tidak disimpan di Postgres** — cukup Redis (ephemeral, TTL), karena
  sifatnya sementara selama sesi berlangsung saja.

**Infra baru yang dibutuhkan**:
- Signaling server (WebSocket) untuk pertukaran SDP/ICE + sinkronisasi state sesi (timer,
  capture, retake command) antara HP dan laptop.
- STUN server (bisa pakai publik, mis. Google STUN) untuk NAT traversal dasar.
- **TURN server direkomendasikan** (self-host `coturn` via docker-compose, konsisten dengan
  infra self-hosted lain) — WiFi venue sering pakai NAT yang lebih ketat, STUN saja kadang tidak
  cukup untuk koneksi P2P yang stabil.

---


- **Performa**: target end-to-end capture→QR ≤ 15 detik (termasuk face detection + compose).
- **Kompatibilitas browser**: `@mediapipe/tasks-vision` butuh WASM + WebGL — pastikan operator
  console mendeteksi & memberi pesan jelas kalau browser/device tidak mendukung (fallback: capture
  tetap jalan tanpa live sticker preview, sticker tetap bisa diterapkan post-hoc kalau perlu).
- **Keamanan & Privasi**: lihat `docs/SECURITY.md` (tidak berubah dari v3.2, sticker/filter baru
  tidak menambah permukaan serangan signifikan karena tetap lewat validasi upload yang sama).
- **Skalabilitas Analytics**: query analitik tidak boleh membebani DB transactional utama secara
  signifikan — pertimbangkan read replica di Phase 2 kalau volume sesi sudah sangat besar (di luar
  scope v4 MVP).

## 7. Open Questions — Perlu Konfirmasi Sebelum Implementasi

1. Anchor point sticker: apakah 8 titik (forehead, left/right eye, nose, mouth, chin, left/right
   ear) sudah cukup, atau perlu lebih granular (mis. "above head" untuk topi vs "on forehead")?
2. Analytics: apakah metrik di FR-13 sudah sesuai kebutuhan, atau ada metrik bisnis spesifik lain
   (mis. revenue per event, kalau ada fitur billing yang belum dibahas)?
3. Fallback kalau `@mediapipe/tasks-vision` tidak didukung browser operator — apakah cukup
   "capture tanpa sticker" atau perlu blocking warning yang lebih tegas?
4. Skala waktu implementasi FR-10–13 — apakah semua masuk MVP v4 sekaligus, atau perlu diurutkan
   prioritas (mis. Library Management dulu baru Analytics)? Lihat `TASKS.md` untuk urutan yang
   diasumsikan saat ini.
5. **Baru**: secara teknis, sistem **tidak bisa otomatis membedakan** "laptop webcam asli" vs
   "HP yang di-tether" vs "DSLR via capture card" — semua terlihat sama sebagai video input device
   generik di `enumerateDevices()`. Kalau analytics (FR-13) perlu memisahkan statistik berdasarkan
   jenis hardware yang dipakai, perlu tambahan: operator memilih label manual saat mulai sesi
   (mis. dropdown "Laptop Webcam" / "HP Tethered" / "DSLR (capture card)"), disimpan di kolom baru
   `capture_device_label` (nullable, free text) di tabel `sessions`. Ini **belum** ditambahkan ke
   `docs/DATABASE.md` — konfirmasi dulu apakah granularitas ini dibutuhkan sebelum implementasi.
6. **Baru (FR-14)**: kalau timer sesi habis tapi belum semua slot grid terisi (mis. baru 3 dari 4
   foto), apakah sesi tetap lanjut diproses dengan slot kosong (grid tidak penuh), atau dianggap
   gagal dan guest harus mulai sesi baru dari nol? Asumsi default di `TASKS.md`: **lanjut proses
   dengan slot yang terisi saja** (lebih ramah guest), tapi ini perlu dikonfirmasi karena
   mempengaruhi desain composer engine (harus bisa handle grid tidak penuh).
7. **Baru (FR-14)**: TURN server — self-host `coturn` (konsisten infra self-hosted, tapi nambah
   effort ops) vs pakai managed service (Twilio/Xirsys/Cloudflare Calls — lebih mahal tapi lebih
   reliable & minim maintenance). Direkomendasikan self-host dulu untuk MVP, evaluasi ulang kalau
   sering ada komplain koneksi gagal di lapangan.
8. **Baru (FR-14)**: FR-14 ini secara teknis jauh lebih kompleks dari mode capture lain (perlu
   WebRTC + signaling + TURN + reconnection handling) — pertimbangkan apakah ini benar-benar masuk
   MVP v4 pertama, atau dirilis belakangan sebagai v4.1 setelah mode direct capture (FR-01/FR-02)
   sudah stabil dipakai di event nyata. `TASKS.md` saat ini menaruhnya sebagai phase terpisah di
   akhir supaya bisa dikerjakan setelah fondasi lain solid, tapi keputusan go/no-go tetap di kamu.
