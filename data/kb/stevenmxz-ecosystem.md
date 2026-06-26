# StevenMXZ Ecosystem — Winlator-Ludashi, Contents CDN, Adreno A8XX stack

Source: github.com/StevenMXZ. Update: Juni 2026.

**SCOPE: Android emulator (Winlator family) — bot WAJIB tau ekosistem ini karena banyak user mobile pake distribusinya.**

Tujuan file ini: bot ngerti **3 build variant Ludashi**, **CDN Winlator-Contents (.wcp catalog)**, **stack Adreno A8XX (SD 8 Elite)**, dan saran upgrade/downgrade per kasus.

---

## Repo summary (yang relevan)

| Repo | Stars | Status | Apa itu |
|------|-------|--------|---------|
| Winlator-Ludashi | 872 | Active (3.0 Apr 2026) | Fork Winlator paling rame, 3 build variant |
| Adreno-Tools-Drivers | 657 | Active (Jun 2026) | `turnip_builder.sh` script build Turnip dari Mesa |
| Winlator-Contents | 63 | Active (Jun 2026) | CDN .wcp components catalog buat Driver Download Manager |
| Adrenotools-Drivers | 11 | Active (Jan 2026) | Prebuilt Turnip binary releases (a8xx ONLY) |
| mesa-tu8 | 3 | Active (Jan 2026) | Mesa fork dengan A8XX hacks (SD 8 Elite) |
| Contents-Cmod | 8 | Stale Aug 2025 | CDN buat Winlator-CMOD specifically |

Skip dari KB: Fixes-For-Games (essentially empty), VkGHL (Linux-targeted), PSX2/xenia/wfm/vkcaps (off-topic).

---

## Winlator-Ludashi — 3 build variants WAJIB pahami

User download `.apk` dari Releases, ada 3 variant. **NAMA SAMA, FUNGSI BEDA**:

| Variant | Package name | Trigger | Target user |
|---------|--------------|---------|-------------|
| `bionic-vanilla.apk` | Original Winlator package | Tidak ada | Default pilihan aman |
| `ludashi-bionic.apk` | Disamarkan jadi Ludashi (app benchmark Cina) | **Xiaomi MIUI/HyperOS** auto-trigger performance mode | Xiaomi/Redmi/POCO user |
| `Redmagic-build.apk` | Disamarkan jadi **Genshin Impact** package | **RedMagic** unlock frame gen + gaming enhancement | RedMagic user (8 Pro, 9 Pro, dst) |

**Logika:** OEM Android (Xiaomi, RedMagic, ASUS ROG) punya whitelist app gaming → trigger CPU/GPU boost + scheduler priority. Ludashi build trick ini.

**Pitfall:** vanilla = paling aman, tapi user Xiaomi/RedMagic mungkin lebih dapet FPS pake variant masing-masing. Tapi kalau Google Play Protect aktif, package name fake bisa ke-flag → install gagal.

---

## Ludashi 3.0 (Apr 2026) — MAJOR rewrite Vulkan

Inflection point yang bot harus tau:

| Versi | Inflection | Impact |
|-------|-----------|--------|
| **3.0** (Apr 2026) | Vulkan backend rewrite (replace OpenGL) + VkImage HW buffer (no CPU copy) + FIFO/Mailbox present modes + XInput2 mouse | Default ke depan. Game OpenGL native (cnc-ddraw OpenGL path, beberapa pre-DX game) mungkin butuh fallback |
| **2.9** (Mar 2026) | DXVK-Sarek BUNDLED + Proton content profile + Universal FPS limiter + Direct Rendering Mode (dri3 AHB scanout, experimental) + Compute BCn DISABLED on Adreno (default ON kemarin) | Sarek Mali user ga perlu manual install lagi. Compute BCn off di Adreno karena over-eager dulu |
| **2.8.2** (Jan 2026) | Box64 32-bit games regression FIXED + GraphicsDriverConfigDialog (GPU name/device/vendor ID spoof) + Compute BCn decompression option for Mali | Spoofing GPU sekarang punya GUI |
| **2.8** (Jan 2026) | Driver Download Manager + custom repo editing + File Manager addition | User bisa langsung install driver dari URL, ga perlu manual sideload |
| **2.7.4** (Dec 2025) | Memory option up to 16384 MB + TU_DEBUG="deck_emu" + IR3_SHADER_DEBUG + FD_DEV_FEATURES env vars + qgl_config.txt support tanpa root + Rendermode 0-3 (sysmem/gmem +10% perf) | Tweak knob bertambah |

**Anti-stale rule baru buat bot:**
- User Ludashi < 2.8.2 → "upgrade dulu, Box64 32-bit fixed di 2.8.2"
- User Ludashi < 2.9 → "Sarek udah bundled di 2.9+, ga perlu manual install"
- User Ludashi 3.0+ + game OpenGL native crash → coba 2.9.x lebih dulu (kalau Vulkan rewrite jadi masalah)
- User Xiaomi/RedMagic dengan vanilla build → "coba variant ludashi/redmagic, OEM trigger performance mode"

---

## Winlator-Contents — CDN component catalog

Pattern: Driver Download Manager (Ludashi 2.8+) baca `contents.json` di repo ini. User point custom repo URL = `https://raw.githubusercontent.com/StevenMXZ/Winlator-Contents/main/contents.json` → otomatis dapet 47+ build update tanpa sideload manual.

**Sibling CDN** (cross-ref): The412Banner punya `winlator-contents` repo dengan struktur sama (`contents.json` raw GitHub), 138 entry (DXVK ×41, Box64 ×24, dst). URL: `https://raw.githubusercontent.com/The412Banner/winlator-contents/main/contents.json`. Bisa dipake user yang mau cross-pull dari ekosistem The412Banner. Detail: kb_lookup("the412banner").

**Yang available (per Juni 2026):**

| Type | Count | Versi range | Highlight buat mobile |
|------|-------|-------------|-----------------------|
| Wine | 2 | proton-10-arm64ec | Wine 10 dengan ARM64EC support |
| Box64 | 7 | 0.3.5 → 0.4.2 | 0.4.2-fix = stable terbaru |
| **WOWBox64** | 4 | 0.3.7 → 0.4.2 | **WoW64-aware Box64** buat Wine 11 ARM64EC mode |
| DXVK | 14 | 1.5.5 → 2.7.1 | Lihat matrix di bawah |
| FEXCore | 13 | 2505 → 2605 | 2605 = latest, anti-OOM (RPMalloc) fixed |
| VKD3D | 7 | proton-2.7 → 3.0b | 3.0a/3.0b ARM64EC variant tersedia |

### DXVK matrix mobile (dari contents.json)

| GPU / Use case | DXVK build |
|----------------|------------|
| Mali (Sarek default) | `dxvk-11.1-sarek-async.wcp` (= **Sarek 1.11.0** sarek-async; "11.1" itu label terpotong dari 1.11.0, repo lain nyebutnya `dxvk-sarek-async-1.11.0.wcp`) |
| Mali legacy compat | `dxvk-1.10.3-async.wcp` |
| Adreno modern (default) | `dxvk-2.7.1-gplasync.wcp` |
| Adreno + Wine ARM64EC | `dxvk-2.7.1-arm64ec-gplasync.wcp` |
| Adreno + Wine ARM64EC + bug fix | `dxvk-2.7.1-arm64ec-gplasync-fix-leegao.wcp` |
| Game spesifik rewel | `dxvk-2.4.1-fix.wcp` (downgrade jalur) |
| Game old engine | `dxvk-2.4.1.1-gplasync-sp.wcp` (speed pack) |

**Variant suffix glossary:**
- `async` = patch async lama (Sporif/dxvk-async, DXVK 1.7.2–2.0, ARCHIVED Nov 2025) — shader compile off-thread, anti-stutter
- `gplasync` = Graphics Pipeline Library + async (Ph42oN, DXVK 2.x). **BUTUH Vulkan 1.3 → buat Adreno/GPU modern, BUKAN Mali tua**
- `arm64ec` = build kompatibel Wine ARM64EC native binary
- `sarek` = fork DXVK 1.10.x buat Mali/GPU tanpa Vulkan 1.3 (BCn emu + ClipDistance strip). Versi: 1.10.4→1.12.0
- `dyasync`/`dynasync` = async-style di Sarek 1.12.0
- `sp` = speed pack
- `fix` = bug-fix patch
- `leegao` = contributor patch buat spesifik regression

### WOWBox64 = yang BARU dan penting

WOWBox64 = Box64 yang aware WoW64. Wine 11.0 unified ke `wine` binary tunggal yang jalanin 64-bit ARM64EC native + 32-bit guest. WOWBox64 cuma jalanin 32-bit guest part. Native ARM64EC code path ga lewat Box64 sama sekali → cepat banget.

Pattern install: Wine `proton-10-arm64ec` + WOWBox64 0.4.2 + DXVK 2.7.1-arm64ec-gplasync. **Ini stack masa depan**, performance jump signifikan vs pure Box64.

User stuck di pure Box64 + Wine non-ARM64EC → masih jalan tapi 100% guest x86_64 translation, lebih lambat dari ARM64EC native.

---

## SD 8 Elite (Adreno 8xx) stack

User SD 8 Elite ada masalah unique: Adreno A8XX driver Qualcomm proprietary belum ke-merge sepenuhnya ke Mesa upstream → Turnip default ga jalan optimal.

**Solusi StevenMXZ:**

1. **mesa-tu8** = Mesa fork dengan A8XX hacks (incomplete MR patches). Branch `adreno-main`.
2. **Adrenotools-Drivers** releases = prebuilt binary dari mesa-tu8:
   - v849 (Jan 2026) — `849.zip` 13.3 MB
   - v842.19 (Dec 2025) — `842.19.zip` 13.2 MB
   - v842.13 (Jan 2026) — `842.13.zip` 24.5 MB (debug-bigger build)
   - **SEMUA `for adreno a8xx devices only`** — TIDAK kompatibel A7xx atau lebih lama
3. **Adreno-Tools-Drivers** (`turnip_builder.sh`) = build script kalau user pengen versi spesifik dari Mesa source

**Anti-stale rule:**
- User SD 8 Elite + Turnip lambat/crash → arahin Adrenotools-Drivers releases (v849 default)
- User SD 8 Gen 3 atau lebih lama → JANGAN install a8xx driver, BREAK device
- User pengen build sendiri dari Mesa source → arahin Adreno-Tools-Drivers `turnip_builder.sh`

---

## RULES BUAT BOT — anti-halu + anti-stale

1. User nyebut "Ludashi" → klarifikasi: Winlator-Ludashi yang **build variant mana** (vanilla/ludashi/redmagic)?
2. User HP Xiaomi (Mi/Redmi/POCO) + Winlator vanilla performance kurang → saranin `ludashi-bionic.apk` variant (trigger MIUI performance mode).
3. User RedMagic (8 Pro / 9 Pro / 10 Pro) → saranin `Redmagic-build.apk` variant (unlock frame gen + gaming features).
4. User Google Play Protect ke-flag install fake-package → suggest disable PPP temporary, atau pake vanilla build.
5. User Ludashi 3.0+ + game OpenGL native (legacy 2000-an OpenGL game, beberapa cnc-ddraw OpenGL path) crash → downgrade ke 2.9.x atau enable compat mode (kalau ada).
6. User minta cara install custom driver → arahin Driver Download Manager (Ludashi 2.8+) + custom repo URL `https://raw.githubusercontent.com/StevenMXZ/Winlator-Contents/main/contents.json`.
7. User SD 8 Elite (Adreno A8xx) → Turnip default = StevenMXZ/Adrenotools-Drivers v849, BUKAN universal Turnip build.
8. User SD non-A8xx coba install Adrenotools-Drivers a8xx → STOP, JELASIN "a8xx ONLY" = break device.
9. User minta DXVK Mali → `dxvk-11.1-sarek-async.wcp` dari Winlator-Contents (atau bundled di Ludashi 2.9+).
10. User minta Wine ARM64EC stack → `proton-10-arm64ec` + WOWBox64 0.4.2 + DXVK 2.7.1-arm64ec-gplasync. JANGAN campur dengan pure Box64.
11. User pake Contents-Cmod (CMOD-only catalog) → confirm fork = CMOD. Kalau Ludashi/vanilla, pake Winlator-Contents.

---

## Quick reference — recommended stack per device

| Device class | Wine | CPU translator | DXVK | Driver |
|--------------|------|----------------|------|--------|
| SD 8 Elite (A8xx) | proton-10-arm64ec | WOWBox64 0.4.2 | 2.7.1-arm64ec-gplasync | Adrenotools-Drivers v849 |
| SD 8 Gen 2/Gen 3 (A7xx) | proton-10-arm64ec | WOWBox64 0.4.2 | 2.7.1-arm64ec-gplasync | Turnip universal (KGSL/MR) |
| SD 7xx (A6xx) | Bundled Wine 9.x | Box64 0.4.2 | 2.6.2 atau 2.7.1 | Turnip universal |
| SD 6xx (A6xx low) | Bundled Wine 9.x | Box64 0.4.2 | 2.4.1-fix | Turnip universal |
| Mali (Mediatek/Exynos) | Bundled Wine | Box64/FEX | 11.1-sarek-async | VirGL/Vortek (bukan Turnip) |
| Helio G80-G99 (Mali) | Bundled Wine 9.x | Box64 0.4.2 | 11.1-sarek-async | VirGL |
