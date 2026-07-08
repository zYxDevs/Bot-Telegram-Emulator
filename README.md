# COPUX

Bot Telegram buat komunitas emulator Windows-di-Android — Winlator, GameHub Lite, BannerHub, GameNative, WinNative, Box86/64, FEX, DXVK, Turnip, dll. Gw bikin ini karena capek jawab pertanyaan crash yang sama berulang-ulang di grup, jadi tinggal lempar ke bot.

`@Noysz_bot` — Node.js, single file, jalan di Termux.

## Cara kerjanya

Bot-nya gw kunci ke domain emulator doang. Nanya resep masakan atau soal coding umum bakal dijawab seadanya/diarahin balik. Kalau ada yang nyebut Mobox/ExaGear/Cassia sebagai solusi, bot bakal nyolot duluan — itu vaporware/udah mati, jangan disaranin lagi.

Format jawaban crash dipaksa terstruktur: `Crash di L<X> — <komponen>. Root cause: <mekanisme>. Fix: <langkah>.` Gw capek baca jawaban AI yang ngambang nggak jelas root cause-nya apa, jadi format ini gw paksa dari prompt level.

LLM-nya **freemodel.dev (GPT-5.5)** buat dua-duanya — vision (baca screenshot/foto/frame video) sama text (reasoning panjang). Dulu text gw route ke TokenRouter (MiniMax-M3), tapi sejak Juni 2026 TokenRouter berhenti ngasih free token jadi semua gw pindah ke freemodel. Routing model otomatis: ada gambar → vision, ga ada → text. Ga perlu user pilih manual.


## 🚀 UPDATE COPUX TERBARU (v2.1)

Bot telah menerima peningkatan fitur besar-besaran untuk pengalaman yang lebih mulus dan canggih!

- **🎮 1. Game Hunter (`/hunting`)**
  Kini kamu bisa langsung mencari rilis game PC (Pre-installed / Portable yang tinggal main tanpa instalasi) hanya dengan perintah `/hunting [nama game]`. Bot secara otomatis akan menyisir 5 sumber tepercaya dan memberikan tautan langsung untukmu!
- **🛡️ 2. Bypass Sensor & Anti-Penolakan**
  Kesal bot suka menolak menjawab saat ditanya soal link game? Sistem telah dirombak! Kueri pencarian game kini langsung di-eksekusi secara instan tanpa perlu melewati hadangan penyaringan moral AI.
- **🎯 3. Pencarian Akurat & Anti-Sampah**
  Sistem filter baru menjamin hasil pencarian hunting sangat relevan. Tidak ada lagi hasil nyasar ke halaman "Login", "Register", atau memunculkan game acak yang tidak sesuai dengan yang kamu cari.
- **🔗 4. Tautan Ramah Klik**
  Seluruh output tautan game dan web telah diperbaiki formatnya. Tautan kini otomatis berwarna biru dan bisa langsung kamu klik tanpa harus repot copy-paste.
- **⚙️ 5. Menu Pintasan Cerdas Otomatis**
  Tidak perlu lagi menghafal perintah! Cukup ketik garis miring (`/`) pada kolom obrolan, dan Telegram akan otomatis memunculkan daftar fitur lengkap bot yang bisa langsung kamu pilih. (Tutup lalu buka kembali Telegram jika menu belum muncul).
- **🛠️ 6. Steam DRM Auto-Bypass & Config Auditor**
  Fitur asisten pintar terbaru untuk para gamer PC & Emulator (Winlator)! Cukup unggah file konfigurasi game kamu (seperti `steam_emu.ini`, `steam_appid.txt`, atau `Ali213.ini`) ke kolom obrolan, dan bot akan langsung melakukan hal berikut:
  - **🩺 Audit Otomatis**: Memeriksa file kamu dari kerusakan parameter, AppID, hingga masalah zona bahasa.
  - **🔓 DLC Config Generator**: Meracik file unlocker DLC secara otomatis (standar CreamAPI/Goldberg) lengkap dengan nama asli dari Steam Store via perintah `/dlc <appid>`.
  - **🍷 Pendeteksi Lingkungan Emulator**: Mengetahui secara otomatis jika kamu sedang berada di lingkungan Winlator (berbasis `drive_c`) dan langsung memberikan panduan akurat untuk Winecfg Override agar game bisa jalan lancar tanpa crash.
- **👁️ 7. Smart Vision & Analisis Screenshot**
  Kirim screenshot error Winlator, bot langsung baca dan analisis penyebab crash secara akurat.
- **🎬 8. AI Video Watcher**
  Kirim link video YouTube/Tutorial, bot akan otomatis download, nonton, ekstrak audio (whisper.cpp), dan berikan rangkuman cerdas.

---

## Fitur Lengkap
### Search

`/cari <keyword>` atau nanya natural langsung, bot bakal trigger search sendiri kalau kebutuhan data terbaru. Urutan fallback: Serper → Tavily → DuckDuckGo. DDG nggak butuh API key jadi minimal selalu ada yang jalan.

Buat baca isi halaman (`web_fetch`), bot coba lewat **Scrapling microservice** dulu — fetcher anti-bot (Playwright stealth) yang bisa nembus Cloudflare/halaman yang nolak request biasa. Kalau service-nya mati, otomatis fallback ke `axios`. Kalau direct fetch kena anti-bot/HTTP error/halaman kosong dan `FIRECRAWL_API_KEY` ada, bot fallback terakhir ke Firecrawl v2 scrape API. Service Scrapling proses Python kepisah (`scrapling_service.py`), bind `127.0.0.1` doang, dan SSRF guard-nya tetep jalan di sisi bot SEBELUM URL dioper ke Scrapling/Firecrawl.

### Vision

Kirim screenshot error, bot baca isinya (handle magic-byte detection karena Telegram suka kirim MIME `application/octet-stream` yang ngaco). Kepake banget buat error/setting/log emulator yang kelihatan di gambar.

### Nonton video

Bot bisa "nonton" video beneran — bukan cuma liat thumbnail. Pipeline-nya: `yt-dlp` download → `ffmpeg` ambil 6 frame + ekstrak audio 16kHz → **whisper.cpp** transcribe audionya → frame (visual) + transcript (audio) dua-duanya di-feed ke LLM. Jadi bot tau yang kelihatan DAN yang dibilang di video.

Sumber yang didukung:

- **Upload video Telegram** (≤20MB) — kirim file video / video_note (yang bulet) langsung, bot proses.
- **Link YouTube** — best-effort. Kalau ada `yt-cookies.txt` valid → frame + transcript. Kalau IP server keblok YouTube (sering) → jatuh ke thumbnail + judul, dan bot jujur bilang "ini cuma dari thumbnail".
- **Link video non-YT** (tiktok/vimeo/mp4/dll) — allowlist host + ekstensi, lewat SSRF guard dulu baru di-download.

Transcript dipotong di `MAX_AUDIO_SEC` (default 180s) — whisper di HP ARM lambat, jadi video panjang ga bikin bot ngegantung. Kerja ffmpeg/whisper di-semaphore (`MAX_CONCURRENT_VIDEO`, default 1) biar ga ngepeg CPU HP.

### Sesi

DM itu 1 sesi per chatId. Di grup, per `chatId:userId` biar konteks user A sama B nggak nyampur. Auto-save ke disk tiap 5 detik (debounced), atomic write jadi aman kalau prosesnya mati di tengah jalan. Expired session di-prune otomatis (default TTL 6 jam).

### Rate limit

5 detik cooldown antar pesan, cap 20 pesan/60 detik. Kena limit dapet warning, bukan langsung di-ban, tapi cooldown warning-nya sendiri 5 menit biar nggak spam warning juga. Admin (`ADMIN_IDS`) bebas dari semua ini + bisa akses `/stats`.

### Resource cap

Ini yang paling penting karena jalan di HP. Concurrency LLM di-semaphore (default 3 paralel), per-session lock biar nggak race condition pas nulis ke chatHistory bersamaan. Ada garbage collector buat bersihin rate-log map sama user stats yang udah nggak aktif. Global error handler nangkep `unhandledRejection`/`uncaughtException` dan nyimpen history dulu sebelum proses mati.

### File reader

Kirim dokumen text/log/json/code (≤1MB), bot baca isinya buat konteks reply. Binary file (PDF, zip, image renamed) di-skip pakai heuristik printable-ratio biar ga blowup RAM.

### Compatibility Layer Verification Suite

Fitur asisten khusus emulasi Android-Wine (Winlator, GameHub). Bot menyediakan dua alur bantuan teknis:
- **Auto-Generator Sub-Aset Emulasi (`/dlc <appid>`)**: Tembak command ini dan microservice Python bot bakal nge-scrape API publik Steam secara concurrent (max 15 data) untuk me-generate struktur `.ini` valid berisi list nama DLC. Langsung copas aja ke dalam folder game.
- **On-the-Fly Config Audit**: Upload file konfigurasi (misal `steam_emu.ini`, `Ali213.ini`, `HLM.ini`, atau `steam_appid.txt`) lewat Telegram, bot bakal baca langsung secara asinkronus dari memori dan ngasih report apa `AppId` dan `Language` config lu bener, kurang, atau korup. Dilengkapi instruksi _Library Override_ (Native then Builtin) kalau emulator lu bermasalah nyangkut di `drive_c`.


### Knowledge Base

`data/kb/*.md` — 20+ file curated tentang Winlator forks (REF4IK, StevenMXZ Ludashi, GameHub, BannerHub), Wine/Proton context, Box64/FEX evolution, DXVK conf, Adreno/Mali stack, preset per-game ground-truth. Bot baca via `kb_lookup` tool sebelum jawab — kalau di KB udah ada, prioritas di atas web search (anti-halu).

Admin bisa `/reloadkb` buat reload tanpa restart proses.

### Security guards

- **SSRF** — `webFetch` blokir RFC1918/loopback/link-local/cloud metadata + DNS-pin (anti-rebinding) + manual redirect validation (cap 3 hop). Guard ini jalan duluan SEBELUM URL dioper ke Scrapling (Playwright resolve DNS sendiri, jadi tanpa gate ini IP-pin ke-bypass). Service Scrapling juga re-reject IP private sendiri (defense-in-depth) + bind `127.0.0.1` only.
- **Video/exec** — yt-dlp/ffmpeg/whisper dipanggil via `execFile` (no shell, no injection). yt-dlp di-sandbox: `--no-playlist --no-exec --max-filesize --match-filter '!is_live'` biar live-stream/video raksasa ga nahan slot sampe timeout. Download video stream-to-disk + byte-counter (anti OOM), temp dir mkdtemp + auto-cleanup di `finally`.
- **Prompt injection** — strip `[META ...]` tag dari user input sebelum di-concat ke history (anti owner-spoof).
- **Photo OOM** — cap 2MB/foto, base64 alloc-aware buat HP RAM ketat.
- **Shutdown** — async save di-await dengan 5s timeout sebelum exit; atomic rename biar partial state ga korup file.

## Commands

| Command | Akses | Scope menu | Fungsi |
|---|---|---|---|
| `/start` | semua | private only | intro & info bot |
| `/cari <query>` | semua | private + group | force web search dulu sebelum jawab |
| `/addfix <isi>` | semua | private + group | sumbang fix/tweak ke Community KB (di-review admin) |
| `/reset` | semua | private + group | clear history sesi |
| `/stats` | admin | hidden | statistik user, top-N, breakdown chat type |
| `/reloadkb` | admin | hidden | reload KB cache dari disk |
| `/promotefix` | admin | hidden | baca antrian `/addfix` → sanitize → tulis ke Community KB |

Command list di `/` menu Telegram di-scope per chat type (private vs group) lewat `setMyCommands`. Setup via `node scripts/setup-bot-metadata.js` — idempotent, bisa di-rerun kapan aja.

Grup: mention atau reply pesan bot. DM: langsung chat aja.

## Tuning buat ARM/Termux

Semua cap di bawah ini env-tunable. Default-nya gw set buat HP 4-6GB RAM:

| Env | Default | Turunin kalau | Naikin kalau |
|---|---|---|---|
| `MAX_HISTORY` | 10 | HP <4GB, ke 6-8 | server, ke 20+ |
| `MAX_CONCURRENT_LLM` | 3 | HP 2-4GB, ke 1-2 | server, ke 5+ |
| `MAX_PHOTO_BYTES` | 2MB | — | server, ke 4-6MB |
| `MAX_FILE_SIZE_BYTES` | 1MB | — | server, ke 4-8MB |
| `MAX_FETCH_BYTES` | 4MB | — | — |
| `SESSION_TTL_MS` | 6 jam | RAM ketat, ke 2-3 jam | — |
| `SAVE_DEBOUNCE_MS` | 5000 | — | I/O lambat, ke 10000 |
| `MAX_VIDEO_BYTES` | 20MB | — | — (cap Telegram getFile ~20MB) |
| `MAX_AUDIO_SEC` | 180 | HP lemot, ke 60-120 | server, ke 300+ |
| `MAX_CONCURRENT_VIDEO` | 1 | — | server, ke 2-3 |
| `WHISPER_BIN` | `/root/whisper.cpp/build/bin/whisper-cli` | path whisper.cpp | — |
| `WHISPER_MODEL` | `.../ggml-base.bin` | model lebih kecil (tiny) | model lebih akurat (small) |
| `SCRAPLING_FETCH_URL` | `http://127.0.0.1:8765/fetch` | kosongin = disable scrapling | — |
| `FIRECRAWL_API_KEY` | kosong | disable fallback Firecrawl | isi kalau mau web_fetch fallback anti-bot eksternal |
| `FIRECRAWL_TIMEOUT_MS` | 45000 | koneksi lambat bikin slot ketahan | situs berat |
| `FIRECRAWL_MAX_AGE_MS` | 3600000 | butuh fresh scrape | hemat credit/cache |

Detail di `.env.example`.

## Install & Setup Cepat

### 1. Kloning Repositori & Install Dependensi
```bash
git clone https://github.com/Noysz/Bot-Telegram.git
cd Bot-Telegram
npm install
cp .env.example .env
nano .env
```

### 2. Setup Scrapling Microservice (Opsional tapi Wajib untuk /hunting)
Service ini menangani Web Fetch dan Game Hunter (`/hunting`). Jika tidak di-setup, bot akan fallback ke metode reguler.
```bash
python3 -m venv .venv
.venv/bin/pip install "scrapling[fetchers,ai]"
.venv/bin/scrapling install      # download chromium playwright
pm2 start .venv/bin/python --name copux-scrapling --interpreter none -- scrapling_service.py
```

> 💡 **Tes Microservice dengan cURL (Terminal):**
> Kamu bisa langsung mengetes apakah fitur hunting berjalan normal di lokal dengan perintah cURL berikut:
> ```bash
> curl -s -X POST http://127.0.0.1:8765/api/v1/hunt-game \
>   -H "Content-Type: application/json" \
>   -d '{"query": "elden ring"}'
> ```

Yang wajib diisi:

```
TELEGRAM_TOKEN=
FREEMODEL_KEY=
TOKENROUTER_KEY=     # legacy — udah ga dipake (TokenRouter mati), tapi startup masih ngecek ada-nya. Isi apa aja.
```

Opsional (kosongin aja kalau ga punya, fallback ke DDG):

```
SERPER_API_KEY=
TAVILY_API_KEY=
FIRECRAWL_API_KEY=
```

Admin, pisah koma:

```
ADMIN_IDS=
```

Jalanin:

```bash
pm2 start bot.js --name copux
# opsional: service scrapling (kalau mau web_fetch anti-bot)
pm2 start .venv/bin/python --name copux-scrapling --interpreter none -- scrapling_service.py
pm2 save
pm2 startup
```

(Opsional, sekali aja) — push bot identity (nama, deskripsi, command list) ke Telegram:

```bash
node scripts/setup-bot-metadata.js
```

Cek:

```bash
pm2 status
pm2 logs copux --lines 50
```

## Yang masih jelek

Single file ~1.9k baris, makin sesak — udah waktunya gw pecah ke `handlers/`, `services/`, `prompts/`. Belum sempet.

State (rate log, in-flight, stats) di RAM doang, restart ya hilang. History-nya aman karena ke disk, tapi yang lain nggak.

No database, pure JSON file (`data/history.json`). Cukup buat skala grup komunitas, jangan dipake buat traffic gede.

Polling mode, bukan webhook — lebih simple deploy tapi boros koneksi dikit. Belum sempet bikin webhook mode.

LLM-nya 100% gantung ke freemodel.dev. Gateway-nya down, bot bisu. Belum ada fallback ke provider lain.

Rate limit-nya per-user, bukan per-grup. Grup gede kalau 20 orang nge-spam bareng, bisa kena 429 dari upstream.

Single tenant — satu instance cuma buat satu bot token. Mau multi-bot, harus refactor token handling-nya dulu.

## Struktur

```
Bot-Telegram/
├── bot.js                          # semuanya ada di sini — handler, AI call, persona, vision, video, search, tools
├── scrapling_service.py            # microservice web_fetch anti-bot (Python, localhost-only)
├── scripts/
│   └── setup-bot-metadata.js       # one-off: push nama/desc/commands ke Bot API
├── package.json
├── .env                            # gitignored
├── .env.example
├── README.md
├── CHANGELOG.md
└── data/
    ├── history.json
    ├── addfix.jsonl                # antrian submission user via /addfix (di-proses /promotefix)
    └── kb/                         # 20+ file knowledge base curated, di-track
```

## Stack

Node 18+, `node-telegram-bot-api` (polling), `axios`, `dotenv`, PM2. LLM: **freemodel.dev** (GPT-5.5, vision + text). Search: Serper/Tavily/DDG. Video: yt-dlp + ffmpeg + whisper.cpp (opsional). Web_fetch anti-bot: Scrapling (Python service, opsional).

## Mau dibenerin

- Pecah `bot.js` jadi modul (sekarang ~1.9k baris)
- Rate limit per-grup (saat ini per-user, grup gede bisa kena 429 upstream)
- Webhook mode
- Test suite (Jest/Vitest) — saat ini smoke test manual per fix
- SQLite buat stats/rate log, biar nggak hilang pas restart

## License

ISC © Noysz (Fourfect Group)

## Kontribusi

PR boleh, tapi jangan rusak persona bot-nya — no ceramah DRM, no nyaranin Mobox/ExaGear/Cassia, no jawaban ngambang. Diskusi dulu di issue kalau mau ubah yang gede-gede.
