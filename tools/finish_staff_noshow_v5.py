from pathlib import Path

p=Path('src/client/PremiumApp.tsx')
s=p.read_text()

def one(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing {label}')
    s=s.replace(old,new,1)

one("  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [workflow,setWorkflow]=useState({operationType:'none',requestedDate:'',reason:'',managerNote:'',workflowStatus:'Нет запроса',updatedAt:null as string|null});",
"  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});\n  const [staff,setStaff]=useState<Array<{telegramUserId:string;role:string;displayName:string;active:boolean}>>([]);\n  const [workflow,setWorkflow]=useState({operationType:'none',requestedDate:'',reason:'',managerNote:'',workflowStatus:'Нет запроса',updatedAt:null as string|null});",'manager states')
one("  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id),api.orderWorkflow(id)]).then(([orderResult,opsResult,workflowResult])=>{setOrder(orderResult.order);setOps(opsResult.ops);setWorkflow(workflowResult.workflow)}).catch((e) => setError(e.message)); };",
"  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id),api.orderWorkflow(id),api.managerStaff()]).then(([orderResult,opsResult,workflowResult,staffResult])=>{setOrder(orderResult.order);setOps(opsResult.ops);setWorkflow(workflowResult.workflow);setStaff(staffResult.items)}).catch((e) => setError(e.message)); };",'manager load')
one("  const chooseOperation=(operationType:'none'|'reschedule'|'cancel')=>", "  const chooseOperation=(operationType:'none'|'reschedule'|'cancel'|'no_show')=>",'operation union')
one("  const workflowLabels:Record<string,string>={none:'Без операции',reschedule:'Перенос',cancel:'Отмена'};", "  const workflowLabels:Record<string,string>={none:'Без операции',reschedule:'Перенос',cancel:'Отмена',no_show:'Неявка'};",'workflow labels')
one('<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value="">Не назначен</option><option>Менеджер 1</option><option>Менеджер 2</option><option>Менеджер 3</option></select>', '<select value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})}><option value="">Не назначен</option>{staff.map(item=><option key={item.telegramUserId} value={item.displayName}>{item.displayName} · {item.role}</option>)}</select>','staff select')
one("{(['none','reschedule','cancel'] as const).map(type=>", "{(['none','reschedule','cancel','no_show'] as const).map(type=>",'choice list')
one("<span>{type==='none'?'Обычное исполнение':type==='reschedule'?'Новая дата поездки':'Запрос на отмену'}</span>", "<span>{type==='none'?'Обычное исполнение':type==='reschedule'?'Новая дата поездки':type==='cancel'?'Запрос на отмену':'Клиент не пришёл на выезд'}</span>",'choice description')
one("placeholder={workflow.operationType==='cancel'?'Почему клиент просит отмену':'Почему нужен перенос'}", "placeholder={workflow.operationType==='cancel'?'Почему клиент просит отмену':workflow.operationType==='no_show'?'Что известно о неявке':'Почему нужен перенос'}",'reason placeholder')
one("{workflow.operationType==='cancel'&&order.paidMinor>0&&<div className=\"px-workflow-warning\"><b>Оплата уже зафиксирована: {formatUsd(order.paidMinor)}</b><span>DEMO-отмена не создаёт фиктивный refund. Возврат будет выполняться только через реальный платёжный провайдер после интеграции.</span></div>}", "{(workflow.operationType==='cancel'||workflow.operationType==='no_show')&&order.paidMinor>0&&<div className=\"px-workflow-warning\"><b>Оплата уже зафиксирована: {formatUsd(order.paidMinor)}</b><span>{workflow.operationType==='cancel'?'DEMO-отмена не создаёт фиктивный refund. Возврат будет выполняться только через реальный платёжный провайдер после интеграции.':'Неявка фиксируется как операционное событие. Удержание/возврат в реальной системе применяется только по подтверждённым правилам и платёжным данным.'}</span></div>}",'workflow warning')
p.write_text(s)
print('manager staff + no-show UI applied')
