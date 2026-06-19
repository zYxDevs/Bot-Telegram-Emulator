# Wine Evolution — Versi yang relevan buat Winlator/GameHub

Source: WineHQ release notes, secondary coverage. Update: Juni 2026.

**SCOPE: Android emulator (Winlator family + GameHub family). NO desktop/Steam Deck.**

Tujuan file ini: bot tau **versi Wine yang ke-ship di fork emulator user**, **kapan fork upgrade worth direkomendasiin**, dan **stale advice mana yg udah ke-replace**.

---

## Fakta keras yg harus inget

1. **User mobile ga bisa upgrade Wine standalone.** Wine ke-bundle ke APK Winlator/GameHub.
2. **Solusi "upgrade Wine" = ganti Winlator fork/version**, bukan ngubah binary.
3. **Cek versi Wine** lewat container settings UI atau About, BUKAN command line `wine --version` (user mungkin ga punya akses shell).
4. **Wineserver model** = daemon `wineserver` + client `wine`. Crash sering di wineserver (deadlock) atau client (DLL load).

---

## Wine prefix anatomy (kalo user nanya isi prefix)

```
$WINEPREFIX/
├── drive_c/
│   ├── windows/{system32, syswow64}/   ← builtin Wine DLLs
│   ├── users/                           ← per-user data
│   ├── Program Files/, Program Files (x86)/
├── system.reg, user.reg, userdef.reg   ← registry hives (text)
├── dosdevices/                          ← symlink ke host filesystem
```

**Di Winlator:** prefix per-container di `/data/data/com.winlator.app/files/imagefs/home/xuser/.wine/` (atau path serupa per-fork). User UI panggil "Container", under hood = prefix.

**DLL loading order:** kontrol via `WINEDLLOVERRIDES` env var (lihat `winedllovr-per-game.md`).

---

## Inflection points relevan mobile

### Wine 9.0 (Jan 2024) — NEW WoW64 mode opt-in
- "Thunk" 32-bit Windows API → 64-bit Unix syscalls. **Jalan 32-bit app di pure 64-bit prefix.**
- **Default Windows version prefix Win10** (sebelumnya XP/7). Kalo game butuh Win7/XP lookalike → set via `winecfg` per-prefix.
- DirectInput action maps — kontroler game lawas yg map input ke action jadi kompat.
- ARM64: loader support ARM64X dan ARM64EC modules — **buka path FEX integration**.
- Vulkan 1.3.272 support.
- VKD3D 1.10, FAudio 23.12.

### Wine 10.0 (Jan 2025) — ARM64EC full + FFmpeg backend
- **ARM64EC full support** — run x86_64 code module dalam ARM64 environment. Direct relevant **GameHub family + FEX**.
- **FFmpeg multimedia backend** gantiin GStreamer di mfplat. Game video cutscene crash di Wine 9.x sering kelar di 10+.
- Vulkan 1.4 spec — DXVK 2.6+ bisa pake.
- High-DPI scaling auto-handle (non-DPI-aware app diskalain otomatis).

### Wine 11.0 (Jan 2026) — WoW64 COMPLETE
- **`wine64` binary GONE** — unified `wine` binary. Kalo user pake fork ship Wine 11 → command `wine64 game.exe` PATAH. Pake `wine` aja.
- WoW64 fully supported = 16-bit + 32-bit + 64-bit jalan satu prefix.
- VKD3D 1.17, Mono 10.2.
- ARM64 simulate 4K page size di system native 16K/64K (limited app).
- Force feedback racing/flight stick support naik.
- Shader model bumps DX lawas.
- H.264 hardware decode via D3D11 video API.

**NOT mobile-relevant** (skip kalo user nanya): NTSync (kernel 6.14+ Linux only, Android ga punya), Wayland driver maturity (Android pake SurfaceFlinger), EGL default X11 (Termux X11 user MAYBE — tapi Winlator render via Vulkan loader langsung).

---

## Wine version yang ke-ship per Winlator fork — UNVERIFIED

⚠️ **Data berikut ASUMSI berdasarkan release timeline.** Tanya user / cek source kalo butuh exact:

| Fork | Latest version | Wine asumsi |
|---|---|---|
| Winlator main (brunodev85) v11.1 | Jun 2026 | Likely Wine 9.x atau 10.x branch |
| Winlator CMOD (coffincolors) v13.1.1 | Aug 2025 | Likely Wine 9.x branch |
| GameHub Lite / BannerHub / GameNative | 2025-2026 | Wine 10.x+ (ARM64EC dependent) |
| WinNative-Emu | 2025-2026 | Wine 10.x+ |

**Bot rule:** kalo user nanya feature Wine spesifik, TANYA versi Wine kontainer dulu (UI Winlator → Container Settings → About atau yang serupa).

---

## Decision matrix: simptom → cek versi Wine

| Simptom user | Aksi |
|---|---|
| `wine64 not found` di Winlator baru | Pake `wine` saja — Wine 11+ unified |
| Video cutscene crash / audio mati di video | Fork user pake Wine ≥10 (FFmpeg backend)? Kalo Wine 9 → saran ganti fork yg ship Wine 10+ |
| .NET game ga jalan | Install Wine Mono manual via Start Menu → System Tools |
| 32-bit installer issue | Pastiin container Wine arch + PREFIX arch align (Wine 11 unified harusnya OK) |
| Kontroler input lawas patah | Pake fork ship Wine ≥9.0 (DirectInput action maps) |
| ARM64EC game (rare) | Pake GameHub family (Wine 10+ + FEX) |

---

## Bot rules — anti-stale Wine

1. **JANGAN saranin "upgrade Wine"** — user mobile ga bisa. Saran = ganti fork emulator.
2. **JANGAN saranin `wine64 ...`** kalo user di Wine 11+ fork — udah merged ke `wine`.
3. **JANGAN saran Wayland tweak** — Android ga pake Wayland desktop driver.
4. **JANGAN saran NTSync benefit** — Android kernel ga punya.
5. **Video cutscene crash** → cek versi Wine fork dulu. Wine ≥10 FFmpeg backend sering fix tanpa codec install manual.
6. **Default Win10 prefix** Wine 9.0+ — game butuh Win7/XP lookalike → winecfg per-prefix, jangan asumsi default.
7. **Wine Mono ga auto-install** — user .NET game butuh install manual via Start Menu System Tools, atau drop dotnet48 dll + `WINEDLLOVERRIDES=mscoree=` (lihat winedllovr-per-game.md).
8. **Cek versi Wine via Winlator UI**, bukan command line — kebanyakan user ga punya shell access default.
