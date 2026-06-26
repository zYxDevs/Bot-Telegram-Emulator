# Evolution per Tool — Inflection Points (2018 → 2026)

Per-tool timeline yang **NGUBAH cara pakai di mobile**. Bukan changelog lengkap — cuma yang impact diagnosis/recommendation.

Sumber: github.com/{doitsujin/dxvk, ptitSeb/box64, FEX-Emu/FEX}/releases.

---

## DXVK — timeline + mobile takeaway

Sumber [VERIFIED via GitHub releases/tags, Jun 2026]:
- Official: `github.com/doitsujin/dxvk/releases`
- Fork Mali: `github.com/pythonlover02/DXVK-Sarek`
- gplasync: `gitlab.com/Ph42oN/dxvk-gplasync`
- async lama: `github.com/Sporif/dxvk-async` (ARCHIVED 23 Nov 2025)

### ⚠️ 3 HAL BEDA yang SERING KETUKER — BACA DULU SEBELUM REKOMENDASI
Jangan campur. Beda repo, beda versi, beda target hardware:

| Nama | Apa | Versi REAL | Target | Repo |
|---|---|---|---|---|
| **async (Sporif)** | Patch async generik DXVK lama. ARCHIVED Nov 2025, ga di-maintain | 1.7.2 → 2.0 (mentok 2.0) | Generic, BUKAN Mali-khusus | Sporif/dxvk-async |
| **DXVK-Sarek** | Fork DXVK 1.10.x buat GPU TANPA Vulkan 1.3 | canonical: 1.10.4→1.10.9, **1.11.0**, **1.12.0**. fork zeyadadev: **v1.11.1-mali-fix** | **MALI / Vulkan 1.1-1.2 = INI** | pythonlover02 + zeyadadev/DXVK-Sarek |
| **gplasync (Ph42oN)** | GPL + async buat DXVK 2.x | v2.1-3 → **v2.7.1-1** (+ 3.0-1) | **GPU MODERN, Vulkan 1.3+. BUKAN Mali tua** | Ph42oN/dxvk-gplasync (GitLab) |

**ATURAN MUTLAK:** Mali tanpa Vulkan 1.3 (pre-Valhall, Valhall awal G57/G68) → **DXVK-Sarek**. JANGAN kasih gplasync (butuh Vulkan 1.3 + `graphics_pipeline_library` yang Mali tua GA PUNYA).

### Versi DXVK yang BENERAN ADA (anti-halu — presisi per-repo)
- **Official DXVK (doitsujin):** 1.x mentok di **1.10.3** (2 Agu 2022) → langsung lompat **2.0**. **Official GA PERNAH punya 1.11.x.** Kalau ada yang sebut "DXVK 1.11.1" maksudnya OFFICIAL → itu salah.
- **Sporif/dxvk-async:** patch async, 1.7.2 → 2.0. Juga GA ADA 1.11.x. (1.7.2/1.10.3 async = INI, bukan Sarek.)
- **DXVK-Sarek canonical (`pythonlover02`):** 1.10.4–1.10.9 → **1.11.0** ("Red River") → **1.12.0** ("Late Anniversary", 16 Apr 2026). Canonical lompat 1.11.0 → 1.12.0 (ga ada 1.11.1 di SINI). "Sarek 1.10.3" cuma tag repack bootstrap.
- **DXVK-Sarek fork (`zeyadadev`):** **`v1.11.1-mali-fix` = REAL** (2025-09-06, base 1.11.0 + fix Mali black-screen + unbound-texture, test Mali-G610, ~1.5k dl). **Jadi "Sarek 1.11.1" BUKAN halu** — itu rilis Mali-fix di fork, JUSTRU bagus buat Mali. StevenMXZ ship sbg `dxvk-11.1-sarek-async.wcp`.

### Era 1.x (2018 – Agu 2022)
- Foundation D3D9/10/11 → Vulkan. Tanpa requirement Vulkan modern.
- **async fork (Sporif)** solve shader compile stutter — tapi ini PATCH GENERIK, bukan Mali-khusus. Rilis async terakhir = 2.0, lalu MATI (diganti GPL).
- Mobile take: **Mali pre-Valhall / Vulkan 1.1 only → pakai DXVK-Sarek** (fork yang nerusin 1.10.x branch tanpa requirement Vulkan 1.3).

### DXVK 2.0 (10 Nov 2022)
- Migrasi meson + **wajib Vulkan 1.3**. Driver mobile lawas ke-cut.
- **`VK_EXT_graphics_pipeline_library` (GPL)** masuk — solusi RESMI anti-stutter (gantiin async). Compile shader pas load, bukan pas draw.
- Mobile take: **Adreno tua / Mali pre-Valhall (no Vulkan 1.3) → tetep di Sarek (1.10.x base).**

### DXVK 2.3 (4 Sep 2023)
- `VK_KHR_present_wait` (input latency turun), spec constants descriptor cache.
- Awal gplasync (Ph42oN) nge-track dari sini (v2.3-1).

### DXVK 2.4 / 2.4.1 (10 Jul 2024)
- **D8VK ke-merge** → support D3D8 built-in. **Lupakan d8vk standalone.**
- Dynamic memory chunk sizing.

### DXVK 2.5 (11 Nov 2024)
- Memory manager rewrite, **periodic defrag**, hemat VRAM s/d 1GB. Software cursor D3D8/9 (fix UE3).
- Mobile take: stutter mid-session berkurang.

### DXVK 2.6 (13 Mar 2025)
- Nvidia Reflex D3D11, swapchain rework + MSAA workaround.
- Mobile take: black-flicker MSAA lama → fixed.

### DXVK 2.7 / 2.7.1 (Jul–30 Agu 2025)
- `VK_KHR_maintenance5` wajib, descriptor buffer, **state cache legacy DIHAPUS**.
- Mobile take: panduan "hapus dxvk.cache" → STALE buat 2.7+ (file-nya udah ga ada).

### DXVK 3.0 (25 Jun 2026) — CURRENT LATEST
- **Wajib Vulkan 1.4** (driver mobile makin ke-cut — basically SEMUA Mali + mayoritas Adreno GA SANGGUP).
- Shader compiler rewrite (dxbc-spirv), `VK_EXT_descriptor_heap` default, D3D9 fixed-function ubershaders, frame-limiter bawaan DIHAPUS.
- Mobile take: **3.0 IRRELEVANT buat 99% HP sekarang** (Vulkan 1.4 belum ada di driver mobile). Jangan rekomendasiin 3.0 ke user Mali/Adreno kecuali dia eksplisit Vulkan 1.4. The412Banner ship `dxvk-3.0.wcp` + `dxvk-gplasync-3.0-1.wcp` cuma buat device bleeding-edge.

### Mobile decision matrix (DXVK) — **[THEORETICAL]**
**⚠️ Interpolasi spec, BUKAN benchmark DB.** Per-game `[VERIFIED]` di `per-game.md`/`gpu-rules.md` SELALU MENANG.

| Driver Vulkan user | Pakai (theoretical) |
|---|---|
| Vulkan 1.0/1.1 (Mali pre-Valhall / Adreno < 6xx) | DXVK-Sarek (base 1.10.x) atau async lawas 1.10.3 |
| Vulkan 1.1/1.2 (Mali Valhall awal: G57, G68) | **DXVK-Sarek 1.11.1-mali-fix / 1.12.0** |
| Vulkan 1.2 tanpa GPL (Mali G610/G715 driver tua) | DXVK-Sarek 1.12.0 (BCn emu) |
| Vulkan 1.3 + GPL (Adreno 7xx, Mali G720+, Turnip baru) | DXVK 2.5–2.7 vanilla / gplasync 2.7.1-1 |
| Adreno + adrenotools custom Turnip | DXVK 2.5+ / gplasync |
| Vulkan 1.4 (sangat jarang di mobile) | DXVK 3.0 (kalau driver dukung) |

**[REVEALED PREFERENCE]** StevenMXZ Winlator-Contents CDN ship `dxvk-11.1-sarek-async.wcp` sebagai default Mali — "11.1" = **Sarek 1.11.1** (fork zeyadadev mali-fix). Mali default tanpa data per-game = **DXVK-Sarek 1.11.1-mali-fix / 1.12.0**, BUKAN vanilla 2.x, BUKAN gplasync.

**Empirical override (ke-test Noysz) — [VERIFIED]:**
- Helio G99 + GTA V DX10 1024x600 Medium = **DXVK 1.7.2** (`dxvk-1.7.2.wcp` di StevenMXZ) > Sarek 1.12 (BCn emu Sarek over-burden Mali-G57 weak CPU). Catatan: "1.7.2" yang Noysz pake itu build ringan; "async" itu label longgar — package StevenMXZ `dxvk-1.7.2.wcp` adalah vanilla 1.7.2.

---

## Box64 — timeline + mobile takeaway

### Era v0.1.x – v0.2.x (2020 – 2022)
- DynaRec dasar lahir, BOX64_DYNAREC default on.
- BOX64_DYNAREC_BIGBLOCK + STRONGMEM diperkenalkan.
- Mobile take: fondasi semua tweak setelah-nya. User Winlator lama (pre-2022 build) → DynaRec primitif, **saranin update**.

### v0.3.0 – v0.3.2 (2022)
- **Box32** diperkenalkan (32-bit x86 emulation kompanion Box86). Sebelumnya Winlator wajib bundle Box86 terpisah.
- **NATIVEFLAGS** default ON di semua backend — perf boost gratis tanpa user tweak.
- Mobile take: ga perlu user manual set `BOX64_DYNAREC_NATIVEFLAGS=1` di Box64 0.3.2+. Saran lama itu **stale**.

### v0.3.4 (Mar 2023)
- RV64 RVV vector emulation (RISC-V doang).
- BOX64_CPUTYPE introduced — spoof CPU vendor (Intel/AMD).
- Mobile take: `BOX64_CPUTYPE=Intel` kadang fix anti-cheat / game vendor-lock.

### v0.3.6 (Jun 2023)
- **Volatile Metadata** support buat Windows executable — handle binary yang ngambek soal flag CPU.
- WowBox64.dll buat Hangover (Wine WOW64) integration.
- Mobile take: game Windows yang dulunya nge-fail di Winlator pre-0.3.6 lewat WOW64 → upgrade Box64 langsung fix.

### v0.3.8 (Oct 2023) — INFLECTION POINT
- **DynaCache** — JIT code di-cache ke disk. Launch ke-2 dst lebih cepet drastis.
- Mobile take: **wajib aktif** di mobile (penyimpanan disk lebih cepet dari RAM yang sempit). `BOX64_DYNACACHE=1`.
- AVX scalar di RV64/LA64 ditambah.

### v0.4.0 (Jan 2024)
- **Opcode prefix decoder rewrite** — DynaRec lebih akurat.
- **FSGSBASE** support — segment register handling simplified. Bantu game pakai TLS lawas.
- BOX64_ARCH introduced (multi-arch select).
- Mobile take: 0.4.x mark titik aman default. Pre-0.4.0 → saranin upgrade.

### v0.4.2 (Apr 2026) — current
- Vulkan x64 overlay.
- PPC64LE backend dev (irrelevant mobile).
- SteamRT3 + Proton 11 support.
- Mobile take: **versi sweet spot**. Semua Winlator/CMOD/GameHub modern bundle 0.4.x.

### Mobile decision matrix (Box64)
| Symptom user | Cek Box64 versi → solusi |
|---|---|
| Launch lambat tiap kali | <0.3.8 → upgrade + enable DynaCache |
| WOW64 game crash | <0.3.6 → upgrade |
| Anti-cheat vendor check fail | Coba `BOX64_CPUTYPE=Intel` (0.3.4+) |
| Game pake TLS lama segfault | <0.4.0 → upgrade buat FSGSBASE |
| User pake setting `NATIVEFLAGS=1` manual | 0.3.2+ udah default ON, ga perlu manual |

---

## FEX — timeline + mobile takeaway

### Era pre-2109 (2021)
- Awal Linux x86-64 → ARM64 emulator. TSO emulation experimental.
- Mobile take: pra-GameHub era. Skip.

### FEX-2109 – 2210 (2021 Q3 – 2022)
- TSO support matang. `TSOEnabled` knob jadi default true.
- AVX (256-bit) di 64-bit binary.
- Mobile take: titik mula bisa dipake serius buat game Unity / DX11. GameHub Lite muncul di era ini.

### FEX-2305 – 2308 (May – Aug 2023)
- Mono ARM64EC/WOW64 perf hacks.
- 3DNow! di-disable di Wine WOW64 (banyak game game old false-detect 3DNow).
- Mobile take: kalau user mention "Wine WOW64 game lawas false-CPU-detect" → versi 2305+ udah handle.

### FEX-2510 (Oct 2023) — INFLECTION
- **x87 intermediate result caching** di slow path → 2-3x instruction reduction. Game pakai math FP87 (lawas) langsung jauh lebih cepet.
- FEXInterpreter rename → FEX (cleanup).
- Mobile take: **upgrade ke 2510+ KASIH FREE PERF 2-3x** di game-game older. Major leap.

### FEX-2511 (Nov 2023)
- **AVX di 32-bit default ON** (sebelumnya cuma 64-bit).
- WritePriorityMutex.
- L1/L2 cache memory optimization.
- Mobile take: game 32-bit yang ngotot AVX → 2511+ langsung jalan tanpa tweak.

### FEX-2512 (Dec 2023)
- io_uring syscall DISABLED (workaround Termux yang sering kacau).
- FEAT_LRCPC2 errata handling.
- Mobile take: **kalau user di Termux/proot pernah lihat "io_uring" error → upgrade ke 2512+**.

### FEX-2603 (Mar 2024)
- **RPMalloc allocator integration** — memory footprint turun drastis.
- vzeroupper via DC ZVA optimization.
- Mobile take: **OOM kill di HP <6GB → upgrade ke 2603+**, RAM consumption drop signifikan.

### FEX-2604 (Apr 2024)
- **Dynamic L1 cache** + L2 disabled by default → memory turun lagi.
- **x87 transcendental inlining → 3.7x speedup**.
- Mobile take: kombinasi 2603 + 2604 = best FEX buat HP RAM ketat.

### FEX-2605 (May 2024) — current bundled di emulator modern
- Snapdragon X2 Elite improvements + atomic split-lock emulation.
- ARM64EC controller crash fixes.
- CLZERO support.
- Mobile take: **stable + future-proof buat HP SD8 Elite generation**.

### Mobile decision matrix (FEX)
| Symptom | Cek FEX versi → solusi |
|---|---|
| Game x87-heavy (PES lama, SH2 classic, GTA SA) slow | <2510 → upgrade buat 2-3x speedup |
| Game 32-bit AVX false detect | <2511 → upgrade |
| Termux io_uring error | <2512 → upgrade |
| OOM di HP 4-6GB RAM | <2603 → upgrade (RPMalloc) |
| Trig-heavy game (rotasi kamera ngaco) | <2604 → upgrade (3.7x sin/cos) |
| HP SD8 Elite / X2 Elite controller crash | <2605 → upgrade |

---

## Implementasi ke emulator family (best-effort dari changelog cross-ref)

### Winlator (main, brunodev85)
- v11.x (2025-2026) bundle: **Box64 0.4.x + DXVK 2.5-2.7 + Wine 9-staging**. Default ga ada FEX.
- v9.x lama (2024): **Box64 0.3.8 + DXVK 2.3** baseline.

### Winlator CMOD (coffincolors)
- v13.x bundle: **Box64 0.4.x + DXVK 2.x atau Sarek pilihan + libadrenotools integrasi**.
- Switch Box64 vs FEX bukan default — CMOD utamain Box64.

### GameHub Lite (Producdevity) + BannerHub + GameNative + WinNative
- Bundle: **FEX (2510+) sebagai default x86 emu** — bukan Box64.
- Khusus FEX karena akurasi TSO buat Unity / anti-cheat modern.
- DXVK seringan + per-game switchable.

### Pattern bot recommendation
- **User pake Winlator CMOD + game tua (PES, SH2, GTA SA)**: cukup Box64 0.4.x + DXVK Sarek. FEX overkill.
- **User pake GameHub/BannerHub + game baru (Unity, modern AC)**: FEX 2603+ wajib. Box64 ga cocok di sini.
- **User stuck di Mobox**: arahin migrasi. Mobox proyek ga update lagi.

---

## Bot rules ke-extract dari evolution

1. **Sebelum kasih tweak `BOX64_DYNAREC_NATIVEFLAGS=1`**: cek versi user. 0.3.2+ udah default ON → tweak lo redundant.
2. **Sebelum kasih panduan "hapus state-cache DXVK"**: cek versi. 2.7+ udah ga ada state cache → panduan lo stale.
3. **OOM di HP RAM ketat + user pake GameHub**: pertanyakan versi FEX. <2603 → upgrade lebih ampuh dari tweak.
4. **Launch game Winlator lama (>30 detik tiap kali)**: cek Box64 versi. <0.3.8 → DynaCache bakal solve lebih baik dari tweak BIGBLOCK.
5. **Mali user "DXVK 2.x crash"**: konfirmasi ulang Vulkan version + GPL support. Kalau ga ada GPL → arahin ke Sarek, jangan paksain 2.x.
6. **d8vk standalone** ditanya: tegasin — udah ke-merge ke DXVK 2.4. Pake DXVK aja.
7. **Sebelum bilang "upgrade Box64 + DXVK + FEX"**: tanya emulator dulu. Winlator family beda paradigm dari GameHub family.
8. **User Ludashi-plus v3.1.2-pre2+ LSFG frame-gen ga jalan**: ingatin — Lossless.dll BUKAN bundled lagi di pre2 (compliance). User wajib **Settings → Import Lossless.dll** manual. v3.1.1 dan lebih lama masih bundled. Detail: kb_lookup("the412banner").
9. **User upgrade BannerHub v3.x → BannerHub v6 fail install**: SHARED_USER_INCOMPATIBLE karena keystore beda. WAJIB uninstall produk lama dulu (backup config via Export Config sebelumnya). 3 produk BannerHub (v3.x / Lite / v6) NEVER update-over-able. Detail: kb_lookup("the412banner").
