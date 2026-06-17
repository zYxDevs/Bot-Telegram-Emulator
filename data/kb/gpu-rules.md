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
- **DX wrapper**: **DXVK-Sarek (1.7-1.12 async/dynasync)** — PRIMARY. Sarek = fork DXVK khusus mobile/Mali yg nambal BCn + ClipDistance.
  - Versi proven: `DXVK 1.7.2 async`, `DXVK 1.7.3 async`, `DXVK 1.12 sarek dynasync`.
  - Source: `github.com/pythonlover02/DXVK-Sarek`.
- **Wine/Proton**: **Proton-arm64ec** (Proton port khusus ARM64EC). Versi: `Proton-10.0.99-arm64ec`, `wine-10.0-arm64ec`.
- **CPU translator**:
  - GameHub/BannerHub → **FEX** (versi 202510, 202604, dll — cek release).
  - Winlator → **Box64** (versi 0.4.1).
- **Preset preset**: di GameHub/BannerHub mostly **PERFORMANCE / EXTREME** (bukan Compatibility lagi — Compatibility outdated default).
- **Winlator fork populer Mali**: **Star Bionic 1.1 (Ludashi variant)**, **Ludashi 2.9 beta**.
- **Wrapper extra**: **leegao wrapper** — buat game tertentu (DX9-DX11 legacy heavy).

### Vortek/WineD3D = LEGACY (kapan masih relevan)
- Game DX8 atau OpenGL doang.
- Game lawas yg bener-bener crash di DXVK-Sarek (rare — coba Sarek 1.7.2 dulu).
- HP super low-end (Helio G35/G37) yg ga sanggup Sarek dynasync.

### Tier per chipset Mali
- **Helio G99 / Mali-G57 MC2**: DXVK 1.12 Sarek dynasync + Proton 10 arm64ec + FEX/Box64 PERFORMANCE preset. Realistic FPS: 25-30 medium settings.
- **Dimensity 8020-8200 / Mali-G610**: DXVK 1.7.3 async + Proton 10 arm64ec. Medium-high settings.
- **Dimensity 8400 Ultra / Mali-G720 MC7**: DXVK 1.7.3 async + Proton-10.0.99-arm64ec + Ludashi 2.9 beta. High + HDR.

---

## Mali Vulkan limitation (kenapa Sarek bisa, DXVK vanilla ngga)
Mali Vulkan secara native miss:
1. **BCn texture compression** (BC1-BC7). DXVK vanilla butuh BCn → crash di `vkCreateShaderModule`. **Sarek**: emulate BCn via CPU decompression, atau swap ke uncompressed.
2. **gl_ClipDistance built-in**. DXVK vanilla pake ClipDistance buat clipping plane. **Sarek**: nambal SPIR-V, buang ClipDistance.

Konsekuensi: **JANGAN rekomendasi DXVK vanilla di Mali**. Selalu Sarek.

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
