# Changelog

Format: keep-a-changelog ringan. Tanggal absolut. Versi major = kapabilitas baru, minor = polish.

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
