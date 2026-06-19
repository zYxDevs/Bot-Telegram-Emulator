# WINEDLLOVERRIDES — Syntax + Per-Game Patterns (Winlator/GameHub context)

Source: Wine docs, community game launch options, protonfixes registry.

**SCOPE: Mobile Winlator/GameHub. Apply path beda dari Steam launch option.**

---

## WAJIB INGAT — apply method di mobile

| Setup | Cara apply |
|---|---|
| Winlator | Container Settings → **Environment Variables** → tambah `WINEDLLOVERRIDES=...` (BUKAN shortcut launch arg) |
| Winlator shortcut launch arg | Field beda — biasanya buat `cmd` Wine, BUKAN env. Jangan campur. |
| GameHub/BannerHub/GameNative | Container/Profile env field. Cek per-UI fork. |
| Termux + Wine standalone | Env var langsung: `WINEDLLOVERRIDES="..." wine app.exe` |
| winecfg permanent | Tab Libraries → Add → loadorder picker (per-prefix, persist) |

**Common mistake:** user paste `WINEDLLOVERRIDES=...` ke shortcut arg field → silent ignored. Bot harus klarifikasi field mana.

---

## Syntax

```
WINEDLLOVERRIDES="dll1=loadorder;dll2=loadorder;..."
```

| Token | Artinya |
|---|---|
| `n` | native (DLL Windows real) |
| `b` | builtin (DLL Wine reimplement) |
| `n,b` | native dulu, fallback ke builtin |
| `b,n` | builtin dulu, fallback ke native |
| `=` (empty) | disable DLL |

Pisah multi entry pake **`;`** (semicolon), bukan koma. Koma = loadorder, semicolon = separator.

```
# BENAR
WINEDLLOVERRIDES="dinput8=n,b;mscoree="

# SALAH (parse error)
WINEDLLOVERRIDES="dinput8=n,b,mscoree="
```

---

## Pattern proven per use case

### Mod loaders / Script extenders

| Override | Game / Use case |
|---|---|
| `dinput8=n,b` | Yakuza ASI mods, Spore Mod Loader, GTA San Andreas mods, **SKSE (Skyrim SE/AE)**, **F4SE (Fallout 4)**, TrackMania Openplanet — **POLA PALING UMUM** |
| `DWrite=n,b` | Baldur's Gate 3 Script Extender (BG3SE) |
| `version=n,b` | GTA V ScriptHookV + ScriptHookVDotNet |
| `winhttp=n,b` | BepInEx (Unity mod loader), Risk of Rain 2 |
| `winmm=n,b` | Older XInput injector, ASI variant |
| `xinput1_3=n,b` | Wrapper controller (x360ce dll drop) — hati2, biasanya Wine handle |

### Audio fixes

| Override | Use case |
|---|---|
| `xaudio2_7=n,b` | Surround sound game lawas |
| `xaudio2_9=n,b` | Game baru pake XAudio2 9 |
| `xactengine3_7=n,b` | XACT3 (Mass Effect, dll) |

### .NET / Framework

| Override | Use case |
|---|---|
| `mscoree=` (empty) | **Cegah Wine Mono auto-install popup** saat installer .NET app. **Wine Mono ga ke-disable totally** — cuma cegah dialog install. |
| `mscoree,mscorwks=` (empty) | Force pake real Microsoft .NET (drop manual via winetricks dotnet48). |

### Shader compiler

| Override | Use case |
|---|---|
| `d3dcompiler_43=n,b` | DX9 game shader (Skyrim LE, dll) |
| `d3dcompiler_47=n,b` | DX11 game shader, kompat lebih luas |

### Older D3D wrappers

| Override | Use case |
|---|---|
| `ddraw=n,b` | DirectDraw game (CNC, StarCraft, Diablo classic) + CnC DDraw wrapper. **UNVERIFIED di Winlator Wine — Wine generic claim, test dulu** |
| `d3d8=n,b` | Game DX8 + dgVoodoo wrapper. **Jarang perlu** karena d8vk udah merged ke DXVK 2.4+ — pake DXVK aja. |

---

## Anti-patterns — JANGAN PERNAH

| Override | Why bahaya |
|---|---|
| `*=n,b` (wildcard semua) | OVERRIDE SEMUA — Wine init fail, crash everywhere |
| `kernel32=n,b` | NEVER — Wine kernel32 = layer ke Unix syscall. Native ga ada artinya |
| `ntdll=n,b` | NEVER — same, Wine ntdll critical |
| `user32=n,b` | NEVER — windowing core |
| `gdi32=n,b` | NEVER — graphics core |
| `advapi32=n,b` | NEVER — registry/security core |
| `vulkan-1=n,b` | NEVER — Vulkan loader core |
| `d3d11=n,b` saat DXVK aktif | Conflict — DXVK ngehandle d3d11 sendiri. Disable DXVK dulu kalo wajib pake native d3d11 |
| `d3d9=n,b` saat DXVK aktif | Sama, conflict. ReShade DX9 lebih aman lewat DXVK injection mode |

---

## Diagnostic — verify override aktif

Termux/Shell user:
```
WINEDEBUG=+loaddll wine game.exe 2>&1 | grep "dinput8"
```
- Native dipake → path = drive_c game folder
- Builtin → path = system32/syswow64

Atau registry check:
```
wine reg query "HKCU\Software\Wine\DllOverrides"
```

Mobile UI user tanpa shell: cek game behavior — mod loaded vs ga.

---

## Bot rules — WINEDLLOVERRIDES advice

1. **Klarifikasi dulu** user di Winlator → field Environment Variables, BUKAN shortcut launch arg.
2. **JANGAN saran wildcard `*=n,b` atau core DLL override** — bunuh prefix.
3. **`mscoree=` (empty) = cegah popup install Wine Mono**, bukan disable .NET total. Sering misunderstood.
4. **DXVK aktif + `d3d*=n,b` = conflict.** ReShade di DXVK game → prefer DXVK injection mode, bukan native override.
5. **Native DLL harus match game architecture** (32-bit game butuh 32-bit DLL). Mismatch = silent fail.
6. **Native DLL drop location:** game folder paling aman (Wine search: cwd → game dir → system32).
7. **Cek native DLL ada dulu** sebelum saran `=n,b`. Drop manual atau install via winetricks.
8. **`dinput8=n,b` BUKAN universal** — verify mod loader user pakai vektor dinput8, beberapa pake winmm/version.
9. **`d8vk standalone` ga perlu** — udah merged ke DXVK 2.4+. Game DX8 pake DXVK aja.
10. **CNC DDraw + WINEDLLOVERRIDES=ddraw=n,b di Winlator** — **claim generic Wine, belum verified Winlator-specific.** Kalo user pengen test, kasih caveat.

---

## Quick decision tree

```
User punya mod / inject loader?
├─ ASI / Ultimate ASI Loader → dinput8=n,b
├─ SKSE / F4SE / OBSE → dinput8=n,b
├─ BG3SE → DWrite=n,b
├─ ScriptHook V (GTA) → version=n,b
├─ BepInEx → winhttp=n,b (atau dinput8, varies)
└─ ReShade → DXVK injection mode (bukan d3d*=n,b)

User audio issue?
├─ Surround / 5.1 hilang → xaudio2_7=n,b
└─ DSound crash → cek Wine version + emulator audio driver picker dulu

User .NET app issue?
├─ Popup install Wine Mono ganggu → mscoree= (empty)
├─ Game .NET ga jalan → install Wine Mono via Start Menu → System Tools dulu
└─ Game butuh real .NET → install dotnet48 via winetricks + drop dll

User cutscene crash?
└─ JANGAN override dulu — cek Wine version fork ≥10 (FFmpeg backend). Sering kelar tanpa hack.
```
