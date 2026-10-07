import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release');
const packageName = 'Channex-Content-Sync-Local';
const packageDir = path.join(release, packageName);
const zipPath = path.join(release, `${packageName}.zip`);

await readFile(path.join(root, 'dist', 'code.js'));
await readFile(path.join(root, 'dist', 'ui.html'));
await rm(packageDir, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(path.join(packageDir, 'dist'), { recursive: true });
await cp(path.join(root, 'manifest.json'), path.join(packageDir, 'manifest.json'));
await cp(path.join(root, 'dist', 'code.js'), path.join(packageDir, 'dist', 'code.js'));
await cp(path.join(root, 'dist', 'ui.html'), path.join(packageDir, 'dist', 'ui.html'));
await writeFile(path.join(packageDir, 'CARA-INSTAL.txt'), `CHANNEX CONTENT SYNC — INSTALASI LOKAL

1. Simpan dan ekstrak folder ini di komputer tujuan.
2. Buka Figma Desktop.
3. Pilih Plugins > Development > Import plugin from manifest...
4. Pilih file manifest.json di folder ini.
5. Jalankan Channex Content Sync dari Plugins > Development.

Jangan hapus atau pindahkan folder setelah diimpor. Figma menjalankan plugin dari file lokal ini.
Untuk memasang pembaruan, ganti isi folder ini dengan paket terbaru lalu jalankan ulang plugin.
`);
execFileSync('zip', ['-qr', zipPath, packageName], { cwd: release });
console.log(`Created ${zipPath}`);
