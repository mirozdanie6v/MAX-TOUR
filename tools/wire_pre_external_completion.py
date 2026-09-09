from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# Worker wiring: cross-site mutation guard + aggregate readiness endpoint.
path = Path('src/worker/index.ts')
text = path.read_text()
text = replace_once(
    text,
    "import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';\nimport { managerStatusSchema } from '../shared/schemas';",
    "import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';\nimport { getProductionReadiness } from './services/readiness';\nimport { assertTrustedMutationRequest } from './services/request-security';\nimport { managerStatusSchema } from '../shared/schemas';",
    'worker imports',
)
text = replace_once(
    text,
    "    try {\n      if (path === '/api/health' && request.method === 'GET') {",
    "    try {\n      assertTrustedMutationRequest(request, url.origin, path);\n\n      if (path === '/api/health' && request.method === 'GET') {",
    'mutation guard wiring',
)
text = replace_once(
    text,
    "      if (path === '/api/owner/overview' && request.method === 'GET') return finish(json(await getOwnerOverview(env, session.id)));",
    "      if (path === '/api/owner/readiness' && request.method === 'GET') return finish(json(await getProductionReadiness(env, session.id)));\n      if (path === '/api/owner/overview' && request.method === 'GET') return finish(json(await getOwnerOverview(env, session.id)));",
    'owner readiness route',
)
path.write_text(text)

# Client API.
path = Path('src/client/lib/api.ts')
text = path.read_text()
text = replace_once(
    text,
    "  ownerOverview:()=>request<any>('/api/owner/overview'),",
    "  ownerReadiness:()=>request<any>('/api/owner/readiness'),\n  ownerOverview:()=>request<any>('/api/owner/overview'),",
    'client readiness api',
)
path.write_text(text)

# Owner dashboard: fetch and render safe readiness matrix.
path = Path('src/client/OwnerPage.tsx')
text = path.read_text()
text = replace_once(
    text,
    "  const [auth,setAuth]=useState<any>(null);\n  const [staff,setStaff]=useState<any>({mode:'demo',items:[],managementEnabled:false});",
    "  const [auth,setAuth]=useState<any>(null);\n  const [readiness,setReadiness]=useState<any>(null);\n  const [staff,setStaff]=useState<any>({mode:'demo',items:[],managementEnabled:false});",
    'owner readiness state',
)
text = replace_once(
    text,
    "    const [overview,status,tildaStatus,authStatus,staffStatus]=await Promise.all([api.ownerOverview(),api.telegramStatus(),api.tildaStatus(),api.authReadiness(),api.ownerStaff()]);\n    setData(overview);setSettings(overview.settings);setIntegration(status);setTilda(tildaStatus);setAuth(authStatus);setStaff(staffStatus);",
    "    const [overview,status,tildaStatus,authStatus,staffStatus,readinessStatus]=await Promise.all([api.ownerOverview(),api.telegramStatus(),api.tildaStatus(),api.authReadiness(),api.ownerStaff(),api.ownerReadiness()]);\n    setData(overview);setSettings(overview.settings);setIntegration(status);setTilda(tildaStatus);setAuth(authStatus);setStaff(staffStatus);setReadiness(readinessStatus);",
    'owner readiness load',
)
old_boundary = '''    <section className="px-owner-panel"><span className="px-kicker">INTEGRATION BOUNDARY</span><h3>Что не подменяем демо-логикой</h3><p>Произвольный лид Tilda не превращается автоматически в экскурсионный заказ, пока MAX TOUR не подтвердит реальные поля форм и hidden ID тура. Реальный эквайринг и live inventory также подключаются только к выбранным бизнес-источникам.</p></section>'''
new_boundary = '''    <section className="px-owner-panel"><span className="px-kicker">PRODUCTION READINESS</span><h3>Что готово до внешних подключений</h3><div className="px-owner-statuses"><div><span>Внутренняя схема</span><b>{readiness?.preExternalImplementationComplete?'OK':'CHECK'}</b></div><div><span>D1 таблицы</span><b>{readiness?.database?.healthy?'OK':'CHECK'}</b></div><div><span>Внешних блокеров</span><b>{readiness?.externalBlockerCount??'—'}</b></div></div><div className="px-owner-orders">{(readiness?.externalBlockers??[]).map((item:any)=><div key={item.key}><div><b>{item.area}</b><span>{item.required}</span></div><div><small>ВНЕШНЯЯ НАСТРОЙКА</small></div></div>)}</div><p>{readiness?.preExternalImplementationComplete?'Код, внутренняя D1-схема, workflow и deployment-контур готовы. Список выше содержит только данные/системы, которые должны прийти от MAX TOUR или выбранного провайдера.':'Есть внутренний технический блокер — перед production activation его нужно устранить.'}</p></section>\n    <section className="px-owner-panel"><span className="px-kicker">INTEGRATION BOUNDARY</span><h3>Что не подменяем демо-логикой</h3><p>Произвольный лид Tilda не превращается автоматически в экскурсионный заказ, пока MAX TOUR не подтвердит реальные поля форм и hidden ID тура. Реальный эквайринг и live inventory также подключаются только к выбранным бизнес-источникам.</p></section>'''
text = replace_once(text, old_boundary, new_boundary, 'owner readiness UI')
path.write_text(text)

print('pre-external completion wiring applied')
