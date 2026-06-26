# dxvk.conf — Extras (complement `dxvk-conf.md`)

Source: github.com/doitsujin/dxvk/blob/master/dxvk.conf (DXVK upstream)

File ini **bukan** pengganti `dxvk-conf.md` — itu udah cover 17 knob paling impactful buat Mali/mobile.
Di sini: knob yang **kurang umum tapi penting** buat kasus spesifik — pipeline library, descriptor heap, GPU spoofing, FP16, D3D8 (post-merge d8vk), edge-case per-game.

---

## DXVK 2.x — feature-toggle penting buat mobile

### dxvk.enableGraphicsPipelineLibrary = Auto / True / False
WHAT: pakai `VK_EXT_graphics_pipeline_library` (GPL) buat compile shader incremental, anti-stutter.
WHY MOBILE: Mali Vulkan 1.0/1.1 sering **ga punya GPL extension** → DXVK 2.x crash atau hang.
DEFAULT-IF:
- Adreno modern (driver Turnip recent): **Auto** atau **True**.
- **Mali tanpa GPL**: **False** → fallback ke shader compile sync, atau pake DXVK Sarek/async fork.

### dxvk.enableDescriptorHeap = Auto
### dxvk.enableDescriptorBuffer = Auto
WHAT: `VK_EXT_descriptor_heap` / `descriptor_buffer` — descriptor management modern.
WHY MOBILE: extension ini baru, banyak driver mobile belum implement.
DEFAULT-IF: **Auto** (DXVK auto-detect known-good driver). Force **False** kalo curiga driver bohong support tapi crash.

### dxvk.lowerSinCos = Auto
WHAT: pakai approximasi sin/cos custom DXVK (lebih akurat) vs native GPU.
WHY MOBILE: beberapa Mali/Adreno FP precision-nya jelek di sin/cos → math game (rotasi kamera, fisika) ngaco.
DEFAULT-IF: **Auto** (DXVK detect driver bermasalah). Force **True** kalo ada visual glitch berhubung trigonometri.

### dxvk.enableImplicitResolves = True
WHAT: auto-resolve MSAA texture kalau sampled tanpa explicit resolve.
WHY MOBILE: bantu game lawas yang lazy soal MSAA. **Nvidia ada striping issue** kalau enabled — tapi mobile bukan Nvidia, jadi True aman.
DEFAULT-IF: True.

### dxvk.tearFree = Auto / True / False
WHAT: kontrol tearing dengan VSync. True = mailbox (no tear), False = relaxed FIFO (tear tapi smooth).
DEFAULT-IF: **False** buat mobile (mailbox biasanya bikin frame drop di Mali; relaxed FIFO lebih lancar).

### dxvk.numCompilerThreads — clarification
Existing file bilang 1 buat MediaTek. Upstream default = **0 (all cores)**.
Klarifikasi:
- 0 = all cores → CPU contention berat di mobile thermal throttle.
- 1 = single thread → aman tapi compile lambat.
- **2-3 = sweet spot** buat 8-core HP mid-range yang punya thermal headroom.

---

## GPU spoofing knobs (kalo bot user nanya "kenapa di-spoof?")

### dxgi.hideNvidiaGpu = Auto
WHAT: report Nvidia GPU sebagai AMD ke aplikasi.
WHY: game pake NVAPI atau check vendor → crash di non-Nvidia. Default Auto (DXVK aware NVAPI ga ada).
MOBILE: Mali/Adreno bukan Nvidia. Tetep True default biar game ga panik check NVAPI.

### dxgi.hideAmdGpu = Auto
WHAT: report AMD GPU sebagai Nvidia.
WHY: game pake AMDAGS lib → crash kalo AMDAGS ga ada. Game spesifik need this (banyak UE4 title).
MOBILE: jarang perlu — mobile GPU bukan AMD, tapi kalo emulator spoof ke AMD, set ini True biar bisep balik ke Nvidia spoof.

### dxgi.hideIntelGpu = Auto
WHAT: report Intel iGPU sebagai AMD.
WHY: game refuse run di iGPU karena performance assumption.
**MOBILE: d3d9.hideIntelGpu DEFAULT = True** — game DX9 lawas otomatis ga liat Intel. Penting buat Adreno yang sering ke-detect aneh.

### dxgi.customDeviceId / customVendorId / customDeviceDesc
WHAT: spoof PCI ID + name manual (4-digit hex).
WHY: game whitelist GPU tertentu (e.g. "GTX 1060"). Spoof biar lolos check.
GUNA: kalo game outright refuse run di mobile GPU, spoof jadi NVIDIA + spesifik ID terkenal.
CATATAN: Wine/Winlator biasanya udah expose lewat winecfg/registry. DXVK level cuma reinforce.

### d3d11.exposeDriverCommandLists = True
WHAT: expose D3D11 command list support.
WHY: kalo lo spoof AMD ke Windows-style, set False — AMD desktop default ga support driver command lists.
MOBILE: True default aman.

---

## D3D8 knobs (DXVK 2.x post-merge d8vk)

DXVK 2.x udah built-in support D3D8 (d8vk merged). Knob D3D8 baru relevant:

### d3d8.scaleDref = 0
WHAT: scale Dref shader instruction buat bit depth shadow map.
WHY: game DX8 awal (PS1.1) expect range `[0..2^bitDepth-1]`. Biasanya **24** buat shadow depth.
GUNA: shadow ngaco di game DX8 → coba 24.

### d3d8.shadowPerspectiveDivide = False
WHAT: paksa perspective divide buat shadow map.
WHY: emulasi behavior GeForce 3/4 lama.
GUNA: True buat game DX8 dengan shadow map dari era GF3/4 (2001-2003).

### d3d8.forceVsDecl = (empty)
WHAT: paksa vertex shader declaration (format "0:2,3:2,7:1" = float3 pos, normal, float2 UV).
WHY: game DX8 lawas yang corrupt geometry — vertex decl-nya ga jelas.
GUNA: vertex chaos di game DX8 → force decl spesifik per-game.

### d3d8.batching = False
WHAT: batching draw call khusus.
**WARNING:** ⚠️ **HURT performance / bikin artifact di luar game spesifik known-good**. Jangan generic.

### d3d8.placeP8InScratch = False
WHAT: place P8 (palettized 8-bit) texture di D3DPOOL_SCRATCH.
WHY: workaround Nvidia GPU awal yang P8-nya bermasalah.
GUNA: game lawas dengan texture P8 corrupt — coba True.

### d3d8.forceLegacyDiscard = False
WHAT: ignore D3DLOCK_DISCARD buat buffer non-dynamic.
WHY: legacy behavior buat game DX8 awal yang lazy soal discard.
GUNA: performance hit, cuma kalo wajib buat compat.

---

## Game-spesifik knob (cross-ref `per-game.md`)

Ini bukan tweak global — pake **per game** yang ke-impact:

### d3d9.forceSamplerTypeSpecConstants = False
GUNA: **Halo: Combat Evolved**, **Spellforce** — fix rendering broken karena sampler type assumption.
SET: True khusus 2 game ini.

### d3d9.extraFrontbuffer = False
GUNA: **Silent Hill 2 Enhanced Edition** — fix frame buffer.
SET: True khusus SH2 EE.

### d3d9.supportCubeDepthFormats = False
GUNA: **Silent Hill 2 EE** butuh True, **Gothic 3 PATAH** kalo True.
SET: True buat SH2 EE; False default (dan buat Gothic 3).

### d3d9.supportX4R4G4B4 = True
GUNA: **The Sims 2** wajib True.
SET: True default udah (jangan diturunin).

### d3d9.disableA8RT = False
GUNA: **The Sims 2** workaround render target.
SET: True khusus Sims 2.

### d3d9.modeCountCompatibility = False
GUNA: **AquaNox** workaround — list cuma current resolution.
SET: True khusus AquaNox.

### d3d9.forceRefreshRate
GUNA: **Metal Gear Rising: Revengeance** — paksa refresh rate exposure.
WARNING: ⚠️ Banyak game lain BROKEN kalo refresh rate dipaksa (fisika, render bocor frame). Pake cuma kalo wajib.

### dxvk.deviceFilter = (empty)
WHAT: filter device by name substring.
GUNA: emulator multi-device (lo punya iGPU + dGPU). Mobile ga relevant — kebanyakan 1 GPU.

---

## Knob debugging / power-user (jarang)

### dxvk.maxMemoryBudget = 0
WHAT: override VRAM budget limit (MB).
⚠️ **DEBUG ONLY** — performance crash kalo dipake casual. Jangan saranin user buat tweak ini.

### dxvk.zeroMappedMemory = False
WHAT: zero memory mapped saat dibebaskan.
⚠️ CPU overhead naik drastis. Last-resort doang.

### dxvk.enableDebugUtils = False
WHAT: enable VK debug utils + user annotation (BeginEvent/EndEvent).
GUNA: bot ga perlu saranin ini — buat dev DXVK doang.

### dxvk.hideIntegratedGraphics = False
WHAT: hide iGPU dari aplikasi.
RELEVANT MOBILE: NGGAK — mobile semua iGPU. Set ini bikin DXVK ga liat GPU sama sekali.

---

## Pattern recommended buat mobile baru (DXVK 2.x)

Kalo user mau coba DXVK 2.x di Mali/Adreno mid (bukan stick di Sarek):

```ini
# Mobile-friendly DXVK 2.x baseline
dxvk.enableGraphicsPipelineLibrary = False    # Mali tanpa GPL — wajib
dxvk.enableDescriptorHeap = Auto
dxvk.enableDescriptorBuffer = Auto
dxvk.lowerSinCos = Auto
dxvk.tearFree = False
dxvk.numCompilerThreads = 2                   # 8-core mid HP
dxvk.maxFrameLatency = 1                      # input lag turun
dxvk.maxFrameRate = 60                        # cap (kalo physics-bound)

# Resource budget
d3d9.maxAvailableMemory = 1536                # Mali-G610 mid
d3d11.cachedDynamicResources = a              # all dynamic ke cached sysmem
d3d9.useFP16 = Auto                           # weaker GPU otomatis FP16
dxvk.maxChunkSize = 96                        # 96MB chunk (mid GPU)

# Stability
d3d9.deferSurfaceCreation = True              # fix black screen
dxgi.deferSurfaceCreation = True
d3d9.floatEmulation = Strict                  # fix poligon DX9 mobile
d3d11.relaxedGraphicsBarriers = True          # FPS boost aman
dxvk.logLevel = none                          # no I/O waste
```

Kalo Mali pre-G77 atau driver Vulkan 1.0: **lupakan ini, pake DXVK Sarek 1.11.1-mali-fix / 1.12.0** — lebih cocok.
