# Phase 4 Selesai: Guest Web Gallery

Kita berhasil mengimplementasikan fondasi terakhir dari sistem photobooth LUMORA, yaitu **Guest Web Gallery (Portal Tamu)**.

Fitur ini didesain mengutamakan pengalaman *mobile-first*, di mana para tamu bisa membuka halaman pameran foto secara langsung (Live Photo Grid) sesaat setelah foto mereka dicetak di *booth*.

## Apa yang baru?

### 1. Halaman Guest Gallery (`/gallery/[eventKey]`)
Sebuah halaman *real-time* yang elegan tanpa perlu instalasi aplikasi:
- **Live Updates:** Layar akan otomatis mendeteksi dan menampilkan foto baru setiap 15 detik (menggunakan `React Query` polling) tanpa perlu *refresh*.
- **Masonry/Grid Layout:** Foto ditampilkan dalam susunan kartu elegan, dilengkapi tombol *Download* beresolusi penuh saat di-klik/disentuh.
- **Header Acara:** Menampilkan nama klien dan label **LIVE** jika acara sedang berlangsung.

### 2. Autentikasi PIN Acara (Opsional)
Jika admin mendaftarkan `pinCode` saat membuat acara, sistem privasi ini akan otomatis aktif:
- Tamu diwajibkan memasukkan PIN acara satu kali saja.
- Sesi mereka dijaga secara aman melalui `Signed JWT Cookie` dengan kedaluwarsa 7 hari, sehingga mereka tidak perlu berulang kali memasukkan PIN setiap membuka halaman.
- Perlindungan *Rate Limiting*: Kami menerapkan batas percobaan maksimal 10x per menit untuk menjaga PIN dari serangan tebakan (*brute force*).

### 3. Tombol Akses di Dashboard Admin
Kami juga telah menanamkan tombol **Guest Gallery** di halaman *Event Dashboard* Admin. Ini memungkinkan pemilik *event* (atau operator) untuk:
- Langsung melompat ke galeri untuk melihat hasil foto sebagai tamu.
- Meng- *copy* URL tersebut untuk dijadikan QR Code berukuran besar di lokasi acara, atau dibagikan melalui WhatsApp Broadcast kepada para peserta!

## Cara Menguji
1. Buka dashboard admin dan masuk ke detail **Demo Wedding Expo**.
2. Klik tombol **Guest Gallery** di pojok kanan atas (tepat di sebelah tombol Pair Bridge/Operator Console).
3. Anda akan langsung dibawa ke halaman pameran foto interaktif milik *event* ini! Coba perhatikan bagaimana foto-foto ujicoba tadi tertata rapi di sana.
