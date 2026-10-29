# Database dan media untuk handover

## Yang masuk Git dan yang harus ditransfer terpisah

| Komponen | Lokasi | Ikut clone? |
| --- | --- | --- |
| Struktur SQL | `db/migrations/0001` sampai `0013` | Ya |
| Input impor aset/Vendor | Disediakan operator secara privat | Tidak |
| Demo booking seed | `db/seeds/booking_demo.sql` | Ya; bukan snapshot database aktif |
| Database PostgreSQL aktif | Cluster lokal di luar source | Tidak |
| Foto/media privat | `.local/asset-media/` atau `ASSETHUB_ASSET_MEDIA_ROOT` | Tidak |
| Recovery bundle terverifikasi | `.local/recovery/` | Tidak |
| Secrets dan konfigurasi operator | `.env.local` | Tidak |
| State prototype | Storage/session browser | Tidak |

Input impor adalah sumber operasional yang masih dipakai tool, sehingga dipertahankan. Jangan menganggap JSON impor atau demo seeds cukup untuk mengembalikan semua relasi, canonical People, audit, receipts, dan mutasi terbaru.

## Konfigurasi aplikasi asli

Salin `.env.example` ke `.env.local` hanya pada clone baru. Isi:

- `ASSETHUB_DATABASE_URL`: database development PostgreSQL 17 yang sudah dipulihkan/tersedia. Port contoh `54329` bukan service yang otomatis dibuat repo.
- `NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED`: mengaktifkan jalur booking durable.
- `ASSETHUB_VENDOR_ENABLED`: mengaktifkan Vendor master lokal.
- `ASSETHUB_ACTOR_MODE=local-development`: identitas development; `provider` belum memiliki adapter produksi.
- `ASSETHUB_LOCAL_ACTOR_ORIGIN=http://127.0.0.1:3000`: harus cocok dengan URL browser dan listener loopback. Gunakan `npm run dev -- --hostname 127.0.0.1`.
- `ASSETHUB_MEDIA_SIGNING_KEY`: secret lokal untuk signed media; buat dengan `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` lalu simpan hanya di `.env.local`.
- `ASSETHUB_ASSET_MEDIA_ROOT`: opsional, default `.local/asset-media` dari working directory aplikasi.
- `ASSETHUB_PG_BIN`: opsional untuk tool operator; default Homebrew `/opt/homebrew/opt/postgresql@17/bin`.

Next memuat `.env.local` sendiri. Tool `scripts/` berbeda-beda: sebagian membaca file itu, sebagian hanya membaca environment proses. Ikuti [indeks scripts](../../scripts/README.md), jangan menampilkan connection string dalam log.

## Jalur yang disarankan: handover dari snapshot terverifikasi

1. Pada mesin sumber, baca [runbook M0](../architecture/M0_RECOVERY.md). Hindari penulisan aplikasi selama capture. Pastikan PG17 client tools dan izin membuat database drill tersedia.
2. Jalankan `node --test scripts/persistence-m0.test.mjs`, lalu `node scripts/persistence-m0.mjs backup-verify` dari root. Ini menulis bundle privat, membuat database restore sementara untuk verifikasi, lalu menghapus database sementara miliknya. Database sumber tidak dimigrasi.
3. Transfer bundle yang berhasil diverifikasi beserta source revision terkait melalui jalur privat. Bundle berisi dump, manifests, migration artifacts, dan media. Jangan push bundle ke GitHub.
4. Pada mesin penerima, ikuti bagian **Actual recovery** dalam runbook M0: restore ke database **baru** dan direktori media **baru**, lalu cocokkan manifest/checksum serta sequence state. Nama role/ownership perlu disesuaikan oleh operator bila berpindah cluster; jangan mengabaikan error restore.
5. Arahkan `.env.local` ke database/media hasil restore setelah validasi. Jalankan development server di loopback, pilih current user lokal, dan cek katalog, Inventory, detail aset, serta foto.

Tool M0 saat ini membaca pohon media default `.local/asset-media` secara langsung. Bila aplikasi menggunakan `ASSETHUB_ASSET_MEDIA_ROOT` khusus, jangan menganggap capture default mencakup direktori itu; operator harus menyesuaikan prosedur capture dan memverifikasi manifest media yang benar sebelum transfer.

Belum ada container/installer PostgreSQL atau initializer kosong yang mencakup seluruh histori schema dan data. Jangan menyebut setup ini satu-perintah. Untuk environment kosong, developer perlu merancang bootstrap terisolasi dan memverifikasinya sebagai pekerjaan terpisah.

## Migrasi dan test

**Jangan gunakan `npm run db:booking:migrate` sebagai perintah update database aktif.** Runner lama membaca semua SQL bernomor dan mengeksekusinya ulang tanpa ledger incremental. Opsi `db:booking:seed` juga menjalankan runner itu sebelum seed.

Tool `people-m1c.mjs` dan `internal-contacts.mjs` memiliki target/checksum/bundle guard sesuai slice. Test Inventory juga membatasi versi baseline. Baca runbook yang dirujuk sebelum menjalankan. File migrations historis tidak diedit atau diurutkan ulang dalam cleanup ini.

Seluruh test data-writing harus memakai database test/clone terisolasi yang disetujui guard suite. Menjalankan `npm test` tidak membuktikan migrasi, restore, ataupun parity produksi berhasil.
