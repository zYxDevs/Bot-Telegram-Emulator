# Proton — Klarifikasi context Winlator/GameHub

**SCOPE: Android emulator user. Proton itself = Steam Deck/Linux desktop, NOT mobile.**

Tujuan file ini singkat: bot tau **Proton ≠ Winlator** + **mapping equivalent feature** kalo user salah kira.

---

## Fakta keras

1. **Proton ga jalan di Android.** Butuh CPU x86_64 native atau translation (Box64/FEX) — Proton bundle ga port-able as-is.
2. **Winlator pake upstream Wine builds**, BUKAN Proton.
3. **GameHub family pake Wine + FEX**, juga bukan Proton.
4. **Steam Deck game work ≠ mobile work.** Beda CPU path + bundled stack.

---

## Apa itu Proton (singkat)

Proton = Valve+CodeWeavers fork Wine + bundled DXVK + VKD3D-Proton + FAudio + dxvk-nvapi + esync/fsync/fshack patches + protonfixes per-game.

Variant:
- **Proton Stable** (current 10.0-4) — Steam default
- **Proton Experimental** — bleeding-edge Wine, latest stack
- **GE-Proton** (community) — extra patches: Media Foundation, AMD FSR (`WINE_FULLSCREEN_FSR=1`), NVIDIA CUDA/PhysX/NVAPI, protonfixes auto

---

## Equivalent mapping Proton feature → Winlator/GameHub

| Proton feature | Winlator/GameHub equivalent |
|---|---|
| `WINE_FULLSCREEN_FSR=1` (GE FSR) | Container Settings → driver/render → FSR (kalo driver Turnip support) |
| protonfixes auto env per game | Manual `WINEDLLOVERRIDES=...` di Container Env Vars |
| esync / fsync | Default bundled di Wine builds Winlator |
| NTSync | TIDAK ada (Android kernel ga support) |
| DXVK bundled | Container Settings → DXVK version picker |
| VKD3D-Proton bundled | Container Settings → DX12 toggle / VKD3D version |
| FAudio bundled | Default di Wine bundled Winlator |
| dxvk-nvapi | Tidak ada (mobile bukan NVIDIA) — N/A |
| GE Media Foundation patches | Sebagian sudah ke-port ke CMOD fork. Tergantung Wine version di-bundled (≥10 punya FFmpeg backend) |

---

## Bot rules — Proton clarification

1. **User di Winlator nanya "Proton version mana"?** → Klarifikasi: Winlator ga pake Proton. Yang relevant = **Wine version + DXVK preset** di Container Settings.
2. **User curhat "Steam Deck game saya jalan di mobile ga?"** → Klarifikasi: TIDAK auto-port. Proton config + Steam runtime beda. Mobile = Wine + Box64/FEX kompat-nya beda per-game.
3. **User minta GE-Proton features di Winlator** → Tanya fitur spesifik mana. FSR mungkin via driver picker, protonfixes mesti manual env + DLL override.
4. **"Install Proton di Winlator gimana?"** → Ga ada path. Wine bundled = upstream, bukan Proton. Saran: ganti fork Winlator yg ship Wine target version.
5. **User klaim "GE-Proton lebih bagus"** → Klarifikasi: bedanya patches + bundled stack, BUKAN magic. Desktop-only. Mobile equivalent = Container Settings tweak.
