import type { Env } from './db/repository';
import { ensureSession, resetSession } from './db/session';
import { getAvailability, getDestinations, getMergedTours, getOrder, listCustomerOrders, listOrders } from './db/repository';
import { quoteBooking, HttpError } from './services/booking';
import { createOrder, demoPayment, updateOrderStatus } from './services/orders';
import { addDirection, addTour, adminTours, patchTour, setAvailability, setPromo } from './services/admin';
import { getAnalytics, recordEvent } from './services/analytics';
import { getManagerOps, patchManagerOps, getOwnerOverview, patchOwnerSettings } from './services/operations';
import { flushTelegramOutbox, getIntegrationStatus, handleTelegramWebhook } from './services/notifications';
import { configureTelegramWebhook, getTelegramWebhookInfo } from './services/telegram-config';
import { getTildaIntegrationStatus, receiveTildaWebhook } from './services/tilda';
import { managerStatusSchema } from '../shared/schemas';

function json(data: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-max-tour-demo': '1',
      ...extraHeaders,
    },
  });
}

async function body(request: Request) {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Ожидается JSON', 'UNSUPPORTED_MEDIA_TYPE');
  try { return await request.json(); } catch { throw new HttpError(400, 'Некорректный JSON', 'INVALID_JSON'); }
}

function withCookie(response: Response, setCookie?: string) {
  if (!setCookie) return response;
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', setCookie);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function match(path: string, pattern: RegExp) {
  const result = path.match(pattern);
  return result ? result.slice(1).map(decodeURIComponent) : null;
}

function requiredIdempotencyKey(request: Request) {
  const key = request.headers.get('Idempotency-Key')?.trim() ?? '';
  if (!key || key.length > 128) throw new HttpError(400, 'Нужен корректный Idempotency-Key', 'IDEMPOTENCY_KEY_REQUIRED');
  return key;
}

function telegramWebhookAuthorized(request: Request, env: Env) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  return request.headers.get('X-Telegram-Bot-Api-Secret-Token') === expected;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (path === '/api/health' && request.method === 'GET') {
        const probe = await env.DB.prepare('SELECT 1 AS ok').first<{ok:number}>();
        return json({ ok: probe?.ok === 1, service: 'max-tour-demo', database: 'D1', time: new Date().toISOString() });
      }

      // External webhooks are intentionally outside browser demo-session creation.
      if (path === '/api/telegram/webhook' && request.method === 'POST') {
        if (!telegramWebhookAuthorized(request, env)) throw new HttpError(401, 'Неверный Telegram webhook secret', 'TELEGRAM_WEBHOOK_UNAUTHORIZED');
        if (!env.TELEGRAM_BOT_TOKEN?.trim()) throw new HttpError(503, 'Telegram bot token ещё не настроен', 'TELEGRAM_NOT_CONFIGURED');
        return json(await handleTelegramWebhook(env, await body(request)), 202);
      }
      if (path === '/api/tilda/webhook' && request.method === 'POST') {
        await receiveTildaWebhook(request, env);
        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }

      const session = await ensureSession(request, env);
      const finish = (r: Response) => withCookie(r, session.setCookie);

      if (path === '/api/session' && (request.method === 'GET' || request.method === 'POST')) {
        return finish(json({ ok: true, demoSession: true }));
      }
      if (path === '/api/demo/reset' && request.method === 'POST') {
        await resetSession(env, session.id);
        return finish(json({ ok: true, reset: true }));
      }

      if (path === '/api/integrations/telegram/status' && request.method === 'GET') {
        return finish(json(await getIntegrationStatus(env, session.id)));
      }
      if (path === '/api/integrations/telegram/flush' && request.method === 'POST') {
        return finish(json(await flushTelegramOutbox(env, session.id)));
      }
      if (path === '/api/integrations/telegram/webhook' && request.method === 'POST') {
        return finish(json(await configureTelegramWebhook(env, url.origin)));
      }
      if (path === '/api/integrations/telegram/webhook' && request.method === 'GET') {
        return finish(json(await getTelegramWebhookInfo(env)));
      }
      if (path === '/api/integrations/tilda/status' && request.method === 'GET') {
        return finish(json(await getTildaIntegrationStatus(env)));
      }

      if (path === '/api/destinations' && request.method === 'GET') return finish(json({ items: await getDestinations(env.DB, session.id) }));
      if (path === '/api/tours' && request.method === 'GET') {
        const all = await getMergedTours(env.DB, session.id);
        const publishedOnly = url.searchParams.get('admin') !== '1';
        return finish(json({ items: publishedOnly ? all.filter(t => t.published) : all }));
      }

      let m = match(path, /^\/api\/tours\/([^/]+)\/availability$/);
      if (m && request.method === 'GET') return finish(json({ items: await getAvailability(env.DB, session.id, m[0]), demo: true }));
      m = match(path, /^\/api\/tours\/([^/]+)$/);
      if (m && request.method === 'GET') {
        const tours = await getMergedTours(env.DB, session.id);
        const tour = tours.find(t => t.id === m![0] || t.slug === m![0]);
        if (!tour) throw new HttpError(404, 'Экскурсия не найдена', 'TOUR_NOT_FOUND');
        return finish(json({ item: tour }));
      }

      if (path === '/api/booking/quote' && request.method === 'POST') {
        const input = await body(request);
        const result = await quoteBooking(env, session.id, input);
        await recordEvent(env, session.id, { eventType: 'quote_created', source: result.draft.source, tourId: result.tour.id });
        return finish(json({ quote: result.quote }));
      }

      if (path === '/api/orders' && request.method === 'POST') {
        const input = await body(request);
        const idempotencyKey = requiredIdempotencyKey(request);
        const result = await quoteBooking(env, session.id, input);
        const order = await createOrder(env, session.id, result.draft, result.tour, result.quote, idempotencyKey);
        if (!order) throw new HttpError(500, 'Не удалось создать заказ', 'ORDER_CREATE_FAILED');
        const { raw: _raw, ...safe } = order;
        return finish(json({ order: safe }, 201));
      }
      m = match(path, /^\/api\/orders\/([^/]+)$/);
      if (m && request.method === 'GET') {
        const order = await getOrder(env.DB, session.id, m[0]);
        if (!order || Number(order.raw.customer_visible ?? 0) !== 1) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
        const { raw: _raw, ...safe } = order;
        return finish(json({ order: safe }));
      }
      if (path === '/api/my-trips' && request.method === 'GET') {
        return finish(json({ items: await listCustomerOrders(env.DB, session.id) }));
      }
      if (path === '/api/payments/demo' && request.method === 'POST') {
        const input: any = await body(request);
        const orderId = String(input?.orderId ?? '');
        if (!orderId) throw new HttpError(400, 'Не указан orderId', 'ORDER_ID_REQUIRED');
        const idempotencyKey = requiredIdempotencyKey(request);
        const order = await demoPayment(env, session.id, orderId, idempotencyKey);
        if (!order) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
        const { raw: _raw, ...safe } = order;
        return finish(json({ order: safe }));
      }

      if (path === '/api/manager/orders' && request.method === 'GET') return finish(json({ items: await listOrders(env.DB, session.id) }));
      m = match(path, /^\/api\/manager\/orders\/([^/]+)$/);
      if (m && request.method === 'GET') {
        const order = await getOrder(env.DB, session.id, m[0]);
        if (!order) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
        const { raw: _raw, ...safe } = order;
        return finish(json({ order: safe }));
      }
      m = match(path, /^\/api\/manager\/orders\/([^/]+)\/status$/);
      if (m && request.method === 'PATCH') {
        const parsed = managerStatusSchema.safeParse(await body(request));
        if (!parsed.success) throw new HttpError(400, 'Некорректный статус', 'VALIDATION_ERROR');
        const order = await updateOrderStatus(env, session.id, m[0], parsed.data.status);
        if (!order) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
        const { raw: _raw, ...safe } = order;
        return finish(json({ order: safe }));
      }

      m = match(path, /^\/api\/manager\/orders\/([^/]+)\/ops$/);
      if (m && request.method === 'GET') return finish(json({ ops: await getManagerOps(env, session.id, m[0]) }));
      if (m && request.method === 'PATCH') return finish(json({ ops: await patchManagerOps(env, session.id, m[0], await body(request)) }));

      if (path === '/api/owner/overview' && request.method === 'GET') return finish(json(await getOwnerOverview(env, session.id)));
      if (path === '/api/owner/settings' && request.method === 'PATCH') return finish(json(await patchOwnerSettings(env, session.id, await body(request))));

      if (path === '/api/admin/tours' && request.method === 'GET') return finish(json({ items: await adminTours(env, session.id) }));
      if (path === '/api/admin/tours' && request.method === 'POST') return finish(json({ item: await addTour(env, session.id, await body(request)) }, 201));
      m = match(path, /^\/api\/admin\/tours\/([^/]+)$/);
      if (m && request.method === 'PATCH') return finish(json({ item: await patchTour(env, session.id, m[0], await body(request)) }));
      m = match(path, /^\/api\/admin\/tours\/([^/]+)\/schedule$/);
      if (m && (request.method === 'POST' || request.method === 'PATCH')) return finish(json({ item: await setAvailability(env, session.id, m[0], await body(request)) }));
      m = match(path, /^\/api\/admin\/tours\/([^/]+)\/promo$/);
      if (m && (request.method === 'POST' || request.method === 'PATCH')) return finish(json({ item: await setPromo(env, session.id, m[0], await body(request)) }));
      if (path === '/api/admin/directions' && request.method === 'GET') return finish(json({ items: await getDestinations(env.DB, session.id) }));
      if (path === '/api/admin/directions' && request.method === 'POST') return finish(json({ item: await addDirection(env, session.id, await body(request)) }, 201));
      if (path === '/api/admin/analytics' && request.method === 'GET') return finish(json(await getAnalytics(env, session.id, url.searchParams)));

      if (path === '/api/analytics/event' && request.method === 'POST') {
        await recordEvent(env, session.id, await body(request));
        return finish(json({ ok: true }, 202));
      }

      return finish(json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } }, 404));
    } catch (error) {
      if (error instanceof HttpError) return json({ error: { code: error.code, message: error.message } }, error.status);
      console.error('Unhandled worker error', error instanceof Error ? error.message : 'unknown');
      return json({ error: { code: 'INTERNAL_ERROR', message: 'Временная ошибка сервиса. Повторите попытку.' } }, 500);
    }
  }
} satisfies ExportedHandler<Env>;
