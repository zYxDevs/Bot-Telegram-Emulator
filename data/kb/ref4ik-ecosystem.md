# REF4IK Ecosystem — Winlator-ref4ik fork (Russian community) + Components CDN

Source: github.com/REF4IK. Update: Juni 2026.

**SCOPE: Android emulator (Winlator family) — fork ramai khusus Russian-speaking community, tapi bot WAJIB tau karena banyak user mobile pake distribusinya juga.**

Tujuan file ini: bot ngerti **fork REF4IK** (beda dari brunodev base + Ludashi + CMOD), **build variant lite vs lud**, **Components-Adrenotools- CDN** dengan keunikannya (bundled VCRedist/PhysX/dotnet), dan **cross-pollination content provider dengan BannerHub**.

---

## Repo summary (yang relevan)

| Repo | Stars | Status | Apa itu |
|------|-------|--------|---------|
| winlator-ref4ik- | 92 | Active (v9 Mei 2026) | Fork brunodev/winlator branch `bionic-ref4ik` |
| Components-Adrenotools- | 4 | Active (Jan 2026) | CDN .wcp components (Wine/Box64/FEX/VKD3D + runtime exe) |
| GameNative-Mod | 0 | Active (Mei 2026) | Fork GameNative dengan ref4ik mods |
| Winlator-REF4IK | 22 | ARCHIVED Nov 2025 | Versi lama, jangan dipake |
| Bionic-Drivers- | 1 | ARCHIVED Jul 2025 | Versi lama driver |
| Components- | 2 | ARCHIVED Jun 2025 | CDN lama |

Skip: `update-url-mod-` (config tweak only), `REF4IK` (profile page).

---

## Winlator-ref4ik — 2 build variants

User download `.apk` dari Releases, ada 2 variant:

| Variant | Filename | Trigger | Target user |
|---------|----------|---------|-------------|
| `lite` | `bionic_ref4ik_v9_lite.apk` | Tidak ada (package name asli) | Default aman, kompatibel Play Protect |
| `lud` | `bionic_ref4ik_v9_lud.apk` | Disamarkan jadi app Ludashi benchmark (sama trick StevenMXZ/Winlator-Ludashi) | Xiaomi MIUI/HyperOS — trigger performance mode |

**Pattern:** sama dengan Ludashi `ludashi-bionic.apk` variant. Bot bisa kasih reference cross — user Xiaomi yang udah biasa pake REF4IK fork → tetap pake `lud` variant. User RedMagic mau frame gen unlock → switch ke StevenMXZ Ludashi `redmagic` variant.

---

## Inflection point versi REF4IK

| Versi | Inflection | Impact |
|-------|-----------|--------|
| **v9** (Mei 2026) | Renderer **completely replaced with Vulkan** — drop legacy GL, custom fragment shaders + SystemSensorPaths sensor query + content provider include ref4ik/the412banner/custom | Game OpenGL native legacy mungkin butuh fallback. Cross-pollination CDN dengan BannerHub |
| **v7** (Mei 2026) | Frame gen support + experimental Steam launching + touch control fix (5-detik disappear bug) | Steam game native via launcher, belum stable |
| **v6** (Mar 2026) | Custom driver repository support + gyroscope controls + update checking + container file management | User bisa point Winlator ke custom CDN URL (kayak StevenMXZ contents.json) |
| **v5** (Feb 2026) | Chinese language support + HDR screen effects | Lokalisasi tambah |

**Anti-stale rule:**
- User REF4IK < v6 → "Custom driver repo support baru ada di v6+, upgrade"
- User REF4IK < v7 → "Steam experimental launching baru ada di v7+, frame gen juga"
- User REF4IK < v9 → "Renderer Vulkan rewrite di v9 — kalau punya game OpenGL native legacy yang crash di v9, downgrade ke v7 atau lapor"
- User mau cross-CDN BannerHub dari REF4IK → "v9+ support content provider the412banner"

---

## Components-Adrenotools- — CDN dengan bundled runtime

Pattern sama Winlator-Contents StevenMXZ, tapi **REF4IK punya keunikan**: VCRedist/PhysX/dotnet di-package sebagai .wcp. Other forks user harus install via Wine winecfg/winetricks manual.

### Wine builds (release "Wine", tag 2553535)

Wine custom-patched ref4ik:
- `10.2-ref4ik.wcp` (214.8 MB, **18,086 downloads** = paling rame)
- `10.0-ref4ik.wcp` (214.4 MB, 17,467 downloads)
- 9.13 → 9.22-ref4ik (78-81 MB tiap-tiap) — granular Wine 9.x versions
- 9.0.1, 8.20 (legacy)

**Catatan:** ref4ik patches at-top of vanilla Wine — apa patch detail belum dokumentasi public. Tapi kemungkinan: bugfix Mali/Android specific + integrasi Box64 path.

### Box64 + FEX + VKD3D (release "D b t", tag 11132)

- `box64-bionic-0.3.9-251120-442d727.wcp` (4.3 MB)
- `box64-0.4.1.wcp` (2.7 MB, 9,493 downloads)
- `FEX-2601.wcp` (926 KB, 11,689 downloads) — **FEX limited to 2601 only**, lebih kecil scope dari StevenMXZ (2505-2605)
- `vkd3d-proton-3.0a.wcp` (3.8 MB)
- `vkd3d-proton-arm64ec-3.0a.wcp` (3.8 MB)

### Runtime executables (release "URL COMPONENTS EXE", tag 111)

Yang membedakan dari fork lain — bundled .wcp:
- `vcredist2015_2017_2019_2022_x64.exe` (25.6 MB)
- `vcredist2015_2017_2019_2022_x86.exe` (14.0 MB)
- `dotnet-sdk-10.0.101.x64.exe` (215.7 MB)
- PhysX (multiple versions)

**Use case:** game yang butuh VCRedist crash launch → user point custom repo URL Components-Adrenotools-, klik install runtime, ga perlu manual winetricks. Convenience untuk Russian community yang mungkin ga familiar dengan winetricks CLI.

---

## REF4IK vs StevenMXZ — perbandingan

| Aspek | REF4IK | StevenMXZ |
|-------|--------|-----------|
| Stars fork | 92 | 872 |
| Komunitas | Russian-speaking (Telegram winlatorruu) | Global, dominan Cina+SEA |
| Build variants | 2 (lite, lud) | 3 (vanilla, ludashi, redmagic) |
| DXVK range | (tidak di CDN sendiri) | 14 build (1.5.5 → 2.7.1, sarek, gplasync, arm64ec) |
| Wine custom | YA, patched `ref4ik` | TIDAK, pakai upstream `proton-10-arm64ec` |
| Bundled runtime | YA (VCRedist, PhysX, dotnet) | TIDAK |
| FEX range | 2601 only | 2505 → 2605 (13 versions) |
| Frame gen | YA (v7+) | TIDAK eksplisit |
| Cross-pollination CDN | YA (ref4ik/the412banner/custom) v9+ | TIDAK |
| OEM trick (Xiaomi) | YA (lud variant) | YA (ludashi variant) |
| RedMagic frame gen unlock | TIDAK | YA (redmagic variant) |

**Decision tree user:**
- HP RedMagic + frame gen unlock → **StevenMXZ** `redmagic` build
- HP Xiaomi/Redmi/POCO → **REF4IK** `lud` ATAU **StevenMXZ** `ludashi` (sama trick, beda fork base)
- Butuh DXVK range luas + custom + Sarek + ARM64EC → **StevenMXZ** (CDN lebih kaya)
- Butuh VCRedist/PhysX/dotnet quick install → **REF4IK** (runtime di-bundled .wcp)
- Russian community + dukungan bahasa Rusia → **REF4IK**
- SD 8 Elite (A8xx) khusus → **StevenMXZ** (mesa-tu8 + Adrenotools-Drivers v849)
- Game OpenGL native legacy yang rewel → hindari REF4IK v9 (Vulkan rewrite)

---

## Cross-pollination content provider (v9+ feature)

REF4IK v9 (Mei 2026) introduce **content provider selection**: ref4ik / the412banner / custom. Artinya user bisa point Driver Download Manager ke 3 sumber sekaligus:

- `ref4ik` — Components-Adrenotools- (default REF4IK)
- `the412banner` — BannerHub CDN (cross-fork pull, kalau user butuh komponen yang ga ada di REF4IK CDN)
- `custom` — URL user sendiri (bisa point ke StevenMXZ contents.json, BannerHub, atau third-party)

**Pattern:** kalau game butuh DXVK 2.7.1-arm64ec-gplasync-fix-leegao (cuma ada di StevenMXZ) tapi user pakai REF4IK base → set custom URL ke `https://raw.githubusercontent.com/StevenMXZ/Winlator-Contents/main/contents.json` → fork apapun bisa pull dari CDN apa pun.

---

## RULES BUAT BOT — anti-halu + anti-stale

1. User nyebut "REF4IK" / "winlator-ref4ik" → klarifikasi build variant (lite / lud).
2. User HP Xiaomi pake REF4IK → saranin `lud` variant (sama trick Ludashi).
3. User HP RedMagic + frame gen unlock → JANGAN saranin REF4IK `lud`, arahin ke StevenMXZ `redmagic` variant.
4. User REF4IK < v6 → upgrade buat custom driver repo support.
5. User REF4IK < v9 + game OpenGL native crash → kemungkinan Vulkan rewrite jadi masalah, downgrade ke v7 dulu.
6. User minta DXVK build range luas (Sarek, ARM64EC, fix variants) → arahin custom URL ke StevenMXZ contents.json (cross-pollination via v9+ content provider).
7. User minta VCRedist/PhysX/dotnet quick install → REF4IK Components-Adrenotools- punya bundled `.wcp`.
8. User minta Wine custom patched → REF4IK punya `10.2-ref4ik.wcp` (18k downloads, paling rame).
9. User minta FEX versi spesifik > 2601 → REF4IK CDN cuma punya 2601, arahin StevenMXZ.
10. User Russian-speaking → mention Telegram `winlatorruu` community sebagai support channel.
11. User REF4IK `Winlator-REF4IK` (huruf kapital) → STOP, itu archived Nov 2025. Arahin ke `winlator-ref4ik-` (lowercase, active).
