import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

await import('../build.mjs');

const root = resolve(import.meta.dirname, '..');
const src = resolve(root, 'src/client-demo');
const dist = resolve(root, 'dist');

await copyFile(resolve(src,'index.html'), resolve(dist,'index.html'));
await copyFile(resolve(src,'styles.css'), resolve(dist,'client-demo.css'));
await copyFile(resolve(src,'app.js'), resolve(dist,'client-demo.js'));
await copyFile(resolve(src,'ui-locales.js'), resolve(dist,'client-ui-locales.js'));
await mkdir(resolve(dist,'client-locales'), {recursive:true});
await copyFile(resolve(src,'vi-tours.json'), resolve(dist,'client-locales/vi-tours.json'));
await copyFile(resolve(src,'en-tours.json'), resolve(dist,'client-locales/en-tours.json'));

await rm(resolve(dist,'admin'), {recursive:true,force:true});
await rm(resolve(dist,'director'), {recursive:true,force:true});

console.log('Built white-label VI/EN client-only tour operator demo.');
