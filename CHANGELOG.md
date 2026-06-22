# Changelog

Format: keep-a-changelog ringan. Tanggal absolut. Versi major = kapabilitas baru, minor = polish.

---

## [Unreleased] — 2026-06-22

### Bot identity + scoped commands

Setup nama, deskripsi (short + long), dan command list ke Telegram via Bot API. Command list di-scope: private vs group dapet daftar berbeda. Script idempotent, bisa di-rerun.

**Added:**
- `scripts/setup-bot-metadata.js` — one-off script: `setMyName`, `setMyShortDescription` (112/120), `setMyDescription` (401/512), `setMyCommands` scoped (private + group + clear default). Native `https` module, zero new deps. Auto-verify pasca-set.
- Bot name: "COPUX • Helper Emulator PC-Android"
- Private chat command menu: `/start`, `/cari`, `/addfix`, `/reset`
- Group chat command menu: `/cari`, `/addfix`, `/reset` (skip `/start` biar ga noisy)
- Admin command (`/stats`, `/reloadkb`) sengaja ga didaftarkan — low-key, tetap berfungsi

**Changed:**
- `bot.js` /start message — formatting rapi (bold/italic Markdown, divider), inline mention bot name dynamic dari `BOT_USERNAME`.
- README — sync sama state sekarang (dual-model routing, commands table dengan scope, security guards section, struktur folder, install steps tambah `node scripts/setup-bot-metadata.js`).

---

## [2.2.0] — 2026-06-22

### Security + correctness audit sweep — 13 findings fixed across 2 commits

Audit lewat 2 reviewer agent paralel (typescript-reviewer + security-reviewer) — 17 finding raw, dedup ke 12 unik, 10 fix di commit pertama, 3 follow-up di commit kedua setelah Sonnet review.

**Fixed (commit `a7a0f20`):**
- **C1 SSRF** — `webFetch` blokir RFC1918/loopback/link-local/cloud-metadata via DNS resolve + blocklist, https-only.
- **C2 prompt injection** — strip `[META ...]` tag dari user input sebelum di-concat ke history.
- **C3 photo OOM** — `MAX_PHOTO_BYTES` default 6MB → 2MB (3 concurrent × base64 ≈ 8MB peak, anti-OOM Termux).
- **H1 chatHistory race** — push setelah `acquireLLMSlot()`, guard `pushed` boolean buat catch.
- **H2 binary file decode** — `responseType: 'arraybuffer'` + heuristik printable ratio (anti string blowup PDF/zip).
- **H3 shutdown race** — skip sync save kalau async lagi in-flight.
- **H4 agentic loop deadline** — `AGENT_DEADLINE_MS` (default 180s) total budget, cek tiap awal round.
- **M1** error log capture `e.response.status`.
- **M2** `webFetch` error message generic (ga leak IP:port).
- **M3** YouTube regex strip trailing punctuation.
- **L1** final-round empty response fallback.

**Fixed (commit `518a632`, follow-up Sonnet review):**
- **C1 follow-up — DNS rebinding / TOCTOU + redirect bypass:** custom `lookup` di `https.Agent` pin IP yang udah divalidasi, `maxRedirects: 0` + manual hop loop (`MAX_REDIRECT_HOPS=3`), tiap target redirect divalidasi ulang via `_resolveSafeUrl`.
- **C2 follow-up — META edge case:** `[META]` tanpa atribut kosong sekarang ke-match (`/\[META(?:\s[^\]]*)?\]/gi`).
- **H3 follow-up — shutdown await:** track `saveInFlightPromise`, async shutdown handler + `Promise.race` vs 5s timeout (sebelumnya: `process.exit(0)` langsung tanpa await).

**False positives (didokumentasi, ga di-patch):**
- `BOT_USERNAME` race — code udah punya falsy guard, aman.

---

## [Unreleased] — 2026-06-20 (malam)

### KB diperluas — REF4IK ecosystem (Russian Winlator fork + bundled runtime CDN)

Deep-dive 8 repo REF4IK. Core: winlator-ref4ik- (92⭐ active fork), Components-Adrenotools- (CDN bundled VCRedist/PhysX/dotnet sebagai .wcp = unique convenience), GameNative-Mod. Russian community via Telegram winlatorruu.

**Added:**
- `data/kb/ref4ik-ecosystem.md` — Fork brunodev branch `bionic-ref4ik`. 2 build variant (lite/lud — lud trick Ludashi-style buat Xiaomi). Inflection: v9 Vulkan rewrite + content provider cross-pollination (bisa pull dari StevenMXZ CDN via custom URL), v7 frame gen + experimental Steam launching, v6 custom driver repo. Comparison REF4IK vs StevenMXZ side-by-side (decision tree per use case). Anti-stale: jangan pake repo lama `Winlator-REF4IK` (archived Nov 2025).

**Changed:**
- `bot.js` SYSTEM_PROMPT: section baru "REF4IK ECOSYSTEM" + tambah REF4IK trigger keyword di KB-FIRST rule (REF4IK / winlator-ref4ik / lite vs lud / Wine 10.2-ref4ik / the412banner / winlatorruu / Russian Winlator / VCRedist .wcp).
- `data/kb/00-index.md` — entry + trigger keyword.

**Skipped:**
- REF4IK/update-url-mod- (config tweak only, ga substantif)
- REF4IK profile page README
- REF4IK/Winlator-REF4IK (archived Nov 2025 — superseded by lowercase)
- REF4IK/Bionic-Drivers- (archived Jul 2025)
- REF4IK/Components- (archived Jun 2025)

---

## [Unreleased] — 2026-06-20 (sore)

### KB diperluas — StevenMXZ ecosystem (Winlator-Ludashi + Contents CDN + A8XX stack)

Deep-dive 17 repo StevenMXZ. Core relevant: Winlator-Ludashi (872⭐), Adreno-Tools-Drivers (657⭐ build script), Winlator-Contents (CDN .wcp catalog 47+ builds), Adrenotools-Drivers (a8xx prebuilt), mesa-tu8 (A8XX hacks).

**Added:**
- `data/kb/stevenmxz-ecosystem.md` — 3 build variant Ludashi (vanilla/ludashi/redmagic) buat OEM perf trigger Xiaomi/RedMagic. Inflection point per versi (3.0 Vulkan rewrite, 2.9 Sarek bundle, 2.8.2 Box64 32-bit fix, 2.8 Driver Download Manager). Winlator-Contents CDN catalog dengan DXVK matrix lengkap mobile (Mali Sarek 11.1, Adreno gplasync 2.7.1, ARM64EC variants). WOWBox64 stack masa depan (Wine 11 ARM64EC). SD 8 Elite (A8xx) stack pakai Adrenotools-Drivers v849 (a8xx ONLY).

**Changed:**
- `bot.js` SYSTEM_PROMPT: section baru "WINLATOR-LUDASHI ECOSYSTEM" — 3 build variant per OEM, Driver Download Manager custom repo URL, A8xx warning, WOWBox64 stack pointer.
- `data/kb/00-index.md` — entry + trigger keyword (Ludashi build variant, Xiaomi MIUI, RedMagic, WOWBox64, SD 8 Elite, custom repo URL, ARM64EC).

**Skipped:**
- StevenMXZ/Fixes-For-Games (essentially empty)
- StevenMXZ/VkGHL (Linux-targeted post-process, not Winlator)
- StevenMXZ/PSX2, xenia_android, wfm, vkcaps-adrenotools (off-topic untuk Winlator KB)
- StevenMXZ/FEX, box64, wine (semua fork WIP, ga stable release)

---

## [Unreleased] — 2026-06-20

### KB diperluas — DXWrapper (elishacloud) disambiguasi + stacking pattern

Deep-dive elishacloud/dxwrapper. Audit Winlator/GameHub relevance — DXWrapper umumnya disalahpahami sebagai "Winlator DX Wrapper dropdown" padahal ini project standalone yang complementary, bukan replacement.

**Added:**
- `data/kb/dxwrapper.md` — Disambiguasi WAJIB: Winlator UI dropdown ≠ elishacloud project. Killer use case = DDraw 1-7 era game (Diablo 1, AoE 2, HoMM 3, Fallout 1-2, StarCraft) di Mali, lewat Dd7to9 stacked DXVK-Sarek (ddraw → d3d9 → Vulkan, lebih bagus dari CNC-DDraw OpenGL path). Setting matrix mobile-relevant + env var `DXWRAPPER_*` alternative buat user yang susah edit INI di shared storage Android. Quick reference matrix kapan pake apa untuk legacy DirectX.

**Changed:**
- `bot.js` SYSTEM_PROMPT: section baru "DXWRAPPER (disambiguasi WAJIB dulu)" — bot tanya klarifikasi dulu sebelum jawab. Update VERSI MATTER tambah stale: "DXWrapper d3d8to9" → redundant, DXVK 2.4+ d8vk merged.
- `data/kb/00-index.md` — entry baru dengan trigger keyword (ddraw game lama, Diablo 1 mobile, Dd7to9, C&C vs ddraw fork, dst).

**Anti-stale rules baru di bot:**
- User minta `[WriteMemory]` hot-patch → TOLAK (Wine memory layout beda)
- User minta `WinVersionLie` → arahin winecfg
- User minta ASI plugin loader di Wine → WARNING Win-only
- User minta DXWrapper d3d8to9 → arahin DXVK 2.4+
- User minta hook System32 → TOLAK (upstream sendiri bilang jangan)

**Skipped (desktop-only / risky di Wine):**
- WriteMemory hot-patching
- AppCompatData LockEmulation/BltEmulation (Windows DDraw HEL specific)
- ASI plugin loader (Win-only mods)
- Mini dump file creation
- WinXP binaries asset

---

## [Unreleased] — 2026-06-19

### KB diperluas — Wine / Proton context (Android-only fokus)

Audit ulang dari deep-dive Wine + Proton. Trim semua bloat desktop/Steam Deck. Total +504 baris KB mobile-relevant (sebelum trim 770, -35% noise).

**Added:**
- `data/kb/wine-evolution.md` — Wine 9/10/11 inflection point yg relevan Winlator/GameHub (WoW64, ARM64EC, FFmpeg mfplat backend, unified `wine` di 11.0). Reality: mobile user ga bisa upgrade Wine standalone → saran = ganti fork emulator.
- `data/kb/wine-debug.md` — WINEDEBUG channel + workflow per simptom. Mobile-friendly priority (`+seh,+module,+loaddll` cukup, JANGAN `+relay`). Exception code reference (0xC0000005, 0xC0000142, dst).
- `data/kb/winedllovr-per-game.md` — WINEDLLOVERRIDES syntax + apply path Winlator (Container Settings → Environment Variables, BUKAN shortcut launch). Pattern proven per use case (SKSE/F4SE/BG3SE/GTAV/Mono popup). Anti-pattern core DLL override.
- `data/kb/proton-family.md` — Klarifikasi singkat: Proton ≠ Winlator. Mapping equivalent feature.

**Changed:**
- `bot.js` SYSTEM_PROMPT: 3 section baru (WINE DEBUG, WINEDLLOVERRIDES, PROTON CONTEXT) + perluasan VERSI MATTER. Reality check di awal tiap section ("TANYA dulu user bisa akses log gimana", "Container Settings Env Vars BUKAN shortcut launch").
- `data/kb/00-index.md` — entry baru dengan trigger keyword per file.

**Skipped (desktop-only, mobile irrelevant):**
- NTSync (Linux kernel 6.14+, Android ga support)
- Wayland driver detail (Android pake SurfaceFlinger)
- EGL default X11 (Termux X11 only)
- Proton Stable/Experimental/Hotfix detail Steam Deck
- Vulkan 1.4 hype (driver mobile sering masih 1.1/1.2)

---

## [2.1.0] — 2026-06-19

### Anti-stale-advice — version awareness DXVK/Box64/FEX

Deep-dive evolution per tool. Bot sekarang cek versi user sebelum saranin knob lama yang udah default/removed/merged.

**Added:**
- `data/kb/evolution-2026.md` — timeline inflection point DXVK (1.x → 2.7), Box64 (0.1 → 0.4.2), FEX (2107 → 2605). Mobile decision matrix per versi + 7 bot-rules anti-stale.
- `data/kb/forks-landscape.md` — status semua komponen Winlator ecosystem 2026 (active/dormant/merged), quick decision matrix, anti-vaporware list (Mobox/ExaGear/Cassia).
- `data/kb/dxvk-conf-extras.md` — knob upstream dxvk.conf lanjutan (Pipeline Library, Descriptor Heap, GPU spoofing, D3D8 post-merge d8vk, game-spesifik) + Mali 2.x baseline preset.

**Changed:**
- `bot.js` SYSTEM_PROMPT: section "VERSI MATTER (anti-stale-advice)" — bot cek versi tool user dulu, contoh stale (NATIVEFLAGS udah default, state-cache hilang di 2.7, d8vk merged).

**Stale advice yg sekarang ke-block:**
- "Set BOX64_DYNAREC_NATIVEFLAGS=1" → udah default ON di Box64 0.3.2+
- "Hapus state-cache DXVK" → DXVK 2.7+ udah ga punya state cache
- "Install d8vk standalone" → merged ke DXVK 2.4+

---

## [2.0.0] — 2026-06 (initial God-Tier rewrite)

### God-Tier Emulator persona + 7 critical bug fixes + ARM adaptive tuning

**Added:**
- SYSTEM_PROMPT rewrite — God-Tier Emulator & Translation Layer Engineer persona. Spesialisasi: GameHub family + Winlator forks + Box86/64/FEX + DXVK/Sarek/VKD3D + Mesa/Turnip/Zink + lsfg-vk-android.
- `kb_lookup` tool + curated KB seed (architecture-layers, gpu-rules, per-game tweak, chipset-affinity, Mali stack, DXVK conf, Box64/FEX envs, dst).
- `/stats` admin command + in-memory user activity tracker.
- Hybrid rate limit (5s cooldown + 20/60s window).
- ARM adaptive tuning — env-tunable resource cap untuk ARM/Termux deployment.

**Fixed:**
1. Memory leaks (chatHistory unbounded growth)
2. Unhandled rejections (orphan promises)
3. Blocking IO (sync reads on event loop)
4. WebFetch error handling (silent failures)
5. chatHistory race condition (concurrent session writes)
6. LLM semaphore (concurrency overflow)
7. YouTube collision detection (shortcode parse)

**Policy:**
- DRM/piracy lecture = FORBIDDEN. Bot ga sok moralis.
- Steam fix: steam_appid.txt + steam_api.dll defender exclude.
- Format code block (```) DILARANG untuk teks biasa.
- Mobox/ExaGear/Cassia DILARANG saranin.
- No hallucination policy.

---

## Sebelum 2.0.0

Initial commit + iterasi awal. Lihat git log untuk detail per commit.
