import profileWorker from './worker-profile.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

const ADMIN_HOST = 'max-tour-demo-admin.viiversion.com';
const ADMIN_SHARED_ASSETS = new Set([
  '/max-tour-logo.svg',
  '/admin-app.css',
  '/admin-app.js',
  '/production-embed-polish.css',
  '/production-embed-polish.js',
]);

const ADMIN_ROLE_FILTER = `
<style id="max-tour-admin-role-filter-style">.role-switch a[href="/"]{display:none!important}</style>
<script id="max-tour-admin-role-filter-script">document.querySelectorAll('.role-switch a[href="/"]').forEach((item)=>item.remove());</script>`;

function mediaKey(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice('/tour-media/'.length));
  } catch {
    return '';
  }
  if (!/^[a-z0-9-]+\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|avif)$/i.test(decoded)) return '';
  if (decoded.split('/').some(part => !part || part === '.' || part === '..')) return '';
  return decoded;
}

async function serveTourMedia(request, env, pathname) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  if (!env.TOUR_MEDIA) return new Response('Tour media storage unavailable', { status: 503 });

  const key = mediaKey(pathname);
  if (!key) return new Response('Bad media path', { status: 400 });

  const object = request.method === 'HEAD'
    ? await env.TOUR_MEDIA.head(key)
    : await env.TOUR_MEDIA.get(key);
  if (!object) return new Response('Not Found', { status: 404 });

  const ext = key.split('.').pop().toLowerCase();
  const headers = new Headers({
    'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'content-length': String(object.size),
  });
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  if (object.uploaded) headers.set('last-modified', new Date(object.uploaded).toUTCString());

  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

function isAdminHostAllowedPath(pathname) {
  return pathname === '/' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/director' ||
    pathname.startsWith('/director/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/tour-media/') ||
    ADMIN_SHARED_ASSETS.has(pathname);
}

function routeAdminHost(url) {
  if (url.hostname !== ADMIN_HOST) return null;
  if (url.pathname === '/') return Response.redirect(new URL('/admin/', url), 302);
  if (url.pathname === '/director') return Response.redirect(new URL('/director/', url), 308);
  if (!isAdminHostAllowedPath(url.pathname)) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  return null;
}

async function filterAdminHostRoles(response, url) {
  if (url.hostname !== ADMIN_HOST) return response;
  if (!(url.pathname.startsWith('/admin') || url.pathname.startsWith('/director'))) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/html')) return response;

  const html = await response.text();
  const filteredHtml = html.includes('</body>')
    ? html.replace('</body>', `${ADMIN_ROLE_FILTER}</body>`)
    : `${html}${ADMIN_ROLE_FILTER}`;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(filteredHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const adminHostResponse = routeAdminHost(url);
    if (adminHostResponse) return adminHostResponse;
    if (url.pathname.startsWith('/tour-media/')) {
      return serveTourMedia(request, env, url.pathname);
    }
    const response = await profileWorker.fetch(request, env, ctx);
    return filterAdminHostRoles(response, url);
  },
};
