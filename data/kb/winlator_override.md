[VERIFIED] - Sumber: Pengujian Komunitas Winlator
# Panduan "Wine Library Override" (Winlator & GameHub)

Dokumentasi ini memandu Anda dalam melakukan *override* pustaka sistem (Wine Library Override) pada emulator Winlator atau GameHub di Android. Tujuannya memastikan berkas *crack* atau emulator *steam_api* dieksekusi dengan benar sebelum memuat pustaka bawaan Wine.

---

## ⚠️ CATATAN KAKI EDUKASI EKSPLISIT (SANGAT PENTING)

Karena banyak unduhan permainan dari indeks agregasi (SteamRIP, SteamGG, OvaGames, GOG-Games, ElAmigos) adalah berkas berjenis **PORTABLE** atau **PRE-INSTALLED (Direct Play)**:

1. **TIDAK PERLU INSTALASI:** Anda sama sekali **tidak perlu** mencari berkas `.exe installer`. Permainan sudah siap dimainkan.
2. **EKSTRAKSI SEMPURNA:** Anda **WAJIB** mengekstrak seluruh isi berkas arsip (ZIP/RAR/7z) secara utuh menggunakan aplikasi pengarsipan Android murni (seperti ZArchiver, RAR) **sebelum** memasukkannya ke dalam Winlator. Jangan ekstrak dari dalam *container* emulator Windows karena bisa korup atau lambat.

---

## Langkah-langkah Override (Cara Winlator / Environment Variables)

Di Winlator, cara paling handal dan anti-gagal untuk melakukan override adalah melalui **Environment Variables**, bukan lewat menu `winecfg` biasa.

1. **Buka Konfigurasi Container:**
   Jalankan aplikasi Winlator. Pada menu utama, klik titik tiga di container Anda lalu pilih **Edit**.

2. **Akses Tab Environment Variables:**
   Gulir/geser tab ke menu **Environment Variables**.

3. **Tambahkan Variabel:**
   Tambahkan variabel baru atau edit variabel `WINEDLLOVERRIDES` (jika sudah ada).
   - Masukkan *Name*: `WINEDLLOVERRIDES`
   - Masukkan *Value*: `steam_api=n,b;steam_api64=n,b`
   
   *(Keterangan: `n,b` berarti Native then Builtin. Titik koma `;` memisahkan tiap DLL. Jangan pakai spasi)*

4. **Simpan dan Terapkan:**
   Klik tombol centang / Save. Mulai sekarang semua game di container tersebut akan menggunakan `steam_api.dll` bawaan crack dari game-nya, bukan buatan Wine.

## Alternatif Lewat winecfg (GameHub / Cara Klasik)

Jika Anda tidak bisa memakai Environment Variables, gunakan `winecfg`:
1. Buka *winecfg* (Start Menu -> System Tools -> Wine Configuration).
2. Pindah ke tab **Libraries**.
3. Ketik `steam_api` pada *"New override for library"*, tekan **Add**.
4. Ulangi ketik `steam_api64`, tekan **Add**.
5. Keduanya secara default akan ter-set sebagai **(native, builtin)**. Klik **Apply** lalu **OK**.

### Mengapa ini dibutuhkan?
Beberapa game bajakan/pre-installed memakai `steam_api.dll` khusus (seperti buatan Goldberg Emulator) untuk memotong verifikasi DRM Steam. Mode *Native then Builtin* memaksa Wine memprioritaskan membaca DLL fisik yang Anda ekstrak (Native) daripada emulasi Wine (Builtin). Hal ini mencegah error *License Not Found*, Steam Store terbuka, atau *Crash to Desktop* saat peluncuran.
