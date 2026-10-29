# Database artifacts

Database aplikasi asli adalah PostgreSQL. Baca [runbook database/media](../docs/handover/DATABASE_AND_MEDIA.md) sebelum menjalankan tool.

| Rentang SQL | Domain |
| --- | --- |
| `0001`–`0002` | Booking foundation dan item inbound |
| `0003`–`0004` | Vendor master dan source import rows |
| `0005`–`0007` | Katalog aset, internal warehouses, audit impor |
| `0008` | Recovery baseline dan provenance |
| `0009` | Canonical People |
| `0010` | Direktori kontak internal |
| `0011`–`0013` | Registrasi aset, dokumentasi, dan nomor aset |

`migrations/` menyimpan histori schema dan kontrak yang dipakai operator/tests. Nomor file tidak berarti semuanya aman dieksekusi ulang. Runner booking lama bukan migration manager incremental.

Input impor aset/Vendor disediakan operator secara privat di `db/imports/`; input seed Vendor lokal memakai `db/seeds/vendor_initial.json`. `seeds/booking_demo.sql` berisi fixture demo booking. Input operasional tidak termasuk clone source.

Snapshot database dan media berada di luar Git. Untuk handover lengkap, sertakan recovery bundle terverifikasi melalui jalur privat.
