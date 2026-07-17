# Protokol Sinkronisasi Bridge & Web Cloud

Karena Lumora Bridge (Laptop) beroperasi pada jaringan yang mungkin *unstable*, mekanisme transfer foto (sinkronisasi) ke Lumora Web (Server) tidak boleh dilakukan dengan REST API biasa yang menunggu *response* sebelum lanjut.

Berikut adalah *protocol* sinkronisasi yang dirancang khusus untuk ketahanan di lingkungan *event outdoor*.

## 1. Arsitektur Sinkronisasi (Offline First + Job Queue)

1. **Local Queue (Antrean Lokal di Laptop):**
   - Saat operator memencet "Cetak" atau foto dijepret, Bridge menyimpan file foto ke *Harddisk* dan mencatat *record* di *Local Database* (SQLite/IndexedDB) dengan status: `PENDING_SYNC`.
2. **Koneksi Stabil & Worker Background:**
   - Bridge memiliki sebuah *worker* kecil yang selalu mengecek ke server: "Apakah ada internet? (Ping)".
   - Jika *Ping* berhasil, worker ini akan memanggil `PENDING_SYNC` record satu persatu (FIFO - *First In First Out*).
3. **Mekanisme Upload (2 Tahap - Bypassing Server):**
   - **Tahap 1 (Minta Izin):** Bridge menembak API Web Lumora: `POST /api/event/sync/request`. Mengirimkan metadata foto (nama file, resolusi, event_id).
   - **Tahap 2 (Terima Tiket):** Server menjawab dengan *Presigned URL* MinIO (Berlaku 15 menit).
   - **Tahap 3 (Upload Langsung):** Bridge mengunggah file foto berukuran besar (10MB) LANGSUNG ke *Presigned URL* MinIO (Amazon S3 bucket kita). Hal ini menjaga beban CPU Server Backend tetap 0%.
   - **Tahap 4 (Konfirmasi):** Setelah upload MinIO sukses (HTTP 200), Bridge menembak API Web lagi: `POST /api/event/sync/confirm`.
   - **Tahap 5 (Update Status):** Server mencatat foto tersebut ke database (PostgreSQL) sebagai `AVAILABLE`. Bridge mengubah status lokalnya menjadi `SYNCED`.
4. **WebSocket (Realtime Update):**
   - Di saat Tahap 5 selesai, Server langsung memancarkan (Broadcast) *event* via WebSockets (Socket.io/Pusher) ke *Guest Gallery* dan *Admin Dashboard*: `NEW_PHOTO_ARRIVED`. 
   - Browser tamu dan Admin langsung memunculkan animasi foto baru masuk (tanpa perlu *refresh* page).

## 2. Penanganan Kegagalan (Error Handling)
- Jika laptop tiba-tiba mati / *hibernate* saat upload Tahap 3, status di DB lokal masih `PENDING_SYNC`. Begitu aplikasi menyala, dia akan otomatis mengulangi dari Tahap 1 (meminta *presigned url* baru karena yang lama hangus).
- Tidak ada foto yang hilang atau *corrupt* (Setengah terunggah).

## 3. Kompresi Lokal (Hemat Kuota Fotografer)
- **Optional namun Krusial:** Sebelum meminta izin upload, Bridge harus membuat versi *Thumbnail* (WebP 800px) secara lokal di laptop (menggunakan library `sharp` atau Node Canvas).
- Yang di-upload ke server (Tahap 3) adalah 2 file: 
  - `HD_Original.jpg` (Untuk tombol Download resolusi penuh).
  - `Thumbnail.webp` (Untuk tampilan cepat di *Grid Gallery* browser tamu, hemat bandwith server!).
