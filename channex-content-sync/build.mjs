import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/code.ts'], outfile: 'dist/code.js', bundle: true, platform: 'browser', target: 'es2020' });
const ui = await build({ entryPoints: ['src/ui.ts'], bundle: true, platform: 'browser', target: 'es2020', write: false, format: 'iife' });
const css = await readFile('src/ui.css', 'utf8');
const js = ui.outputFiles[0].text.replaceAll('</script', '<\\/script');
await writeFile('dist/ui.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="app"></main><script>${js}</script></body></html>`);
