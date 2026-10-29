# Demo Sites

## Identitas dan lokasi

- URL demo saat handover: https://assethub.business-3650.chatgpt.site
- Sites project ID: `appgprj_6ae2a8f762688191835d16d1ea2932d4`
- Source lokal: `.local/sites/assethub-internal/`, relatif terhadap root AssetHub.
- Folder tersebut adalah **repository Git terpisah**, diabaikan Git repo utama. Push aplikasi asli tidak menyertakan source demo.

Dokumen ini mencatat konfigurasi source saat handover; status hosting tidak diperiksa ulang dalam cleanup repository. Jika developer perlu memelihara demo, transfer/clone repository demo secara terpisah melalui pemilik Sites. Jangan membuka ignore seluruh `.local` untuk memasukkannya ke repo utama.

## Perbedaan dengan aplikasi asli

| Bagian | Aplikasi asli | Demo Sites |
| --- | --- | --- |
| Runtime | Next.js Node | Vinext/Vite dan Workers |
| Database | PostgreSQL relasional | D1 dengan adapter dokumen JSON dari data sumber |
| Media | Penyimpanan lokal privat + signed reads | Foto impor statis `public/source-media`, upload baru di R2 |
| Identitas | Actor canonical + sesi development loopback | Default System Admin untuk semua pengunjung demo |
| Build | `npm run build` di root utama | Script build milik repo demo |

Default System Admin di Sites memang diminta untuk mencoba seluruh menu. Data demo dibagi antar pengunjung dan dapat berubah bersama. Ini bukan model hak akses produksi, dan bypass demo tersebut tidak dipindahkan ke aplikasi asli.

Konversi mempertahankan informasi sumber untuk demo; D1 bukan implementasi PostgreSQL schema/RLS yang setara. Perubahan SQL di repo utama tidak otomatis mengubah DB demo. Foto, seed snapshot, dan adapter demo memiliki siklus update sendiri.

## Titik masuk untuk developer demo

Baca `SITES_MIGRATION.md`, `.openai/hosting.json`, `package.json`, `vite.config.ts`, `worker/index.ts`, dan adapter database/media dalam repo demo. Catatan migrasi berisi histori konfigurasi; perilaku System Admin sekarang menggantikan persona preview sebelumnya.

- `.openai/hosting.json` menghubungkan project dengan D1 binding `DB` dan R2 binding `BUCKET`.
- Pertahankan konfigurasi build `preserveEntrySignatures: "strict"` dan `minifyInternalExports: false`; keduanya terkait kompatibilitas navigasi produksi.
- `export-source.mjs` adalah tool migrasi dari aplikasi asli dan masih bergantung pada struktur folder/dependency sumber. Periksa path dan target sebelum mengekspor ulang.
- Script verifikasi migrasi/concurrency lama mungkin masih berasumsi akses memerlukan sign-in/persona. Review asumsi tersebut terhadap mode demo System Admin sebelum dipakai.
- Verifikasi yang menulis data hanya dijalankan terhadap storage lokal/terisolasi. Build lokal saja tidak memperbarui deployment Sites.

Cleanup aplikasi asli ini tidak mengubah source, database, audience, atau deployment demo Sites.
