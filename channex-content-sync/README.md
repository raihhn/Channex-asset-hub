# Channex Content Sync

Plugin Figma lokal untuk mengisi teks pada frame yang sudah ada atau membuat salinan artboard dari XLSX/CSV. Tidak ada backend atau upload data.

## Build dan pemasangan

```bash
cd /Users/muhammadraihanpradana/Documents/Project/channex-content-sync
npm install
npm run typecheck
npm run build
```

Di Figma Desktop: **Plugins → Development → Import plugin from manifest…**, pilih `manifest.json`. Jika plugin sudah terpasang, tutup dan jalankan kembali untuk memakai build terbaru.

### Pasang di komputer lain

Jalankan `npm run package:local`. File `release/Channex-Content-Sync-Local.zip` berisi plugin siap pakai; komputer tujuan tidak perlu memasang Node.js.

1. Kirim ZIP ke komputer tujuan, lalu ekstrak ke folder yang tidak akan dipindahkan atau dihapus.
2. Buka Figma Desktop, lalu pilih **Plugins → Development → Import plugin from manifest…**.
3. Pilih `manifest.json` dari folder hasil ekstrak.
4. Jalankan **Channex Content Sync** dari **Plugins → Development**.

Figma menjalankan plugin dari file lokal yang dipilih, jadi folder hasil ekstrak harus tetap ada. Untuk memasang versi baru, ekstrak paket terbaru ke folder yang sama dan jalankan ulang plugin. Cara ini cocok untuk uji coba lokal; agar plugin muncul dan diperbarui untuk pengguna lain tanpa impor manual, plugin perlu dipublikasikan melalui Figma Community.

## Alur penggunaan

1. **Sync:** upload satu workbook XLSX. Setiap sheet berisi produk dibaca terpisah; sheet kosong diabaikan. Plugin mengenali judul kolom di baris pertama atau data produk yang dimulai langsung dari baris pertama. Untuk file tanpa judul, kolom sementara disusun sebagai `No`, `Products`, `USP`, `PRICE BEFORE`, `PRICE AFTER`, `DISC PDP`, lalu kolom berulang dengan nomor urut. Judul duplikat ditampilkan terpisah, misalnya `PRICE AFTER (2)`. Kolom produk, USP, harga, dan diskon dicocokkan otomatis dan dapat diubah.
2. **Template:** tandai satu artboard sebagai contoh. Pilih layer teks, lalu beri atau ubah tag **Products Name, USP, Old Price, Current Price, Discount**, atau **Custom**. Pilih **Tidak ditandai** untuk menghapus tag. Pilih artboard serupa untuk menerapkan tag sekaligus.
3. **Penanda Frame:** pilih artboard, lalu secara opsional pilih brand di **Tandai brand artboard** dan simpan. Penanda ini memilih sheet meski nama artboard tidak menyebut brand. Jika dibiarkan otomatis, nama artboard seperti `Wardah — 1` akan dicocokkan ke sheet Wardah. Duplikat artboard mewarisi brand, ID produk, dan tag layer. Duplikat dengan ID sama akan menerima data produk yang sama saat sync. Untuk memakai duplikat sebagai produk berbeda, pilih satu frame lalu ubah produknya di **Ganti produk untuk satu artboard**.
4. **Buat Artboard:** pilih sheet/brand dan batas jumlah produk per brand (0 berarti semua). Pilih artboard master yang sudah ditandai di tab **Template**. Jika brand master dikenali dari nama atau penandanya, hanya sheet brand itu yang bisa dipilih. Untuk brand lain, jadikan artboard brand tersebut sebagai master dan jalankan proses lagi. **Periksa artboard** menampilkan baris Excel yang akan dibuat; **Buat & isi** menggandakan desain, mengisi semua layer bertag dari kolom yang cocok, menata hasil di samping master, serta menyimpan ID dan penanda brand/sheet. Produk yang ID-nya sudah punya artboard pada halaman itu dilewati. Maksimum 500 artboard per proses.
5. Di **Sync**, pilih kolom dan artboard tujuan, lalu tekan **Periksa perubahan**. Tinjau hasilnya sebelum memilih **Terapkan**.

Untuk workbook dengan beberapa sheet, tiap artboard memakai penanda brand yang tersimpan. Jika belum ada, nama artboard digunakan untuk mencari nama sheet. Preview menampilkan nama sheet dan produk untuk memudahkan pengecekan. Kolom yang dibiarkan **Tidak digunakan** tidak diubah.

## Angka, mata uang, dan diskon

- Tidak ada konversi Rupiah atau mata uang lainnya. Teks disalin sebagai konten.
- XLSX dibaca beserta format sel: `0.2` yang diformat sebagai persentase menjadi `20%`; format kode `000` mempertahankan `001`.
- Pemisah desimal Excel dapat bergantung pada wilayah komputer. Pilih **Comma** atau **Dot** agar sesuai tampilan Excel. Isi teks dan CSV tidak diubah oleh pilihan ini.
- **Hapus simbol % dari teks diskon** aktif secara default untuk desain dengan simbol `%` pada layer terpisah. `20%` menjadi `20`. Jika tidak dicentang, hasilnya tetap `20%`. Layer simbol tidak dihapus.
- Tag lama `custom:disc` dan `custom:discount` dikenali sebagai Discount.
- Rumus memerlukan hasil yang sudah tersimpan dalam XLSX. Jika belum tersedia, buka dan simpan file di Excel lalu upload ulang.

## Perilaku saat ada masalah

Nomor produk kosong/berulang, pasangan yang tidak ditemukan, atau layer yang belum ditandai ditampilkan sebelum penerapan. Field yang tidak digunakan tidak menghasilkan peringatan. Sel kosong mempertahankan teks lama. Kegagalan satu field tidak menghentikan frame lainnya.

Plugin mempertahankan gaya teks dan memuat font sebelum mengganti karakter. Perubahan yang melintasi beberapa gaya berbeda ditolak dengan petunjuk untuk mengedit manual atau memisahkan layer. Panjang teks baru tetap dapat memengaruhi wrapping dan Auto Layout.

Kolom pilihan dan checkbox diskon disimpan di perangkat. File dan data spreadsheet hanya berada dalam sesi plugin yang sedang terbuka.

## Akses

Untuk tahap ini tidak ada daftar akun atau pembatasan akses di plugin. Siapa pun yang mengimpor paket lokal dapat menjalankannya pada file Figma yang bisa mereka edit. Data Excel tetap diproses di dalam sesi plugin dan tidak dikirim ke server.

## Verifikasi

```bash
npm run typecheck
npm test
npm audit --audit-level=moderate
```

`npm run typecheck` dan `npm run build` berhasil. Workbook `contoh xls.xlsx` sudah dibuka di preview plugin: produk Face wash Multivariant terbaca sebelum ACNE AND PORE CLEANSE, harga desimal dan diskon tampil, serta judul duplikat dipisahkan. Preview perubahan belum dikonfirmasi pada desain.
