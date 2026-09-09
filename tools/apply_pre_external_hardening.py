from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# Worker request hardening.
path = Path('src/worker/index.ts')
text = path.read_text()
text = replace_once(
    text,
    "      'x-max-tour-demo': '1',",
    "      'x-max-tour-demo': '1',\n      'x-content-type-options': 'nosniff',\n      'referrer-policy': 'strict-origin-when-cross-origin',\n      'permissions-policy': 'camera=(), microphone=(), geolocation=()',",
    'api security headers',
)
text = replace_once(
    text,
    "async function body(request: Request) {\n  const type = request.headers.get('content-type') ?? '';\n  if (!type.includes('application/json')) throw new HttpError(415, 'Ожидается JSON', 'UNSUPPORTED_MEDIA_TYPE');\n  try { return await request.json(); } catch { throw new HttpError(400, 'Некорректный JSON', 'INVALID_JSON'); }\n}",
    "async function body(request: Request) {\n  const type = request.headers.get('content-type') ?? '';\n  if (!type.includes('application/json')) throw new HttpError(415, 'Ожидается JSON', 'UNSUPPORTED_MEDIA_TYPE');\n  const declaredLength = Number(request.headers.get('content-length') ?? 0);\n  if (Number.isFinite(declaredLength) && declaredLength > 131072) throw new HttpError(413, 'JSON-запрос слишком большой', 'PAYLOAD_TOO_LARGE');\n  const raw = await request.text();\n  if (new TextEncoder().encode(raw).byteLength > 131072) throw new HttpError(413, 'JSON-запрос слишком большой', 'PAYLOAD_TOO_LARGE');\n  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Некорректный JSON', 'INVALID_JSON'); }\n}",
    'bounded json body',
)
text = replace_once(
    text,
    "    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);",
    "    if (!path.startsWith('/api/')) {\n      const asset = await env.ASSETS.fetch(request);\n      const headers = new Headers(asset.headers);\n      headers.set('X-Content-Type-Options','nosniff');\n      headers.set('Referrer-Policy','strict-origin-when-cross-origin');\n      headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');\n      return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});\n    }",
    'asset security headers',
)
path.write_text(text)

# Owner SLA + sales target UI.
path = Path('src/client/OwnerPage.tsx')
text = path.read_text()
text = replace_once(
    text,
    "const [settings,setSettings]=useState({managerSlaMinutes:15,managerNotifications:true,ownerDigest:'Ежедневно',salesFocus:'Премиум экскурсии'});",
    "const [settings,setSettings]=useState({managerSlaMinutes:15,managerNotifications:true,ownerDigest:'Ежедневно',salesFocus:'Премиум экскурсии',salesTargetMinor:500000});",
    'owner settings state',
)
text = replace_once(
    text,
    "const exportReport=()=>{const payload={generatedAt:new Date().toISOString(),demo:true,metrics:data.metrics,statuses:data.statuses,sources:data.sources,recentOrders:data.recentOrders,settings:data.settings,audit:data.audit||[],auth};",
    "const exportReport=()=>{const payload={generatedAt:new Date().toISOString(),demo:true,metrics:data.metrics,statuses:data.statuses,sources:data.sources,recentOrders:data.recentOrders,sla:data.sla,settings:data.settings,audit:data.audit||[],auth};",
    'owner export sla',
)
text = replace_once(
    text,
    '      <OwnerMetric label="Оплачено" value={formatUsd(data.metrics.paidMinor)} note="по demo-платежам"/>',
    '      <OwnerMetric label="Оплачено" value={formatUsd(data.metrics.paidMinor)} note="по demo-платежам"/>\n      <OwnerMetric label="План продаж" value={`${data.metrics.targetProgressPercent??0}%`} note={`цель ${formatUsd(data.metrics.salesTargetMinor??0)}`}/>',
    'owner target metric',
)
text = replace_once(
    text,
    '      <OwnerMetric label="Конверсия" value={`${data.metrics.conversion}%`} note="DEMO funnel"/>',
    '      <OwnerMetric label="Конверсия" value={`${data.metrics.conversion}%`} note="DEMO funnel"/>\n      <OwnerMetric label="SLA просрочено" value={String(data.metrics.slaOverdueOrders??0)} note={`лимит ${data.sla?.managerSlaMinutes??settings.managerSlaMinutes} мин`}/>',
    'owner sla metric',
)
old_queue = '''      <article className="px-owner-panel"><span className="px-kicker">ОЧЕРЕДЬ КОМАНДЫ</span><h3>Что требует внимания</h3><div className="px-owner-statuses">{data.statuses.map((row:any)=><div key={row.status}><span>{row.status}</span><b>{row.count}</b></div>)}</div><p>Менеджер закрывает новые и оплаченные заказы. Администратор отвечает за продукт и расписание. Владелец видит отклонения и вмешивается только когда это нужно.</p></article>'''
new_queue = '''      <article className="px-owner-panel"><span className="px-kicker">ОЧЕРЕДЬ КОМАНДЫ</span><h3>Что требует внимания</h3><div className="px-owner-statuses">{data.statuses.map((row:any)=><div key={row.status}><span>{row.status}</span><b>{row.count}</b></div>)}<div><span>Без контакта</span><b>{data.sla?.uncontactedOrders??0}</b></div><div><span>За SLA</span><b>{data.sla?.overdueOrders??0}</b></div></div><div className="px-owner-orders">{(data.sla?.queue??[]).filter((item:any)=>item.overdue).slice(0,4).map((item:any)=><div key={item.orderId}><div><b>{item.orderId} · {item.customer}</b><span>{item.tourTitle} · {item.assignedManager||'менеджер не назначен'}</span></div><div><strong>{item.waitingMinutes} мин</strong><small>ожидает контакта</small></div></div>)}</div><p>{data.sla?.overdueOrders?`Есть ${data.sla.overdueOrders} заказ(а), где первый контакт вышел за установленный SLA.`:'Новые заказы находятся в пределах установленного SLA.'}</p></article>'''
text = replace_once(text, old_queue, new_queue, 'owner attention queue')
old_rules = '''      <article className="px-owner-panel"><span className="px-kicker">ПРАВИЛА РАБОТЫ · DEMO</span><h3>Настройки владельца</h3><label className="px-field"><span>SLA менеджера, минут</span><input type="number" min="5" max="120" value={settings.managerSlaMinutes} onChange={e=>setSettings({...settings,managerSlaMinutes:Number(e.target.value)})}/></label><label className="px-field"><span>Фокус продаж</span><input value={settings.salesFocus} onChange={e=>setSettings({...settings,salesFocus:e.target.value})}/></label><label className="px-field"><span>Сводка владельцу</span><select value={settings.ownerDigest} onChange={e=>setSettings({...settings,ownerDigest:e.target.value})}><option>Отключено</option><option>Ежедневно</option><option>Еженедельно</option></select></label><label className="px-owner-check"><input type="checkbox" checked={settings.managerNotifications} onChange={e=>setSettings({...settings,managerNotifications:e.target.checked})}/><span>Уведомлять менеджеров о новых заказах</span></label><button className="px-button px-button-dark px-block" onClick={save} disabled={saving}>{saving?'Сохраняем…':'Сохранить правила'}</button><p className="px-form-note">Это демонстрационная настройка будущей системы. Она хранится в D1 только в текущей demo-сессии.</p></article>'''
new_rules = '''      <article className="px-owner-panel"><span className="px-kicker">ПРАВИЛА РАБОТЫ · DEMO</span><h3>Настройки владельца</h3><label className="px-field"><span>SLA менеджера, минут</span><input type="number" min="5" max="120" value={settings.managerSlaMinutes} onChange={e=>setSettings({...settings,managerSlaMinutes:Number(e.target.value)})}/></label><label className="px-field"><span>План продаж, USD</span><input type="number" min="0" step="100" value={Math.round((settings.salesTargetMinor??0)/100)} onChange={e=>setSettings({...settings,salesTargetMinor:Math.max(0,Math.round(Number(e.target.value)*100))})}/></label><label className="px-field"><span>Фокус продаж</span><input value={settings.salesFocus} onChange={e=>setSettings({...settings,salesFocus:e.target.value})}/></label><label className="px-field"><span>Сводка владельцу</span><select value={settings.ownerDigest} onChange={e=>setSettings({...settings,ownerDigest:e.target.value})}><option>Отключено</option><option>Ежедневно</option><option>Еженедельно</option></select></label><label className="px-owner-check"><input type="checkbox" checked={settings.managerNotifications} onChange={e=>setSettings({...settings,managerNotifications:e.target.checked})}/><span>Уведомлять менеджеров о новых заказах</span></label><button className="px-button px-button-dark px-block" onClick={save} disabled={saving}>{saving?'Сохраняем…':'Сохранить правила'}</button><p className="px-form-note">Настройки и план хранятся в D1 текущей demo-сессии и попадают в журнал действий.</p></article>'''
text = replace_once(text, old_rules, new_rules, 'owner settings controls')
path.write_text(text)

# Current app already has staff directory and no-show workflow; only polish labels/readiness copy.
path = Path('src/client/PremiumApp.tsx')
text = path.read_text()
text = replace_once(text, "['/trips', 'Поездки', '✦']", "['/trips', 'Мои поездки', '✦']", 'bottom nav label')
text = replace_once(text, '<b>ЗАГЛУШКА → нужен bot token + server-side initData + webhook</b>', '<b>КОД ГОТОВ → нужны bot token + chat IDs для реальной доставки</b>', 'telegram readiness')
text = replace_once(text, '<b>ЗАГЛУШКА → нужен webhook/API mapping текущего сайта</b>', '<b>WEBHOOK ГОТОВ → нужны secret + mapping реальных полей форм</b>', 'tilda readiness')
text = replace_once(text, '<b>ЗАГЛУШКА → нужен реальный транспорт уведомлений</b>', '<b>SLA И OUTBOX ГОТОВЫ → нужны реальные Telegram chat IDs</b>', 'sla readiness')
path.write_text(text)

# D1 migration.
migration = Path('migrations/0010_owner_sales_target.sql')
if migration.exists():
    raise SystemExit('owner target migration already exists unexpectedly')
migration.write_text('ALTER TABLE demo_owner_settings ADD COLUMN sales_target_minor INTEGER NOT NULL DEFAULT 500000;\n')

# CI verifies the new schema and also runs on this clean synchronization branch.
path = Path('.github/workflows/ci.yml')
text = path.read_text()
text = replace_once(text, '    branches: [main, integration-completion, production-hardening]', '    branches: [main, integration-completion, production-hardening, ops-hardening-v2]', 'ci branch')
text = replace_once(
    text,
    "            SELECT COUNT(*) AS promoDiscountColumns FROM pragma_table_info('demo_promotions') WHERE name IN ('discount_type','discount_value');",
    "            SELECT COUNT(*) AS promoDiscountColumns FROM pragma_table_info('demo_promotions') WHERE name IN ('discount_type','discount_value');\n            SELECT COUNT(*) AS ownerTargetColumn FROM pragma_table_info('demo_owner_settings') WHERE name='sales_target_minor';",
    'ci owner target query',
)
text = replace_once(
    text,
    "          const promoColumns=Number(find('promoDiscountColumns')?.promoDiscountColumns ?? 0);",
    "          const promoColumns=Number(find('promoDiscountColumns')?.promoDiscountColumns ?? 0);\n          const ownerTargetColumn=Number(find('ownerTargetColumn')?.ownerTargetColumn ?? 0);",
    'ci owner target parse',
)
text = replace_once(
    text,
    "          if (destinations < 5 || tours < 8 || Number(price.adultMinor)!==5200 || Number(price.childMinor)!==3800 || outbox!==1 || tildaInbox!==1 || audit!==1 || workflows!==1 || customers!==1 || staff!==1 || auditActorColumns!==2 || customerVisible!==1 || promoColumns!==2) {",
    "          if (destinations < 5 || tours < 8 || Number(price.adultMinor)!==5200 || Number(price.childMinor)!==3800 || outbox!==1 || tildaInbox!==1 || audit!==1 || workflows!==1 || customers!==1 || staff!==1 || auditActorColumns!==2 || customerVisible!==1 || promoColumns!==2 || ownerTargetColumn!==1) {",
    'ci owner target guard',
)
text = replace_once(
    text,
    "            console.error({destinations,tours,price,outbox,tildaInbox,audit,workflows,customers,staff,auditActorColumns,customerVisible,promoColumns});",
    "            console.error({destinations,tours,price,outbox,tildaInbox,audit,workflows,customers,staff,auditActorColumns,customerVisible,promoColumns,ownerTargetColumn});",
    'ci owner target error',
)
text = replace_once(text, "          console.log('D1 verified baseline, CRM/workflow, audit actor and staff RBAC schema OK');", "          console.log('D1 verified baseline, CRM/workflow, audit, staff RBAC and Owner target schema OK');", 'ci success copy')
path.write_text(text)

print('pre-external hardening patch applied')
