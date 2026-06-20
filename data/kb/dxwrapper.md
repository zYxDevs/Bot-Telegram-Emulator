# DXWrapper (elishacloud) — Drop-in DLL untuk DDraw-era games

Source: github.com/elishacloud/dxwrapper, PCGamingWiki, Winlator DeepWiki. Update: Juni 2026.

**SCOPE: Android emulator (Winlator family + GameHub family). NO desktop Win10/11 reference.**

Tujuan file ini: bot ngerti **dua hal berbeda yang sama-sama dipanggil "DXWrapper"**, kapan elishacloud DXWrapper worth dipake di Winlator, dan stacking pattern-nya sama DXVK.

---

## DISAMBIGUASI WAJIB

User bilang "DXWrapper" → bot **WAJIB klarifikasi dulu**:

| Maksud | Apa itu | Di mana |
|--------|---------|---------|
| **Winlator UI "DX Wrapper" dropdown** | Picker untuk wrapper bundled Winlator | Container Settings → Graphics → DX Wrapper |
| **elishacloud DXWrapper project** | Drop-in DLL set untuk game folder | github.com/elishacloud/dxwrapper |

**Winlator UI dropdown** isinya: WineD3D, DXVK, VKD3D, CNC DDraw, D8VK.

**elishacloud DXWrapper** = file `dxwrapper.dll` + `dxwrapper.ini` + stub DLL (ddraw.dll / d3d8.dll / dll) yang user copy-paste ke folder game.

Beda sumber, beda mekanisme, beda use case. Bot jangan campur aduk.

---

## Apa itu elishacloud DXWrapper

DLL wrapper yang ngintercept DirectX call game dan convert/fix. Designed buat game DirectX legacy (pra-2005) di Windows modern. Di Winlator, value-nya khusus untuk **game era DirectDraw (1995-2003)** karena DXVK ga support DDraw.

API yang bisa di-stub:
- `ddraw.dll` — DirectDraw 1-7 (KILLER FEATURE: Dd7to9)
- `d3d8.dll` — DirectX 8 (redundant, lihat catatan d8vk di bawah)
- `d3d9.dll` — DirectX 9 (redundant kecuali special tweak)
- `dsound.dll` — DirectSound audio fix
- `winmm.dll` — older audio + timer
- `dinput.dll` / `dinput8.dll` — DirectInput fix mouse/keyboard

**Release latest:** v1.7.8400.25 (Mei 2026). Asset utama: `dxwrapper.zip` (10.8MB). `winxp.binaries.zip` SKIP — Wine version-lie udah ke-handle winecfg.

---

## Stacking pattern di Winlator (yang penting)

Untuk game DDraw lama (Diablo 1, Age of Empires 1-2, StarCraft, HoMM 3, Fallout 1-2, Carmageddon, etc.):

```
[Game ddraw call]
     ↓
ddraw.dll (stub elishacloud DXWrapper)
     ↓
dxwrapper.dll Dd7to9 conversion
     ↓
d3d9.dll (DXVK)
     ↓
Vulkan (Turnip/Mali Sarek)
```

**Steps di Winlator:**

1. Download `dxwrapper.zip`, extract
2. Copy `Stub/ddraw.dll` + `dxwrapper.dll` + `dxwrapper.ini` ke folder `.exe` game
3. Container Settings → Environment Variables: `WINEDLLOVERRIDES=ddraw=n,b`
4. Container Settings → Graphics → DX Wrapper: **DXVK** (atau DXVK-Sarek buat Mali)
5. Edit `dxwrapper.ini`:
   ```
   [Compatibility]
   Dd7to9 = 1
   ```
6. Launch game

**Result:** ddraw output → konversi ke d3d9 → DXVK Vulkan. Mali pakai jalur Sarek = JAUH lebih bagus dari CNC-DDraw yang OpenGL.

---

## Kapan elishacloud DXWrapper Dd7to9 > CNC-DDraw

Winlator default-nya CNC-DDraw buat ddraw games (di-bundle, pilihannya di dropdown). Tapi:

| Aspek | CNC-DDraw | DXWrapper Dd7to9 |
|-------|-----------|------------------|
| Output | OpenGL | Direct3D 9 → DXVK Vulkan |
| Mali (Mali) | OpenGL via Wine GL → swiftshader/native = lambat/glitchy | Tetap di pipeline Vulkan Sarek = lebih bagus |
| Adreno | Sama-sama jalan, kinerja close | Lebih konsisten karena Turnip Vulkan path |
| Setup | Built-in dropdown | Manual drop-in file |
| Game asal nama | C&C series specifically | General ddraw 1-7 |
| Range game | Sebagian ddraw saja | Lebih luas (Dd7to9 cover lebih banyak game) |

**Rule of thumb:**
- Mali / non-C&C ddraw game → coba DXWrapper Dd7to9 dulu
- Adreno + C&C series → CNC-DDraw cukup (lebih simple)
- Game ddraw rewel → DXWrapper Dd7to9 lebih comprehensive

---

## Setting yang RELEVAN buat Winlator (dxwrapper.ini)

Cuma setting yang bener-bener kepake di konteks mobile/Wine:

```ini
[Compatibility]
Dd7to9 = 1               ; THE KEY: DDraw → D3D9 conversion
D3d8to9 = 0              ; SKIP: redundant kalau pake DXVK 2.4+ (d8vk merged)
D3d9to9Ex = 0            ; SKIP: special case desktop
WinVersionLie = 0        ; SKIP: pake winecfg Wine Version override

[ddraw]
DdrawOverrideBitMode = 32  ; force 32-bit color buat game yang stuck 16-bit

[d3d9]
AnisotropicFiltering = 0   ; biarin DXVK yang handle (dxvk.conf)
AntiAliasing = 0           ; biarin DXVK
EnableVSync = 0            ; biarin Winlator
EnableWindowMode = 0       ; biarin Winlator force fullscreen toggle

[Dd7to9]
DdrawAutoFrameSkip = 0     ; CRT-era frame skip, biasanya ga butuh
DdrawFillSurfaceColor = 0  ; debug helper, skip
```

**Setting yang HARUS bot tolak rekomendasiin:**
- `[WriteMemory]` apapun — Wine memory layout beda dari Windows, hot-patch ga reliable
- `[AppCompatData] LockEmulation`/`BltEmulation` — designed for Windows DDraw HEL, behavior Wine ddraw layer beda
- `[Plugins] LoadPlugins=1` — ASI plugin loader, mayoritas plugin Windows-specific ga loadable di Wine
- `WinVersionLie` — Wine punya winecfg → Applications → Windows Version override yang lebih bersih
- `[Hooking] DdrawHookSystem32` dll — DXWrapper sendiri bilang "do not overwrite system32 DLLs". Di Wine = jangan taruh di prefix/drive_c/windows/system32

---

## INI file name match

DXWrapper baca INI berdasarkan nama DLL stub-nya:
- Stub `ddraw.dll` → cari `ddraw.ini` (BUKAN dxwrapper.ini!)
- Stub `winmm.dll` → cari `winmm.ini`
- Default name `dxwrapper.ini` cuma kalau stub-nya `dxwrapper.dll` (jarang)

**Common mistake:** user copy `ddraw.dll` + `dxwrapper.ini` doang → ga ke-load karena nama beda. Solusi:
- Rename `dxwrapper.ini` → `ddraw.ini`, atau
- Pake env variable Winlator (lewat Container Settings → Environment Variables) — DXWrapper baca env var juga

---

## Setting via Environment Variables (mobile-friendly)

DXWrapper bisa baca env var sebagai alternatif INI. Format: `DXWRAPPER_<SettingName>`.

Contoh di Winlator Container Settings → Environment Variables:
```
WINEDLLOVERRIDES=ddraw=n,b
DXWRAPPER_Dd7to9=1
DXWRAPPER_DdrawOverrideBitMode=32
```

**Kenapa ini berguna buat mobile:** user kadang susah edit INI di folder game (path nested di shared storage Android). Env var di-set sekali di Container, berlaku global.

**Caveat:** env var override INI. Kalau user complain "settingan INI ga ke-apply", cek env var dulu — kemungkinan ada conflict.

---

## Stable nggak buat mobile?

State per Juni 2026:
- **Dd7to9** — actively maintained. Most DirectDraw APIs implemented. Direct3D portion (Direct3D 1-7 era, beda dari DDraw) **still limited** per developer's own statement
- **Game support** — ratusan game di-test, di wiki. Tapi semua test di Windows native, **bukan Wine**
- **Wine + DXWrapper testing** — komunitas tipis. Sebagian besar laporan di PCGamingWiki Proton/Linux, bukan Android specifically
- **Performa di Wine** — ada overhead double translation (ddraw → d3d9 = DXWrapper, d3d9 → Vulkan = DXVK). Untuk game tahun 1995-2003 yang ringan, ga jadi masalah

**Yang BELUM proven di Winlator komunitas:**
- Game-spesifik AppCompatData fix sebagian besar untuk Windows-side bug, perilaku di Wine bisa beda
- Dd7to9 D3D path (bukan DDraw path) masih incomplete per upstream
- ASI plugin pipeline mayoritas Win-only

---

## RULES BUAT BOT — anti-stale + anti-halu

1. User bilang "DXWrapper" → **WAJIB klarifikasi dulu**: maksud Winlator UI dropdown atau elishacloud project standalone?
2. User mau pake elishacloud DXWrapper buat fix DDraw game → WAJIB sebut: butuh set `WINEDLLOVERRIDES=ddraw=n,b` di Container Environment Variables, **bukan launch arg**.
3. User minta `d3d8to9` di DXWrapper → arahin ke **DXVK 2.4+** (d8vk merged), DXWrapper redundant untuk DX8 sekarang.
4. User minta hot-patch via `[WriteMemory]` → TOLAK, jelasin Wine memory layout beda.
5. User minta `WinVersionLie` → arahin ke **winecfg Wine Version override** (lebih reliable).
6. User minta ASI plugin via DXWrapper di Winlator → WARNING: mayoritas ASI mod Windows-only, ga loadable di Wine.
7. User minta nge-hook System32 → TOLAK, DXWrapper upstream sendiri ngomong jangan.
8. User punya game C&C series → arahin CNC-DDraw (lebih simple, built-in).
9. User punya game DDraw non-C&C di Mali → coba **DXWrapper Dd7to9 stacked DXVK-Sarek** dulu sebelum CNC-DDraw.
10. User bilang "ddraw.dll-nya ga ke-load" → cek (a) WINEDLLOVERRIDES udah set, (b) INI rename match nama DLL stub, (c) env var DXWRAPPER_* di Container.

---

## Quick reference matrix — kapan pake apa untuk DirectX legacy

| Game DX version | Opsi terbaik Winlator | Stacking |
|-----------------|------------------------|----------|
| DirectDraw 1-7 (1995-2003) | DXWrapper Dd7to9 + DXVK | ddraw → d3d9 → Vulkan |
| DirectDraw 1-7 (C&C series) | CNC-DDraw (built-in dropdown) | ddraw → OpenGL |
| DirectX 8 (1999-2003) | DXVK 2.4+ (d8vk merged) | d3d8 → Vulkan |
| DirectX 9 (2002-2010) | DXVK / DXVK-Sarek (Mali) | d3d9 → Vulkan |
| DirectX 10/11 | DXVK | d3d10/11 → Vulkan |
| DirectX 12 | VKD3D-Proton | d3d12 → Vulkan |

elishacloud DXWrapper sweet spot = **kolom 1 baris pertama** (DDraw non-C&C, terutama di Mali).
