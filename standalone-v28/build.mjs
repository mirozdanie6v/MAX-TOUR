import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname);
const dist = resolve(root, 'dist');
const sourceDir = resolve(root, 'source');
const manifest = JSON.parse(await readFile(resolve(sourceDir, 'manifest.json'), 'utf8'));

async function restore(entry) {
  const encoded = (await Promise.all(entry.parts.map(p => readFile(resolve(sourceDir, p), 'ascii')))).join('');
  const raw = gunzipSync(Buffer.from(encoded,'base64'));
  const sha = createHash('sha256').update(raw).digest('hex');
  if (raw.length !== entry.size_bytes) throw new Error(`${entry.original_name}: size mismatch`);
  if (sha !== entry.sha256) throw new Error(`${entry.original_name}: checksum mismatch`);
  return raw;
}

const [prototypeRaw, catalogRaw, adminPrototype, directorPrototype] = await Promise.all([
  restore(manifest.html),
  restore(manifest.catalog),
  readFile(resolve(root, 'src/admin-v3.html'), 'utf8'),
  readFile(resolve(root, 'src/director-v3.html'), 'utf8'),
]);
const prototypeHtml = prototypeRaw.toString('utf8');
const catalog = JSON.parse(catalogRaw.toString('utf8'));
if (!Array.isArray(catalog) || catalog.length < 1) throw new Error('v28 catalog must be a non-empty array');
if (!prototypeHtml.includes('MaxTour Mini App Prototype v28')) throw new Error('Unexpected prototype source');
if (!prototypeHtml.includes('const TOURS =')) throw new Error('Prototype does not contain expected catalog binding');

function replaceLegacyAdmin(html) {
  const oldEntry = "function showAdmin() { showScreen('admin'); }";
  const adminStart = html.indexOf('function renderAdmin() {');
  const adminEndMarker = '\nrenderHome();';
  const adminEnd = html.indexOf(adminEndMarker, adminStart);
  if (!html.includes(oldEntry)) throw new Error('Prototype admin entry point was not found');
  if (adminStart < 0 || adminEnd < 0) throw new Error('Prototype legacy admin renderer was not found');

  const withoutLegacyAdmin = `${html.slice(0, adminStart)}function renderAdmin() { window.location.assign('/admin/'); }${html.slice(adminEnd)}`;
  return withoutLegacyAdmin.replace(oldEntry, "function showAdmin() { window.location.assign('/admin/'); }");
}

const brandLogoPath = '/max-tour-logo.svg';

function replaceBrandLogos(html) {
  let replacements = 0;
  const replace = (pattern, markup) => {
    html = html.replace(pattern, () => {
      replacements += 1;
      return markup;
    });
  };

  replace(
    /<img\s+src="data:image\/png;base64,[^"]+"\s+alt="Max Tour — Экскурсионное бюро"\s+loading="eager">/g,
    `<img src="${brandLogoPath}" alt="Max Tour — Экскурсионное бюро" loading="eager">`,
  );
  replace(
    /<img\s+alt="MaxTour"\s+src="data:image\/png;base64,[^"]+">/g,
    `<img alt="MaxTour" src="${brandLogoPath}">`,
  );
  replace(
    /const logoSrc = "data:image\/png;base64,[^"]+";/g,
    `const logoSrc = '${brandLogoPath}';`,
  );

  if (replacements === 0) throw new Error('Brand logo was not found in HTML');
  return html;
}

const telegramSdk = '<script src="https://telegram.org/js/telegram-web-app.js?63"></script>';
const analyticsTracker = '<script defer src="https://dashboard.viiversion.com/tracker.js" data-project="MAX TOUR Demo"></script>';

function withViiversionAnalytics(html) {
  let result = html;
  if (!result.includes('telegram-web-app.js')) {
    if (!result.includes('</head>')) throw new Error('HTML has no </head> marker');
    result = result.replace('</head>', `${telegramSdk}\n</head>`);
  }
  if (!result.includes('dashboard.viiversion.com/tracker.js')) {
    if (!result.includes('</body>')) throw new Error('HTML has no </body> marker');
    result = result.replace('</body>', `${analyticsTracker}\n</body>`);
  }
  return result;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await mkdir(resolve(dist, 'admin'), { recursive: true });
await mkdir(resolve(dist, 'director'), { recursive: true });
const marker = '</body>';
const injection = '<script src="/booking-pricing.js"></script>\n<script src="/traveler-profile.js"></script>\n<link rel="stylesheet" href="/traveler-picker-list.css">\n<script src="/trip-actions.js"></script>\n<link rel="stylesheet" href="/hero-redesign.css">\n<script src="/hero-redesign.js"></script>\n<link rel="stylesheet" href="/role-switch.css">\n<script src="/role-switch.js"></script>\n<script src="/runtime-api.js" defer></script>\n';
if (!prototypeHtml.includes(marker)) throw new Error('Prototype has no </body> marker');
const builtHtml = withViiversionAnalytics(replaceBrandLogos(replaceLegacyAdmin(prototypeHtml)).replace(marker, `${injection}${marker}`));
await writeFile(resolve(dist, 'index.html'), builtHtml, 'utf8');
await writeFile(resolve(dist, 'catalog.v28.json'), catalogRaw);
await copyFile(resolve(root, 'src/booking-pricing.js'), resolve(dist, 'booking-pricing.js'));
await copyFile(resolve(root, 'src/traveler-profile.js'), resolve(dist, 'traveler-profile.js'));
await copyFile(resolve(root, 'src/traveler-picker-list.css'), resolve(dist, 'traveler-picker-list.css'));
await copyFile(resolve(root, 'src/trip-actions.js'), resolve(dist, 'trip-actions.js'));
await copyFile(resolve(root, 'src/hero-redesign.css'), resolve(dist, 'hero-redesign.css'));
await copyFile(resolve(root, 'src/hero-redesign.js'), resolve(dist, 'hero-redesign.js'));
await copyFile(resolve(root, 'src/role-switch.css'), resolve(dist, 'role-switch.css'));
await copyFile(resolve(root, 'src/role-switch.js'), resolve(dist, 'role-switch.js'));
await copyFile(resolve(root, 'src/max-tour-logo.svg'), resolve(dist, 'max-tour-logo.svg'));
const adminBuilt = withViiversionAnalytics(replaceBrandLogos(adminPrototype)
  .replace('</head>', '<link rel="stylesheet" href="/admin-app.css">\n</head>')
  .replace('</body>', '<script src="/admin-app.js" defer></script>\n</body>'));
await writeFile(resolve(dist, 'admin/index.html'), adminBuilt, 'utf8');
await writeFile(resolve(dist, 'director/index.html'), withViiversionAnalytics(directorPrototype), 'utf8');
await copyFile(resolve(root, 'src/admin-app.css'), resolve(dist, 'admin-app.css'));
await copyFile(resolve(root, 'src/admin-app.js'), resolve(dist, 'admin-app.js'));
await copyFile(resolve(root, 'src/runtime-api.js'), resolve(dist, 'runtime-api.js'));
console.log(`Built standalone v28: ${catalog.length} tours + admin v3 + director v3 + Telegram analytics; exact source checksums verified.`);
