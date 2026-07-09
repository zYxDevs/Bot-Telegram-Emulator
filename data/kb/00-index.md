# Knowledge Base — Index

Curated by Noysz/Fourfect. Verified dari testing langsung + source resmi.
File ini = peta. Tiap topik linked ke file detail di folder yg sama.

## Konsep dasar (BACA KALAU USER TANYA "kenapa")
- `architecture-layers.md` — 7-layer stack Wine/Box64/FEX/DXVK/Driver/Kernel/HW + 4 hambatan
  kompatibilitas (instruction, Win API, Vulkan ext, anti-cheat) + diagnostic flowchart crash.
  **PAKE FILE INI** kalau user nanya: "kenapa HP gw kuat tapi game X ga jalan", "bottleneck di mana",
  "kenapa ganti DLL bisa kerja", "GPU spoofing nyentuh apa", "Rambooster placebo bukan", "bedanya
  Wine sama emulator apa", "anti-cheat kenapa ga bisa".

## DRM Bypass & Cracking (BACA KALAU USER TANYA CARA MEMAINKAN GAME ORI/STEAM DI EMULATOR)
- `drm-bypass.md` — Cara bypass Steam DRM, Goldberg emu, Epic Games, Denuvo, dan troubleshooting untuk menjalankan game ori di emulator mobile (Winlator). **PAKE FILE INI** kalau user nanya: "kenapa game steam nggak bisa dibuka", "cara pakai goldberg", "bypass drm", "crack game emulator".
- `kb_drm_bypass.md` — Pengetahuan mendalam tentang DRM bypass berdasarkan SteamAutoCracker. **PAKE FILE INI** buat referensi advanced cara bongkar DRM Steam (Steamless, CreamAPI DLC, Goldberg).
- `kb_piracy_sites.md` — Daftar situs download game bajakan yang aman (SteamRIP, FitGirl) dan blacklist malware. **PAKE FILE INI** kalau user nanya "download game di mana" atau minta link crack.
- `winlator_override.md` — Panduan teknis cara pasang override Environment Variables `WINEDLLOVERRIDES=steam_api=n,b;` di Winlator agar crack bekerja dengan benar. **PAKE FILE INI** kalau user gagal jalankan game bajakan yang baru diekstrak.

## Forks & ecosystem map (BACA KALAU USER TANYA "fork mana / komponen apa")
- `forks-landscape.md` — versi + status semua komponen 2026 (Winlator main/CMOD/Bionic Ludashi/GLIBC,
  Box64/FEX, DXVK/Sarek/VKD3D/d8vk/CNC DDraw/dxwrapper, libadrenotools/Turnip). Quick decision matrix
  + anti-vaporware list. **PAKE FILE INI** kalau user nanya: "fork mana yang bagus", "X masih hidup ga",
  "wrapper mana buat game lama", "perlu d8vk standalone ga", "Mali pake DXVK versi berapa".

## Evolution per tool (BACA KALAU USER LAMA PAKE VERSI USANG / NANYA "perlu upgrade ga")
- `evolution-2026.md` — timeline inflection point DXVK (1.x → 3.0.1; practical mobile 2.7.1), Box64 (0.1 → 0.4.2), FEX (2107 → 2607).
  Mobile decision matrix per versi. 7 bot-rules untuk anti-stale-advice (NATIVEFLAGS udah default,
  state-cache hilang di 2.7, d8vk merged, dst). **PAKE FILE INI** kalau user nanya: "kenapa lambat di
  HP gw", "upgrade Box64/FEX worth ga", "DynaCache itu apa", "x87 speedup", "io_uring error",
  "OOM kill FEX", "tweak lama masih ngaruh ga di versi baru".

## Box64 (CPU translator x86→ARM64, dipake Winlator-type)
- `box64-envs.md` — BOX64_DYNAREC_*, BOX64_MMAP32, BOX64_AVX, BOX64_NOSIGSEGV, dll.

## FEXCore (CPU translator x86→ARM64, dipake GameHub/BannerHub/Mobox)
- `fex-translation.md` — FEX_TSOENABLED, VectorTSO, HideHypervisorBit, per-game-engine matrix.
- `fex-extreme-params.md` — FULL matrix Custom/Extreme params (X87ReducedPrecision, MaxInst, SmallTSCScale, MemcpySetTSO, HalfBarrierTSO, VolatileMetadata, MonoHacks, SMCChecks) + preset COMPATIBILITY/BALANCED/PERFORMANCE.

## Box64 & FEXCore Preset Ground-Truth (var-level per app/fork) [VERIFIED screenshot UI]
- `box64-fex-presets-ground-truth.md` — value preset Stability/Compatibility/Intermediate/Performance per app: **GameHub vs Winlator Ludashi Bionic 3.1**. **CONFIRMED Box64 preset value BEDA antar app** (7 var beda di 4 preset). FEXCore preset identik di 2 sample (kemungkinan universal). **PAKE FILE INI** kalau user nanya "Box64 Performance preset isinya apa", "bedanya Stability vs Compatibility", "preset X di [app] settingnya gimana" — WAJIB konfirmasi app/fork dulu kalau user ga sebut.
- `box64-fex-variable-mechanics.md` — MEKANISME tiap var Box64/FEXCore + TUNING SIGNAL per game-archetype (Unity, multi-thread, x87 lawas, dst). Pake confidence tag [VERIFIED]/[THEORETICAL] per var. **PAKE FILE INI** kalau user mau compose CUSTOM preset, atau nanya "kenapa naikin SAFEFLAGS aman", "STRONGMEM ngaruh apa", "BIGBLOCK 3 bahaya ga buat game X".

## DXVK / DXGI / D3D9-11 (Vulkan translation layer)
- `dxvk-conf.md` — knob dxvk.conf critical buat mobile (maxAvailableMemory, deferSurfaceCreation, async, dll).
- `dxvk-conf-extras.md` — knob upstream lanjutan: Pipeline Library, Descriptor Heap/Buffer, FP16,
  GPU spoofing (hideNvidia/AMD/Intel + customDeviceId), D3D8 post-merge d8vk, game-spesifik
  (Halo CE, SH2 EE, Sims 2, Gothic 3, AquaNox), + DXVK 2.x mobile baseline preset.
  **PAKE FILE INI** kalau user nanya: "DXVK 2.x bisa di Mali ga", "graphicsPipelineLibrary apa",
  "kenapa game DX8 jalan tanpa d8vk", "spoof GPU ke Nvidia gimana", knob spesifik per-game.

## VKD3D-Proton (DX12 → Vulkan)
- `vkd3d.md` — VKD3D_CONFIG, feature level, RE4 setup.

## DXWrapper (elishacloud, drop-in DLL — beda dari Winlator UI dropdown)
- `dxwrapper.md` — Disambiguasi WAJIB: Winlator UI "DX Wrapper" dropdown ≠ elishacloud DXWrapper
  project standalone. Killer use: DDraw 1-7 game di Mali (Diablo 1, AoE 2, HoMM 3, etc.) lewat
  Dd7to9 stacked DXVK-Sarek (ddraw → d3d9 → Vulkan, lebih bagus dari CNC-DDraw OpenGL path).
  Setting matrix mobile-relevant + env var DXWRAPPER_* alternative (mobile-friendly).
  Anti-stale: WriteMemory tolak (Wine memory layout beda), d3d8to9 redundant (DXVK 2.4+ d8vk merged),
  WinVersionLie tolak (pake winecfg), ASI plugin warning (Win-only).
  **PAKE FILE INI** kalau user nanya: "DXWrapper apa", "ddraw game lama", "Diablo 1 mobile",
  "AoE 2 Winlator", "Dd7to9", "ddraw.dll ga ke-load", "C&C vs ddraw fork".

## Wine / WINE env
- `wine-envs.md` — WINEDEBUG, WINEESYNC, WINEFSYNC, WINEDLLOVERRIDES, WINE_LARGE_ADDRESS_AWARE.
- `wine-evolution.md` — Wine 9.0/10.0/11.0 inflection point yg relevan Winlator/GameHub
  (WoW64, ARM64EC, FFmpeg mfplat backend, Win10 default prefix, unified \`wine\` 11.0).
  User MOBILE ga bisa upgrade Wine standalone — saran = ganti fork emulator.
  Desktop-only stuff (NTSync/Wayland/EGL) di-skip karena ga relevan Android.
  **PAKE FILE INI** kalau user nanya: "wine64 not found", "video cutscene crash",
  "Wine versi mana di Winlator", "kontroler DInput action map", "32-bit installer issue".
- `wine-debug.md` — WINEDEBUG channels + workflow per simptom buat Winlator/GameHub log.
  Reality check: mobile user sering ga punya shell akses → tanya cara akses log dulu.
  Channel mobile-friendly (+seh,+module,+loaddll), JANGAN +relay/+all (GB+ log).
  Exception code reference (0xC0000005 AV, 0xC0000142 DLL init, 0xC0000094 div0, dst).
  **PAKE FILE INI** kalau user attach log Wine, crash code hex, channel debug query.
- `winedllovr-per-game.md` — WINEDLLOVERRIDES syntax + apply path Winlator (Container
  Settings → Environment Variables, BUKAN shortcut launch arg). Pattern proven
  (dinput8=n,b ASI/SKSE/F4SE, DWrite=n,b BG3SE, version=n,b GTAV, mscoree= cegah popup
  install Wine Mono). Anti-pattern core DLL override + DXVK conflict.
  **PAKE FILE INI** kalau user nanya: "DLL override apa", "mod loader Winlator", "SKSE",
  "BG3SE crash", "ReShade Winlator".

## Proton — klarifikasi context (NOT mobile-runnable)
- `proton-family.md` — Singkat: Proton ≠ Winlator. Mobile pake upstream Wine + Box64/FEX,
  Proton hanya Steam Deck/Linux desktop. Mapping equivalent (Proton FSR → Winlator
  driver picker, protonfixes → manual DLL override, dst). 5 bot-rules clarification.
  **PAKE FILE INI** kalau user nanya: "Proton di Winlator gimana", "install Proton mobile",
  "Steam Deck game di HP", "GE-Proton mobile feature".

## GPU / Driver
- `gpu-rules.md` — Mali vs Adreno hard rule, GPU spoofing, BCn/ClipDistance limitation.
- `chipset-gpu-map.md` — mapping chipset HP (Snapdragon/Dimensity/Helio) → vendor GPU (Adreno/Mali/IMG) → stack rendering. **WAJIB cek file ini DULU** sebelum nentuin Mali driver-gated stack vs Turnip — chipset Dimensity 7020/7025 itu jebakan (IMG, bukan Mali).
- `mtk-mali-modern.md` — MediaTek/Mali 2026 driver gate: driver `v40+` buat DXVK 2.x D3D9/10/11 test path, driver `v50+` buat VKD3D/DX12-light experimental, contoh `54.1.0` + Vulkan `1.3.303` sebagai community signal. **PAKE FILE INI** kalau user nanya: "DXVK 2 di Mali", "DX12 Mali", "VKD3D Mali", "driver v40/v50", "Vulkan 1.3.303", "Helio G99 driver baru", "MTK sekarang bisa DX12", "Mali driver".
- `turnip-per-adreno.md` — repo Turnip driver per chipset Adreno.

## Per-game tweak
- `per-game.md` — GTA V (3-tier per chipset), RE4 Remake, DiRT 3, Grid 2, SH2/3 classic,
  Splinter Cell Blacklist, Payday 2, Sleeping Dogs DE, Tomb Raider 2013, Halo CE, dll.
- `per-game-config-files.md` — PATH + KEY spesifik file config game di luar emulator
  (hardware_settings_config.xml DiRT 3, settings.xml GTA V, registry Tomb Raider 2013, dll).
  **WAJIB cek file ini sebelum jawab "edit config game"**.

## Chipset-specific
- `chipset-affinity.md` — CORE_AFFINITY_MASK per chipset (Helio G99, Dim 8400, SD 8 Elite, dll).

## REF4IK ecosystem (Winlator-ref4ik Russian fork + Components CDN bundled runtime)
- `ref4ik-ecosystem.md` — Fork brunodev branch `bionic-ref4ik`, 2 build variant (lite/lud — lud
  trick Ludashi-style buat Xiaomi MIUI). Latest v9 Mei 2026: Vulkan renderer rewrite + content
  provider cross-pollination (ref4ik/the412banner/custom URL = bisa pull dari StevenMXZ contents.json
  juga). Components-Adrenotools- CDN unik karena bundled VCRedist/PhysX/dotnet jadi .wcp (other forks
  user harus winetricks manual). Wine custom-patched `ref4ik` (10.2-ref4ik paling rame 18k DL).
  FEX cuma 2601, kalo butuh range luas arahin StevenMXZ.
  **PAKE FILE INI** kalau user nanya: "REF4IK Winlator apa", "winlator-ref4ik lite vs lud", "Russian
  Winlator", "Wine 10.2-ref4ik", "VCRedist .wcp install", "Telegram winlatorruu", "frame gen Winlator"
  (v7+), "content provider the412banner".

## The412Banner ecosystem (BannerHub 3 produk + Bannerlator + Nightlies CDN)
- `the412banner-ecosystem.md` — **3 produk SEPARATE** (BannerHub v3.8.0, BannerHub Lite v1.0.2, BannerHub v6 1.0.0-609 — beda base, beda keystore, ga update-over-able). Bannerlator (Winlator continuation post-Star-archive, BUKAN BannerHub). Nightlies = source of truth binary `.wcp` auto-build hourly. winlator-contents CDN URL (`https://raw.githubusercontent.com/The412Banner/winlator-contents/main/contents.json` — 138 entry). Banners-Turnip alt Mesa main builder. Tools: BCI (BannersComponentInjector no-root component manager), AIO-Graphics-Test (diagnostic), GamePathFixer (v5.x only), dxvk-unified (DXVK+VKD3D 1-file, BUKAN d7vk merge), bannerhub-nano-offline (700 MB offline build).
  **PAKE FILE INI** kalau user nanya: "BannerHub apa", "BannerHub vs Lite vs revanced", "BannerHub v6", "Bannerlator", "BannersComponentInjector", "BCI", "AIO-Graphics-Test", "GamePathFixer", "dxvk-unified", "Nightlies", "the412banner CDN", "Ludashi-plus Lossless.dll", "offline BannerHub".

## StevenMXZ ecosystem (Winlator-Ludashi + Contents CDN + Adreno A8XX)
- `stevenmxz-ecosystem.md` — 3 build variant Ludashi (vanilla/ludashi/redmagic) buat OEM perf trigger
  Xiaomi/RedMagic. Inflection point Ludashi versi (3.0 Vulkan rewrite, 2.9 Sarek bundle, 2.8.2 Box64
  32-bit fix, 2.8 Driver Download Manager). Winlator-Contents CDN catalog 47+ component (.wcp) buat
  custom repo URL. DXVK mobile matrix lengkap (Mali Sarek 11.1, Adreno gplasync 2.7.1, ARM64EC variants).
  WOWBox64 = Box64 WoW64-aware buat Wine 11 ARM64EC stack. SD 8 Elite (A8xx) need Adrenotools-Drivers
  v849 BUKAN universal Turnip.
  **PAKE FILE INI** kalau user nanya: "Winlator Ludashi apa", "build vanilla/ludashi/redmagic bedanya",
  "Xiaomi MIUI performance", "RedMagic frame gen", "Driver Download Manager", "WOWBox64", "ARM64EC",
  "SD 8 Elite Turnip", "DXVK build mana", "custom repo URL Winlator".

## Cara cari di KB
Bot panggil `kb_lookup(topic)` — substring match case-insensitive ke header section + body file.
Topic bisa: nama env var, nama knob, nama game, nama chipset, atau konsep (mis. "TSO").

## Community Fixes (Kontribusi Real User)
- `community.md` — Kumpulan fix dan trik dari pengguna Winlator di komunitas (via command /addfix). Isinya adalah pengalaman riil di lapangan (seperti fix game PES, RE3 Remake di chipset tertentu). **PAKE FILE INI** kalau ada spesifik problem yang tidak ada di dokumentasi resmi namun sudah pernah dipecahkan oleh member komunitas.
