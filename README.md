# AssetHub V2

Aplikasi internal untuk katalog aset, Inventory, request/booking, dan operasi aset event. **Repo utama ini menggunakan Next.js + PostgreSQL.** Demo Sites adalah salinan terpisah; lihat [panduan Sites](docs/handover/SITES_DEMO.md).

## Mulai membaca

1. [Handover developer](docs/handover/DEVELOPER_GUIDE.md): peta kode, status implementasi, dan urutan kerja.
2. [Setup database dan media](docs/handover/DATABASE_AND_MEDIA.md): kebutuhan data di luar Git dan cara memulihkan environment.
3. [Indeks spesifikasi](docs/00_README.md): aturan produk dan urutan otoritas dokumen.
4. [AI_GUIDE.md](AI_GUIDE.md) dan [AGENTS.md](AGENTS.md): konvensi implementasi untuk kontributor/agent.

## Menjalankan lokal

Gunakan Node.js 22 (verifikasi handover memakai 22.22.3), npm, dan PostgreSQL 17 untuk fitur persisten. Jalankan dari root repo yang memiliki package `assethub-v2`.

```sh
npm ci
cp .env.example .env.local
```

Lengkapi `.env.local`, lalu siapkan database dan media sesuai [runbook](docs/handover/DATABASE_AND_MEDIA.md). `cp` hanya untuk clone baru; pertahankan `.env.local` yang sudah ada. Setelah data siap:

```sh
npm run dev -- --hostname 127.0.0.1
```

Buka `http://127.0.0.1:3000`. Origin harus sesuai `ASSETHUB_LOCAL_ACTOR_ORIGIN`. Pilih current user melalui UI lokal untuk membuat sesi development; role di state tampilan saja bukan otorisasi server.

**Clone GitHub tidak menyertakan database aktif, foto privat, atau sesi browser.** Tanpa data lokal, sebagian tampilan prototype bisa terbuka tetapi fitur database belum siap. Belum ada bootstrap database kosong yang memulihkan seluruh state operasional dengan satu perintah.

## Struktur

| Folder | Isi |
| --- | --- |
| `src/app/` | Route Next.js, layout, dan API |
| `src/features/` | Komposisi layar dan alur fitur |
| `src/components/` | Komponen bersama dan komponen domain |
| `src/lib/domain/` | Aturan bisnis dan validasi |
| `src/lib/server/`, `src/server/` | Service PostgreSQL, identitas, otorisasi, media |
| `src/styles/`, `src/types/` | Token desain dan tipe bersama |
| `db/` | SQL migrations dan fixture demo; input operasional disediakan privat |
| `scripts/` | Tool impor, recovery, serta verifikasi operasional; [indeks](scripts/README.md) |
| `tests/` | Unit, integrasi, dan Playwright |
| `docs/` | Spesifikasi aktif, arsitektur, dan panduan handover |
| `.local/` | Data privat/generated lokal; diabaikan Git |

## Pemeriksaan

```sh
npm run typecheck
npm run lint
npm test
node --test scripts/persistence-m0.test.mjs
```

Suite database/E2E memerlukan setup terpisah; baca [panduan testing](docs/handover/DEVELOPER_GUIDE.md#verifikasi) sebelum menjalankannya. Jangan gunakan database aktif sebagai target test, seed, atau migrate-all.

## Batas saat ini

Sebagian workflow masih memakai state prototype; keberadaan halaman tidak membuktikan seluruh workflow sudah persisten. Identitas development berbasis loopback bukan login produksi. ADR Supabase menjelaskan target infrastruktur, sedangkan implementasi asli saat ini memakai PostgreSQL lokal. Lihat [production readiness](docs/architecture/PRODUCTION_READINESS.md) sebelum deployment produksi.
