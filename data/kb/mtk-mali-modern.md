# MediaTek / Mali Modern Driver Gates — DXVK 2.x & VKD3D

Update: 22 Jul 2026.

Tujuan file ini: COPUX jangan lagi jawab "Mali = selalu Sarek" secara buta. Untuk MediaTek/Mali 2026, keputusan DXVK/VKD3D harus driver-gated: GPU model saja tidak cukup.

Sumber:
- [VERIFIED via GitHub release] DXVK upstream: `https://github.com/doitsujin/dxvk/releases`
- [VERIFIED via GitHub release] VKD3D-Proton: `https://github.com/HansKristian-Work/vkd3d-proton/releases`
- [VERIFIED via GitHub release] FEX: `https://github.com/FEX-Emu/FEX/releases`
- [VERIFIED via GitHub release] GameNative: `https://github.com/utkarshdalal/GameNative/releases`
- [COMMUNITY SIGNAL] GameNative/X/Reddit/YouTube posts are useful for direction, but treat per-device claims as "test signal", not universal truth.

---

## Core rule

Mali recommendation order:

1. Per-game `[VERIFIED]` result in KB.
2. Android GPU driver version.
3. Vulkan API version + extension set.
4. GPU tier/model.
5. Theoretical matrix.

**BOT RULE:** kalau user cuma sebut "Helio/Dimensity/Mali" tapi tidak kasih driver version, jangan langsung lock ke Sarek atau DXVK 2.x. Tanya 2 data:
- `Driver version` dari AIO Graphics Test / VulkanCaps / DevCheck.
- `Vulkan version` dari app yang sama.

Contoh format yang dicari:
```
GPU: Mali-G57 MC2
Vulkan: 1.3.303
Driver: 54.1.0
Android: 16
```

---

## MTK/Mali driver gate

**[COMMUNITY SIGNAL + THEORETICAL]** Rule ini datang dari signal komunitas 2026 + requirement DXVK/VKD3D. Treat sebagai decision gate, bukan janji FPS.

| Driver Mali/MTK | D3D9/10/11 via DXVK | DX12 via VKD3D | Rekomendasi bot |
|---|---|---|---|
| Unknown | Jangan tebak | Jangan tebak | Tanya driver + Vulkan dulu. Sarek/1.7.x tetap safe fallback kalau user butuh jawaban cepat. |
| `< v40` | Legacy path | Tidak | DXVK-Sarek 1.11.1/1.12.0 atau DXVK 1.7.2/1.10.3 per-game. Jangan saran DXVK 2.x. |
| `v40-v49` | DXVK 2.x mulai layak dites kalau Vulkan 1.3 + extension penting ada | Umumnya tidak | Primary test: DXVK 2.5-2.7 untuk D3D9/10/11. Fallback: Sarek/1.7.2 kalau shader/BCn/ClipDistance crash. |
| `>= v50` | DXVK 2.x viable path | Experimental DX12-light | VKD3D boleh dicoba untuk DX12 ringan. Heavy AAA DX12 tetap jangan dijanjikan. |
| `54.1.0+` dengan Vulkan `1.3.303` | Strong community signal | Stronger DX12-light signal | Boleh arahkan DXVK 2.x/VKD3D-light sebagai test path, tapi wajib kasih fallback Sarek/DX11 mode. |

**DXVK 3.x note:** DXVK 3.0/3.0.1 butuh Vulkan 1.4. Mayoritas driver HP masih lebih cocok DXVK 2.5-2.7. Jangan rekomendasikan DXVK 3.x ke MTK/Mali kecuali user eksplisit menunjukkan Vulkan 1.4.

---

## Contoh device interpretation

### Helio G99 / Mali-G57 MC2

**[VERIFIED - Noysz]** Helio G99 + GTA V DX10 1024x600 Medium pernah lebih mulus di `dxvk-1.7.2.wcp` daripada Sarek 1.12.0. Itu tetap valid sebagai per-game override untuk stack lama atau driver yang belum jelas.

**[COMMUNITY SIGNAL]** Helio G99/Mali-G57 dengan driver `54.1.0` + Vulkan `1.3.303` sudah beda kelas dari G99 lama. Untuk stack seperti ini:
- D3D9/10/11: boleh tes DXVK 2.x dulu.
- DX12: boleh tes VKD3D untuk game ringan saja.
- Fallback tetap `dxvk-1.7.2.wcp` / Sarek 1.11.1/1.12.0 kalau muncul shader crash, black screen, atau VRAM pressure.

### Dimensity 7200/8100/8200/8300 family

GPU G610/G615 sering tergantung driver vendor. Jangan pakai rule model-only.
- Driver `<40`: Sarek path.
- Driver `40+`: tes DXVK 2.x kalau Vulkan 1.3 reported.
- Driver `50+`: VKD3D-light boleh dicoba, tapi DX11 fallback tetap lebih realistis.

### Dimensity 9300/9400 / Immortalis G720/G925

Secara arsitektur lebih dekat ke DXVK 2.x path, tapi tetap cek driver.
- Vulkan 1.3 + driver modern: DXVK 2.5-2.7 masuk akal.
- Vulkan 1.4: baru pertimbangkan DXVK 3.x.
- DX12: VKD3D-light only, jangan overpromise Cyberpunk/Hogwarts-class.

---

## VKD3D on Mali

**[VERIFIED via GitHub release]** VKD3D-Proton 3.0.1 punya fixes untuk Turnip test suite dan performance work untuk mobile/tile GPUs: deferred clears/discards, render pass suspend-resume, MSAA resolve work.

**Interpretasi mobile:**
- Ini menaikkan peluang DX12 di mobile tiler, tapi bukan berarti semua Mali langsung kuat.
- Driver `>=50` adalah gate minimum praktis untuk MTK/Mali DX12-light.
- Gunakan `VKD3D_CONFIG=dxr11` dan matikan ekspektasi ray tracing.
- Kalau game punya DX11 mode, DX11 + DXVK 2.x/Sarek sering lebih waras daripada DX12.

---

## Mali BCn texture fixes (env-var) — artifact / black screen

**[COMMUNITY SIGNAL]** Mali GPU tidak punya HW decode BCn/BCn-compressed texture (DXT/BC1-7). Efeknya: artifact tekstur, black screen di game yang pakai texture compression. Fix dari thread issue fork Bionic-wrapper + Bannerlator (2026, closed/solved oleh tester) = paksa decode BCn via CPU atau compute shader lewat env-var wrapper.

⚠️ **Dua nama env-var beda, fungsi sama** (dua maintainer nulis sendiri-sendiri) — kalau satu ga jalan, coba variannya:

| Env var | Fungsi | Sumber issue |
|---|---|---|
| `USE_CPU_BCN=all` atau `=133,137` | Paksa CPU decode BCn (nilai = format code, `all` = semua) | Bionic-wrapper #113, #92 |
| `USE_BCN_CPU=all` | Varian nama sama fungsi | Bionic-wrapper #118 |
| `ENABLE_BCN_COMPUTE=1` | Decode BCn via compute shader (bukan CPU) | Bannerlator #51 |
| `WRAPPER_EMULATE_BCN=2` | Mode emulasi BCn di wrapper | Bannerlator #51 |
| `WRAPPER_LOG_LEVEL=trace` | Debug wrapper (diagnosa VUID / copy error) | Bionic-wrapper #164 |

**DXVK version gate Mali-G57 (dari tester):** DXVK `1.10.3` / `1.5.5` sering lebih stabil daripada 2.x di Mali-G57 untuk game tertentu (mis. My Summer Car). Konsisten dengan rule driver-gate di atas: 2.x butuh driver + Vulkan cukup baru.

⚠️ **Caveat:** env-var + nilai di atas di-ekstrak dari komentar issue, bukan dokumentasi resmi wrapper. Verifikasi flag exact di build wrapper yang user pakai (bionic vs bannerlator beda). Ini test-signal, bukan janji.

**BOT RULE:** kalau user Mali laporan "artifact tekstur" / "black screen di game" (bukan crash), sebelum suruh ganti DXVK version, saranin coba `USE_CPU_BCN=all` (bionic) atau `ENABLE_BCN_COMPUTE=1` (bannerlator) dulu — lebih murah dari swap wrapper.

---

## Failure mapping

- `vkCreateShaderModule failed` di Mali driver `<40` atau Vulkan 1.1/1.2 -> balik ke DXVK-Sarek.
- Artifact tekstur / black screen di game (bukan crash) di Mali -> coba env-var BCn dulu (`USE_CPU_BCN=all` / `ENABLE_BCN_COMPUTE=1`, lihat section di atas) sebelum swap DXVK version.
- Black screen setelah splash di DXVK 2.x -> coba Sarek 1.11.1/1.12.0, lalu 1.7.2/1.10.3 kalau game lebih cocok build lama.
- VKD3D launch lalu crash compile shader -> DX12 path belum cocok; pakai DX11 mode kalau tersedia.
- OOM / app killed -> jangan langsung naik versi DXVK; turunkan resolusi, VRAM cap, dan coba build yang lebih ringan.
- User nyebut "MTK bisa DX12 sekarang" -> jawab: bisa mulai dicoba di driver `v50+`, bukan semua MTK.

---

## Bot answer rules

1. Jangan bilang "Mali = Sarek always".
2. Jangan bilang "Helio G99 always DXVK 1.7.2". Itu verified untuk stack/game tertentu, bukan semua driver baru.
3. Jangan bilang "Mali DX12 impossible". Rule baru: driver `<50` jangan; driver `>=50` experimental/lightweight.
4. Kalau driver version missing, tanya driver dulu. Kalau user maksa preset cepat, berikan safe fallback + sebut "tanpa data driver".
5. Selalu echo confidence tag:
   - `[VERIFIED - Noysz]` untuk hasil test Noysz.
   - `[VERIFIED via GitHub release]` untuk changelog release.
   - `[COMMUNITY SIGNAL]` untuk Reddit/X/YouTube/device-post.
   - `[THEORETICAL]` untuk inferensi dari Vulkan/extension/tier.
