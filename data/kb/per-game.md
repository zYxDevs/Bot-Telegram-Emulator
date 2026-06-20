# Per-game Tweak

Game spesifik yg punya quirk verified.

---

## GTA V — RAGE Engine, DX11

**Launcher**: `PlayGTAV.exe` (BUKAN `GTA5.exe` — Rockstar overlay crash di Wine).
**In-game VSync**: WAJIB OFF (bug lock 10fps).
**Pre-launch**: settings.xml di `Documents\Rockstar Games\GTA V\` — set `<vsync value="0"/>`, `<windowed value="2"/>`.

### Tier per chipset (verified community presets)

**Helio G99 / Mali-G57 MC2** (Realme 11, Infinix Note 40, dll):
```
Resolution      : 1024x600
DirectX         : 10 (force, lebih ringan dari 11)
DXVK            : 1.7.2 async
Proton          : wine-10.0-arm64ec
FEX preset      : PERFORMANCE
Box64 preset    : PERFORMANCE
Box64 ver       : 0.4.1
FEX ver         : 202604+
Winlator fork   : Star Bionic 1.1 (Ludashi variant)
Graphic         : Medium
RAM             : 8GB
Expected FPS    : 30 fps
```

**Dimensity 8020-8200 / Mali-G610**:
```
Resolution      : 1280x720
DirectX         : 11
DXVK            : 1.7.3 async
Proton          : Proton-10.0.99-arm64ec
FEX preset      : PERFORMANCE
Graphic         : Medium-High
RAM             : 8-12GB
Expected FPS    : 30-40 fps
```

**Dimensity 8400 Ultra / Mali-G720 MC7** (POCO X7 Pro, dll):
```
Resolution      : 1920x1080
DirectX         : 11
DXVK            : 2.5/2.6/2.7 vanilla (Vulkan 1.3+GPL — Sarek opsional)
Proton          : Proton-10.0.99-arm64ec
Box64 preset    : PERFORMANCE
Box64 ver       : 0.4.1
FEX ver         : 202510+
Winlator fork   : Ludashi 2.9+
Graphic         : HIGH + HDR + SUPER resolution
RAM             : 12GB
Expected FPS    : 25-30 fps
Note            : leegao wrapper bisa nambah stability
```

**Adreno 740 (SD 8 Gen 2/3)** & higher:
- Driver: Turnip (cek per-chipset di turnip-per-adreno.md).
- DXVK 2.x.
- Bisa coba High settings stable.

### Common errors GTA V
- `Rockstar Game Services failed to initialize` → pake **Offline Mode** + bypass Social Club.
- Crash di intro → matiin DLSS/FSR in-game (mobile ga support).
- Black screen Story Mode → `dxgi.deferSurfaceCreation=True` di dxvk.conf.
- FPS drop di Sandy Shores → environment streaming bottleneck, ga ada fix murni — kurangin Distance Scaling.

### JANGAN
- ❌ Vortek + WineD3D di Mali = OUTDATED (era 2022). Pake DXVK-Sarek.
- ❌ Compatibility preset Box64/FEX = lambat ga perlu, PERFORMANCE udah stabil di sebagian besar HP.
- ❌ MSAA on = crash hampir pasti di mobile.

## RE4 Remake (Resident Evil 4 Remake, 2023)
- Engine: RE Engine.
- DX: **12 ONLY**.
- **WAJIB VKD3D-Proton**. JANGAN DXVK.
- `WINEDLLOVERRIDES="d3d12=n;dxgi=n"`
- `VKD3D_CONFIG=dxr11` wajib (matiin RT).
- FEX (GameHub): `FEX_TSOENABLED=ON`, `HIDEHYPERVISORBIT=ON`.
- Driver: minimal Adreno 740 (SD8 Gen 2/3) buat playable. Mali = no.
- Texture quality LOW. RT OFF. Shadow MEDIUM max.

## Silent Hill 2 & 3 (Classic, 2002-2003)
- DX: **8** (bukan DX9!).
- DXVK ga handle DX8 directly. **Wajib pake d3d8to9.dll wrapper** di folder game.
- `WINEDLLOVERRIDES="d3d8=n,d3d9=n"`.
- d3d8to9 source: github.com/crosire/d3d8to9 (releases).
- Setelah wrap, DXVK handle DX9-nya normal.
- VSync force in-game (game tua, 30/60 fps cap).

## Splinter Cell Blacklist
- Engine: Unreal Engine 2.5 (heavily modded).
- DX: 9 atau 11 (toggle in-game).
- **NoDynamicLights=False** wajib di config.
  WHY: True bikin black screen di Wine (dynamic lighting path bug).
- **EnableOcclusion=True** — counterintuitive, occlusion culling **lebih ringan** di setup ini.
- **FPS cap 60 WAJIB**. WHY: physics bug di >60fps (door clip, ragdoll crazy).
- `StartupGraphicsApi=0` buat force DX9.

## Payday 2
- Engine: Diesel Engine.
- DX: 9.
- FEX (GameHub): `FEX_TSOENABLED=OFF` (Diesel engine ga butuh TSO).
- dxvk.conf: **`d3d9.deferSurfaceCreation=False`** (True bikin glitch merah-cyan).
- RamBooster: `ZRAM_GUARD_LEVEL=85`, `PRE_CRISIS_LEVEL=0` atau 86.
  WHY: PD2 idle RAM ~80%, threshold harus jauh di atas idle.
- Box64: `BOX64_DYNAREC_BIGBLOCK=2`.

## Sleeping Dogs / Sleeping Dogs Definitive Edition
- Engine: bespoke (mirip Just Cause engine).
- DX: 11 (DE) / 9 (original).
- FEX (GameHub): `FEX_TSOENABLED=OFF`, `FEX_VECTORTSOENABLED=OFF`.
  WHY: rendering single-thread, TSO overhead percuma → off bikin ~15-25% FPS boost.
- Anti-aliasing: SMAA aman, MSAA crash.
- DXVK: `d3d11.relaxedBarriers=True`.
- Driver: Adreno 7XX OK, Mali G610+ OK, Mali G57 struggle.

## DiRT 3 (Complete Edition) — EGO 2.0 Engine
- Arch: **32-bit ONLY**.
- DX: native 11, **WAJIB force DX9** (DX11 EGO terlalu berat di Mali).
- **Pre-launch wajib**:
  1. Edit `Documents\My Games\DiRT3\hardwaresettings\hardware_settings_config.xml` — set `<directx forcedx9="true" />`.
  2. Copy `d3d9.dll` dari folder x32 DXVK ke folder game.
  3. `WINEDLLOVERRIDES="d3d9=n"`.
- **Executable**: `dirt3_game.exe` (BUKAN `dirt3.exe`).
- **dxvk.conf** (taro di folder game):
  ```
  dxvk.enableAsync = True
  dxvk.enableStateCache = True
  dxvk.stateCacheMaxEntries = 200
  dxvk.maxChunkSize = 32
  d3d9.maxAvailableMemory = 1024
  d3d9.maxFrameLatency = 1
  d3d9.samplerAnisotropy = 4
  ```
- **FEX preset Helio G99**:
  ```
  TSOEnabled         : OFF
  X87ReducedPrecision: ON
  Multiblock         : ON
  MaxInst            : 4000
  SmallTSCScale      : ON
  VectorTSOEnabled   : OFF
  MemcpySetTSOEnabled: OFF
  HalfBarrierTSOEnabled: OFF
  VolatileMetadata   : ON
  HideHypervisorBit  : OFF
  MonoHacks          : OFF
  SMCChecks          : mtrack
  ```
- **Box64 (Winlator Bionic)**: `BOX64_DYNAREC_STRONGMEM=0`, `BOX64_DYNAREC_FASTNAN=1`, `BOX64_DYNAREC_CALLRET=1`, `BOX64_DYNAREC_SAFEFLAGS=1`, `BOX64_DYNAREC_SIZE=32`.
- **In-game**: 800x600 atau 1024x768, AA = 8xMSAA atau Off (JANGAN QCSAA = green screen), VSync Off.
- **Troubleshoot**:
  - Green screen race → ubah `multisampling=8xmsaa` di config.
  - GFWL error → pakai Complete Edition (skip GFWL).
  - FPS rendah → konfirmasi `forcedx9="true"` + dll lokasinya.

## Grid 2 — EGO 2.0 (sama family DiRT 3)
- Lokasi config: `Documents\My Games\GRID 2\hardwaresettings\hardware_settings_config.xml`
- Settings & FEX preset = sama dengan DiRT 3.
- **Helio G99 / Mali-G57 verified**: DXVK 1.12 sarek dynasync + Proton 10 arm64ec + GameHub 5.1.0, 800x600-854x480 ultra-low, 25-30 fps.

## Tomb Raider 2013 (Crystal Dynamics)
- Engine: Crystal Engine.
- DX: 9 atau 11.
- **Force DX9** via registry Wine:
  `HKCU\Software\Crystal Dynamics\Tomb Raider\Graphics → RenderAPI = 9`
  WHY: DX11 path butuh feature yg DXVK mobile kadang miss. DX9 lebih stabil.
- FEX: `TSOENABLED=ON` (Crystal Engine TSO-dependent).
- Tressfx (hair physics): OFF di mobile.

## Halo CE (Combat Evolved)
- Engine: Blam!
- DX: 9.
- dxvk.conf: `d3d9.forceSamplerTypeSpecConstants=True`.
  WHY: tanpa ini crash di shader compilation di banyak Vulkan driver mobile.

## Assassin's Creed (any AnvilNext era)
- Engine: AnvilNext.
- DX: 11 (kebanyakan) / 12 (Valhalla, Mirage).
- FEX: `TSOENABLED=ON`, `VECTORTSOENABLED=ON`, `HIDEHYPERVISORBIT=ON` (anti-emu detection).
- Driver: AC Origins+ butuh Adreno 730+ atau Mali G610+.

## Cyberpunk 2077
- Engine: RED Engine.
- DX: 12.
- Mobile: super berat, ga praktis di bawah SD 8 Elite.
- VKD3D + DXR off + texture lowest.

## Hogwarts Legacy
- DX: 12 default, **ada DX11 launch flag** `-dx11`.
- Prefer DX11 di mobile (DXVK lebih stabil ketimbang VKD3D di game ini).

## Elden Ring / Dark Souls 3 / Sekiro
- FromSoft games. Physics bound.
- `dxvk.maxFrameRate = 60` WAJIB.
- ER kompatibel DXVK 1.10.3 lebih dari 2.x di banyak case.
- Anti-cheat Easy AC kadang trigger di Wine → boot offline mode.

---

## Pattern umum game lawas (pre-2010)
- DX 9 atau ke bawah.
- 32-bit binary → butuh `WINE_LARGE_ADDRESS_AWARE=1` + `BOX64_MMAP32=1`.
- VSync sering bug di Wine → force OFF in-game, cap via DXVK.
- DRM lawas (StarForce, SecuROM) → `BOX64_NOSIGSEGV=1`, `BOX64_NOSIGILL=1`.
