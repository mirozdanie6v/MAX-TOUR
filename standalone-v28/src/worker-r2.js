import profileWorker from './worker-profile.js';

const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/tour-media/')) {
      return serveTourMedia(request, env, url.pathname);
    }
    return profileWorker.fetch(request, env, ctx);
  },
};
