# Turnip Driver per Adreno chipset

Turnip = open-source Mesa Vulkan driver buat Adreno (cabang dari freedreno).
Driver vendor (Qualcomm proprietary) sering kurang kompatibel buat translation layer.
Turnip lebih aktif maintained buat use case Winlator/GameHub.

⚠ Cuma buat **Adreno**. Mali → Vortek/Vortek-pendant (lihat `gpu-rules.md`).

---

## Mapping repo per chipset

### Adreno 6XX (610/619/630/640/650/660)
- `github.com/star-emu/star`
- `github.com/Other-backup/freedreno_turnip-CI`
- Cocok buat: SD 6/7 series lama, SD 855/865/870/888.

### Adreno 710 (SD 6 Gen 1/2/3)
- `github.com/Vauzi-17/710`
- **CATATAN**: Adreno 710 Vulkan cuma 1.2. Beberapa DXVK mainstream butuh 1.3.
  Pakai **DXVK-Sarek** sebagai pair. Sumber: `github.com/pythonlover02/DXVK-Sarek`.

### Adreno 720/722 (SD 7 Gen 1/7s Gen 2)
- `github.com/Vauzi-17/710` (multi-chipset support)
- DXVK 1.9.4-async atau Sarek.

### Adreno 730 (SD 8 Gen 1)
- `github.com/maxjivi05/Components`
- `github.com/The412Banner/Banners-Turnip` (multi-GPU)
- DXVK 2.x mulai usable.

### Adreno 735 (SD 7 Gen 3)
- `github.com/Shalaykin1/Adreno-Tools-Drivers-Sh1ma`

### Adreno 740 (SD 8 Gen 2)
- `github.com/maxjivi05/Components`
- `github.com/The412Banner/Banners-Turnip`
- `github.com/star-emu/star` (fork stabil)
- DXVK 2.x. Bisa coba DXVK-gplasync buat shader stutter reduction.

### Adreno 750 (SD 8 Gen 3)
- `github.com/star-emu/star`
- `github.com/maxjivi05/Components`
- DXVK 2.x normal flow.

### Adreno 8XX series (SD 7 Gen 3 / SD 8 Elite / SD 8s Gen 4 — chip-specific TBD)
- `github.com/DiskDVD/TurniptoolsA8XX` — generic A8XX driver pool
- **NOTE:** Dimensity 9300/9400 BUKAN Adreno (itu MediaTek dengan Mali Immortalis G720/G925). Adreno eksklusif Snapdragon.

### Adreno 825 (SD 8s Gen 4)
- `github.com/bkupaccount/freedreno_turnip-CI`

### Adreno 830 / 840 (SD 8 Elite / Gen 5)
- `github.com/whitebelyash/freedreno_turnip-CI`
- `github.com/s1mptom/freedreno_turnip-CI` (variant Eden/Citron)
- Vulkan 1.4 ready, DXVK 2.x latest.

### Multi-GPU / universal
- `github.com/The412Banner/Banners-Turnip` + `Banners-Turnip-Nightlies`
- `github.com/maxjivi05/Components`
- `github.com/StevenMXZ/Adreno-Tools-Drivers`

---

## Cara cek release terbaru
- Repo masing-masing → tab **Releases**.
- Versi terbaru biasanya dirilis 2-4 minggu sekali.
- Pas update Turnip, **WAJIB clear shader cache DXVK** (lokasi tergantung emulator) — shader lama incompatible dengan compiler baru.

## Pattern install (Winlator)
1. Download `.adpkg` atau `.zip` driver.
2. Buka Winlator → Container settings → Graphics Driver → Import.
3. Apply, restart container.

## Pattern install (GameHub/BannerHub)
1. Download driver.
2. Settings → Drivers → Import.
3. Per-game override jika perlu.

## Warning
- JANGAN install driver Mali di Adreno (ga kompatibel).
- JANGAN install driver buat chipset beda (mis. Adreno 740 driver di Adreno 730).
- Backup driver lama dulu, kadang revert perlu.
