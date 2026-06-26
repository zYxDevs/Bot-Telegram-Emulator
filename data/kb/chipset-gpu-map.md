# Chipset → GPU → Rendering Stack Map

Mapping chipset HP → GPU → stack rendering yang BENER. Dipake buat: user sebut chipset/HP → tentuin GPU → arahin DXVK-Sarek (Mali) / Turnip+DXVK (Adreno) / fallback (IMG PowerVR).

**Confidence:** data cross-ref dari NanoReview/GSMArena/MediaTek-Qualcomm official. Sample 15 entry di-spot-check [VERIFIED] 15/15 akurat (GPU family + core count). Sisanya high-confidence.

---

## GPU family → stack decision (INTI — baca ini dulu)

| GPU family | Vendor | Stack rendering | Catatan |
|---|---|---|---|
| **Mali** (Bifrost G52/G76, Valhall G57/G68/G77/G610/G615/G710, Immortalis G715/G720/G925) | ARM | **DXVK-Sarek** (Vulkan 1.1-1.2) PRIMARY. Driver = vendor Mali bawaan / Vortek. | Mali GA bisa Mesa Turnip. Sarek wajib buat Vulkan <1.3. Detail: kb_lookup("gpu-rules") |
| **Adreno** (6xx/7xx/8xx modern) | Qualcomm | **Turnip (Mesa)** + DXVK 2.x/gplasync. | Adreno 7xx/8xx = Vulkan 1.3+GPL → DXVK vanilla/gplasync jalan. Detail: kb_lookup("turnip") |
| **Adreno LAWAS** (3xx/4xx/5xx, 6xx low: 50x/61x) | Qualcomm | DXVK 1.x ringan / WineD3D fallback. Vulkan terbatas. | Adreno 5xx ke bawah = Vulkan 1.0/1.1 doang, banyak game DX11 ga jalan mulus. |
| **IMG PowerVR / BXM** (GE8320, BXM-8-256) | Imagination | **WineD3D / Vortek LEGACY**. Support paling lemah. | Driver Vulkan IMG payah. DXVK sering ga stabil → fallback OpenGL/WineD3D. Kategori paling susah. |

**Aturan cepat:**
- Mali → **DXVK-Sarek** (hampir selalu).
- Adreno modern (6 Gen+/7xx/8xx) → **Turnip + DXVK**.
- Adreno tua / IMG PowerVR → kelola ekspektasi, fallback WineD3D, jangan janjiin DX11 mulus.

---

## MediaTek Dimensity → GPU

| Chipset | GPU | Family → stack |
|---|---|---|
| Dimensity 6020 / 6080 / 6100+ / 6300 | Mali-G57 MC2 | Mali → Sarek |
| Dimensity 7020 / 7025 | **IMG BXM-8-256** | IMG → WineD3D/Vortek (BUKAN Mali!) |
| Dimensity 7030 | Mali-G610 MC3 | Mali → Sarek |
| Dimensity 7050 | Mali-G68 MC4 | Mali → Sarek |
| Dimensity 7200 / 7200 Ultra | Mali-G610 MC4 | Mali → Sarek |
| Dimensity 7300 / 7300 Energy / 7300 Ultra | Mali-G615 MC2 | Mali → Sarek |
| Dimensity 8000 | Mali-G610 MC6 | Mali → Sarek |
| Dimensity 8020 / 8050 | Mali-G77 MC9 | Mali (Valhall) → Sarek |
| Dimensity 8100 / 8200 / 8200 Ultra / 8200 Ultimate | Mali-G610 MC6 | Mali → Sarek |
| Dimensity 8300 / 8300 Ultra / 8350 | Mali-G615 MC6 | Mali → Sarek |
| Dimensity 9000 / 9000+ | Mali-G710 MC10 | Mali → Sarek (G710 kuat, kadang Vulkan 1.3) |
| Dimensity 9200 / 9200+ | Immortalis-G715 MC11 | Mali → Sarek / DXVK 2.x kalau Vulkan 1.3 |
| Dimensity 9300 / 9300+ | Immortalis-G720 MC12 | Mali → Sarek / DXVK 2.x |
| Dimensity 9400 | Immortalis-G925 MC12 | Mali → Sarek / DXVK 2.x |

## MediaTek Helio G → GPU

| Chipset | GPU | Family → stack |
|---|---|---|
| Helio G25 / G35 / G36 / G37 | **PowerVR GE8320** | IMG → WineD3D/Vortek LEGACY (paling lemah, DX9 max realistis) |
| Helio G70 / G80 / G81 / G81 Ultra / G85 / G88 / G91 / G91 Ultra | Mali-G52 MC2 | Mali (Bifrost) → Sarek, Vulkan 1.1 |
| Helio G90 / G90T / G95 | Mali-G76 MC4 | Mali (Bifrost) → Sarek |
| Helio G96 / G99 / G99 Ultra / G99 Ultimate / G100 | Mali-G57 MC2 | Mali (Valhall) → Sarek |

**[VERIFIED — Noysz]** Helio G99 / Mali-G57 MC2 = `dxvk-1.7.2.wcp` (build ringan) > Sarek 1.12.0 buat GTA V DX10 (BCn emu Sarek over-burden G57 weak CPU). Detail: kb_lookup("gpu-rules").

## Qualcomm Snapdragon → GPU

| Chipset | GPU | Family → stack |
|---|---|---|
| SD 600/610/615/616/617 | Adreno 320/405 | Adreno LAWAS → WineD3D, Vulkan minim |
| SD 625/626/632/636/650/652/653/660 | Adreno 506/509/510/512 | Adreno LAWAS → DXVK 1.x ringan/WineD3D |
| SD 662/665/680/685 | Adreno 610 | Adreno low → DXVK 1.x, Vulkan 1.1 |
| SD 670/710/712 | Adreno 615/616 | Adreno low → DXVK 1.x |
| SD 675/678 | Adreno 612 | Adreno low → DXVK 1.x |
| SD 720G/730/730G/732G | Adreno 618 | Adreno → Turnip + DXVK (Vulkan 1.1) |
| SD 690/750G/695/6s Gen 3 | Adreno 619/619L | Adreno → Turnip + DXVK |
| SD 4 Gen 1 | Adreno 619 | Adreno → Turnip + DXVK |
| SD 4 Gen 2 | Adreno 613 | Adreno → Turnip + DXVK |
| SD 4s Gen 2 | Adreno 611 | Adreno → DXVK 1.x/Turnip |
| SD 765/765G/768G | Adreno 620 | Adreno → Turnip + DXVK |
| SD 778G/778G+/782G | Adreno 642L | Adreno → Turnip + DXVK |
| SD 780G | Adreno 642 | Adreno → Turnip + DXVK |
| SD 6 Gen 1 / 6 Gen 3 | Adreno 710 | Adreno → Turnip + DXVK |
| SD 7 Gen 1 | Adreno 644 | Adreno → Turnip + DXVK |
| SD 7s Gen 2 / 7s Gen 3 | Adreno 710 | Adreno → Turnip + DXVK |
| SD 7 Gen 3 | Adreno 720 | Adreno → Turnip + DXVK 2.x |
| SD 7+ Gen 2 | Adreno 725 | Adreno → Turnip + DXVK 2.x |
| SD 7+ Gen 3 | Adreno 732 | Adreno (Vulkan 1.3+GPL) → DXVK 2.x/gplasync |
| SD 800/801/805/808/810 | Adreno 330/420/418/430 | Adreno LAWAS jadul → WineD3D |
| SD 820/821/835 | Adreno 530/540 | Adreno lawas → DXVK 1.x terbatas |
| SD 845 | Adreno 630 | Adreno → Turnip + DXVK |
| SD 855/855+/860/870 | Adreno 640/650 | Adreno → Turnip + DXVK 2.x |
| SD 865/865+ | Adreno 650 | Adreno → Turnip + DXVK 2.x |
| SD 888/888+ | Adreno 660 | Adreno → Turnip + DXVK 2.x |
| SD 8 Gen 1 / 8+ Gen 1 | Adreno 730 | Adreno (Vulkan 1.3+GPL) → DXVK 2.x/gplasync |
| SD 8 Gen 2 | Adreno 740 | Adreno → DXVK 2.x/gplasync |
| SD 8s Gen 3 | Adreno 735 | Adreno → DXVK 2.x/gplasync |
| SD 8 Gen 3 | Adreno 750 | Adreno → DXVK 2.x/gplasync, Turnip terbaik |
| SD 8 Elite | Adreno 830 | Adreno top → DXVK 2.x/gplasync, A8xx Turnip (kb_lookup "a8xx") |

---

## Catatan penting buat rekomendasi

1. **IMG PowerVR/BXM (Dimensity 7020/7025, Helio G25-G37)** = jebakan. User sering kira "Dimensity 70xx pasti Mali" — SALAH, 7020/7025 itu IMG. Jangan kasih DXVK-Sarek (itu fork Mali). Arahin WineD3D/Vortek + kelola ekspektasi.
2. **Mali pre-Valhall (G52, G76 = Bifrost)** = Vulkan 1.1 → Sarek WAJIB, DXVK 2.x ga jalan.
3. **Adreno 5xx ke bawah** = Vulkan 1.0/1.1 atau ga ada → banyak game DX11 ga realistis. Jangan over-promise.
4. **MC vs MP**: sama aja (core count notation). Mali-G610 MC3 = Mali-G610 MP3.
5. Kalau chipset user GA ADA di tabel → tanya GPU-nya langsung (CPU-Z/DevCheck tab GPU) atau web_search "<chipset> GPU spec".
