# The412Banner Ecosystem — BannerHub 3 produk + Bannerlator + Nightlies CDN

Source: github.com/The412Banner (44 repo, last research Juni 2026).

**SCOPE: Domain emulator Android — bot WAJIB paham karena The412Banner ngeluarin 3 launcher SEPARATE + Winlator continuation + binary CDN besar.**

Tujuan file ini: bot ngerti **3 produk BannerHub bukan 3 varian dari 1 app** (kesalahan paling sering user), **Bannerlator beda dari BannerHub** (emulator vs launcher), **winlator-contents CDN** sebagai sumber binary, dan tools tambahan (Component Injector, AIO-Graphics-Test, GamePathFixer).

---

## 3 PRODUK BANNERHUB — SEPARATE projects [VERIFIED]

User sering ngira "BannerHub Lite + revanced + base" = 3 varian 1 produk. **SALAH**. Ini **3 produk berbeda** dengan base APK upstream beda, keystore beda, backend beda, dan **TIDAK update-over-able**.

| Produk | Repo | Base | Latest | Package keystore |
|--------|------|------|--------|------------------|
| **BannerHub** | `The412Banner/BannerHub` | GameHub 5.3.5 ReVanced (PlayDay) | v3.8.0 (Juni 2026) | Independent keystore A |
| **BannerHub Lite** | `The412Banner/Bannerhub-Lite` | GameHub Lite 5.1.4 (Producdevity) | v1.0.2 (Mei 2026) | Independent keystore B |
| **BannerHub v6** | `The412Banner/bannerhub-revanced` | XiaoJi GameHub 6.0.9 (NEW pipeline) | v1.0.0-609 (Juni 2026) | Independent keystore C, 9 variant |

⚠️ **Trap utama**: nama repo `bannerhub-revanced` MISLEADING — itu produk **v6** (XiaoJi 6.0.9 base), BUKAN "revanced patch dari BannerHub 3.x". Pipeline beda total dari v3.x.

⚠️ **Trap kedua**: user upgrade dari v3.x → "v6" bakal **fail install** (Android reject SHARED_USER_INCOMPATIBLE) karena keystore beda. WAJIB uninstall produk lama dulu.

**Decision matrix — pilih produk mana:**

- User Android lega (RAM ≥6GB), pengen full feature (HUD, voice chat, AI FrameGen, RTS controls) → **BannerHub** (v3.8.0)
- User Android low-RAM atau pengen APK kecil (~47 MB vs 138 MB) → **BannerHub Lite**
- User pengen base terbaru (XiaoJi 6.0.x line) + ga peduli stabilitas masih WIP → **BannerHub v6**
- User komunikasi/info ga reliable → **bannerhub-nano-offline** (700 MB embedded server, lihat section bawah)

---

## Per-produk highlights

### BannerHub v3.8.0 [VERIFIED — released 2026-06-18]
Base GameHub 5.3.5 ReVanced. Extension via apktool smali patching (no source code), dibantu Claude Sonnet 4.6.

Fitur penting (anti-halu, ini yg ada bener-bener di v3.8.0):
- GOG / Amazon / Epic Games library tabs (login + download manager)
- Component Manager + in-app component downloader
- Winlator HUD overlay (Normal + Extra Detailed + **Konkr style** — CPU/GPU/RAM/SWAP/temp/per-core)
- AI Frame Generation menu
- RTS touch controls, VRAM unlock, per-game CPU core affinity
- Voice chat room-based (cross-compatible dengan BannerHub v6, no Steam login)
- Per-game PC Audio Settings (PulseAudio recording-compatible mode)
- Community Game Configs browser (dari `bannerhub-game-configs` repo)
- Offline Steam launch, root access management, Japanese locale

### BannerHub Lite v1.0.2 [VERIFIED — 2026-05-12]
Base GameHub Lite 5.1.4 (Producdevity vanilla, no ReVanced). APK ~47 MB.

**Beda dari BannerHub full** (yang ADA di Lite tapi pake jalur beda):
- Sustained Perf toggle pake `setSustainedPerformanceMode` + CPU governor (root) — BannerHub full cuma CPU governor (root)
- Built-in RTS touch controls (5.1.4 udah bawa, ga perlu patch)
- GPU System Driver default = YES (BannerHub full NO)
- Launch Fix (hardware whitelist bypass) — penting buat device tertentu (AYANEO Pocket FIT, dll)

**Belum ada di Lite (ada di BannerHub full):**
- Konkr Style HUD, Community Game Configs browser, Component description di settings picker

### BannerHub v6 1.0.0-609 [VERIFIED — 2026-06-18]
Base XiaoJi GameHub **6.0.9** (versionCode 121). NEW pipeline, **barely tested in general** (per README warning sendiri).

Highlight v6:
- Login bypass, redirect catalog API ke BannerHub Cloudflare Worker
- Preload-free PC-accurate XInput rumble
- In-app GOG sign-in/library/download via **Explore** tab (BannerHub-owned)
- Mute UI feedback sounds + recording-compatible audio toggle opsional
- 9 APK variant install side-by-side (different package names)
- Cross-compatible voice chat dengan BannerHub v3.8.0
- Tidak ada "Lite" terpisah di v6 — XiaoJi udah size-pass -46% sendiri

⚠️ Compatibility v6 ≠ v3.x — beda Steam client + beda component system. Game yg jalan di v3.x belum tentu jalan di v6, vice versa.

---

## Bannerlator [VERIFIED — released 2026-06-20] — BUKAN BannerHub

⚠️ **Penting**: Bannerlator = Winlator-style emulator (continuation dari Star Bionic post-`star-emu/star` archived). BannerHub = launcher/store aggregator. **Beda kelas total**, namanya doang yang mirip.

Latest: **Bannerlator 1.3** (`com.winlator.banner` + `com.tencent.ig` PuBG flavor + `com.ludashi.benchmark` Ludashi flavor).

Stack yang di-bundle:
- Wine + Box64/Box86 + WOWBox64 (ARM64EC) + FEXCore
- DXVK (GPLAsync + Sarek variants) + VKD3D-Proton + WineD3D/DirectDraw fallback
- Proton bionic via GameNative integration
- **VEGAS** — Adreno-optimized DXVK dengan real-time upscaling (Bannerlator unique)
- Turnip/Mesa dengan Timeline Semaphore patches buat DXVK terbaru
- **Frame Generation + FPS Limiter** built-in (headline 1.3)

Lineage: brunodev/winlator → coffincolors/cmod → Pipetto-crypto/Bionic → jacojayy/Star → The412Banner Star Bionic → **Bannerlator** (post-Star-archive personal continuation).

**Trap**: jangan bilang "pake BannerHub buat jalanin game Windows" — BannerHub itu launcher buat library Steam/Epic/GOG. Bannerlator yang Winlator-equivalent.

---

## winlator-contents CDN [VERIFIED]

Format sama persis StevenMXZ pattern: 1 file `contents.json` flat array, raw GitHub serve.

**URL:**
```
https://raw.githubusercontent.com/The412Banner/winlator-contents/main/contents.json
```

**Catalog: 138 entry** (per Juni 2026):
- Box64 ×24, WOWBox64 ×11, DXVK ×41, FEXCore ×20, VKD3D ×17, Proton ×5, Wine ×20

Setiap entry struktur:
```json
{
  "type": "Box64",
  "verName": "Box64-0.4.3",
  "verCode": "0",
  "remoteUrl": "https://github.com/The412Banner/Nightlies/releases/download/Box64/Box64-0.4.3.wcp"
}
```

**Consumption:** BannerHub/Bannerlator/REF4IK/Ludashi-plus tinggal set custom content provider URL → auto-pull JSON → render UI → download `.wcp` langsung dari `The412Banner/Nightlies` release.

**Cross-pollination**: REF4IK (v6+) + Ludashi (2.8+) Driver Download Manager bisa tarik dari URL ini. User Mali pake REF4IK pengen DXVK Sarek → bisa tarik dari sini (alternative dari StevenMXZ/Winlator-Contents).

---

## Nightlies = source of truth binary [VERIFIED]

Repo: `The412Banner/Nightlies` (92⭐). Auto-build via GitHub Actions:
- **Hourly** workflow update commit hash + asset
- **Daily full build** 03:30 EST / 08:30 UTC
- Format: `.wcp` (Winlator) + `.zip` (GameHub) untuk tiap komponen

Component upstream pinning (current):
- FEXCore: FEX-Emu/FEX (commit pinned per release, ~FEX-2605)
- VKD3D-Proton: HansKristian-Work/vkd3d-proton 3.0.1 + ARM64EC variant
- DXVK: doitsujin/dxvk (GPLAsync + ARM64EC + BinSem variants)
- Box64: ptitSeb/box64 + Pipetto-crypto/box64 main
- WOWBox64: WoW64-aware Box64 + Hybrid variants
- Turnip: dari `Banners-Turnip` (lihat bawah)

**DXVK BinSem variant**: butuh `DXVK_DISABLE_TIMELINE_SEMAPHORES=1` env biar aktif — workaround Turnip-kgsl timeline regression.

---

## Banners-Turnip = alt Mesa main builder [VERIFIED]

Sibling dari StevenMXZ Adreno-Tools-Drivers — keduanya build Mesa main jadi AdrenoTools zips, tapi pattern bin beda:

| Repo | Format | Coverage |
|------|--------|----------|
| StevenMXZ/Adrenotools-Drivers | Prebuilt `.zip` (debug-bigger) | A8xx ONLY (v849, v842.x) |
| The412Banner/Banners-Turnip | 3 zip per release (`.zip`) | A6xx/A7xx universal, A8xx, 710/720 test |

Latest: **v26.2.0-20260621-r2** (Mesa 26.2.0-devel). Build cadence **multiple per day** (auto-push tiap upstream Mesa berubah).

Per release 3 binary:
- `Turnip-v<MESA>-<DATE>-r<N>.zip` — A6xx/A7xx (SD 600-800, 7 Gen, 8 Gen 1-3)
- `Turnip-v<MESA>-<DATE>-r<N>-A8xx.zip` — experimental SD 8 Elite (A810/825/829/830)
- `Turnip-v<MESA>-<DATE>-r<N>-710-720-Test.zip` — unverified Adreno 710/720/722

---

## Tools tambahan layak rekomen

### BannersComponentInjector (BCI) v2.2.0 [VERIFIED]
External component manager — install/replace DXVK/VKD3D/Box64/FEXCore/Wine/GPU driver di GameHub app variants **tanpa root**. Pake Storage Access Framework (SAF).

Built-in repository (9): StevenMXZ, Arihany WCPHub, Xnick417x, AdrenoToolsDrivers (K11MCH1), freedreno Turnip CI, MaxesTechReview, HUB Emulators, **The412Banner/Nightlies**, GameNative.

**Use case**: User GameHub-family bingung install Sarek/d8vk/custom Box64 — saran BCI sebagai jalur GUI (cross-repo search + batch download + backup/restore otomatis).

⚠️ **Syarat**: WAJIB pake build GameHub yang udah patch file-access (Lite 5.1.4 atau setara). Build tanpa patch = BCI ga bisa baca data dir.

### AIO-Graphics-Test v1.6.0 [VERIFIED]
All-in-one Windows `.exe` diagnostic — replace `vkcube.exe`, `GPUInfo.exe`, dan `3d-tests` kit.

Drop ke container Winlator/Bannerlator → 1 binary render cube via Vulkan native / OpenGL (Zink) / DirectDraw / D3D8/9/10/11 (DXVK) / D3D12 (VKD3D-Proton).

Bundled:
- DX11 scene suite (cube, instanced 512 cubes, tessellation, compute particles)
- Demo scenes (raymarched: Space, Cityscape, Desert, Nebula, Ocean v2)
- Disk Speed bench (sequential + random 4KB, CrossPlatformDiskTest-matched method, klasifikasi eMMC/UFS/SSD)
- Stacked Vulkan + OpenGL GPU info pane (replaces GPUInfo.exe)
- Timeline-vs-binary semaphore probe (DXVK regression detector)
- Mesh-shader probe (`VK_EXT_mesh_shader` detection — Adreno Turnip currently NO)
- Benchmark mode dengan Avg/Min/Max/1%-low + CSV dump

**Use case**: user crash random — pake AIO Graphics dulu sebelum bilang DXVK rusak. Bisa nentuin **layer mana** yg sakit (driver vs translator vs DXVK).

### bannerhub-nano-offline v0.2 [VERIFIED]
Fully offline build BannerHub v3.7.5. Embedded NanoHttpd server di `127.0.0.1:51823` mirror Cloudflare Worker static catalog.

APK ~700 MB karena bundled component + catalog. Bundled: Proton 10.0 x64 (jalan airplane mode out of the box) + 9 more layers download-on-demand (Proton 8/9/10/GE + Wine 7/8/9/10) yang persist setelah download pertama.

**Use case**: rural/limited connectivity user. Bukan default — saranin hanya kalau user explicit bilang "internet susah".

⚠️ Yang TETAP butuh internet (kalo ada): GOG/Epic/Amazon login + downloads (jalur OkHttp masing-masing, bukan via local server).

### GamePathFixer v1.2.2 [VERIFIED]
No-root utility — edit exe path / display name / card art game entry di GameHub-family launcher.

**Compatibility:** GameHub v5.x **ONLY** (Lite 5.1.x, BannerHub 3.x-base, gamehub-lite). GameHub 6.0+ **NOT supported** — DB schema migrate ke `db_game_library.db` (multi-table baru).

**Use case**: user pindahin folder game terus library broken → arahin GamePathFixer.

### dxvk-unified [VERIFIED]
Single `.wcp` covering D3D1-12: DXVK 2.7.1 (yang udah include d7vk D3D1-7 path) + VKD3D-Proton 3.0b di-package jadi 1 file (~9.8 MB compressed / ~54 MB uncompressed).

⚠️ **Anti-halu**: bukan "d7vk + DXVK merge baru". d7vk udah ke-merge upstream ke DXVK (commit SHA sama). dxvk-unified value-nya = **packaging convenience**, bukan code-level merge.

**Use case**: user pengen 1 component cover semua DX version (DDraw classic + DX8-11 + DX12) — drop dxvk-unified.wcp sekali, gak perlu mix-match.

---

## RULES BUAT BOT — anti-halu BannerHub family

1. User nyebut "BannerHub" → **TANYA dulu**: BannerHub (v3.x), BannerHub Lite, atau BannerHub v6? Beda produk, beda jawaban.
2. User nyebut "BannerHub revanced" → klarifikasi: maksud **BannerHub v6** (XiaoJi 6.0.9 base, repo `bannerhub-revanced`), bukan "revanced version of BannerHub 3.x".
3. User upgrade dari v3.x ke v6 fail install → jelasin: keystore beda, **wajib uninstall dulu**, history game di-backup manual via Export Config sebelumnya.
4. User nyebut "Bannerlator" → ini **emulator** Winlator-continuation, BUKAN BannerHub launcher. Jangan campur jawaban.
5. User Mali pake BannerHub/Bannerlator → DXVK pick TIER-aware sama dengan rules existing (Sarek 1.11.1-mali-fix / 1.12.0 vs vanilla 2.x). The412Banner Nightlies punya semua versi via `.wcp`.
6. User mau install DXVK/Box64/Wine custom → arahin BCI (Banners Component Injector) sebagai GUI jalur, atau direct URL `https://raw.githubusercontent.com/The412Banner/winlator-contents/main/contents.json` di Driver Download Manager.
7. User GameHub 6.0+ broken library entry → JANGAN saran GamePathFixer (v5.x only). Saran upgrade/reinstall.
8. User crash random + bingung layer mana → AIO-Graphics-Test untuk diagnostic dulu sebelum tweak.
9. User Ludashi-plus + LSFG ga jalan v3.1.2-pre2+ → ingatin: **Lossless.dll BUKAN bundled lagi** di pre2 (compliance). User wajib **Settings → Import Lossless.dll** manual. v3.1.1 dan lebih lama masih bundled.
10. User pengen 1-file DX1-12 wrapper → saran dxvk-unified.wcp (TAPI jelasin bukan d7vk merge baru, itu DXVK 2.7.1 packaging).

---

## Cross-reference

- **StevenMXZ ecosystem**: `kb_lookup("stevenmxz")` — sibling CDN + a8xx driver
- **REF4IK ecosystem**: `kb_lookup("ref4ik")` — Russian community fork, content provider compatible
- **GPU rules**: `kb_lookup("gpu-rules")` — Mali tier matrix universal, applicable di Bannerlator/BannerHub juga
- **Evolution**: `kb_lookup("evolution")` — inflection point Box64/FEX/DXVK universal
