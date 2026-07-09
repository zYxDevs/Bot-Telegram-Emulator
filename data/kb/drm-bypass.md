# DRM BYPASS & CRACKING PADA EMULATOR (Winlator / Termux-Box)
[VERIFIED] - Sumber: Panduan Dasar Emulator Winlator

## KONTEKS
Beberapa game original (seperti dari Steam, GOG, Epic Games, atau EA App) yang dipasang di emulator Winlator/Mobox seringkali tidak bisa dijalankan karena adanya DRM (Digital Rights Management). Emulator belum mendukung integrasi penuh dengan client-client resmi ini secara sempurna.

## CARA BYPASS DRM (STEAM)
Pesan error umum: `"Steam is not running"`, `"Steam initialization failed"`, `"Fatal Error: Failed to load steam_api.dll"`, `"Please make sure you have steam running"`.

1. **Goldberg Steam Emu**:
   - Jika game aslinya menggunakan Steam DRM, cara paling umum adalah dengan menimpa file `steam_api.dll` (untuk game 32-bit) atau `steam_api64.dll` (untuk game 64-bit) dengan versi emulator milik Goldberg.
   - **Lokasi file**: Biasanya ada di folder root game atau di dalam folder `Engine/Binaries/ThirdParty/Steamworks/` (pada game Unreal Engine).
   - Letakkan juga file `steam_appid.txt` yang berisi AppID game tersebut di samping file .exe game. AppID bisa dicari di steamdb.info.

2. **Steamless**:
   - Beberapa executable (.exe) di-pack dengan perlindungan SteamStub yang menyebabkan game langsung crash di emulator. Untuk menghapusnya, gunakan aplikasi Steamless pada file .exe game sebelum menjalankannya di Winlator. (Aplikasi ini berjalan di PC Windows).

## CARA BYPASS DRM LAINNYA
- **Epic Games**: Gunakan emulator seperti Nemirtingas Epic Emu atau CODEX emu. Timpa file `EOSSDK-Win64-Shipping.dll`.
- **Denuvo**: Tidak bisa di-bypass secara instan dengan emulator. Game dengan Denuvo harus sudah memiliki versi *cracked executable* agar bisa dijalankan di Winlator. Ganti file .exe bawaan dengan .exe yang sudah di-crack.

## TROUBLESHOOTING STEAM ERROR
- `"Steam is not running"` atau langsung keluar tanpa pesan error (Crash to Desktop): 99% DRM belum ke-bypass. Pasang Goldberg emu dan `steam_appid.txt`.
- Jika sudah pasang Goldberg tapi masih crash, coba buat file teks kosong dengan nama `steam_interfaces.txt` di sebelah `steam_api(64).dll`.
- Pastikan tidak ada spasi atau karakter aneh (seperti tanda kurung) pada folder tempat instalasi crack/game. Winlator sensitif terhadap path berantakan.
- Cek file konfigurasi `.ini` milik crack (seperti `steam_emu.ini` atau `goldberg_emu.ini`) jika game nge-freeze di awal. Coba ubah bahasa (Language) atau matikan fitur overlay/controller jika ada.
