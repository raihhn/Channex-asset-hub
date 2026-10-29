# Handover developer

Dokumen ini menjelaskan repository aplikasi asli per 29 Oktober 2026. Spesifikasi produk tetap mengikuti [urutan otoritas](../00_README.md); catatan verifikasi lama bukan bukti runtime terkini.

## Urutan onboarding

1. Baca [README](../../README.md), [AI_GUIDE](../../AI_GUIDE.md), dan [indeks dokumentasi](../00_README.md).
2. Siapkan Node/npm dan [database beserta media](DATABASE_AND_MEDIA.md).
3. Telusuri satu flow dari route → feature → domain/service → repository/SQL sebelum mengubahnya.
4. Baca spesifikasi domain yang relevan, lalu jalankan pemeriksaan sesuai perubahan.

## Peta implementasi

| Kebutuhan | Mulai dari |
| --- | --- |
| Daftar route dan API | [src/app](../../src/app/) |
| Katalog, Inventory, registrasi/edit aset | [src/features/assets](../../src/features/assets/), [src/server/assets](../../src/server/assets/), [src/lib/server/assets.ts](../../src/lib/server/assets.ts) |
| Booking dan request | [src/features/requests](../../src/features/requests/), [src/lib/server/booking.ts](../../src/lib/server/booking.ts) |
| Vendor | [src/lib/server/vendors.ts](../../src/lib/server/vendors.ts), [spesifikasi](../domain/VENDOR_MASTER_PERSISTENCE.md) |
| Canonical People, session dan actor | [src/server/auth](../../src/server/auth/), [src/server/people](../../src/server/people/), [M1-D](../architecture/M1_D_CANONICAL_API_INTEGRATION.md) |
| Kontak internal/PIC | [src/server/contacts](../../src/server/contacts/), [spesifikasi](../domain/INTERNAL_CONTACT_DIRECTORY.md) |
| Komposisi state prototype | [prototype-provider.tsx](../../src/features/prototype/prototype-provider.tsx) |
| Validasi dan aturan domain | [src/lib/domain](../../src/lib/domain/) |
| Desain bersama | [tokens.css](../../src/styles/tokens.css), [design system](../design/DESIGN_SYSTEM.md) |

Dua direktori server mencerminkan migrasi bertahap: service lama ada di `src/lib/server`, boundary yang lebih baru ada di `src/server`. Keduanya masih digunakan. Jangan menghapus atau menggabungkan hanya karena namanya serupa. Import alias `@/` menunjuk ke `src/`.

## Status yang perlu dipahami

- PostgreSQL menyimpan data katalog, Vendor, canonical People/kontak, dan bagian booking/Inventory yang sudah diimplementasikan. Baca [migrations](../../db/README.md) serta dokumen implementasi untuk batas tiap slice.
- Provider prototype masih mengelola sebagian workflow dan state browser. Periksa pemanggil API dan service; jangan menganggap setiap mutasi UI sudah durable.
- Current user lokal menggunakan cookie dengan actor canonical, origin yang cocok, dan listener loopback. Mengubah role tampilan tidak memberikan hak server.
- Adapter login provider produksi belum diimplementasikan (`PROVIDER_UNCONFIGURED`). Supabase di ADR adalah arah target, bukan dependency runtime yang sudah aktif.
- New Request: **Usage & Dates → Select Assets → Fulfillment → Review & Submit**. Readiness adalah validasi inline.
- HeroUI React v3 adalah satu-satunya component library. Untuk UI, ikuti skill lokal, token bersama, dan verifikasi desktop/mobile.

## Dokumen implementasi

- [Rencana Inventory yang disetujui](../architecture/INVENTORY_APPROVED_PLAN.md): scope, keputusan, dan batas implementasi.
- [Gate 1](../architecture/INVENTORY_GATE1_DURABLE_FOUNDATION.md) dan [Gate 2–4](../architecture/INVENTORY_GATES_2_4_IMPLEMENTATION.md): detail implementasi dan hasil verifikasi pada saat slice dikerjakan.
- [M0 recovery](../architecture/M0_RECOVERY.md), [M1-C](../architecture/M1_C_CANONICAL_PEOPLE_STORAGE.md), [M1-D](../architecture/M1_D_CANONICAL_API_INTEGRATION.md): evolusi persistence/identity.

Path dalam blok kode dokumen implementasi mengikuti root repo. Link navigasi memakai path relatif agar bisa dibaca di GitHub.

Proposal yang sudah digantikan, catatan V1, QA lama, dan laporan M1-B disimpan di `.local/handover-archive/2026-10-29/` pada mesin sumber, di luar Git. Plugin Figma Channex Content Sync juga dipisahkan ke `.local/companion-projects/channex-content-sync/`. Keduanya bukan dependency untuk build aplikasi dan tidak diperlukan saat clone repo utama.

## Verifikasi

| Pemeriksaan | Perintah dan syarat |
| --- | --- |
| Tipe aplikasi | `npm run typecheck` |
| Lint aplikasi | `npm run lint`; data privat/generated dikecualikan |
| Suite Vitest standar | `npm test`; booking persistence dikecualikan oleh package script |
| Guard recovery tanpa DB | `node --test scripts/persistence-m0.test.mjs` |
| Playwright prototype | `npm run test:e2e`; periksa konfigurasi/server serta target sebelum menjalankan |
| Booking durable | `npm run test:booking:db` / `npm run test:booking:e2e`; wajib database test terisolasi |
| Vendor durable | `npm run test:vendor:db`; wajib target test sesuai guard suite |
| Test slice Inventory/People/kontak | [Indeks scripts](../../scripts/README.md); membutuhkan bundle/snapshot dan versi schema tertentu |

Jangan jalankan semua tool operasional sekaligus. Beberapa test lama memang mengunci daftar migrations/baseline milik slice tertentu dan dapat menolak schema yang lebih baru. Periksa guard sebelum memilih bundle. Kegagalan guard bukan alasan mengubah checksum migration atau melemahkan validasi.

## Sebelum handover / push

1. Review `git diff` dan `git status`; pastikan source, SQL, dan dokumentasi yang dimaksud masuk commit.
2. Bagikan `.env.local`, database, dan media melalui jalur privat terpisah sesuai [runbook](DATABASE_AND_MEDIA.md). Jangan menambahkan seluruh `.local` ke Git.
3. Catat hasil pemeriksaan aktual dan batas yang belum diverifikasi.
4. Demo Sites tetap project tersendiri; [panduan Sites](SITES_DEMO.md) menjelaskan lokasi dan perbedaannya.

## Status verifikasi handover

Pemeriksaan 29 Oktober 2026: typecheck dan lint lolos; 4 test guard M0 lolos. Suite utama menghasilkan 274 pass, 2 fail, dan 63 skip. Source aplikasi dan tests tidak berubah dalam cleanup. Database integration/E2E, restore drill, dan deployment tidak dilakukan.

Dua kegagalan yang perlu ditangani developer:

- `tests/reservations.test.ts`: fixture mengharapkan aset bebas setelah planned inbound 15 Oktober, tetapi saat test dijalankan tanggal itu sudah lewat dan belum ada actual inbound. Gunakan argumen `now` eksplisit untuk kasus overlap terjadwal, serta pertahankan pengujian overdue tanpa melemahkan aturan receipt.
- `tests/reporting.test.tsx`: fixture masih mengasumsikan default Super Admin, padahal provider sekarang memerlukan identitas yang sah. Siapkan actor/session test dan tunggu state siap sebelum memeriksa validasi financial reference. Test ini juga mengeluarkan peringatan React `act(...)`.
