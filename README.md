# COPUX

Bot Telegram buat komunitas emulator Windows-di-Android — Winlator, GameHub Lite, BannerHub, GameNative, WinNative, Box86/64, FEX, DXVK, Turnip, dll. Gw bikin ini karena capek jawab pertanyaan crash yang sama berulang-ulang di grup, jadi tinggal lempar ke bot.

`@Noysz_bot` — Node.js, single file, jalan di Termux.

## Cara kerjanya

Bot-nya gw kunci ke domain emulator doang. Nanya resep masakan atau soal coding umum bakal dijawab seadanya/diarahin balik. Kalau ada yang nyebut Mobox/ExaGear/Cassia sebagai solusi, bot bakal nyolot duluan — itu vaporware/udah mati, jangan disaranin lagi.

Format jawaban crash dipaksa terstruktur: `Crash di L<X> — <komponen>. Root cause: <mekanisme>. Fix: <langkah>.` Gw capek baca jawaban AI yang ngambang nggak jelas root cause-nya apa, jadi format ini gw paksa dari prompt level.

LLM-nya dual-route: **vision via freemodel.dev** (GPT-5.5) buat baca screenshot/foto, **text via TokenRouter** (MiniMax-M3) buat reasoning panjang. Routing otomatis berdasarkan ada gambar atau enggak — ga perlu user pilih manual.

## Fitur

### Search

`/cari <keyword>` atau nanya natural langsung, bot bakal trigger search sendiri kalau kebutuhan data terbaru. Urutan fallback: Serper → Tavily → DuckDuckGo. DDG nggak butuh API key jadi minimal selalu ada yang jalan.

### Vision

Kirim screenshot error, bot baca isinya (handle magic-byte detection karena Telegram suka kirim MIME `application/octet-stream` yang ngaco). Paste link YouTube, bot ambil 6 frame thumbnail pake yt-dlp + ffmpeg buat dianalisa — kepake banget buat video tutorial yang errornya kelihatan di gambar.

### Sesi

DM itu 1 sesi per chatId. Di grup, per `chatId:userId` biar konteks user A sama B nggak nyampur. Auto-save ke disk tiap 5 detik (debounced), atomic write jadi aman kalau prosesnya mati di tengah jalan. Expired session di-prune otomatis (default TTL 6 jam).

### Rate limit

5 detik cooldown antar pesan, cap 20 pesan/60 detik. Kena limit dapet warning, bukan langsung di-ban, tapi cooldown warning-nya sendiri 5 menit biar nggak spam warning juga. Admin (`ADMIN_IDS`) bebas dari semua ini + bisa akses `/stats`.

### Resource cap

Ini yang paling penting karena jalan di HP. Concurrency LLM di-semaphore (default 3 paralel), per-session lock biar nggak race condition pas nulis ke chatHistory bersamaan. Ada garbage collector buat bersihin rate-log map sama user stats yang udah nggak aktif. Global error handler nangkep `unhandledRejection`/`uncaughtException` dan nyimpen history dulu sebelum proses mati.

### File reader

Kirim dokumen text/log/json/code (≤1MB), bot baca isinya buat konteks reply. Binary file (PDF, zip, image renamed) di-skip pakai heuristik printable-ratio biar ga blowup RAM.

### Knowledge Base

`data/kb/*.md` — 20+ file curated tentang Winlator forks (REF4IK, StevenMXZ Ludashi, GameHub, BannerHub), Wine/Proton context, Box64/FEX evolution, DXVK conf, Adreno/Mali stack, preset per-game ground-truth. Bot baca via `kb_lookup` tool sebelum jawab — kalau di KB udah ada, prioritas di atas web search (anti-halu).

Admin bisa `/reloadkb` buat reload tanpa restart proses.

### Security guards

- **SSRF** — `webFetch` blokir RFC1918/loopback/link-local/cloud metadata + DNS-pin (anti-rebinding) + manual redirect validation (cap 3 hop).
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

Detail di `.env.example`.

## Install

Butuh Node 18+, git, PM2 (`npm install -g pm2`). Opsional `yt-dlp` + `ffmpeg` kalau mau fitur YouTube extractor.

```bash
git clone https://github.com/Noysz/Bot-Telegram.git
cd Bot-Telegram
npm install
cp .env.example .env
nano .env
```

Yang wajib diisi:

```
TELEGRAM_TOKEN=
FREEMODEL_KEY=
TOKENROUTER_KEY=
```

Opsional (kosongin aja kalau ga punya, fallback ke DDG):

```
SERPER_API_KEY=
TAVILY_API_KEY=
```

Admin, pisah koma:

```
ADMIN_IDS=
```

Jalanin:

```bash
pm2 start bot.js --name copux
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

Single file ~1.1k baris, masih kebaca tapi udah mulai sesak — kalau scope nambah lagi gw harus pecah ke `handlers/`, `services/`, `prompts/`.

State (rate log, in-flight, stats) di RAM doang, restart ya hilang. History-nya aman karena ke disk, tapi yang lain nggak.

No database, pure JSON file (`data/history.json`). Cukup buat skala grup komunitas, jangan dipake buat traffic gede.

Polling mode, bukan webhook — lebih simple deploy tapi boros koneksi dikit. Belum sempet bikin webhook mode.

LLM-nya 100% gantung ke freemodel.dev. Gateway-nya down, bot bisu. Belum ada fallback ke provider lain.

Rate limit-nya per-user, bukan per-grup. Grup gede kalau 20 orang nge-spam bareng, bisa kena 429 dari upstream.

Single tenant — satu instance cuma buat satu bot token. Mau multi-bot, harus refactor token handling-nya dulu.

## Struktur

```
Bot-Telegram/
├── bot.js                          # semuanya ada di sini — handler, AI call, persona, vision, search, tools
├── scripts/
│   └── setup-bot-metadata.js       # one-off: push nama/desc/commands ke Bot API
├── package.json
├── .env                            # gitignored
├── .env.example
├── README.md
├── CHANGELOG.md
└── data/
    ├── history.json
    ├── addfix-queue.json           # antrian submission user via /addfix
    └── kb/                         # 20+ file knowledge base curated, di-track
```

## Stack

Node 18+, `node-telegram-bot-api` (polling), `axios`, `dotenv`, PM2. LLM dual-route: **freemodel.dev** (vision, GPT-5.5) + **TokenRouter** (text, MiniMax-M3). Search: Serper/Tavily/DDG. Media: yt-dlp + ffmpeg (opsional).

## Mau dibenerin

- Pecah `bot.js` jadi modul (sekarang ~1.3k baris)
- Rate limit per-grup (saat ini per-user, grup gede bisa kena 429 upstream)
- Webhook mode
- Test suite (Jest/Vitest) — saat ini smoke test manual per fix
- SQLite buat stats/rate log, biar nggak hilang pas restart

## License

ISC © Noysz (Fourfect Group)

## Kontribusi

PR boleh, tapi jangan rusak persona bot-nya — no ceramah DRM, no nyaranin Mobox/ExaGear/Cassia, no jawaban ngambang. Diskusi dulu di issue kalau mau ubah yang gede-gede.
