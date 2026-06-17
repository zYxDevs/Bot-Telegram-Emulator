# Wine/Winlator/GameHub Architecture — Layer Cake

Pondasi konseptual buat jawab pertanyaan **"kenapa"** soal stack emulator PC di Android.
Bukan emulasi penuh kayak PCSX2 — ini **rantai penerjemah berlapis**, output layer N jadi input layer N+1.

---

## 7-Layer Stack

```
┌─────────────────────────────────────────────┐
│ L1  GAME WINDOWS (.exe)                     │  x86/x64 + Win API
│         ↓                                   │
│ L2  WINE LAYER                              │  Win API → Linux API
│         ↓                                   │
│ L3  CPU TRANSLATOR (Box64 / FEXCore)        │  x86/x64 → ARM64 (JIT)
│         ↓                                   │
│ L4  GRAPHICS LAYER (DXVK / VKD3D-Proton)    │  DirectX → Vulkan
│         ↓                                   │
│ L5  GPU DRIVER (Turnip / Vortek / Mesa)     │  Vulkan → GPU hardware
│         ↓                                   │
│ L6  KERNEL LINUX ANDROID                    │  syscall, mmap, scheduler
│         ↓                                   │
│ L7  HARDWARE (CPU + GPU + RAM)              │  besi fisik
└─────────────────────────────────────────────┘
```

---

## Layer 1 — Game Windows (.exe)
Game ditulis pake instruksi **x86/x64** + panggilan **Windows API** (Direct3D, DirectInput, XAudio, dst).
Android = ARM64 + Linux. Ga ada satu pun yg nyambung native — semua harus diterjemahin layer di bawahnya.

---

## Layer 2 — Wine
**Wine BUKAN emulator.** Wine = implementasi ulang Windows API di atas Linux.
Game panggil `CreateWindow()` / `Direct3DCreate9()` / `XInputGetState()` → Wine intercept → terjemahin ke syscall Linux yg setara.

**Implikasi praktis:**
- `regedit` di Wine = registry Wine sendiri (file di container), BUKAN registry Windows. Karena itu `wine reg add` cuma nyentuh container itu.
- `WINEDLLOVERRIDES=d3d11=n,b` bilang ke Wine: "buat DLL ini, jangan pake builtin Wine — load file di folder game (native), fallback ke builtin." Ini mekanisme **resmi** Wine — bukan hack.
- DLL load order: folder game → Wine builtin. Inilah kenapa naro `d3d11.dll` (versi DXVK) di folder game = rewire graphics layer tanpa nyentuh container global.

**Cross-link:** `wine-envs.md`

---

## Layer 3 — CPU Translator (Box64 / FEXCore)
**Layer yg paling sering disalahpahami.** Bukan "simulasi CPU x86" — ini **JIT compiler**: baca instruksi x86 → kompile ke instruksi ARM64 → eksekusi → cache hasil.

| Translator | Dipake di |
|---|---|
| **Box64** | Winlator (Bionic/Star/Frost/Cmod/Ajay), Mobox |
| **FEXCore** | GameHub, BannerHub, Mobox (FEX mode), WinNative |

**Implikasi praktis:**
- `BOX64_DYNAREC_*` env var = lu literally ngonfigurasi cara JIT compiler kerja (block size, optimization aggressiveness, dst).
- `FEX_TSOENABLED` = nyalain emulasi Total Store Ordering x86 → barrier per store di ARM. Aman, tapi mahal (~15-25% perf).
- Game dengan instruksi spesifik (AVX2 tertentu, instruksi MMX edge case) bisa crash karena translator belum implement, BUKAN karena HP lemot.

**Cross-link:** `box64-envs.md`, `fex-translation.md`, `fex-extreme-params.md`

---

## Layer 4 — Graphics Layer (DXVK / VKD3D-Proton)
Game panggil DX9/11/12. Android cuma punya Vulkan. DXVK/VKD3D = penerjemah yg jalan di atas Wine.

- **DXVK**: DX9/10/11 → Vulkan.
- **DXVK-Sarek**: fork DXVK khusus Mali (handle BCn texture decode + gl_ClipDistance emulation di shader).
- **VKD3D-Proton**: DX12 → Vulkan. Beda binary dari DXVK.

**Implikasi praktis:**
- **GPU spoofing kerja di layer ini**, BUKAN di driver. `dxvk.customDeviceId/customVendorId` di dxvk.conf bikin DXVK lapor ke game "gw NVIDIA RTX 2060", padahal di L5 tetep Mali-G57.
- State cache (`.dxvk-cache`) = hasil compile shader yg disimpen. Sesi berikutnya skip recompile = startup cepet + frametime stabil.
- Ganti `d3d11.dll` di folder game = ganti versi DXVK yg dipake (asal `WINEDLLOVERRIDES=d3d11=n`).

**Cross-link:** `dxvk-conf.md`, `vkd3d.md`

---

## Layer 5 — GPU Driver (Turnip / Vortek / Mesa)
Vulkan calls dari L4 → driver → GPU hardware.

| Driver | GPU | Status |
|---|---|---|
| **Turnip** | Adreno (Snapdragon) | Open-source Mesa, performance bagus |
| **Vortek** | Mali | Wrapper, perf < Turnip, demoted era 2025+ |
| **DXVK-Sarek path** | Mali modern | Bypass Vortek, langsung Vulkan native Mali |
| **Mesa generic** | desktop/dev | Bukan target Android |

**Implikasi praktis:**
- Mali GPU **fundamentally** miss extension Vulkan tertentu yg DXVK butuh (BCn compressed texture, gl_ClipDistance). Sarek emulate di shader → kerja, tapi lebih berat.
- Adreno punya driver paling matang → kompatibilitas tertinggi.

**Cross-link:** `gpu-rules.md`, `turnip-per-adreno.md`

---

## Layer 6 — Kernel Linux Android
Semua syscall dari L2/L3/L5 (mmap, VirtualAlloc, thread create) berakhir di sini.

**Implikasi praktis:**
- **Rambooster genuine, bukan placebo.** Wine `VirtualAlloc` → diterjemahin ke `mmap()` ke kernel Android. Kernel rasain memory pressure → trigger LMK (Low Memory Killer) → background apps di-clear → RAM bebas buat stack di atasnya.
- CPU affinity (`taskset` / `CORE_AFFINITY_MASK`) = ngomong ke kernel scheduler core mana yg boleh dipake → big core dedicated buat translator JIT.
- ZRAM swap = kernel feature, dipake buat compress RAM idle.

**Cross-link:** `chipset-affinity.md`

---

## Layer 7 — Hardware
CPU (ARM64 cores), GPU (Adreno/Mali), RAM. Layer paling bawah. Yg ngerasain seluruh overhead translation L2-L5.

---

# 4 Hambatan Kompatibilitas — Diagnostic

**Pertanyaan klasik: "HP gw flagship, kenapa game ini tetep ga jalan?"**

Raw spec (GHz, core count, RAM) **bukan** satu-satunya faktor. 4 hambatan ini ga bisa di-solve cuma dengan HP lebih kenceng:

## Hambatan 1 — Instruction Set Coverage (L3)
Game pake instruksi x86 spesifik (AVX2, BMI2, SSE4 edge case) yg **belum diimplement** di Box64/FEXCore.
**Gejala**: crash instant di splash screen, illegal instruction error di log, "Application has stopped working" di Wine.
**Diagnostic**: cek log Box64/FEX → kalo ada `unsupported opcode` / `unimplemented instruction` → ini.
**Workaround**: update Box64/FEX versi terbaru, atau ganti translator (Box64 ↔ FEX).

## Hambatan 2 — Windows API Coverage (L2)
Wine ga implement 100% Win API. Fungsi spesifik (DirectStorage, terbaru WinRT, kernel API tertentu) belum ada.
**Gejala**: launcher jalan tapi game stuck loading; error "missing entry point: <FunctionName>"; crash di game-specific feature.
**Diagnostic**: `WINEDEBUG=+loaddll,+module` → cari `err:module:import_dll Library X (XYZ.dll) not found` atau `fixme:` panggilan kritikal.
**Workaround**: install Wine version lebih baru, copy DLL Windows native + `WINEDLLOVERRIDES=xyz=n`.

## Hambatan 3 — Vulkan Extension Support (L5)
DXVK butuh Vulkan extension tertentu. GPU lama / Mali tertentu support Vulkan tapi miss extension yg dipake DXVK.
**Gejala**: DXVK fail to initialize, `vkCreateInstance failed`, `Required Vulkan extension X not supported`, black screen permanen.
**Diagnostic**: log DXVK (`DXVK_LOG_LEVEL=info`) → `info: Required Vulkan extension VK_KHR_xxx not supported` di awal.
**Workaround**: Mali → coba DXVK-Sarek (handle BCn + ClipDistance). Adreno → cek versi Turnip yg lebih baru.

## Hambatan 4 — Anti-Cheat / DRM (L2 + L6)
Kernel-level anti-cheat (EasyAntiCheat, BattlEye, Vanguard) jalan di driver Windows ring 0 — Wine **ga bisa** emulate ini, dan ga akan pernah bisa tanpa kernel module Android.
**Gejala**: game refuse to launch, kick instant after match start, "Anti-cheat service not running".
**Diagnostic**: cek game ini punya kernel-level AC? → biasanya yes kalo multiplayer competitive.
**Workaround**: pake offline mode kalo ada (Elden Ring, FromSoft games), atau game ini ga playable di Wine. Permanent block.

---

# Diagnostic Flowchart

```
Crash di startup / belum sampai splash
  └─ Log Box64/FEX ada "unsupported opcode"?
       YES → L3 (Hambatan 1)
       NO  → log Wine ada "import_dll not found"?
              YES → L2 (Hambatan 2)
              NO  → log DXVK ada "extension not supported"?
                     YES → L5 (Hambatan 3)
                     NO  → cek Hambatan 4 (anti-cheat)

Launcher jalan, game stuck loading
  └─ Kemungkinan L2 (Hambatan 2) atau L4 (DXVK shader compile fail)

Game jalan, crash random in-game
  └─ Cek dxvk.log device lost? → L5 driver crash
     Cek "out of memory" → L6 / L7 RAM kurang → Rambooster
     Cek log ada SIGSEGV di Box64 → L3 edge case

Refuse to launch sama sekali, error anti-cheat
  └─ L2/L6 Hambatan 4 — permanent block
```

---

# 3 Insight Komunitas

## 1. Spek tinggi BUKAN jaminan
Bottleneck bisa di layer manapun. SD 8 Gen 3 + 16GB RAM tetep gagal kalo:
- Translator belum support instruksi spesifik (L3)
- Wine belum implement Win API yg dipanggil (L2)
- Game punya kernel-level AC (L2+L6)

Diagnose dulu **layer mana yg fail**, jangan langsung blame hardware.

## 2. Tiap setting nyentuh layer berbeda
| Setting | Layer | Efek |
|---|---|---|
| `BOX64_DYNAREC_BIGBLOCK=3` | L3 | JIT compiler config |
| `FEX_TSOENABLED=0` | L3 | Translator memory ordering |
| `dxvk.maxFrameRate=60` | L4 | DXVK cap |
| `WINEDLLOVERRIDES=d3d11=n` | L2 | Wine DLL load order |
| `wine reg add` | L2 | Wine registry |
| `CORE_AFFINITY_MASK` | L6 | Kernel scheduler |
| Rambooster ZRAM | L6 | Kernel memory pressure |
| Turnip driver pick | L5 | GPU driver swap |
| `dxvk.customDeviceId` | L4 | DXVK spoofing (BUKAN L5) |

Paham layer mana yg lu sentuh → diagnose 10x lebih cepet.

## 3. Rambooster / Swap / RAM management = genuine
Bukan placebo. Mereka nyentuh **L6 (kernel)** langsung — layer yg di-share semua layer atas. RAM yg dibebasin LMK → tersedia buat seluruh stack di atasnya. Mekanisme kerasa.

---

# Kapan Pake KB Ini

Trigger kalo user nanya:
- "Kenapa HP gw kuat tapi game X tetep ga jalan?"
- "Bottleneck-nya di mana?"
- "Bedanya Wine sama emulator apa?"
- "Kenapa ganti DLL bisa kerja?"
- "GPU spoofing itu nyentuh apa?"
- "Rambooster placebo bukan sih?"
- "Anti-cheat kenapa ga bisa?"
- "Cara baca crash log buat tau layer mana yg fail?"

Bot harus jelasin **dengan referensi ke layer** + cross-link ke KB knob spesifiknya.
