# FEX Extreme/Custom Params — Full Matrix

⚠ EMU SCOPE: **GameHub / BannerHub / Mobox / WinNative** (FEX-based). BUKAN Winlator.

Lokasi: GameHub → Settings → Translation Params → Custom/Extreme.
Sebagian juga bisa di-set via env var `FEX_*`.

---

## TSOEnabled (= FEX_TSOENABLED)
WHAT: emulasi Total Store Ordering x86.
WHY: x86 strict store ordering, ARM weak. FEX emulate via memory barrier per store.
TRADE-OFF: ON = aman + slower (~15-25%). OFF = cepet + risiko crash/desync di multi-thread game.
DEFAULT-IF: ON. OFF buat Diesel Engine (Payday 2, Sleeping Dogs), DiRT 3 (EGO 2.0), game single-thread heavy.

## VectorTSOEnabled
WHAT: TSO khusus SIMD/vector store (SSE/AVX).
WHY: subset TSO, lebih spesifik ke vector instruction.
DEFAULT-IF: ikut TSOEnabled. Kalau game scalar-only → OFF.

## MemcpySetTSOEnabled
WHAT: TSO khusus memcpy/memset operation.
WHY: memcpy heavy = banyak barrier kalau TSO on → bottleneck besar.
TRADE-OFF: OFF kasih FPS boost di game memory-intensive (open world streaming).
DEFAULT-IF: OFF buat performance. ON kalau crash di loading.

## HalfBarrierTSOEnabled
WHAT: pakai barrier setengah (acquire OR release only, bukan full).
WHY: full barrier mahal di ARM. Half barrier cukup buat banyak workload.
TRADE-OFF: ga aman buat all-case TSO. Gabungin dengan VectorTSOEnabled=OFF.
DEFAULT-IF: OFF (safe default). Coba ON buat extreme perf.

## X87ReducedPrecision
WHAT: kurangi presisi floating-point x87 (80-bit → 64-bit).
WHY: x87 80-bit ga ada di ARM, full emulate = slow. Reduced = pakai ARM FP64 native.
TRADE-OFF: presisi turun (irrelevant buat 99% game). Bisa bikin physics glitch kecil di game lawas (rare).
DEFAULT-IF: ON. Wajib buat game DX9 lawas.

## Multiblock
WHAT: JIT compile multi-block (cross-basic-block optimization).
WHY: optimize lintas branch, register allocation lebih bagus.
TRADE-OFF: compile awal lebih lama.
DEFAULT-IF: ON.

## MaxInst
WHAT: max instruksi per blok JIT.
WHY: blok lebih panjang = optimize lebih dalam, tapi compile lambat.
TRADE-OFF: 1000 = safe default. 2000-4000 = aggressive (Unity, UE). 500 = conservative buat low-RAM.
DEFAULT-IF: 1000 standard, 4000 extreme preset.

## SmallTSCScale
WHAT: scale Time Stamp Counter (rdtsc) lebih kecil.
WHY: rdtsc kecepatan beda x86 vs ARM bisa bikin timer game glitch. Scale = kalibrasi.
TRADE-OFF: kalau game timer udah bener, skip ini.
DEFAULT-IF: ON buat game racing/timing-sensitive (DiRT, NFS, F1).

## VolatileMetadata
WHAT: pake volatile metadata dari header PE.
WHY: nge-help FEX prediksi memory access pattern.
DEFAULT-IF: ON.

## HideHypervisorBit
WHAT: spoof CPUID — sembunyiin info kalau jalan di emulator.
WHY: game/DRM cek bit ini → kalau detect = refuse launch.
DEFAULT-IF: ON buat game DRM (AC, GTA V, RE Engine). OFF buat indie.

## MonoHacks
WHAT: workaround khusus Mono runtime (Unity, etc).
WHY: Mono punya pattern memory access spesifik yg bisa di-opt.
TRADE-OFF: ON cuma kalau game Unity (Hollow Knight, Cuphead, dll).
DEFAULT-IF: ON buat Unity. OFF buat selainnya.

## SMCChecks (Self-Modifying Code Checks)
WHAT: mode deteksi self-modifying code.
Value:
- `none` — skip SMC check (fastest, risiko crash di game pake SMC)
- `mtrack` — track via mprotect (balance)
- `full` — strict check (safest, slowest)
WHY: game dengan SMC (DRM lawas, anti-cheat) butuh detect SMC supaya JIT cache invalidate.
DEFAULT-IF: `mtrack` (balance). `none` buat extreme perf di game yg ga ada SMC.

---

## Preset matrix (GameHub UI presets)

### COMPATIBILITY / SAFE
```
TSOEnabled         : ON
VectorTSOEnabled   : ON
MemcpySetTSOEnabled: ON
HalfBarrierTSOEnabled: OFF
X87ReducedPrecision: OFF
Multiblock         : ON
MaxInst            : 1000
SmallTSCScale      : OFF
VolatileMetadata   : ON
HideHypervisorBit  : ON
MonoHacks          : OFF
SMCChecks          : full
```

### BALANCED / INTERMEDIATE
```
TSOEnabled         : ON
VectorTSOEnabled   : ON
MemcpySetTSOEnabled: OFF
HalfBarrierTSOEnabled: OFF
X87ReducedPrecision: ON
Multiblock         : ON
MaxInst            : 2000
SmallTSCScale      : ON
VolatileMetadata   : ON
HideHypervisorBit  : ON
MonoHacks          : OFF (ON kalau Unity)
SMCChecks          : mtrack
```

### PERFORMANCE / EXTREME
```
TSOEnabled         : OFF (kecuali game multi-thread heavy)
VectorTSOEnabled   : OFF
MemcpySetTSOEnabled: OFF
HalfBarrierTSOEnabled: ON
X87ReducedPrecision: ON
Multiblock         : ON
MaxInst            : 4000
SmallTSCScale      : ON
VolatileMetadata   : ON
HideHypervisorBit  : OFF (ON kalau DRM game)
MonoHacks          : OFF (ON kalau Unity)
SMCChecks          : mtrack
```

### CUSTOM matrix per game engine
| Engine | TSO | VectorTSO | HideHypervisor | MonoHacks | SMC |
|---|---|---|---|---|---|
| RAGE (GTA V) | ON | ON | ON | OFF | mtrack |
| EGO 2.0 (DiRT 3) | OFF | OFF | OFF | OFF | mtrack |
| AnvilNext (AC) | ON | ON | ON | OFF | mtrack |
| RE Engine | ON | ON | ON | OFF | mtrack |
| Diesel (Payday 2) | OFF | OFF | OFF | OFF | mtrack |
| Crystal (Tomb Raider) | ON | ON | OFF | OFF | mtrack |
| UE4/UE5 | ON | ON | ON | OFF | mtrack |
| Unity | ON | ON | OFF | ON | mtrack |
| FoxEngine (MGS V) | ON | ON | ON | OFF | mtrack |

---

## Env var FEX_*  (alternatif setting via .env)
```
FEX_TSOENABLED=1        # 0=off, 1=on
FEX_MULTIBLOCK=1
FEX_SILENTLOG=1         # matikan log
FEX_CORE=irjit          # backend JIT
```
