# Box64 & FEXCore — Variable Mechanics & Custom Preset Tuning Guide

> Tujuan: bukan cuma tau preset value (lihat presets-ground-truth.md),
> tapi paham MEKANISME tiap var biar COPUX bisa compose CUSTOM preset
> berdasarkan karakteristik game/GPU/CPU — bukan cuma pilih dari 4
> preset bawaan.
>
> Tag confidence per var:
> - **[VERIFIED]** = ada deskripsi resmi di UI app (lihat screenshot
>   Custom Params sebelumnya)
> - **[THEORETICAL]** = inferensi dari nama var + pengetahuan umum
>   dynamic-binary-translation/JIT — BELUM dikonfirmasi exact behavior
>
> ATURAN BUAT COPUX: kalau jawab pake var [THEORETICAL], WAJIB bilang
> "estimasi berdasarkan nama var, belum verified exact behavior" —
> jangan present sebagai fakta pasti.

---

## BOX64

### SAFEFLAGS — [VERIFIED]
**WHAT:** seberapa lengkap dynarec recalculate x86 condition flags
(ZF/CF/OF dst) setelah tiap instruksi.
**MEKANISME:** x86 instruksi implisit nge-set flag yang kadang dicek
beberapa instruksi kemudian. Tracking penuh = akurat tapi mahal.
0=no handling (tercepat, asumsi game ga gantung flag), 1=balanced
[default app], 2=full handling (teraman).
**TUNING SIGNAL:** game lama/simpel dengan logic branch sedikit →
boleh 0-1. Game dengan logic kompleks/banyak conditional jump aneh,
atau crash misterius di area decision-making → naikin ke 2.

### FASTNAN — [VERIFIED]
**WHAT:** fast NaN (Not-a-Number) handling buat floating point.
**MEKANISME:** skip strict IEEE-754 NaN propagation buat speed.
**TUNING SIGNAL:** game action/visual biasa aman ON. Game dengan
physics-heavy/precision-dependent calc (racing sim, particle physics
detail) → coba OFF kalau ada glitch fisika aneh.

### FASTROUND — [VERIFIED]
**WHAT:** fast floating-point rounding, skip strict IEEE rounding rule.
**TUNING SIGNAL:** sama kayak FASTNAN — ON buat speed, OFF kalau ada
jitter visual/fisika inkonsisten.

### X87DOUBLE — [VERIFIED]
**WHAT:** precision mode buat x87 FPU (legacy float instruction era
DX7/8/9).
**MEKANISME:** 1=pakai double precision pass (akurat, buat game lama
yang gantung x87), 0=skip extra precision (cepat, buat game modern
yang float math-nya udah pindah ke SSE).
**TUNING SIGNAL:** game lama (era 2000-2010, DX9 native, non-Unity)
→ 1. Game modern SSE-based → 0 aman.

### BIGBLOCK — [VERIFIED]
**WHAT:** strategi ukuran block kode yang di-compile sekali jalan.
**MEKANISME:** 0=small block (aman buat multithread/self-modifying,
tapi compile overhead lebih sering), 1=standard, 2=larger (elf memory
only), 3=maximum (bagus buat Wine, tapi riskan kalau multithread).
**TUNING SIGNAL:** game single-thread/straight-line code → naikin ke
2-3. Game multi-thread berat (engine modern, banyak worker thread) →
turunin ke 0-1.

### STRONGMEM — [VERIFIED]
**WHAT:** kekuatan x86 memory ordering model yang di-enforce.
**MEKANISME:** makin tinggi = makin strict barrier (aman buat
multi-thread shared-state), makin rendah = lebih cepat tapi riskan
race condition.
**TUNING SIGNAL:** game/engine modern dengan banyak shared state antar
thread (job system, ECS architecture) → naikin. Game lama/single-thread
→ 0 aman.

### FORWARD — [VERIFIED via nama, behavior umum dynarec]
**WHAT:** instruction lookahead window sebelum compile/optimize block.
**MEKANISME:** lebih besar = lebih banyak optimasi per pass tapi compile
overhead awal + RAM lebih tinggi.
**TUNING SIGNAL:** device RAM rendah / game udah confirmed stabil →
boleh besarin (512) buat max throughput. Device RAM ketat / game belum
ke-test → kecilin (128) buat compatibility.

### CALLRET — [VERIFIED]
**WHAT:** optimasi function call/return (CALL/RET).
**MEKANISME:** ON = dispatch lebih cepat (predict/cache return address),
tapi bisa salah kalau game manipulasi stack secara aneh (anti-cheat,
custom ABI).
**TUNING SIGNAL:** ON default buat performance. Crash spesifik di area
function call/exception handling → coba OFF.

### WAIT — [VERIFIED]
**WHAT:** dynarec thread nunggu compile block selesai sebelum lanjut.
**MEKANISME:** ON = aman (ga race ke block yang belum siap), tapi nambah
latency. OFF = kurang stall tapi riskan run block belum lengkap.
**TUNING SIGNAL:** default ON buat sebagian besar game. OFF cuma kalau
udah super stabil dan butuh max speed.

### UNITYPLAYER — [VERIFIED]
**WHAT:** compatibility hook khusus Unity engine (UnityPlayer.so).
**MEKANISME:** Unity Mono/IL2CPP runtime nge-JIT sendiri, butuh hook
khusus biar ga konflik sama SMC detection Box64.
**TUNING SIGNAL:** ON WAJIB kalau game Unity-based. OFF buat game
non-Unity (ga ada benefit, malah overhead).

### WEAKBARRIER — [VERIFIED]
**WHAT:** level optimasi memory barrier (axis beda dari STRONGMEM,
lebih granular).
**TUNING SIGNAL:** sama prinsip kayak STRONGMEM — naikin buat
multi-thread shared-state, turunin buat single-thread.

### NATIVEFLAGS — [VERIFIED]
**WHAT:** pakai flag native ARM langsung instead of emulasi software
flag x86.
**MEKANISME:** ON = lebih cepat (manfaatin flag host langsung), tapi
cuma bener kalau semantic x86-ARM align buat instruksi itu.
**TUNING SIGNAL:** ON aman buat mayoritas game. Cuma matiin kalau ada
bug logic branch yang aneh.

### PAUSE — [VERIFIED]
**WHAT:** emulasi instruksi x86 PAUSE (buat spin-lock hint).
**MEKANISME:** 0=ignore (cepat tapi bisa busy-spin CPU/boros thermal
kalau game pakai spinlock berat), 1=YIELD emulation, 2=WFI emulation,
3=SEVL+WFE emulation (paling power-aware).
**TUNING SIGNAL:** game/engine dengan threading berat yang spin-wait
(beberapa middleware) → naikin ke 1-3 buat kurangin panas/battery drain.
Game ringan → 0 cukup.

### MMAP32 — [THEORETICAL, nama jelas tapi exact trigger ga di-screenshot]
**WHAT:** mode memory-mapping khusus buat compatibility 32-bit address
space.
**TUNING SIGNAL:** ON spesifik buat game 32-bit yang crash dengan error
memory-mapping (vkMapMemory -5 style). Ga perlu buat game 64-bit.

### AVX — [VERIFIED level, mekanisme umum]
**WHAT:** support emulasi AVX/AVX2 SIMD instruction.
**MEKANISME:** ARM ga punya AVX native, jadi emulasi software — mahal.
0=disable (cepat, tapi game yang butuh AVX bakal crash), 1=basic, 2=full
AVX2.
**TUNING SIGNAL:** cek dulu game beneran pakai AVX (biasanya port PC
modern dengan vectorized math berat). Kalau ga butuh, biarin 0 — jangan
nyalain "buat jaga-jaga" karena overhead-nya nyata.

### MAXCPU — [THEORETICAL trigger, jelas fungsi]
**WHAT:** cap jumlah core yang di-report/dipakai Box64 ke game.
**TUNING SIGNAL:** turunin kalau game punya bug threading di core count
tinggi (jarang, tapi ada engine lama yang assume core count tertentu).

### DIRTY — [VERIFIED]
**WHAT:** strategi handling "dirty page" (halaman memory yang ditulis
ulang setelah di-compile — indikasi self-modifying code).
**MEKANISME:** 0=safe mode (selalu re-check), 1=allow dirty blocks
(skip beberapa safety check), 2=hot page optimization (caching agresif
buat page yang sering berubah).
**TUNING SIGNAL:** 0 default aman. Naikin kalau game crash-free tapi
performanya keganggu sama recompile churn berat.

### ALIGNED_ATOMICS — [VERIFIED]
**WHAT:** asumsi operasi atomic (buat sync thread) selalu di alamat
ter-align.
**MEKANISME:** ON = lebih cepat (skip alignment check), tapi crash kalau
game pakai unaligned atomics.
**TUNING SIGNAL:** biarin OFF kecuali confirmed game/engine emang
guarantee aligned atomics.

### DYNAREC_SEP — [THEORETICAL, nama ga jelas fungsi exact]
Belum cukup data buat nentuin mekanisme pasti. Kemungkinan soal separasi
cache/region di pipeline dynarec. **Jangan kasih WHY pasti ke user buat
var ini sampai ada konfirmasi lebih lanjut.**

### VOLATILE_METADATA — [VERIFIED, mirip versi FEX]
**WHAT:** treat metadata PE (.exe) sebagai volatile (bisa berubah saat
runtime).
**TUNING SIGNAL:** ON buat game yang ada self-patching loader/anti-tamper
yang modifikasi binary saat jalan.

### SSE42 — [VERIFIED level]
**WHAT:** support instruction set SSE4.2 (dipakai beberapa engine modern
buat string/CRC ops).
**TUNING SIGNAL:** ON kalau game/engine confirmed pakai SSE4.2; OFF
kalau ga, biar ga nambah overhead emulasi sia-sia.

### DYNACACHE — [THEORETICAL]
**WHAT (estimasi):** ukuran/agresivitas cache translasi dynarec.
**TUNING SIGNAL (estimasi):** device RAM lega → boleh naikin buat
manfaatin cache hit lebih banyak. Device RAM ketat → turunin.

### NOARCH — [THEORETICAL]
**WHAT (estimasi):** disable optimasi arch-specific ARM, fallback ke
codegen generic.
**TUNING SIGNAL (estimasi):** cuma relevan kalau ada masalah compatibility
di core ARM yang ga umum/lawas.

### PURGE — [THEORETICAL]
**WHAT (estimasi):** seberapa agresif dynarec purge cache block lama
buat hemat RAM.
**TUNING SIGNAL (estimasi):** device RAM rendah → mungkin worth dinyalain.

### SSE_FLUSHTO0 — [VERIFIED konsep umum FP]
**WHAT:** flush-to-zero buat angka denormal (floating point sangat kecil
mendekati 0).
**MEKANISME:** ON = cepat (denormal math itu lambat di kebanyakan CPU),
sedikit beda presisi di edge case.
**TUNING SIGNAL:** ON aman buat mayoritas game.

### SYNC_ROUNDING — [THEORETICAL]
**WHAT (estimasi):** sinkronisasi mode rounding floating point antara
guest x86 dan host ARM lebih strict.
**TUNING SIGNAL (estimasi):** kebalikan FASTROUND — ON kalau butuh
presisi rounding lebih konsisten, trade speed.

### X87_NO80BITS — [VERIFIED konsep umum]
**WHAT:** skip precision extended 80-bit x87 (pakai double 64-bit aja).
**MEKANISME:** ARM ga punya hardware 80-bit float, emulasi mahal. ON =
cepat, presisi sedikit turun.
**TUNING SIGNAL:** ON buat game DX lama yang pakai x87 tapi ga butuh
presisi ekstrem.

### CPUTYPE — [VERIFIED]
**WHAT:** identitas vendor CPU yang di-report via CPUID (0=Intel,
1=AMD).
**TUNING SIGNAL:** match ke vendor yang game/optimasinya expect (kalau
game punya AMD-specific code path, coba 1; default Intel paling umum).

### UNITY (beda dari UNITYPLAYER) — [THEORETICAL]
**WHAT (estimasi):** kemungkinan toggle Unity runtime component yang
beda dari UNITYPLAYER (mungkin spesifik Mono backend vs IL2CPP).
**Jangan klaim pasti bedanya ke user sampai ada konfirmasi.**

---

## FEXCORE

### TSOENABLED — [VERIFIED konsep]
**WHAT:** enforce Total Store Order (x86 strict memory consistency).
**TUNING SIGNAL:** ON buat engine multi-thread modern (AAA-style port).
OFF buat game single-thread/lawas yang prioritas speed.

### VECTORTSOENABLED — [VERIFIED konsep]
**WHAT:** TSO khusus buat operasi vector/SIMD load-store.
**TUNING SIGNAL:** ON kalau game heavy SIMD math (physics/graphics-math
berat) dan multi-thread; OFF buat hemat kalau ga relevan.

### HALFBARRIERTSOENABLED — [VERIFIED konsep]
**WHAT:** TSO barrier khusus unaligned load/store.
**TUNING SIGNAL:** ON kalau engine banyak akses memory unaligned di
context multi-thread.

### MEMCPYSETTSOENABLED — [VERIFIED konsep]
**WHAT:** TSO ordering khusus operasi bulk memcpy/memset.
**TUNING SIGNAL:** ON buat engine streaming asset/buffer berat lintas
thread.

### X87REDUCEDPRECISION — [VERIFIED konsep]
**WHAT:** kurangi presisi x87 FPU demi speed (versi FEX dari X87DOUBLE).
**TUNING SIGNAL:** ON buat speed di game ga sensitif presisi float;
constant OFF di semua preset bawaan — ini area manual tuning.

### MULTIBLOCK — [VERIFIED konsep]
**WHAT:** compile beberapa basic block jadi 1 unit translasi.
**MEKANISME:** unit lebih besar = optimasi lebih baik, riskan buat
self-modifying/branchy multi-thread code.
**TUNING SIGNAL:** ON aman buat mayoritas; OFF (Stability default) buat
game yang tricky/self-modifying.

### MAXINST (5000, fix semua preset) — [VERIFIED]
**WHAT:** ceiling instruksi per block translasi.
**TUNING SIGNAL:** rendahin manual buat code self-modifying ekstrem;
naikin manual buat throughput max di code simpel confirmed stabil.

### HOSTFEATURES ("off", fix) — [VERIFIED nama, manual tuning territory]
**WHAT:** deteksi fitur CPU host (ARM) tambahan buat optimasi spesifik
chip.
**TUNING SIGNAL:** worth dicoba nyalain di device flagship dengan ARM
core fitur lengkap; minim manfaat di device entry-level.

### SMALLTSCSCALE (1, fix) — [VERIFIED konsep]
**WHAT:** scaling Time Stamp Counter buat device clock rendah.
**TUNING SIGNAL:** lebih relevan di device budget/clock rendah; kurang
kritis di flagship clock tinggi.

### SMC_CHECKS (mtrack, fix) — [VERIFIED]
**WHAT:** metode deteksi self-modifying code (page tracking via memory
protection fault).
**TUNING SIGNAL:** fix di semua preset — bukan axis speed/safety, lebih
ke mekanisme deteksi teknis.

### VOLATILEMETADATA (1, fix) — [VERIFIED, sama konsep Box64]
**WHAT:** treat metadata binary sebagai volatile/bisa berubah.

### MONOHACKS (1, fix) — [VERIFIED]
**WHAT:** hook compatibility khusus runtime .NET Mono (banyak dipakai
Unity lawas/engine indie .NET).
**TUNING SIGNAL:** relevan khusus game Mono-based.

### HIDEHYPERVISORBIT (0, fix) — [VERIFIED]
**WHAT:** sembunyiin bit CPUID hypervisor dari guest.
**TUNING SIGNAL:** nyalain manual kalau anti-cheat/DRM nolak jalan
karena deteksi virtualisasi.

### DISABLEL2CACHE / DYNAMICL1CACHE (0, fix) — [THEORETICAL]
**WHAT (estimasi):** kontrol emulasi behavior cache L1/L2 buat
timing-sensitive code.
**Jangan kasih WHY pasti — fix di semua preset, kemungkinan niche
debug/compat toggle.**

---

## CARA PAKE FILE INI BUAT CUSTOM PRESET

Contoh logic compose preset custom (bukan preset bawaan):
1. Identifikasi sumbu risiko dari game: single-thread vs multi-thread,
   Unity vs non-Unity, 32-bit vs 64-bit, DX versi, AVX usage.
2. Mulai dari preset terdekat (Stability kalau ga yakin, Performance
   kalau device kuat + game udah ke-test komunitas).
3. Override var spesifik berdasarkan signal di atas — JANGAN ubah var
   yang ga relevan sama sumbu risiko game itu.
4. Selalu kasih WHY + TRADE-OFF per override, pakai tag confidence yang
   bener ([VERIFIED] vs [THEORETICAL]) sesuai file ini.
