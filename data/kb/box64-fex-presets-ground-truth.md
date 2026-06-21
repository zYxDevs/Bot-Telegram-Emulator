# Box64 & FEXCore Preset — Ground Truth (Var-Level)

> Sumber: screenshot langsung dari UI Settings (Box64 Preset / FEXCore
> Preset dropdown), 2 app: **GameHub** dan **Winlator Ludashi Bionic 3.1**.
> Semua angka di file ini **[VERIFIED]** — dari observasi UI langsung,
> BUKAN dari dokumentasi/forum. Kalau ada app/fork lain (REF4IK, Frost,
> Pipetto, dst), JANGAN asumsikan value sama — butuh verifikasi screenshot
> terpisah sebelum ditambah ke file ini.

---

## ATURAN PAKAI BUAT COPUX

1. Kalau user nanya "bedanya preset A vs B di Box64", jawab **VAR YANG
   BENERAN BEDA AJA** — JANGAN list semua var seolah preset ngatur
   semuanya. Liat tabel "yang berubah" di bawah.
2. Kalau user nanya soal Box64 preset, **WAJIB tanya/konfirmasi app-nya**
   dulu (GameHub vs Ludashi vs lainnya) kalau ga disebut — karena value
   beda per-app, KONFIRMED dari data ini.
3. FEXCore preset **diasumsikan universal** (identik di GameHub & Ludashi
   3.1) — tapi ini cuma 2 sample, bukan bukti buat semua app.
4. JANGAN bilang "default Box64/FEX preset = Compatibility" sebagai label
   resmi — itu observasi behavioral (container baru start di situ), bukan
   tag [Default] dari app manapun yang ke-screenshot.

---

## BOX64 — GameHub

### Var yang BERUBAH per preset

| Var | Stability | Compatibility | Intermediate | Performance |
|---|---|---|---|---|
| SAFEFLAGS | 2 | 2 | 2 | 1 |
| FASTNAN | OFF | OFF | ON | ON |
| FASTROUND | 0 | 0 | 0 | 1 |
| X87DOUBLE | 1 | 1 | 1 | 0 |
| BIGBLOCK | 0 | 0 | 1 | 3 |
| STRONGMEM | 2 | 1 | 0 | 0 |
| FORWARD | 128 | 128 | 128 | 512 |
| CALLRET | OFF | OFF | ON | ON |
| WAIT | OFF | ON | ON | ON |
| UNITYPLAYER | ON | ON | OFF | OFF |
| MMAP32 | OFF | OFF | ON | ON |

### Var yang TETEP (semua preset, GameHub)
AVX=0, MAXCPU=0, WEAKBARRIER=0, ALIGNED_ATOMICS=OFF, DF=ON, DIRTY=0,
NATIVEFLAGS=ON, PAUSE=0.

GameHub TIDAK expose: DYNAREC_SEP, DYNACACHE, DYNAREC_NOARCH,
DYNAREC_PURGE, SSE_FLUSHTO0, SYNC_ROUNDING, X87_NO80BITS, CPUTYPE,
UNITY (terpisah dari UNITYPLAYER), VOLATILE_METADATA, SSE42 — var ini
cuma muncul di Ludashi 3.1 (lihat bawah).

---

## BOX64 — Winlator Ludashi Bionic 3.1

### Var yang BERUBAH per preset

| Var | Stability | Compatibility | Intermediate | Performance |
|---|---|---|---|---|
| SAFEFLAGS | 2 | 2 | 2 | 0 |
| FASTNAN | OFF | OFF | ON | ON |
| FASTROUND | 0 | 0 | 0 | 1 |
| X87DOUBLE | 1 | 1 | 1 | 0 |
| BIGBLOCK | 0 | 0 | 1 | 2 |
| STRONGMEM | 2 | 1 | 0 | 0 |
| FORWARD | 128 | 128 | 128 | 512 |
| CALLRET | OFF | OFF | ON | ON |
| WAIT | OFF | ON | ON | ON |
| UNITYPLAYER | ON | ON | OFF | OFF |
| WEAKBARRIER | 0 | 1 | 0 | 0 |
| NATIVEFLAGS | OFF | OFF | ON | ON |
| PAUSE | 0 | 0 | 1 | 0 |
| MMAP32 | OFF | OFF | ON | ON |
| DIRTY | 0 | 0 | 0 | 1 |
| DYNAREC_SEP | 0 | 0 | 1 | 1 |
| VOLATILE_METADATA | OFF | ON | ON | ON |
| SSE42 | OFF | ON | ON | ON |
| DYNACACHE | 2 | 2 | 1 | 0 |
| DYNAREC_NOARCH | 0 | 0 | 0 | 1 |
| SSE_FLUSHTO0 | OFF | OFF | ON | ON |
| SYNC_ROUNDING | ON | ON | OFF | OFF |
| X87_NO80BITS | OFF | OFF | ON | ON |
| UNITY | ON | ON | OFF | OFF |

### Var yang TETEP (semua preset, Ludashi 3.1)
AVX=0, MAXCPU=0, ALIGNED_ATOMICS=OFF, DF=ON, DYNAREC_PURGE=OFF,
CPUTYPE=0.

---

## BOX64 — PERBEDAAN GameHub vs Ludashi 3.1 (var yang sama, value beda)

| Preset | Var | GameHub | Ludashi 3.1 |
|---|---|---|---|
| Stability | NATIVEFLAGS | ON | OFF |
| Compatibility | WEAKBARRIER | 0 | 1 |
| Compatibility | NATIVEFLAGS | ON | OFF |
| Intermediate | PAUSE | 0 | 1 |
| Performance | SAFEFLAGS | 1 | 0 |
| Performance | BIGBLOCK | 3 | 2 |
| Performance | DIRTY | 0 | 1 |

**Implikasi:** preset nama sama ("Performance") ≠ behavior sama. WAJIB
sebut app/fork tiap kali kasih value Box64 preset ke user.

---

## FEXCORE — Identik di GameHub & Ludashi Bionic 3.1

### Var yang BERUBAH per preset

| Var | Stability | Compatibility | Intermediate | Performance |
|---|---|---|---|---|
| TSOENABLED | ON | ON | ON | OFF |
| VECTORTSOENABLED | ON | ON | OFF | OFF |
| HALFBARRIERTSOENABLED | ON | ON | ON | OFF |
| MEMCPYSETTSOENABLED | ON | ON | OFF | OFF |
| MULTIBLOCK | OFF | ON | ON | ON |

### Var yang TETEP (semua preset)
X87REDUCEDPRECISION=OFF, MAXINST=5000, HOSTFEATURES=off,
SMALLTSCSCALE=1, SMC_CHECKS=mtrack, VOLATILEMETADATA=1, MONOHACKS=1,
HIDEHYPERVISORBIT=0, DISABLEL2CACHE=0, DYNAMICL1CACHE=0.

**Catatan:** cuma 5 dari 15 variable FEXCore yang preset-dependent —
semua soal TSO/memory-ordering + multiblock compile. 10 sisanya FIX
ga peduli preset apa. **[THEORETICAL]**: kemungkinan FEXCore preset
universal antar app (beda dari Box64), tapi cuma 2 sample — perlu
verifikasi app ketiga buat naikin confidence ke [VERIFIED] generalized.

---

## CAVEAT PENTING — "0" ≠ "Default"

Beberapa var punya tag `[Default]` di dropdown opsi yang BUKAN value
preset-nya sekarang. Contoh dari custom params (bukan tabel di atas):
SafeFlags default app = 1, WeakBarrier default = 1, BigBlock default = 2.
Kalau user override manual ke 0, itu DORONGAN dari default ke ekstrem,
BUKAN "balik ke default". TRADE-OFF harus disebut akurat: risiko naik,
bukan netral.

---

## YANG BELUM DI-COVER (jangan diasumsikan)

- REF4IK, Frost, Cmod, Pipetto, Star Bionic — belum ada data screenshot
- Preset "default" Winlator container baru = Compatibility, ini
  **observasi behavioral**, bukan label app manapun
- Versi Box64/FEXCore yang dipakai di screenshot ini tidak diketahui
  pasti — kalau versi beda, value preset bisa berubah lagi
