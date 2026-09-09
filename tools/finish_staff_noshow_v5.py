from pathlib import Path

root=Path('.')

def replace(path, old, new, label):
    p=root/path
    s=p.read_text()
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    p.write_text(s.replace(old,new,1))

# Server-side staff directory: UI no longer owns the staff list.
p=root/'src/worker/services/telegram-auth.ts'
s=p.read_text()
anchor='export async function getAuthReadiness(env: Env) {'
if anchor not in s: raise SystemExit('auth readiness anchor missing')
insert='''export async function listAssignableStaff(env: Env) {\n  if ((env.AUTH_MODE ?? 'demo') !== 'telegram') {\n    return {\n      mode: 'demo' as const,\n      items: [\n        { telegramUserId:'demo-manager-1', role:'manager' as const, displayName:'Менеджер 1', active:true },\n        { telegramUserId:'demo-manager-2', role:'manager' as const, displayName:'Менеджер 2', active:true },\n        { telegramUserId:'demo-manager-3', role:'manager' as const, displayName:'Менеджер 3', active:true },\n      ],\n    };\n  }\n  const rows = await env.DB.prepare(\"SELECT telegram_user_id,role,display_name,active,created_at,updated_at FROM staff_accounts WHERE active=1 ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, display_name\").all<any>();\n  return { mode:'telegram' as const, items:(rows.results ?? []).map(mapStaff) };\n}\n\n'''
s=s.replace(anchor,insert+anchor,1)
p.write_text(s)

# No-show is an internal workflow state; payment/refund remains external.
replace('src/worker/services/internal-workflows.ts',
"  const operationType = ['none','reschedule','cancel'].includes(String(input?.operationType)) ? String(input.operationType) : 'none';",
"  const operationType = ['none','reschedule','cancel','no_show'].includes(String(input?.operationType)) ? String(input.operationType) : 'none';",
'workflow operation list')
replace('src/worker/services/internal-workflows.ts',
"  await recordAudit(env, sessionId, 'manager', operationType === 'cancel' ? 'Запрос отмены' : operationType === 'reschedule' ? 'Запрос переноса' : 'Сброс операции', 'order', displayId, before, after, actorId);",
"  await recordAudit(env, sessionId, 'manager', operationType === 'cancel' ? 'Запрос отмены' : operationType === 'reschedule' ? 'Запрос переноса' : operationType === 'no_show' ? 'Фиксация неявки' : 'Сброс операции', 'order', displayId, before, after, actorId);",
'workflow audit label')

# API wiring.
replace('src/worker/index.ts',
"import { authenticateTelegramStaff, getAuthReadiness, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';",
"import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';",
'index staff import')
replace('src/worker/index.ts',
"      if (path === '/api/manager/orders' && request.method === 'GET') return finish(json({ items: await listOrders(env.DB, session.id) }));",
"      if (path === '/api/manager/staff' && request.method === 'GET') return finish(json(await listAssignableStaff(env)));\n      if (path === '/api/manager/orders' && request.method === 'GET') return finish(json({ items: await listOrders(env.DB, session.id) }));",
'manager staff route')
replace('src/client/lib/api.ts',
"  managerOrders:()=>request<{items:OrderSummary[]}>('/api/manager/orders'),",
"  managerStaff:()=>request<{mode:string;items:Array<{telegramUserId:string;role:string;displayName:string;active:boolean}>}>('/api/manager/staff'),\n  managerOrders:()=>request<{items:OrderSummary[]}>('/api/manager/orders'),",
'client manager staff')

# Manager order UI consumes directory and supports no-show.
p=root/'src/client/PremiumApp.tsx'; s=p.read_text()
old="  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [workflow,setWorkflow]=useState({operationType:'none',requestedDate:'',reason:'',managerNote:'',workflowStatus:'Нет запроса',updatedAt:null as string|null});"
new="  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [staff,setStaff]=useState<Array<{telegramUserId:string;role:string;displayName:string;active:boolean}>>([]);\n  const [workflow,setWorkflow]=useState({operationType:'none',requestedDate:'',reason:'',managerNote:'',workflowStatus:'Нет запроса',updatedAt:null as string|null});"
if old not in s: raise SystemExit('manager state anchor missing')
s=s.replace(old,new,1)
old="  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id),api.orderWorkflow(id)]).then(([orderResult,opsResult,workflowResult])=>{setOrder(orderResult.order);setOps(opsResult.ops);setWorkflow(workflowResult.workflow)}).catch((e) => setError(e.message)); };"
new="  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id),api.orderWorkflow(id),api.managerStaff()]).then(([orderResult,opsResult,workflowResult,staffResult])=>{setOrder(orderResult.order);setOps(opsResult.ops);setWorkflow(workflowResult.workflow);setStaff(staffResult.items)}).catch((e) => setError(e.message)); };"
if old not in s: raise SystemExit('manager load anchor missing')
s=s.replace(old,new,1)
s=s.replace("  const chooseOperation=(operationType:'none'|'reschedule'|'cancel')=>", "  const chooseOperation=(operationType:'none'|'reschedule'|'cancel'|'no_show')=>",1)
s=s.replace("  const workflowLabels:Record<string,string>={none:'Без операции',reschedule:'Перенос',cancel:'Отмена'};", "  const workflowLabels:Record<string,string>={none:'Без операции',reschedule:'Перенос',cancel:'Отмена',no_show:'Неявка'};",1)
old='<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value="">Не назначен</option><option>Менеджер 1</option><option>Менеджер 2</option><option>Менеджер 3</option></select>'
new='<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value="">Не назначен</option>{staff.map(item=><option key={item.telegramUserId} value={item.displayName}>{item.displayName} · {item.role}</option>)}</select>'
if old not in s: raise SystemExit('manager select anchor missing')
s=s.replace(old,new,1)
s=s.replace("{(['none','reschedule','cancel'] as const).map(type=>", "{(['none','reschedule','cancel','no_show'] as const).map(type=>",1)
s=s.replace("<span>{type==='none'?'Обычное исполнение':type==='reschedule'?'Новая дата поездки':'Запрос на отмену'}</span>", "<span>{type==='none'?'Обычное исполнение':type==='reschedule'?'Новая дата поездки':type==='cancel'?'Запрос на отмену':'Клиент не пришёл на выезд'}</span>",1)
s=s.replace("placeholder={workflow.operationType==='cancel'?'Почему клиент просит отмену':'Почему нужен перенос'}", "placeholder={workflow.operationType==='cancel'?'Почему клиент просит отмену':workflow.operationType==='no_show'?'Что известно о неявке':'Почему нужен перенос'}",1)
# Extend the warning to no-show while preserving truthful refund boundary.
s=s.replace("{workflow.operationType==='cancel'&&order.paidMinor>0&&<div className=\"px-workflow-warning\"><b>Оплата уже зафиксирована: {formatUsd(order.paidMinor)}</b><span>DEMO-отмена не создаёт фиктивный refund. Возврат будет выполняться только через реальный платёжный провайдер после интеграции.</span></div>}", "{(workflow.operationType==='cancel'||workflow.operationType==='no_show')&&order.paidMinor>0&&<div className=\"px-workflow-warning\"><b>Оплата уже зафиксирована: {formatUsd(order.paidMinor)}</b><span>{workflow.operationType==='cancel'?'DEMO-отмена не создаёт фиктивный refund. Возврат будет выполняться только через реальный платёжный провайдер после интеграции.':'Неявка фиксируется как операционное событие. Удержание/возврат в реальной системе применяется только по подтверждённым правилам и платёжным данным.'}</span></div>}",1)
p.write_text(s)

print('staff directory + no-show v5 applied')
