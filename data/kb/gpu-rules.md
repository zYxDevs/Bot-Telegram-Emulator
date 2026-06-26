# GPU Rules — Modern Stack (2025-2026)

## Driver per vendor — JANGAN KEBOLAK
- **Adreno (Snapdragon)** → **Turnip** + DXVK. BUKAN Vortek/VirGL/WineD3D.
- **Mali (MediaTek/Exynos)** → **DXVK-Sarek** (PRIMARY 2025+). Vortek/VirGL/WineD3D = LEGACY fallback only.

## DirectX translation layer
- DX9 / DX10 / DX11 → **DXVK** (Mali: pakai Sarek branch).
- DX12 → **VKD3D-Proton**.
- DX8 (SH2/3 era 2001-03) → **d3d8to9 wrapper** → DXVK.

---

## Mali stack 2025-2026 (UPDATED — KB lama outdated)

**Outdated rule (sebelum 2024):** Mali = Vortek/WineD3D doang, DX9 max.
**Modern reality (2025+):** Mali handle DX11 (bahkan DX12 lite) via DXVK-Sarek + Proton-arm64ec.

### Default stack Mali modern
- **Driver Vulkan**: Mesa Turnip ga jalan di Mali — pake **driver vendor Mali** (built-in HP) atau **Vortek (Wear/EOA)** kalau emulator support custom driver.
- **DX wrapper**: **DXVK-Sarek** — PRIMARY buat Mali. Fork DXVK khusus GPU tanpa Vulkan 1.3 (nambal BCn + ClipDistance).
  - **Versi Sarek REAL** (`github.com/pythonlover02/DXVK-Sarek`): 1.10.4–1.10.9, **1.11.0** ("Red River"), **1.12.0** ("Late Anniversary", +dyasync +d7vk +Mali black-screen fix). GA ADA Sarek 1.7.x maupun 1.11.1.
  - ⚠️ **JANGAN ketuker:** `DXVK 1.7.2 async` / `1.7.3 async` itu **build Sporif/dxvk-async** (`github.com/Sporif/dxvk-async`, archived Nov 2025) — BUKAN Sarek. Build ringan generik, kadang dipake di Mali low-end karena enteng, tapi bukan bagian repo Sarek.
  - `dynasync` = fitur di Sarek 1.12.0. `sarek-async` = varian Sarek dgn async (StevenMXZ label `dxvk-11.1-sarek-async.wcp` = Sarek 1.11.0).
- **Wine/Proton**: **Proton-arm64ec** (Proton port khusus ARM64EC). Versi: `Proton-10.0.99-arm64ec`, `wine-10.0-arm64ec`.
- **CPU translator**:
  - GameHub/BannerHub → **FEX** (versi 202510, 202604, dll — cek release).
  - Winlator → **Box64** (versi 0.4.1).
- **Preset preset**: di GameHub/BannerHub mostly **PERFORMANCE / EXTREME** (bukan Compatibility lagi — Compatibility outdated default).
- **Winlator fork populer Mali**: **Star Bionic 1.1 (Ludashi variant)**, **Ludashi 2.9 beta**.

**Sumber Turnip alt** (cross-ref): selain StevenMXZ Adrenotools-Drivers (A8xx only), ada The412Banner/Banners-Turnip yang build Mesa main → 3 zip per release (A6xx/A7xx universal + A8xx + 710/720 test), cadence hourly. User butuh universal/710/720 → Banners-Turnip. Detail: kb_lookup("the412banner").
- **Wrapper extra**: **leegao wrapper** — buat game tertentu (DX9-DX11 legacy heavy).

### Vortek/WineD3D = LEGACY (kapan masih relevan)
- Game DX8 atau OpenGL doang.
- Game lawas yg bener-bener crash di DXVK-Sarek (rare — coba build async ringan `dxvk-1.7.2.wcp` dulu).
- HP super low-end (Helio G35/G37) yg ga sanggup Sarek dynasync.

### Tier per chipset Mali
- **Helio G99 / Mali-G57 MC2**: **[VERIFIED — Noysz, GTA V DX10 1024x600 Medium]** DXVK **1.7.2** (package `dxvk-1.7.2.wcp` StevenMXZ — build ringan; "async" label longgar) — terbukti lebih mulus daripada Sarek 1.12.0 (BCn emu Sarek over-burden Mali-G57 CPU lemah). + Proton 10 arm64ec + FEX/Box64 PERFORMANCE preset. **[THEORETICAL alt]** Sarek 1.11.0/1.12.0 dari tier matrix — belum ke-bench komunitas Noysz.
- **Dimensity 8020-8200 / Mali-G610**: DXVK 1.7.3 async + Proton 10 arm64ec. Medium-high settings.
- **Dimensity 8400 Ultra / Mali-G720 MC7**: **[VERIFIED]** baseline DXVK 1.7.3 async + Proton-10.0.99-arm64ec + Ludashi 2.9+. **[THEORETICAL]** DXVK 2.5/2.6/2.7 vanilla mestinya jalan (Vulkan 1.3+GPL ada) tapi belum ada bench public. Sampai ada empirical data, default = baseline verified.

---

## Mali Vulkan limitation (TIER-AWARE, bukan blanket "Selalu Sarek")

Mali Valhall TIER LAMA secara native miss:
1. **BCn texture compression** (BC1-BC7). DXVK vanilla butuh BCn → crash di `vkCreateShaderModule`. **Sarek**: emulate BCn via CPU decompression, atau swap ke uncompressed.
2. **gl_ClipDistance built-in**. DXVK vanilla pake ClipDistance buat clipping plane. **Sarek**: nambal SPIR-V, buang ClipDistance.

**Mali tier BARU (G720+, driver 2025+)** udah ada BCn native + `VK_EXT_graphics_pipeline_library` → DXVK vanilla jalan. Sarek opsional, BUKAN mandatory.

**[THEORETICAL]** Decision matrix (interpolasi spec Mali + DXVK feature reqs — **BELUM** dari bench database):
| Mali tier | Vulkan | DXVK (theoretical) |
|-----------|--------|--------------------|
| Valhall awal (G57, G68, Helio G99) | 1.1/1.2 | Sarek **1.10.3 / 1.11.1** (architectural) |
| G610/G715 (Dim 8020-8200) + GPL belum support | 1.2 | Sarek **1.12** (architectural) |
| G720+ (Dim 8400 Ultra, G725, Immortalis G720/G925) + GPL ada | 1.3 | DXVK **2.5/2.6/2.7 vanilla** (architectural, untest) |

**[REVEALED PREFERENCE]** community signal: StevenMXZ Winlator-Contents CDN ship DXVK 11.1-sarek-async sebagai mainline default untuk Mali. Maintainer udah test across banyak device dan pilih Sarek. Itu signal lebih kuat dari teori spec. Default kalau ga ada per-game empirical = Sarek (sesuai komunitas), BUKAN vanilla 2.x.

**Confidence rules buat bot:**
- Per-game `[VERIFIED]` preset di `per-game.md` → SELALU MENANG dari matrix manapun
- Matrix di sini = `[THEORETICAL]` — kalau dipake, WAJIB echo ke user dengan label "ini estimasi, belum ke-test"
- StevenMXZ CDN default Sarek = bukti komunitas, layak jadi soft-default kalau user belum ada empirical

## Exynos / Xclipse
Sub-family Mali tapi quirky. Pake **ExynosTools** layer.
Repo: `github.com/WearyConcern1165/ExynosTools`.

---

## GPU spoofing (DXVK)
Vendor ID: NVIDIA `10de`, AMD `1002`, Intel `8086`.

Spoofing **CUMA ubah identitas**, BUKAN naikin performa.

Mapping rekomendasi:
- Helio G99 / Dim 6k-7k → RTX 2060 SUPER (`10de` / `1f06`)
- Dim 8020-8200 → RTX 3060 (`10de` / `2503`)
- Dim 8300-8350 → RTX 3070 (`10de` / `2484`)
- Dim 8400 Ultra → RTX 3080 (`10de` / `2206`)
- SD 8 Elite → RTX 4080 (`10de` / `2704`)

Setting dxvk.conf:
```
dxgi.customVendorId = 10de
dxgi.customDeviceId = 2484
dxgi.customDeviceDesc = "NVIDIA GeForce RTX 3070"
```

---

## Common error → fix mapping
- `vkCreateShaderModule failed` (Mali) → ganti ke **DXVK-Sarek**. Bukan WineD3D.
- `vkMapMemory -5` (Mali) → `BOX64_MMAP32=0` ATAU Sarek terbaru.
- `VK_ERROR_OUT_OF_DEVICE_MEMORY` → turunin `d3d9.maxAvailableMemory` atau `dxvk.maxChunkSize`.
- Black screen intro DX9/11 → `deferSurfaceCreation=True` (kecuali Payday 2).
- Game refuse launch karena cek GPU → spoof vendor ke NVIDIA/AMD.
- Shader stutter di Mali → DXVK **dynasync** branch (bukan async biasa).
