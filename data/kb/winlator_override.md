# Panduan "Wine Library Override" (Winlator & GameHub)

Dokumentasi taktis ini memandu Anda dalam melakukan *override* pustaka sistem (Wine Library Override) pada emulator Winlator atau GameHub di Android. Tujuan utama konfigurasi ini adalah memastikan berkas *crack* atau emulator *steam_api* bawaan dari permainan pre-installed dieksekusi dengan benar sebelum mencoba memuat pustaka dari sistem operasi Wine itu sendiri.

---

## ⚠️ CATATAN KAKI EDUKASI EKSPLISIT (SANGAT PENTING)

Karena semua unduhan permainan dari indeks agregasi kami (SteamRIP, SteamGG, GameBounty, AnkerGames, UnionCrax) adalah berkas berjenis **PORTABLE** atau **PRE-INSTALLED (Direct Play)**:

1. **TIDAK PERLU INSTALASI:** Anda sama sekali **tidak perlu** mencari atau menjalankan berkas `.exe installer` (seperti `setup.exe` atau `install.exe`). Permainan sudah siap dimainkan.
2. **EKSTRAKSI SEMPURNA:** Anda **WAJIB** mengekstrak seluruh isi berkas arsip (ZIP/RAR/7z) secara utuh menggunakan aplikasi pengarsipan murni Android (seperti ZArchiver, RAR, atau WinRAR) **sebelum** memasukkannya ke dalam Winlator atau melakukan konfigurasi di bawah ini. Jangan pernah mencoba mengekstrak file dari dalam *container* emulator Windows.

---

## Langkah-langkah Taktis Library Override

Ikuti instruksi berikut untuk mengatur *override* pustaka `steam_api` dan `steam_api64` ke mode **Native then Builtin**:

1. **Buka Konfigurasi Container:**
   Jalankan aplikasi Winlator atau GameHub di perangkat Android Anda. Pilih *container* (wadah OS) yang akan Anda gunakan untuk menjalankan permainan, lalu masuk ke menu **Settings** (Pengaturan) atau **Wine Configuration** (`winecfg`).

2. **Akses Tab Libraries:**
   Pada jendela *Wine Configuration* (`winecfg`), arahkan ke tab **Libraries**.

3. **Tambahkan steam_api:**
   - Pada kolom isian bertuliskan *"New override for library"*, ketik secara manual: `steam_api` (tanpa tanda kutip).
   - Tekan tombol **Add** (Tambah).

4. **Tambahkan steam_api64:**
   - Kembali pada kolom isian *"New override for library"*, ketik secara manual: `steam_api64` (tanpa tanda kutip).
   - Tekan tombol **Add** (Tambah).

5. **Atur ke 'Native then Builtin':**
   - Cari dan klik `steam_api` pada daftar *"Existing overrides"* di bawahnya.
   - Klik tombol **Edit**.
   - Pilih opsi radio: **Native then Builtin**.
   - Klik **OK**.
   - Ulangi langkah yang sama untuk `steam_api64`: klik `steam_api64` dari daftar, pilih **Edit**, atur ke **Native then Builtin**, dan klik **OK**.

6. **Terapkan Perubahan:**
   - Klik **Apply** lalu **OK** untuk menutup jendela `winecfg`.
   - Jalankan file `.exe` utama permainan Anda dari dalam *container* yang telah dikonfigurasi.

### Mengapa ini dibutuhkan?
Beberapa rilis pre-installed modifikasi (*cracked*) menggunakan pustaka `steam_api.dll` dan `steam_api64.dll` khusus yang dimodifikasi untuk memotong verifikasi DRM Steam. Mode *Native then Builtin* memaksa Wine untuk memprioritaskan membaca `.dll` fisik bawaan permainan di dalam direktori folder yang Anda ekstrak (Native) daripada mencoba menggunakan atau mengemulasi pustaka buatan sistem Wine itu sendiri (Builtin). Hal ini mencegah error seperti *License Not Found*, jendela Steam Store terbuka tiba-tiba, atau permainan keluar paksa (Crash to Desktop) saat peluncuran.
