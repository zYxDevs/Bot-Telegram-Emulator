# Knowledge Base — Index

Curated by Noysz/Fourfect. Verified dari testing langsung + source resmi.
File ini = peta. Tiap topik linked ke file detail di folder yg sama.

## Box64 (CPU translator x86→ARM64, dipake Winlator-type)
- `box64-envs.md` — BOX64_DYNAREC_*, BOX64_MMAP32, BOX64_AVX, BOX64_NOSIGSEGV, dll.

## FEXCore (CPU translator x86→ARM64, dipake GameHub/BannerHub/Mobox)
- `fex-translation.md` — FEX_TSOENABLED, VectorTSO, HideHypervisorBit, per-game-engine matrix.
- `fex-extreme-params.md` — FULL matrix Custom/Extreme params (X87ReducedPrecision, MaxInst, SmallTSCScale, MemcpySetTSO, HalfBarrierTSO, VolatileMetadata, MonoHacks, SMCChecks) + preset COMPATIBILITY/BALANCED/PERFORMANCE.

## DXVK / DXGI / D3D9-11 (Vulkan translation layer)
- `dxvk-conf.md` — knob dxvk.conf critical (maxAvailableMemory, deferSurfaceCreation, async, dll).
- `dxvk-version-per-chipset.md` — DXVK versi mana buat Adreno/Mali apa.

## VKD3D-Proton (DX12 → Vulkan)
- `vkd3d.md` — VKD3D_CONFIG, feature level, RE4 setup.

## Wine / WINE env
- `wine-envs.md` — WINEDEBUG, WINEESYNC, WINEFSYNC, WINEDLLOVERRIDES, WINE_LARGE_ADDRESS_AWARE.

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
