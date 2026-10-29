# Operational scripts

Semua path/perintah di bawah dijalankan dari **root AssetHub**, kecuali disebutkan lain. Jangan menjalankan tool berdasarkan nama saja: baca guard, parameter, dan runbook yang sesuai. Perintah di sini adalah indeks, bukan instruksi menjalankan semuanya.

| Tool | Tujuan / syarat |
| --- | --- |
| `persistence-m0.mjs` | Backup dan restore verification PG17; baca [M0 recovery](../docs/architecture/M0_RECOVERY.md). Membaca `.env.local`, bisa memakai override environment. Membuat bundle dan database drill terisolasi. |
| `persistence-m0.test.mjs` | `node --test scripts/persistence-m0.test.mjs`; guard tanpa koneksi DB |
| `people-m1c.mjs`, `.d.mts` | Migrasi/import canonical People dengan exact target, checksum, verified bundle; baca [M1-C](../docs/architecture/M1_C_CANONICAL_PEOPLE_STORAGE.md) |
| `internal-contacts.mjs` | Migrasi dan import direktori kontak dengan bundle dan actor canonical; baca [spesifikasi kontak](../docs/domain/INTERNAL_CONTACT_DIRECTORY.md) |
| `booking-db.mjs`, `vendor-db.mjs` | Runner SQL/seed lama; membaca environment proses. **Bukan updater aman untuk database aktif.** |
| `extract-assets.py` | Ekstraksi workbook sumber ke data/media lokal; periksa kebutuhan Python, input, serta direktori output dalam script |
| `asset-import-mapping.mjs`, `.d.mts` | Mapping sumber impor yang dipakai pipeline dan tests |
| `import-assets.mjs`, `import-vendors.mjs` | Pipeline impor; baca [katalog](../docs/domain/ASSET_CATALOG_IMPORT.md) dan [Vendor](../docs/domain/VENDOR_MASTER_PERSISTENCE.md). Memerlukan environment proses; preview bukan jaminan tanpa file output. |
| `report-asset-upload-orphans.mjs` | Laporan file upload tanpa referensi; inspect target DB/media dan output, bukan tool hapus otomatis |
| `test-people-m1c.mjs`, `test-internal-contacts.mjs` | Test operasional terisolasi dengan baseline/recovery sesuai slice |
| `test-m1d-runtime.mjs` | Verifikasi runtime actor; baca [M1-D](../docs/architecture/M1_D_CANONICAL_API_INTEGRATION.md) |
| `test-asset-registration.mjs` | Test Gate 1, mengunci migration/bundle slice tersebut; baca [Gate 1](../docs/architecture/INVENTORY_GATE1_DURABLE_FOUNDATION.md) |
| `test-inventory-build.mjs`, `verify-inventory-browser.mjs` | Verifikasi Gate 2–4, memakai clone/driver dan baseline tertentu; baca [implementasi](../docs/architecture/INVENTORY_GATES_2_4_IMPLEMENTATION.md) |

Script yang mengunci baseline historis dapat sengaja menolak repo/schema lebih baru. Jangan mengedit migration lama, memakai database aktif sebagai target test, atau melemahkan guard untuk melewati penolakan.
