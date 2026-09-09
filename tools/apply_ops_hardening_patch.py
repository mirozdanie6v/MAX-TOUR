from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


index_path = Path('src/worker/index.ts')
index = index_path.read_text()
index = replace_once(
    index,
    "import { authenticateTelegramStaff, getAuthReadiness, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';",
    "import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';",
    'telegram-auth import',
)
index = replace_once(
    index,
    "async function body(request: Request) {\n  const type = request.headers.get('content-type') ?? '';\n  if (!type.includes('application/json')) throw new HttpError(415, 'Ожидается JSON', 'UNSUPPORTED_MEDIA_TYPE');\n  try { return await request.json(); } catch { throw new HttpError(400, 'Некорректный JSON', 'INVALID_JSON'); }\n}",
    "async function body(request: Request) {\n  const type = request.headers.get('content-type') ?? '';\n  if (!type.includes('application/json')) throw new HttpError(415, 'Ожидается JSON', 'UNSUPPORTED_MEDIA_TYPE');\n  const declaredLength = Number(request.headers.get('content-length') ?? 0);\n  if (Number.isFinite(declaredLength) && declaredLength > 131072) throw new HttpError(413, 'JSON-запрос слишком большой', 'PAYLOAD_TOO_LARGE');\n  const raw = await request.text();\n  if (new TextEncoder().encode(raw).byteLength > 131072) throw new HttpError(413, 'JSON-запрос слишком большой', 'PAYLOAD_TOO_LARGE');\n  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Некорректный JSON', 'INVALID_JSON'); }\n}",
    'bounded JSON body parser',
)
index = replace_once(
    index,
    "      'x-max-tour-demo': '1',",
    "      'x-max-tour-demo': '1',\n      'x-content-type-options': 'nosniff',\n      'referrer-policy': 'strict-origin-when-cross-origin',\n      'permissions-policy': 'camera=(), microphone=(), geolocation=()',",
    'API security headers',
)
index = replace_once(
    index,
    "    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);",
    "    if (!path.startsWith('/api/')) {\n      const asset = await env.ASSETS.fetch(request);\n      const headers = new Headers(asset.headers);\n      headers.set('X-Content-Type-Options','nosniff');\n      headers.set('Referrer-Policy','strict-origin-when-cross-origin');\n      headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');\n      return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});\n    }",
    'asset security headers',
)
index = replace_once(
    index,
    "      if (path === '/api/manager/orders' && request.method === 'GET') return finish(json({ items: await listOrders(env.DB, session.id) }));",
    "      if (path === '/api/manager/staff' && request.method === 'GET') return finish(json(await listAssignableStaff(env)));\n      if (path === '/api/manager/orders' && request.method === 'GET') return finish(json({ items: await listOrders(env.DB, session.id) }));",
    'manager staff route',
)
index_path.write_text(index)

app_path = Path('src/client/PremiumApp.tsx')
app = app_path.read_text()
app = replace_once(app, "['/trips', 'Поездки', '✦']", "['/trips', 'Мои поездки', '✦']", 'bottom navigation label')
app = replace_once(
    app,
    "  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [error, setError] = useState(''); const [saved,setSaved]=useState(false);\n  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id)]).then(([orderResult,opsResult])=>{setOrder(orderResult.order);setOps(opsResult.ops)}).catch((e) => setError(e.message)); };",
    "  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [staff,setStaff]=useState<Array<{telegramUserId:string;role:string;displayName:string}>>([]);\n  const [error, setError] = useState(''); const [saved,setSaved]=useState(false);\n  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id),api.managerStaff()]).then(([orderResult,opsResult,staffResult])=>{setOrder(orderResult.order);setOps(opsResult.ops);setStaff(staffResult.items)}).catch((e) => setError(e.message)); };",
    'manager staff loading',
)
app = replace_once(
    app,
    "<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value=\"\">Не назначен</option><option>Менеджер 1</option><option>Менеджер 2</option><option>Менеджер 3</option></select>",
    "<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value=\"\">Не назначен</option>{ops.assignedManager&&!staff.some(item=>item.displayName===ops.assignedManager)&&<option>{ops.assignedManager}</option>}{staff.map(item=><option key={item.telegramUserId} value={item.displayName}>{item.displayName}{item.role!=='manager'?` · ${item.role}`:''}</option>)}</select>",
    'manager staff selector',
)
app = replace_once(
    app,
    '<b>ЗАГЛУШКА → нужен bot token + server-side initData + webhook</b>',
    '<b>КОД ГОТОВ → нужны bot token + chat IDs для реальной доставки</b>',
    'Telegram readiness copy',
)
app = replace_once(
    app,
    '<b>ЗАГЛУШКА → нужен webhook/API mapping текущего сайта</b>',
    '<b>WEBHOOK ГОТОВ → нужны secret + mapping реальных полей форм</b>',
    'Tilda readiness copy',
)
app = replace_once(
    app,
    '<b>ЗАГЛУШКА → нужен реальный транспорт уведомлений</b>',
    '<b>SLA И OUTBOX ГОТОВЫ → нужны реальные Telegram chat IDs</b>',
    'SLA readiness copy',
)
app_path.write_text(app)

print('ops hardening exact patch applied')
