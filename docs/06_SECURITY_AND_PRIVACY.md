# Spesifikasi Keamanan & Privasi (Security & Privacy)

Sistem Lumora berurusan dengan foto wajah dan acara privat (seperti *Wedding* atau *Corporate Event*). Oleh karena itu, keamanan aset digital dan privasi pengguna adalah prioritas mutlak, bukan sekadar fitur tambahan.

## 1. Privasi Galeri Tamu (Guest Gallery)
Tidak semua orang yang tahu URL acara (misal: `lumora.id/gallery/wedding-budi`) boleh melihat isi foto.
- **PIN Protection:** Admin bisa mengaktifkan opsi PIN 4-6 digit untuk sebuah *event*. Tamu yang men-scan QR Code harus memasukkan PIN (yang bisa dicetak di kertas foto) sebelum bisa melihat galeri.
- **Watermark (Opsional):** Jika tamu hanya melihat di grid, foto diberikan *watermark* halus. Versi bersih hanya didapat saat mereka menekan tombol "Download".

## 2. Keamanan Object Storage (MinIO / S3)
- **Bucket Harus Privat:** *Bucket* penyimpanan di MinIO **tidak boleh** bersifat *Public Read*. Jika *public*, siapa saja bisa menebak (brute-force) URL foto orang lain.
- **Presigned URLs:** Semua gambar yang ditampilkan di *Guest Gallery* maupun *Dashboard Admin* harus menggunakan *Presigned URL* yang umurnya singkat (misal: *expired* dalam 1 jam). Jika link tersebut disebar ke orang lain dan dibuka besoknya, link sudah tidak valid.

## 3. Retensi Data (Auto-Cleanup)
Penyimpanan *cloud* mahal, dan menyimpan foto klien selamanya adalah risiko privasi.
- **TTL (Time to Live):** Setelah *event* selesai (berubah status menjadi `COMPLETED`), sistem memberikan masa tenggang (contoh: 30 hari) agar tamu masih bisa *download*.
- **Worker Cron Job:** `apps/worker` akan berjalan setiap malam untuk mencari foto-foto yang umurnya sudah melebihi batas retensi, lalu menghapusnya secara permanen dari *database* dan MinIO untuk menghemat *storage* (sekaligus menjaga privasi klien).

## 4. Keamanan API & Bridge
- **Event Keys:** Lumora Bridge di laptop tidak boleh menggunakan *username/password* Admin. Melainkan menggunakan **Event Key** (Token statis) yang hanya berlaku untuk 1 event spesifik. 
- Jika laptop operator dicuri, pencuri hanya punya akses sinkronisasi untuk event hari itu, bukan seluruh *database* event studio tersebut. Admin cukup me- *revoke* (mencabut) Event Key tersebut dari Web Dashboard.
