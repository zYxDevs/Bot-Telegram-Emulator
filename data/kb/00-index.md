# Knowledge Base — Index

Curated by Noysz/Fourfect. Verified dari testing langsung + source resmi.
File ini = peta. Tiap topik linked ke file detail di folder yg sama.

## Konsep dasar (BACA KALAU USER TANYA "kenapa")
- `architecture-layers.md` — 7-layer stack Wine/Box64/FEX/DXVK/Driver/Kernel/HW + 4 hambatan
  kompatibilitas (instruction, Win API, Vulkan ext, anti-cheat) + diagnostic flowchart crash.
  **PAKE FILE INI** kalau user nanya: "kenapa HP gw kuat tapi game X ga jalan", "bottleneck di mana",
  "kenapa ganti DLL bisa kerja", "GPU spoofing nyentuh apa", "Rambooster placebo bukan", "bedanya
  Wine sama emulator apa", "anti-cheat kenapa ga bisa".

## Forks & ecosystem map (BACA KALAU USER TANYA "fork mana / komponen apa")
- `forks-landscape.md` — versi + status semua komponen 2026 (Winlator main/CMOD/Bionic Ludashi/GLIBC,
  Box64/FEX, DXVK/Sarek/VKD3D/d8vk/CNC DDraw/dxwrapper, libadrenotools/Turnip). Quick decision matrix
  + anti-vaporware list. **PAKE FILE INI** kalau user nanya: "fork mana yang bagus", "X masih hidup ga",
  "wrapper mana buat game lama", "perlu d8vk standalone ga", "Mali pake DXVK versi berapa".

## Evolution per tool (BACA KALAU USER LAMA PAKE VERSI USANG / NANYA "perlu upgrade ga")
- `evolution-2026.md` — timeline inflection point DXVK (1.x → 2.7), Box64 (0.1 → 0.4.2), FEX (2107 → 2605).
  Mobile decision matrix per versi. 7 bot-rules untuk anti-stale-advice (NATIVEFLAGS udah default,
  state-cache hilang di 2.7, d8vk merged, dst). **PAKE FILE INI** kalau user nanya: "kenapa lambat di
  HP gw", "upgrade Box64/FEX worth ga", "DynaCache itu apa", "x87 speedup", "io_uring error",
  "OOM kill FEX", "tweak lama masih ngaruh ga di versi baru".

## Box64 (CPU translator x86→ARM64, dipake Winlator-type)
- `box64-envs.md` — BOX64_DYNAREC_*, BOX64_MMAP32, BOX64_AVX, BOX64_NOSIGSEGV, dll.

## FEXCore (CPU translator x86→ARM64, dipake GameHub/BannerHub/Mobox)
- `fex-translation.md` — FEX_TSOENABLED, VectorTSO, HideHypervisorBit, per-game-engine matrix.
- `fex-extreme-params.md` — FULL matrix Custom/Extreme params (X87ReducedPrecision, MaxInst, SmallTSCScale, MemcpySetTSO, HalfBarrierTSO, VolatileMetadata, MonoHacks, SMCChecks) + preset COMPATIBILITY/BALANCED/PERFORMANCE.

## DXVK / DXGI / D3D9-11 (Vulkan translation layer)
- `dxvk-conf.md` — knob dxvk.conf critical buat mobile (maxAvailableMemory, deferSurfaceCreation, async, dll).
- `dxvk-conf-extras.md` — knob upstream lanjutan: Pipeline Library, Descriptor Heap/Buffer, FP16,
  GPU spoofing (hideNvidia/AMD/Intel + customDeviceId), D3D8 post-merge d8vk, game-spesifik
  (Halo CE, SH2 EE, Sims 2, Gothic 3, AquaNox), + DXVK 2.x mobile baseline preset.
  **PAKE FILE INI** kalau user nanya: "DXVK 2.x bisa di Mali ga", "graphicsPipelineLibrary apa",
  "kenapa game DX8 jalan tanpa d8vk", "spoof GPU ke Nvidia gimana", knob spesifik per-game.
- `dxvk-version-per-chipset.md` — DXVK versi mana buat Adreno/Mali apa.

## VKD3D-Proton (DX12 → Vulkan)
- `vkd3d.md` — VKD3D_CONFIG, feature level, RE4 setup.

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
- `turnip-per-adreno.md` — repo Turnip driver per chipset Adreno.

## Per-game tweak
- `per-game.md` — GTA V (3-tier per chipset), RE4 Remake, DiRT 3, Grid 2, SH2/3 classic,
  Splinter Cell Blacklist, Payday 2, Sleeping Dogs DE, Tomb Raider 2013, Halo CE, dll.
- `per-game-config-files.md` — PATH + KEY spesifik file config game di luar emulator
  (hardware_settings_config.xml DiRT 3, settings.xml GTA V, registry Tomb Raider 2013, dll).
  **WAJIB cek file ini sebelum jawab "edit config game"**.

## Chipset-specific
- `chipset-affinity.md` — CORE_AFFINITY_MASK per chipset (Helio G99, Dim 8400, SD 8 Elite, dll).

## Cara cari di KB
Bot panggil `kb_lookup(topic)` — substring match case-insensitive ke header section + body file.
Topic bisa: nama env var, nama knob, nama game, nama chipset, atau konsep (mis. "TSO").
