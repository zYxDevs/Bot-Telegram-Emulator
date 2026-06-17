# Per-Game Config Files — Path + Key Spesifik

File config game di luar emulator yg bot HARUS tau lokasi + key spesifiknya.
Tanpa info ini, bot cuma kasih saran generik (gagal sebut "ubah baris X jadi Y").

---

## DiRT 3 (Complete Edition) — EGO 2.0 Engine
**Lokasi**: `Documents\My Games\DiRT3\hardwaresettings\hardware_settings_config.xml`
**Key**:
- `<directx forcedx9="true" />` — FORCE DX9 (default false di file). DX11 EGO 2.0 berat di mobile.
- `multisampling=8xmsaa` — kalau green/black screen pas race. JANGAN `qcsaa` (green screen).
**Executable**: `dirt3_game.exe` (BUKAN `dirt3.exe`).
**Pre-launch**: copy `d3d9.dll` dari DXVK folder x32 (game 32-bit) ke folder game.
**WINEDLLOVERRIDES**: `d3d9=n`.

## Splinter Cell Blacklist — UE 2.5 modded
**Lokasi**: `Documents\My Games\Splinter Cell Blacklist\SCBlacklistGame\Config\SCBlacklistEngine.ini`
**Key**:
- `NoDynamicLights=False` — WAJIB False (True bikin black screen).
- `EnableOcclusion=True` — counterintuitive, occlusion **lebih ringan** di setup ini.
- `StartupGraphicsApi=0` — force DX9.
- `MaxFPS=60` — physics bug di >60fps (door clip, ragdoll glitch).

## GTA V — RAGE Engine
**Lokasi settings**: `Documents\Rockstar Games\GTA V\settings.xml`
**Key**:
- `<vsync value="0" />` — VSync OFF (bug lock 10fps di Wine kalau ON).
- `<windowed value="2" />` — borderless windowed (lebih kompatibel dari fullscreen).
- `<screenwidth>1280</screenwidth>` / `<screenheight>720</screenheight>` — buat HP low-end mobile.
**Executable**: `PlayGTAV.exe` (BUKAN `GTA5.exe` — Rockstar launcher overlay sering crash di Wine).

## Tomb Raider 2013 — Crystal Engine
**Lokasi**: Wine registry (BUKAN file).
**Key**: `HKCU\Software\Crystal Dynamics\Tomb Raider\Graphics → RenderAPI = 9` (force DX9, DX11 mode butuh feature mobile-DXVK kadang miss).
**Cara set**: `wine regedit` di container, atau pake `reg add`.

## Halo CE (Combat Evolved)
**dxvk.conf**: `d3d9.forceSamplerTypeSpecConstants = True` — tanpa ini crash di shader compile di Vulkan mobile.
**Lokasi config**: in-game settings + dxvk.conf di folder game.

## Skyrim (Legendary Edition / Special Edition)
**Lokasi**: `Documents\My Games\Skyrim\Skyrim.ini` + `SkyrimPrefs.ini`
**Key Skyrim.ini**:
- `iPresentInterval=0` — VSync off (physics bug di 60+ FPS).
- `bFloatPointRenderTarget=1`.
**Key SkyrimPrefs.ini**:
- `iSize H/W` — resolusi window.
**dxvk.conf**: `dxvk.maxFrameRate = 60` WAJIB (physics-bound, bug di >60fps).

## Dark Souls 3 / Sekiro / Elden Ring — FromSoft
**Lokasi**: `AppData\Roaming\<Game>\` (config saved per profile).
**dxvk.conf**: `dxvk.maxFrameRate = 60` WAJIB.
**Wine env**: `WINEDLLOVERRIDES="dinput8=n,b"` buat fix DirectInput.
**Anti-cheat**: Easy AC trigger di Wine → boot **offline mode**.

## Silent Hill 2 (Classic 2002)
**Pre-launch**: copy `d3d8to9.dll` ke folder game (game native DX8, perlu wrap ke DX9 dulu).
**WINEDLLOVERRIDES**: `d3d8=n,d3d9=n`.
**dxvk.conf**: `d3d9.deferSurfaceCreation=True`.

## Need For Speed: Most Wanted (2005)
**Pre-launch**: pakai **WidescreenFix** patch (resolusi modern ga supported native).
**dxvk.conf**: `d3d9.maxAvailableMemory=512` (game tua, ga butuh banyak).
**Box64**: `BOX64_NOSIGSEGV=1` (DRM SafeDisc lawas).

## Payday 2 — Diesel Engine
**dxvk.conf**:
- `d3d9.deferSurfaceCreation = False` — **HARUS False** (True bikin glitch merah-cyan).
- `d3d9.maxAvailableMemory = 1024`.
**FEX**: `TSOEnabled=OFF`, `VectorTSOEnabled=OFF` (Diesel single-thread).
**RamBooster**: `ZRAM_GUARD_LEVEL=85`, `PRE_CRISIS_LEVEL=86` (atau 0).

## Sleeping Dogs / Definitive Edition
**FEX**: `TSOEnabled=OFF`, `VectorTSOEnabled=OFF` (single-thread rendering, ~15-25% FPS boost).
**Lokasi save**: `Documents\Square Enix\Sleeping Dogs\Save\`
**dxvk.conf**: `d3d11.relaxedBarriers=True`.
**In-game**: MSAA = **JANGAN ON** (crash). Pake SMAA aman.

## RE4 Remake (2023) — RE Engine
**WAJIB VKD3D-Proton**, BUKAN DXVK.
**WINEDLLOVERRIDES**: `d3d12=n;dxgi=n`.
**Env**: `VKD3D_CONFIG=dxr11` (matiin RT — mobile ga sanggup).
**FEX**: `TSOEnabled=ON`, `HIDEHYPERVISORBIT=ON`.
**Driver**: minimal Adreno 740 (SD8 Gen 2/3). Mali = no.

## Grid 2 — EGO 2.0
**Mirip DiRT 3** (engine sama).
**Lokasi**: `Documents\My Games\GRID 2\hardwaresettings\hardware_settings_config.xml`
**Key**: cek `<directx>` tag, force DX9 kalau ada opsi.

## NFS Heat / Payback (Frostbite)
**Anti-cheat**: EA's anti-cheat **JANGAN** dipake offline-only (refuse to start).
**dxvk.conf**: `dxgi.maxFrameLatency=1` (input lag).

---

## Cara cek file config sendiri (kalau game ga ada di sini)
1. Folder umum: `%USERPROFILE%\Documents\My Games\<NamaGame>\`
2. Atau: `%APPDATA%\<Publisher>\<NamaGame>\`
3. Atau: folder install game itu sendiri (`<NamaGame>\Config\`, `<NamaGame>\engine\config\`).
4. Buka file `.ini` / `.xml` / `.cfg` cari key `RenderAPI`, `directx`, `vsync`, `resolution`.

## Cara apply Wine registry
```bash
wine regedit
# Di GUI: HKCU > Software > <PathRegistry>
```
Atau via command:
```bash
wine reg add "HKCU\Software\Crystal Dynamics\Tomb Raider\Graphics" /v RenderAPI /t REG_DWORD /d 9 /f
```
