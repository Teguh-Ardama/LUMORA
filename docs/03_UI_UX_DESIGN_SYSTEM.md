# UI/UX & Design System (Lumora Web)

Seperti permintaan, UI/UX dari Lumora **tidak boleh terlihat seperti dashboard admin standar** (seperti AdminLTE atau Bootstrap lawas). Kita ingin Lumora terasa seperti *Premium SaaS Product* (Contoh kiblat desain: *Vercel, Linear, Stripe, Framer*). 

## 1. Filosofi Desain (Aesthetics & Vibe)
- **Minimalist & Content-First:** Karena bisnis kita berurusan dengan Foto (Visual), maka UI di sekitarnya harus sangat minimal dan tidak mendistraksi.
- **Glassmorphism & Depth:** Menggunakan efek transparan (blur/backdrop-filter) tipis di *sidebar* atau *modal*, namun tidak berlebihan.
- **Micro-interactions:** Setiap *hover* pada tombol, *input focus*, atau transisi halaman harus memiliki animasi yang sangat halus (menggunakan *Framer Motion* atau CSS transisi standar modern `0.2s ease`).

## 2. Palet Warna (Color Tokens)
Hindari warna primer mencolok (merah/biru murni). Gunakan *tailored HSL colors*.
- **Background Utama (Dark Mode Default):** `#09090B` (Sangat gelap, nyaris hitam, tapi terasa lebih elegan dari `#000000`).
- **Foreground (Teks Utama):** `#FAFAFA` (Putih lembut, tidak membuat mata lelah).
- **Brand / Accent (Warna Utama Lumora):** Gradasi halus dari Ungu Gelap ke Pink Keemasan (menggambarkan perayaan/pesta), namun digunakan sangat irit (hanya di *Active Tab*, CTA Button, atau *Progress Bar*). Contoh Hex *Accent*: `#8B5CF6` (Violet).
- **Surface / Card (Panel):** `#18181B` (Abu-abu sangat gelap untuk membedakan kartu dengan *background*).
- **Borders:** `#27272A` (Garis pemisah yang sangat subtil/tipis).

## 3. Tipografi (Typography)
Tinggalkan *browser default fonts*.
- **Font Utama (Headers & UI):** **Inter** atau **Geist** (Memberikan kesan rapi, *tech-forward*, dan modern).
- **Font Kombinasi (Untuk Judul Event / Serif):** **Playfair Display** atau **Instrument Serif** (Bisa dipakai khusus di *Guest Web Gallery* untuk memberikan kesan elegan layaknya *Wedding Invitation*).

## 4. UI Components / Elements
- **Borders & Radius:** Gunakan `border-radius: 8px` atau `12px` (Sedikit membulat tapi tetap tegas, *squircle* jika memungkinkan).
- **Shadows (Glow):** Ketimbang *drop shadow* biasa, gunakan *subtle glow* untuk tombol *Primary*.
- **Kosongkan State (Empty States):** Jangan hanya menampilkan teks "Tidak ada event". Tampilkan *illustration* modern garis tipis dengan tombol CTA yang menggoda "Buat Event Pertamamu!".

## 5. Antarmuka Spesifik (Specific Views)

### A. Dashboard Admin (Pusat Komando)
- **Layout:** Sidebar kiri yang tipis (*collapsible* menjadi icon) + Kanvas besar di kanan.
- **Header:** Terlihat bersih dengan fitur pencarian global (tekan `Cmd+K` untuk *Command Palette*).
- **Event List:** Ditampilkan bukan sebagai tabel *spreadsheet* kaku, tapi sebagai kumpulan kartu (*Cards*) dengan tampilan *thumbnail/poster* dari *event* tersebut, status "Sedang Berlangsung" dengan *pulsing green dot* (indikator *live*), dan progres data.

### B. Frame Studio (Asset Manager)
- Antarmuka *Drag & Drop* yang besar di tengah layar.
- Saat admin mengunggah Frame PNG (pinggiran foto), sistem menampilkan *Mockup/Preview Live*. Admin bisa menggeser *dummy photo* di belakang *frame* untuk melihat hasil akhir yang akan tampil di mesin photobooth.

### C. Guest Web Gallery (Untuk Tamu)
- **Tampilan:** Seperti aplikasi galeri foto di iPhone atau Pinterest.
- **Header:** Nama acara besar di tengah dengan tipografi Serif elegan.
- **Grid Layout:** *Masonry grid* atau kotak seragam (tergantung pilihan layout dari Admin) untuk foto-foto yang masuk secara *live*.
- **Interaksi:** Saat tamu menekan (Tap) sebuah foto, foto terbuka *full screen* tanpa jeda (*blur-up effect* loading) dengan tombol "Unduh Resolusi Penuh" dan "Bagikan ke Instagram". 
- **Dark/Light Mode:** Bisa diatur mengikuti OS dari *smartphone* tamu otomatis.
