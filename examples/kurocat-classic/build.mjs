import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const directory = fileURLToPath(new URL('.', import.meta.url));
const result = await build({
  absWorkingDir: directory, entryPoints: ['preview.ts'], bundle: true,
  format: 'iife', target: 'es2020', minify: true, write: false,
  loader: { '.png': 'dataurl' },
});
const template = await readFile(resolve(directory, 'preview.template.html'), 'utf8');
const notices = await Promise.all(['upstream/LICENSE', 'upstream/src/assets/dafeiyu/LICENSE-MIT.txt']
  .map(name => readFile(resolve(directory, name), 'utf8')));
const script = '/*\n' + notices.join('\n\n') + '\n*/\n' + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
await writeFile(resolve(process.argv[2] || 'KuroCat-Classic.html'), template.replace('/* BUNDLE */', () => script));
