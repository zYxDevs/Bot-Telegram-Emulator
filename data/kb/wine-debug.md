# WINEDEBUG — Channel + Workflow buat Winlator/GameHub log analysis

Source: Wine wiki Debug_Channels, wine-staging Debug, Wine User's Guide.

**SCOPE: Android Winlator/GameHub context.** Channel + exception code universal Wine, tapi **akses log di mobile beda dari desktop**.

---

## Reality check — gimana user dapet log Wine di mobile

Sebelum kasih saran channel, **tanya user dulu**:

| Setup user | Cara dapet log |
|---|---|
| Winlator standar (UI only) | Container Settings → Log/Debug toggle (kalo ada), atau file log di prefix path |
| Winlator + Termux co-install | Tee output via shell, Termux access prefix dir |
| Termux + Wine standalone | Native: `WINEDEBUG=... wine app.exe > log.txt 2>&1` |
| GameHub/BannerHub | UI biasanya punya Logs viewer. Cek menu Settings → Logs |
| Bare logcat | `adb logcat` (PC required) atau aplikasi logcat reader (root opsional) |

**Default rule:** Kalo user ga punya shell akses, **WINEDEBUG terbatas guna**. Saranin alternative diagnostic dulu:
- Container Settings → switch DXVK version / Box64 preset / Wine version (kalo multi-version slot)
- Tanya game versi + chipset → bypass debug, langsung kasih config target

---

## Syntax

```
WINEDEBUG=[class][+/-]channel[,[class][+/-]channel2]...
```

| Token | Artinya |
|---|---|
| `class` | `err`, `warn`, `fixme`, `trace`. Skip = semua class |
| `+channel` | enable |
| `-channel` | disable |
| Leading `+` | optional kalo ga ada class prefix |
| **NO SPACE** | anywhere in string |

Contoh:
```
WINEDEBUG=+seh,+module,+loaddll     # crash triage (small log)
WINEDEBUG=fixme-all,warn+cursor     # selective
WINEDEBUG=-all                       # SILENT (perf mode)
```

---

## Channel matrix — mobile-friendly priority

### Crash debug (START HERE — small log)

| Channel | Guna |
|---|---|
| `+seh` | Exception detail (AV, stack overflow) |
| `+module` | Module load + linker resolution |
| `+loaddll` | DLL load events + paths |

```
WINEDEBUG=+seh,+module,+loaddll wine game.exe > log.txt 2>&1
```
Log size: typically <1 MB. Mobile-friendly.

### Video/audio (per-symptom)

| Channel | Simptom |
|---|---|
| `+mfplat` | Video cutscene crash / WMF codec issue |
| `+dsound` | DirectSound audio mati/glitch |
| `+xaudio2` | XAudio2 (modern game audio) |
| `+mmdevapi` | Audio routing |

### Per-component

| Channel | Guna |
|---|---|
| `+heap` | Heap allocation, leak hunt |
| `+thread` | Thread create/exit/sync |
| `+file` | Filesystem ops |
| `+reg` | Registry access |
| `+mscoree` + `+dotnet` | .NET / Wine Mono issue |

### JANGAN saran ke mobile user

| Channel | Why |
|---|---|
| `+relay` | GB+ log size, bunuh storage HP |
| `+all` | Sama, terlalu noisy |
| `+snoop` | Verbose hampir setara relay |

Kalo user **harus** pake relay → wajib `RelayInclude` filter (registry `HKCU\Software\Wine\Debug`).

---

## Workflow per simptom

### "Game crash on launch"
```
WINEDEBUG=+seh,+module,+loaddll wine game.exe > log.txt 2>&1
```
Cari:
- `err:module:...` → DLL gagal load.
- `wine: Call from ... to unimplemented function ...` → API stub.
- `Unhandled exception: ...` → crash type.

### "Crash setelah video cutscene"
```
WINEDEBUG=+mfplat,+dsound,+seh wine game.exe > log.txt 2>&1
```
Kalo Wine fork user <10.0 → saran ganti fork ship Wine 10+ (FFmpeg backend) — sering kelar tanpa hack codec.

### "Audio mati"
```
WINEDEBUG=+dsound,+xaudio2,+mmdevapi wine game.exe > log.txt 2>&1
```
Mobile sering issue di routing OpenSL/AAudio level — kadang root cause di emulator audio driver picker, bukan Wine.

### ".NET game ga jalan"
```
WINEDEBUG=+mscoree,+dotnet wine game.exe > log.txt 2>&1
```
Pastiin Wine Mono installed (Winlator: Start Menu → System Tools).

### "Game freeze / hang"
```
WINEDEBUG=+thread,+sync,+seh wine game.exe > log.txt 2>&1
```
Cari thread WaitForSingleObject infinite = deadlock.

---

## Exception code quick reference

| Hex code | Artinya |
|---|---|
| `0xC0000005` | Access violation — null ptr / bad memory |
| `0xC0000142` | DLL initialization failed |
| `0xC0000094` | Integer divide by zero |
| `0xC0000409` | Stack buffer overrun (security cookie) |
| `0xC0000374` | Heap corruption |
| `0xE06D7363` | C++ exception (RTTI) |

---

## Error message patterns

| Pattern | Artinya |
|---|---|
| `err:module:import_dll Loading library ... failed` | DLL missing — install via winetricks, drop manual, atau `WINEDLLOVERRIDES` setup |
| `err:module:LdrInitializeThunk Initialization of dll ... failed` | DLL init crash — MSVCRT mismatch sering |
| `fixme:...:stub` | Wine ga implement function — biasanya non-critical, kecuali game ngandel function-nya |
| `wine: Call from ... to unimplemented function ...` | API stub — sering anti-cheat probe |
| `err:winediag:nodrv_CreateWindow X server` | Display server unavailable (Winlator render path broken — reset container) |
| `fixme:vulkan:wine_vk_get_physical_device_features2` | Vulkan ext baru — DXVK fallback (biasanya OK) |

---

## Bot rules — WINEDEBUG advice

1. **TANYA dulu** user bisa akses log gimana — bukan asumsi shell akses.
2. **JANGAN saran `+relay` atau `+all` casual** — bunuh storage HP.
3. **Default start: `+seh,+module,+loaddll`** = compact + targeted.
4. **Video crash** → `+mfplat,+dsound`. Kalo Wine <10 → saran ganti fork (FFmpeg backend).
5. **Audio crash** → cek emulator audio driver picker DULU sebelum WINEDEBUG. Sering root cause di driver Android, bukan Wine.
6. **Perf debug** → `WINEDEBUG=-all` baseline + DXVK_HUD overlay, bukan WINEDEBUG verbose.
7. **Output WAJIB redirect ke file** (`> log.txt 2>&1`).
8. **User attach log >5 MB**: minta potong via grep `err\|fixme:critical` dulu.
9. **Exception code 0xC0000005** = paling sering. Tanya: crash di splash atau ingame? Kalo splash = launcher DLL miss, kalo ingame = render/driver.
10. **winedbg interactive debugger** = jarang relevan mobile. Skip kecuali user explicit minta.

---

## Output redirect — pattern aman mobile

```
# Small triage
WINEDEBUG=+seh,+module wine game.exe 2>&1 | head -c 5M > log.txt

# Continuous tail (kalo Termux available)
WINEDEBUG=+seh wine game.exe 2>&1 | tee log.txt

# Skip fixme noise
WINEDEBUG=+seh wine game.exe 2>&1 | grep -v "^fixme:" > log.txt
```
