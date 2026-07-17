# Skema Database Awal (Prisma / PostgreSQL)

Berikut adalah *core entities* yang dirancang untuk mendukung ekosistem Lumora Event Photobooth.

## Model 1: User / Organization (Admin)
Data tentang klien/pemilik photobooth yang *login* ke Dashboard.
- `id` (UUID, PK)
- `email` (String, Unique)
- `password_hash` (String)
- `company_name` (String)
- `created_at` (DateTime)

## Model 2: Event
Satu acara fisik (misal: "Wedding Budi"). Satu organisasi bisa punya banyak event.
- `id` (UUID, PK)
- `organization_id` (UUID, FK -> User)
- `name` (String) - *Contoh: Wedding Budi & Ani*
- `event_date` (DateTime)
- `location` (String)
- `status` (Enum: DRAFT, UPCOMING, LIVE, COMPLETED)
- `event_key` (String, Unique) - *Kode unik yang akan dimasukkan ke Lumora Bridge agar sinkron dengan event ini.*
- `pin_code` (String, Nullable) - *PIN 4-6 digit untuk memproteksi Guest Gallery (opsional).*

## Model 3: Frame
Koleksi desain bingkai PNG berlubang yang sudah diunggah oleh Admin.
- `id` (UUID, PK)
- `organization_id` (UUID, FK -> User)
- `name` (String) - *Contoh: Bunga Klasik 2x6*
- `storage_url` (String) - *URL MinIO ke file PNG*
- `width` (Int)
- `height` (Int)
- `created_at` (DateTime)

## Model 4: Event_Frame (Many-to-Many)
Mengkoneksikan *Frame* apa saja yang aktif di *Event* tertentu (karena 1 event biasanya hanya menggunakan 2-3 frame pilihan klien dari koleksi puluhan frame milik studio).
- `event_id` (UUID, FK -> Event)
- `frame_id` (UUID, FK -> Frame)
- `is_active` (Boolean) - *Default: True*

## Model 5: Photo (Jantung Data)
Data setiap lembar hasil jepretan/cetakan. Ini disinkronisasi langsung dari Lumora Bridge.
- `id` (UUID, PK)
- `event_id` (UUID, FK -> Event)
- `hd_image_url` (String) - *URL gambar resolusi tinggi (dengan frame) di MinIO*
- `thumbnail_url` (String) - *URL gambar WebP untuk grid (dengan frame)*
- `raw_image_url` (String, Opsional) - *URL gambar asli (tanpa frame) jika studio menjual fitur cetak ulang/re-edit*
- `frame_id_used` (UUID, Nullable) - *Frame mana yang dipakai di foto ini*
- `printed_count` (Int) - *Berapa kali foto ini ditekan tombol "Cetak" oleh operator*
- `taken_at` (DateTime) - *Waktu jepret dari kamera/lokal, BUKAN waktu upload*
- `synced_at` (DateTime) - *Kapan foto ini berhasil masuk ke Cloud*

## Model 6: Subscription / Credits (Monetisasi SaaS)
Jika Lumora disewakan ke berbagai studio foto (SaaS B2B).
- `id` (UUID, PK)
- `organization_id` (UUID, FK -> User)
- `plan_type` (Enum: FREE, BASIC, PRO, UNLIMITED)
- `credits_balance` (Int) - *Sistem token: 1 kredit = 1 event, atau 1 kredit = 100 foto upload.*
- `expires_at` (DateTime)

## Analisis Skema
- Model di atas sudah mengadopsi kebutuhan *Offline-first Event Photobooth*. 
- Waktu penjepretan (`taken_at`) dipisah dengan waktu upload (`synced_at`) agar *timeline* foto di Galeri Tamu tetap sesuai urutan kejadian meskipun internet di lokasi mati selama 2 jam dan baru *upload* sekaligus belakangan.
