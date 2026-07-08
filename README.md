# COPUX-FourFect Bot (v2.1)

Bot Telegram cerdas asisten komunitas emulator Windows-di-Android — Winlator, GameHub Lite, BannerHub, GameNative, WinNative, Box86/64, FEX, DXVK, Turnip, dll. Diciptakan untuk menangani ribuan keluhan dan pertanyaan teknis berulang di grup, dengan kapabilitas eksekusi tingkat lanjut.

`@Noysz_bot` — Berjalan di atas Node.js, dioptimalkan untuk eksekusi efisien di Termux/ARM.

---

## 🌟 Fitur Utama (Update v2.1)

### 🎮 1. Game Hunter (`/hunting`) & Web Search
- **Auto-Hunt**: Cari rilis game PC (Pre-installed / Portable) via perintah `/hunting [nama game]`. Menyisir 5 sumber tepercaya dan memberikan tautan unduhan langsung tanpa melewati hadangan penyaringan moral AI.
- **Natural Search**: Bot bisa melakukan pencarian web natural (`/cari`) untuk berita/data terbaru, dengan mekanisme *fallback* bertingkat (Serper → Tavily → DuckDuckGo).
- **Web Fetch Anti-Bot**: Menggunakan **Scrapling microservice** berbasis Playwright Stealth untuk menembus Cloudflare/halaman pelindung. Dilengkapi proteksi SSRF yang ketat sebelum request diproses.

### 🛠️ 2. Steam DRM Auto-Bypass & Config Auditor
Fitur asisten khusus emulasi Android-Wine (Winlator, GameHub):
- **On-the-Fly Config Audit**: Upload file konfigurasi (`steam_emu.ini`, `Ali213.ini`, `steam_appid.txt`) lewat obrolan. Bot akan membaca langsung secara asinkronus dan mendeteksi jika parameter `AppId` atau `Language` korup/hilang.
- **DLC Config Generator (`/dlc <appid>`)**: Meracik file unlocker DLC secara otomatis (standar CreamAPI/Goldberg) dari hasil *scrape* API publik Steam.
- **Winecfg Override Detector**: Mendeteksi otomatis lingkungan Winlator (berbasis `drive_c`) dan memberikan panduan _Library Override_ (Native then Builtin) agar game tidak *crash*.

### 👁️ 3. Smart Vision & Analisis Screenshot
Bot memiliki mata! Kirim *screenshot* *error*, log, atau pengaturan emulator yang terlihat membingungkan. Bot akan otomatis membaca layarnya dan menganalisis penyebab *crash* secara instan. *(Dilengkapi magic-byte detection untuk mencegah error MIME application/octet-stream dari Telegram).*

### 🎬 4. AI Video Watcher (Otomatis Nonton Video)
Kirim video langsung (≤20MB) atau *link* YouTube/TikTok/MP4, bot akan:
1. Mengunduh video stream menggunakan `yt-dlp`.
2. Mengekstrak frame gambar visual dan audio (16kHz) menggunakan `ffmpeg`.
3. Melakukan transkripsi audio menggunakan **`whisper.cpp`**.
4. Menganalisa visual & suara di dalam video secara bersamaan, dan memberikan rangkuman/panduan cerdas berdasarkan apa yang "dilihat" dan "didengar" bot.

### 🛡️ 5. Keamanan & Efisiensi Resource (Optimasi ARM)
- **SSRF Guard**: Memblokir injeksi IP Private (RFC1918) dan *DNS-pinning* untuk celah pembajakan internal.
- **Anti Prompt Injection**: Melucuti *tag* berbahaya sebelum masuk riwayat pesan obrolan.
- **Resource Management**: Concurrency pemanggilan LLM dan proses video dibatasi ketat menggunakan *semaphore*, aktifnya *garbage collector* RAM, serta mode penyimpanan *atomic write* yang memastikan riwayat chat tidak rusak meskipun server mati mendadak.
- **Sistem Sesi & Rate Limit**: Mengkarantina sesi secara individual per pengguna, mencegah spam (20 pesan / 60 detik) dengan perlindungan *cooldown* 5 detik per pesan.

### ⚙️ 6. Antarmuka Telegram Interaktif
- **Tautan Ramah Klik**: Format MarkdownV2 yang disempurnakan. Tautan otomatis berwarna biru cerah dan aman diklik tanpa salin-tempel manual.
- **Menu Pintasan Cerdas Otomatis**: Cukup ketik garis miring (`/`) pada kolom obrolan, dan Telegram akan otomatis memunculkan daftar fitur lengkap bot (Menu Pintasan Bot).

---

## 🛠️ Instalasi & Setup Lengkap

Karena kapabilitasnya yang masif (membaca video, bypass cloudflare, NLP LLM), bot ini membutuhkan beberapa instalasi tambahan. 

### Tahap 1: Setup Kebutuhan Dasar (Bot Core)
Wajib dilakukan untuk menjalankan inti bot.
```bash
# Pastikan sudah terinstall Node.js 18+, git, dan PM2
npm install -g pm2

# Clone Repo
git clone https://github.com/Noysz/Bot-Telegram.git
cd Bot-Telegram
npm install
cp .env.example .env
nano .env  # Isi TOKEN TELEGRAM dan API KEY (lihat Tahap 4)
```

### Tahap 2: Setup Scrapling Microservice (Wajib untuk /hunting & Web Fetch)
Service Python ini dirancang untuk berjalan di *background* untuk melewati Cloudflare dan bot-protection. Tanpa ini, bot hanya bisa membaca web biasa.
```bash
python3 -m venv .venv
.venv/bin/pip install "scrapling[fetchers,ai]"
.venv/bin/scrapling install      # Mengunduh chromium playwright
# Jalankan microservice di background via PM2
pm2 start .venv/bin/python --name copux-scrapling --interpreter none -- scrapling_service.py
```
> 💡 **Tes Microservice dengan cURL (Terminal):**
> Kamu bisa memastikan fitur *hunting* berjalan sempurna di lokal/server menggunakan cURL:
> ```bash
> curl -s -X POST http://127.0.0.1:8765/api/v1/hunt-game \
>   -H "Content-Type: application/json" \
>   -d '{"query": "elden ring"}'
> ```

### Tahap 3: Setup AI Video Watcher (Wajib untuk Analisis Video)
Wajib di-install jika ingin bot bisa mengunduh dan menganalisis video & link YouTube.
```bash
# 1. Install yt-dlp & ffmpeg (via apt atau pkg Termux)
pkg install yt-dlp ffmpeg

# 2. Build whisper.cpp secara Native (Jangan pakai faster-whisper di arsitektur ARM)
cd ~
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build

# 3. Download Model Whisper
bash ./models/download-ggml-model.sh base
```
*Catatan: Pastikan lokasi folder build whisper sesuai dengan variable `WHISPER_BIN` di dalam `.env`!*

### Tahap 4: Konfigurasi Lingkungan (`.env`)

Isi variabel krusial di `.env`:
```env
TELEGRAM_TOKEN=token_bot_telegram_kamu
FREEMODEL_KEY=sk-xxxxxx  # API Key untuk otak LLM utama
ADMIN_IDS=123456789,987654321  # ID Telegram Admin, pisahkan dengan koma

# Konfigurasi Video & Whisper
WHISPER_BIN=/root/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL=/root/whisper.cpp/models/ggml-base.bin

# Fallback Mesin Pencari Eksternal (Opsional)
SERPER_API_KEY=
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
```

---

## 🚀 Menjalankan Bot

Setelah semua tahap dan konfigurasi selesai:

```bash
# 1. Mulai bot utama
pm2 start bot.js --name copux

# 2. Simpan startup PM2 agar auto-run saat server/Termux me-reboot
pm2 save
pm2 startup

# 3. (Hanya Sekali) Daftarkan Menu Pintasan Cerdas Otomatis ke sistem Telegram
node scripts/setup-bot-metadata.js

# Cek Log bot secara realtime
pm2 logs copux --lines 50
```

---

## 🧠 Knowledge Base & System Tuning
Semua pedoman pemecahan masalah emulasi keras berada di direktori `data/kb/*.md` (Forks Winlator, Wine/Proton, DXVK). Bot merujuk ke pustaka ini (RAG) terlebih dahulu sebelum menggunakan internet untuk menjamin akurasi dan mencegah "halusinasi AI". Admin Telegram dapat memanggil perintah `/reloadkb` di obrolan untuk memuat ulang data tanpa me-*restart* bot.

Parameter batas keamanan (*tuning*) untuk menyesuaikan dengan batas HP/Server (seperti `MAX_HISTORY`, `MAX_CONCURRENT_LLM`, dll) sudah diatur efisien secara *default* untuk ukuran 4-6GB RAM. Anda bisa mengubahnya langsung di dalam `.env` jika perangkat terlalu berat/ringan.

---

**Stack:** Node.js 18+ | PM2 | Playwright Python | yt-dlp & FFmpeg | Whisper C++
**License:** ISC © Noysz (Fourfect Group)
