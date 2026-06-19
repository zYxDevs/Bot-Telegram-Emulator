# COPUX — Telegram Bot for Emulator Tech Communities

> **Pakar AI Telegram khusus dunia emulator Windows-di-Android** (Winlator, GameHub Lite, BannerHub, GameNative, WinNative, Box86/64, FEX, DXVK, Turnip). Dirancang buat ngebantu komunitas opreker — troubleshoot crash, baca screenshot error, cariin driver/build yang relevan, semuanya lewat chat di Telegram.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![PM2](https://img.shields.io/badge/PM2-Daemon-2B037A?logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](#license)

---

## Apa Itu COPUX?

COPUX (`@Noysz_bot`) adalah bot Telegram berbasis Node.js yang berperan sebagai **God-Tier Emulator & Translation Layer Engineer**. Fokus utamanya bukan asisten umum — tapi spesialis sempit di ranah:

- **Frontend emulator modern**: GameHub Lite (Producdevity), BannerHub (The412Banner), GameNative (utkarshdalal), WinNative-Emu, Winlator forks (Ludashi, Frost, Cmod, Star Bionic, Glibc).
- **Translation layers**: Box86/Box64, FEX-Emu, Proton-arm64ec.
- **Graphics stack**: DXVK (vanilla + Sarek async/dynasync untuk Mali), VKD3D-Proton, d8vk, Mesa/Turnip/Zink, lsfg-vk-android.
- **Layer-based crash analysis** (L1 Kernel/Bionic → L7 Anti-cheat/DRM) — bukan tebak-tebakan generik.

Bot ini didesain agar tetap stabil di **Termux / ARM low-RAM**, dengan rate limit hybrid dan resource cap yang fully tunable per device.

---

## Fitur Utama

### Chat AI
- Bahasa Indonesia gaya opreker (`lu/gw`), to-the-point, no fluff, no DRM lectures.
- Persona terkunci ke domain emulator — refuse generic small talk, korek balik kalau ada false claim soal Mobox/ExaGear/Cassia (vaporware/usang).
- Anti-halu: format jawaban crash wajib `Crash di L<X> — <komponen>. Root cause: <mekanisme>. Fix: <langkah>.`
- Powered by GPT-5.5 via [freemodel.dev](https://freemodel.dev) gateway.

### Web Search 3-Tier (Auto-Fallback)
`Serper → Tavily → DuckDuckGo`. Cukup `/cari <keyword>` atau tanya natural — bot auto-trigger search kalau perlu data terbaru. Tier ke-3 (DDG) ga butuh API key, jadi fallback selalu jalan.

### Vision Engine
- **Photo OCR/analysis**: kirim screenshot crash/error langsung ke chat, bot baca isinya (magic-byte detection — robust ke MIME `application/octet-stream` dari Telegram).
- **YouTube frame extractor**: paste URL YouTube, bot ekstrak 6 frame thumbnail via `yt-dlp + ffmpeg` buat analisa video tutorial/gameplay.

### Smart Sessions
- **Private chat**: 1 sesi per `chatId`.
- **Group chat**: 1 sesi per `chatId:userId` — konteks user A & user B di grup yang sama ga ke-mix.
- Auto-flush ke disk debounced (default 5s), atomic write (`.tmp` + rename) — aman dari crash mendadak.
- Auto-restore history saat startup; expired sessions di-prune (default TTL 6 jam).

### Hybrid Rate Limit
- **5 detik cooldown** antar pesan per user.
- **20 pesan / 60 detik** window cap.
- Warning anti-spam (per-user cooldown 5 menit).
- Admin (`ADMIN_IDS` env) bypass rate limit + akses `/stats`.

### Resource Safety (ARM-Friendly)
- Global LLM concurrency semaphore (default 3 paralel, tunable).
- Per-session in-flight lock — anti race condition di `chatHistory`.
- Garbage collection berkala: prune rate-log map setelah 10 menit idle, user stats setelah 7 hari.
- Global `unhandledRejection` + `uncaughtException` guard + auto-save history sebelum crash.

### File Reader
Kirim dokumen text/log/json/code (≤1 MB default) — bot baca isinya dalam konteks reply.

---

## Commands

| Command | Akses | Fungsi |
|---------|-------|--------|
| `/start` | Semua | Sapaan singkat |
| `/reset` | Semua | Clear history sesi lo |
| `/cari <query>` | Semua | Paksa web search (3-tier fallback) |
| `/stats` | Admin | Statistik user aktif & top user |

Di grup: mention `@Noysz_bot` atau reply ke pesan bot. Di DM: kirim pesan langsung.

---

## Adaptive ARM Tuning

Semua resource cap fully **env-tunable**. Default cocok buat HP mid-range (4–6 GB RAM). Override sesuai device:

| Env Var | Default | Kapan diturunkan | Kapan dinaikkan |
|---------|---------|------------------|-----------------|
| `MAX_HISTORY` | 10 | HP <4 GB → 6–8 | Server lega → 20+ |
| `MAX_CONCURRENT_LLM` | 3 | HP 2–4 GB → 1–2 | Server → 5+ |
| `MAX_PHOTO_BYTES` | 6 MB | HP low-RAM → 3 MB | — |
| `MAX_FILE_SIZE_BYTES` | 1 MB | — | Server → 4–8 MB |
| `MAX_FETCH_BYTES` | 4 MB | — | — |
| `SESSION_TTL_MS` | 6 jam | RAM ketat → 2–3 jam | — |
| `SAVE_DEBOUNCE_MS` | 5000 | — | I/O lambat → 10000 |

Detail lengkap di `.env.example`.

---

## Deploy

### Prerequisites
- Node.js **18+**
- Git
- PM2 (`npm install -g pm2`)
- (Opsional) `yt-dlp` + `ffmpeg` buat fitur YouTube frame extractor

### Install

```bash
git clone https://github.com/Noysz/Bot-Telegram.git
cd Bot-Telegram
npm install
```

### Konfigurasi `.env`

Copy template, lalu isi:

```bash
cp .env.example .env
nano .env
```

**Wajib:**
```env
TELEGRAM_TOKEN=isi_token_dari_botfather
FREEMODEL_KEY=isi_key_dari_freemodel.dev
```

**Opsional** (fallback otomatis ke DuckDuckGo kalau kosong):
```env
SERPER_API_KEY=
TAVILY_API_KEY=
```

**Admin** (pisah koma — admin bebas rate limit + akses `/stats`):
```env
ADMIN_IDS=123456789,987654321
```

### Jalankan dengan PM2

```bash
pm2 start bot.js --name copux
pm2 save
pm2 startup       # generate startup script (sekali aja)
```

### Cek status

```bash
pm2 status
pm2 logs copux --lines 50
```

---

## Kelebihan

- ✅ **Domain expertise mendalam** — bukan AI generik, fokus tajam ke emulator stack modern dengan layer-based diagnostic.
- ✅ **Hybrid rate limit dewasa** — cooldown + window cap + warning anti-spam.
- ✅ **Multi-modal input** — text, photo (vision OCR), YouTube link, dokumen.
- ✅ **3-tier search fallback** — selalu jalan walau tanpa API key berbayar (DDG free).
- ✅ **ARM-optimized** — sengaja dirancang buat Termux / HP, semua cap tunable.
- ✅ **Crash-safe** — atomic save, global error guards, auto-restore session.
- ✅ **Group-aware** — sesi per-user di grup, ga ada bocor konteks antar user.
- ✅ **Anti-halu protocol** — format jawaban diagnostik terstruktur, anti tebak-tebakan.
- ✅ **Zero ceremony** — single-file (`bot.js`), 3 dependencies utama, no bloat framework.

## Keterbatasan

- ⚠️ **Single-file architecture (~1.1k LOC)** — gampang di-grok, tapi mulai padat. Refactor ke modul akan dibutuhin kalau scope nambah.
- ⚠️ **In-memory state** — semua rate log, in-flight, user stats di RAM. Restart = state hilang (history tetep aman karena ke disk).
- ⚠️ **Persona-locked** — bot di-tune buat domain emulator. Tanya soal resep masakan / coding umum bakal dijawab pendek atau diarahkan balik ke topic.
- ⚠️ **Single-tenant token** — satu instance = satu bot Telegram. Kalau mau multi-tenant, perlu refactor token handling.
- ⚠️ **No database** — pure file-based persistence (`data/history.json`). Cukup buat skala kecil-menengah; bukan untuk traffic enterprise.
- ⚠️ **YouTube extractor opsional** — butuh `yt-dlp + ffmpeg` ter-install + cookies file (`/root/yt-cookies.txt`) buat video age-restricted.
- ⚠️ **Polling mode** — pakai `node-telegram-bot-api` polling (bukan webhook). Lebih simple deploy, tapi sedikit lebih boros koneksi.
- ⚠️ **API key terikat ke `freemodel.dev`** — kalau gateway down, LLM ga jalan. Belum ada fallback ke OpenAI/Anthropic native.
- ⚠️ **Rate limit per-user, bukan per-group** — di grup besar, 20+ user bisa burst bareng dan trigger upstream 429.

---

## Project Structure

```
Bot-Telegram/
├── bot.js              # Main entry — handler, AI calls, persona, vision, search
├── package.json
├── .env                # Secrets (gitignored)
├── .env.example        # Template + dokumentasi adaptive tuning
├── data/
│   ├── history.json    # Auto-save sessions
│   └── kb/             # Knowledge base curated (tracked)
└── README.md
```

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Runtime | Node.js 18+ |
| Telegram client | `node-telegram-bot-api` (polling) |
| HTTP client | `axios` |
| Env loader | `dotenv` |
| Process manager | PM2 |
| LLM gateway | [freemodel.dev](https://freemodel.dev) (default: GPT-5.5) |
| Search providers | Serper, Tavily, DuckDuckGo |
| Media tools | `yt-dlp`, `ffmpeg` (opsional) |

---

## Roadmap (Indicative)

- [ ] Modular refactor — split `bot.js` jadi `handlers/`, `services/`, `prompts/`.
- [ ] Per-group rate limit (selain per-user).
- [ ] Webhook mode (opsional, polling tetep default).
- [ ] Multi-LLM fallback (freemodel → OpenAI → Anthropic).
- [ ] Persistent KV store (SQLite) untuk stats & rate log.

---

## License

ISC © [Noysz](https://github.com/Noysz) (Fourfect Group)

---

## Contributing

PR welcome — tapi please respect persona lock (no DRM lecturing, no Mobox/ExaGear/Cassia suggestions, no halu generic answers). Buka issue dulu kalau perubahan besar.
