from pathlib import Path

root=Path('.')
app=root/'src/client/PremiumApp.tsx'
s=app.read_text()

def replace_once(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    s=s.replace(old,new,1)

replace_once("import { api } from './lib/api';", "import { api } from './lib/api';\nimport { OwnerPage } from './OwnerPage';", 'owner import')
replace_once("type Role = 'tourist' | 'manager' | 'admin';", "type Role = 'tourist' | 'manager' | 'admin' | 'owner';", 'role union')
replace_once("const LOGO_SRC = 'https://thb.tildacdn.one/tild3938-3763-4364-a165-666362383464/-/resize/600x/Max_Tour-3.jpg';", "const LOGO_SRC = 'https://static.tildacdn.one/tild3063-6230-4266-b063-313839663461/____1680_x_600_-4.jpg';", 'logo')
replace_once("function roleFromPath(pathname: string): Role {\n  if (pathname.startsWith('/manager') || pathname.startsWith('/channels')) return 'manager';", "function roleFromPath(pathname: string): Role {\n  if (pathname.startsWith('/owner')) return 'owner';\n  if (pathname.startsWith('/manager') || pathname.startsWith('/channels')) return 'manager';", 'role path')
replace_once("    <Route path=\"/channels\" element={<BackofficeShell title=\"Каналы продаж\" role=\"manager\"><ChannelsPage /></BackofficeShell>} />", "    <Route path=\"/channels\" element={<BackofficeShell title=\"Каналы продаж\" role=\"manager\"><ChannelsPage /></BackofficeShell>} />\n    <Route path=\"/owner\" element={<BackofficeShell title=\"Панель владельца\" role=\"owner\"><OwnerPage /></BackofficeShell>} />", 'owner route')

old_logo='''function Logo() {
  const [failed, setFailed] = useState(false);
  return <div className="px-logo-wrap">{!failed && <img className="px-logo-image" src={LOGO_SRC} alt="MAX TOUR" onError={() => setFailed(true)} />}<div className="px-logo-text"><b>MAX TOUR</b><span>VIETNAM</span></div></div>;
}'''
new_logo='''function Logo() {
  const [failed, setFailed] = useState(false);
  return <div className="px-logo-wrap">{!failed ? <img className="px-logo-image px-logo-official" src={LOGO_SRC} alt="MAX TOUR" onError={() => setFailed(true)} /> : <div className="px-logo-text"><b>MAX TOUR</b><span>VIETNAM</span></div>}</div>;
}'''
replace_once(old_logo,new_logo,'logo function')
replace_once("const goRole = (next: Role) => { setOpen(false); navigate(next === 'manager' ? '/manager' : next === 'admin' ? '/admin' : '/'); };", "const goRole = (next: Role) => { setOpen(false); navigate(next === 'manager' ? '/manager' : next === 'admin' ? '/admin' : next === 'owner' ? '/owner' : '/'); };", 'goRole')
replace_once("<button className={role === 'admin' ? 'active' : ''} onClick={() => goRole('admin')}><b>Администратор</b><span>Каталог, цены, аналитика</span></button></div>", "<button className={role === 'admin' ? 'active' : ''} onClick={() => goRole('admin')}><b>Администратор</b><span>Каталог, цены, расписание</span></button><button className={role === 'owner' ? 'active' : ''} onClick={() => goRole('owner')}><b>Владелец</b><span>Показатели и правила команды</span></button></div>", 'drawer owner')

old_shell='''function BackofficeShell({ title, role, children }: { title: string; role: Role; children: React.ReactNode }) {
  const navigate = useNavigate();
  return <div className="px-app px-backoffice"><Header title={title} /><main className="px-content px-wide"><section className="px-office-hero"><div><span className="px-kicker">MAX TOUR · {role === 'manager' ? 'MANAGER DEMO' : 'ADMIN DEMO'}</span><h1>{title}</h1></div><span className="px-demo-pill">ДЕМО-ДАННЫЕ</span></section><nav className="px-office-tabs">{role === 'manager' ? <><button onClick={() => navigate('/manager')}>Заказы</button><button onClick={() => navigate('/channels')}>Tilda + Telegram</button></> : <><button onClick={() => navigate('/admin')}>Каталог</button><button onClick={() => navigate('/admin/schedule')}>Расписание</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button><button onClick={() => navigate('/admin/directions')}>Направления</button></>}</nav>{children}</main></div>;
}'''
new_shell='''function BackofficeShell({ title, role, children }: { title: string; role: Role; children: React.ReactNode }) {
  const navigate = useNavigate();
  const roleLabel = role === 'manager' ? 'MANAGER DEMO' : role === 'admin' ? 'ADMIN DEMO' : 'OWNER DEMO';
  const tabs = role === 'manager' ? <><button onClick={() => navigate('/manager')}>Заказы</button><button onClick={() => navigate('/channels')}>Tilda + Telegram</button></> : role === 'admin' ? <><button onClick={() => navigate('/admin')}>Каталог</button><button onClick={() => navigate('/admin/schedule')}>Расписание</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button><button onClick={() => navigate('/admin/directions')}>Направления</button></> : <><button onClick={() => navigate('/owner')}>Обзор</button><button onClick={() => navigate('/manager')}>Очередь менеджера</button><button onClick={() => navigate('/admin')}>Управление продуктом</button><button onClick={() => navigate('/channels')}>Каналы продаж</button></>;
  return <div className="px-app px-backoffice"><Header title={title} /><main className="px-content px-wide"><section className="px-office-hero"><div><span className="px-kicker">MAX TOUR · {roleLabel}</span><h1>{title}</h1></div><span className="px-demo-pill">ДЕМО-ДАННЫЕ</span></section><nav className="px-office-tabs">{tabs}</nav>{children}</main></div>;
}'''
replace_once(old_shell,new_shell,'backoffice shell')

old_manager="function ManagerOrderPage() { const { id = '' } = useParams(); const [order, setOrder] = useState<OrderSummary | null>(null); const [error, setError] = useState(''); const load = () => { void api.managerOrder(id).then((r) => setOrder(r.order)).catch((e) => setError(e.message)); }; useEffect(() => { load(); }, [id]); const update = async (status: OrderSummary['status']) => { const result = await api.managerStatus(id, status); setOrder(result.order); }; if (error) return <Notice>{error}</Notice>; if (!order) return <SkeletonCards />; return <><section className=\"px-order-detail-grid\"><Detail label=\"Экскурсия\" value={order.tourTitle} /><Detail label=\"Дата\" value={order.selectedDate} /><Detail label=\"Клиент\" value={order.customer} /><Detail label=\"Контакт\" value={order.contact} /><Detail label=\"Отель\" value={order.hotel} /><Detail label=\"Источник\" value={order.source} /><Detail label=\"Сумма\" value={formatUsd(order.totalMinor)} /><Detail label=\"Оплачено\" value={formatUsd(order.paidMinor)} /><Detail label=\"Осталось\" value={formatUsd(order.remainingMinor)} /></section><section className=\"px-section px-office-actions\"><h2>Статус заказа</h2><div>{(['Новый', 'Оплачено', 'Подтверждено'] as OrderSummary['status'][]).map((status) => <button key={status} className={order.status === status ? 'active' : ''} onClick={() => update(status)}>{status}</button>)}</div><p>Изменение сохраняется в D1 и сразу видно при повторном открытии заказа.</p></section></>; }"
new_manager='''function ManagerOrderPage() {
  const { id = '' } = useParams();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [ops,setOps]=useState({assignedManager:'',pickupNote:'',internalNote:'',lastContactAt:null as string|null,updatedAt:null as string|null});
  const [error, setError] = useState(''); const [saved,setSaved]=useState(false);
  const load = () => { void Promise.all([api.managerOrder(id),api.managerOps(id)]).then(([orderResult,opsResult])=>{setOrder(orderResult.order);setOps(opsResult.ops)}).catch((e) => setError(e.message)); };
  useEffect(() => { load(); }, [id]);
  const update = async (status: OrderSummary['status']) => { const result = await api.managerStatus(id, status); setOrder(result.order); };
  const saveOps=async(markContacted=false)=>{const result=await api.patchManagerOps(id,{...ops,markContacted});setOps(result.ops);setSaved(true);setTimeout(()=>setSaved(false),1600)};
  if (error) return <Notice>{error}</Notice>; if (!order) return <SkeletonCards />;
  return <><section className="px-order-detail-grid"><Detail label="Экскурсия" value={order.tourTitle} /><Detail label="Дата" value={order.selectedDate} /><Detail label="Клиент" value={order.customer} /><Detail label="Контакт" value={order.contact} /><Detail label="Отель" value={order.hotel} /><Detail label="Источник" value={order.source} /><Detail label="Сумма" value={formatUsd(order.totalMinor)} /><Detail label="Оплачено" value={formatUsd(order.paidMinor)} /><Detail label="Осталось" value={formatUsd(order.remainingMinor)} /></section><section className="px-section px-office-actions"><h2>Статус заказа</h2><div>{(['Новый', 'Оплачено', 'Подтверждено'] as OrderSummary['status'][]).map((status) => <button key={status} className={order.status === status ? 'active' : ''} onClick={() => update(status)}>{status}</button>)}</div><p>Статус сохраняется в D1 и сразу виден владельцу.</p></section><section className="px-section px-manager-editor"><div><span className="px-kicker">РАБОТА МЕНЕДЖЕРА</span><h2>Редактировать заказ</h2><p>Менеджер отвечает за исполнение заказа и коммуникацию. Цена и программа остаются зоной администратора.</p></div><label className="px-field"><span>Ответственный менеджер</span><input value={ops.assignedManager} onChange={e=>setOps({...ops,assignedManager:e.target.value})} placeholder="Например: Менеджер 1" /></label><label className="px-field"><span>Трансфер / точка сбора</span><input value={ops.pickupNote} onChange={e=>setOps({...ops,pickupNote:e.target.value})} placeholder="Уточнение по отелю и времени" /></label><label className="px-field"><span>Внутренняя заметка</span><textarea rows={5} value={ops.internalNote} onChange={e=>setOps({...ops,internalNote:e.target.value})} placeholder="Что важно передать следующей смене или гиду" /></label><div className="px-manager-edit-actions"><button className="px-button px-button-dark" onClick={()=>saveOps(false)}>{saved?'Сохранено ✓':'Сохранить изменения'}</button><button className="px-button px-button-primary" onClick={()=>saveOps(true)}>Связались с клиентом</button></div>{ops.lastContactAt&&<p className="px-form-note">Последний контакт: {new Date(ops.lastContactAt).toLocaleString('ru-RU')}</p>}</section></>;
}'''
replace_once(old_manager,new_manager,'manager page')

old_admin="function AdminTourPage() { const { id = '' } = useParams(); const { bump } = useApp(); const [tour, setTour] = useState<Tour | null>(null); const [price, setPrice] = useState(''); const [description, setDescription] = useState(''); const [saved, setSaved] = useState(false); useEffect(() => { api.tour(id).then((r) => { setTour(r.item); setPrice(String((r.item.pricingRules.adultMinor ?? r.item.pricingRules.adultFromMinor ?? 0) / 100)); setDescription(r.item.description); }); }, [id]); if (!tour) return <SkeletonCards />; const save = async () => { const adultMinor = Math.round(Number(price) * 100); const pricingRules = { ...tour.pricingRules, adultMinor, adultFromMinor: undefined }; const result = await api.patchTour(tour.id, { description, pricingRules }); setTour(result.item); setSaved(true); bump(); setTimeout(() => setSaved(false), 1800); }; return <section className=\"px-edit-form\"><div className=\"px-edit-preview\"><img src={tour.images[0]} alt={tour.title} /><div><span className=\"px-kicker\">PREVIEW</span><h2>{tour.title}</h2></div></div><label className=\"px-field\"><span>Цена взрослого, $</span><input type=\"number\" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label className=\"px-field\"><span>Описание</span><textarea rows={6} value={description} onChange={(e) => setDescription(e.target.value)} /></label><button className=\"px-button px-button-dark\" onClick={save}>{saved ? 'Сохранено ✓' : 'Сохранить изменения'}</button><p className=\"px-form-note\">Изменение сохраняется как DEMO override и отражается в туристическом каталоге этой сессии.</p></section>; }"
new_admin='''function AdminTourPage() {
  const { id = '' } = useParams(); const { bump } = useApp(); const [tour, setTour] = useState<Tour | null>(null);
  const [title,setTitle]=useState(''); const [price,setPrice]=useState(''); const [description,setDescription]=useState(''); const [published,setPublished]=useState(true); const [program,setProgram]=useState(''); const [saved,setSaved]=useState(false);
  useEffect(()=>{api.tour(id).then((r)=>{setTour(r.item);setTitle(r.item.title);setPrice(String((r.item.pricingRules.adultMinor??r.item.pricingRules.adultFromMinor??0)/100));setDescription(r.item.description);setPublished(r.item.published);setProgram(r.item.program.join('\\n'))})},[id]);
  if(!tour)return <SkeletonCards/>;
  const save=async()=>{const adultMinor=Math.round(Number(price)*100);const result=await api.patchTour(tour.id,{title,description,published,adultMinor,program:program.split('\\n').map(x=>x.trim()).filter(Boolean)});setTour(result.item);setSaved(true);bump();setTimeout(()=>setSaved(false),1800)};
  return <section className="px-edit-form"><div className="px-edit-preview"><img src={tour.images[0]} alt={tour.title}/><div><span className="px-kicker">LIVE DEMO PREVIEW</span><h2>{title||tour.title}</h2></div></div><label className="px-field"><span>Название</span><input value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="px-field"><span>Цена взрослого, $</span><input type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="px-field"><span>Описание</span><textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="px-field"><span>Программа — один пункт на строку</span><textarea rows={8} value={program} onChange={e=>setProgram(e.target.value)}/></label><label className="px-owner-check"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/><span>Показывать экскурсию туристу</span></label><button className="px-button px-button-dark px-block" onClick={save}>{saved?'Сохранено ✓':'Сохранить изменения'}</button><p className="px-form-note">Название, цена, описание, программа и публикация сохраняются как DEMO override в D1 и сразу отражаются у туриста.</p></section>;
}'''
replace_once(old_admin,new_admin,'admin editor')
replace_once('<em>→</em></button>)}</section>}</>;', '<em>Редактировать →</em></button>)}</section>}</>;', 'admin edit label')
app.write_text(s)

# Worker routes
p=root/'src/worker/index.ts'; w=p.read_text()
anchor="import { getAnalytics, recordEvent } from './services/analytics';"
if anchor not in w: raise SystemExit('worker import missing')
w=w.replace(anchor,anchor+"\nimport { getManagerOps, patchManagerOps, getOwnerOverview, patchOwnerSettings } from './services/operations';",1)
route_anchor="      if (path === '/api/admin/tours' && request.method === 'GET') return finish(json({ items: await adminTours(env, session.id) }));"
block="""      m = match(path, /^\\/api\\/manager\\/orders\\/([^/]+)\\/ops$/);
      if (m && request.method === 'GET') return finish(json({ ops: await getManagerOps(env, session.id, m[0]) }));
      if (m && request.method === 'PATCH') return finish(json({ ops: await patchManagerOps(env, session.id, m[0], await body(request)) }));

      if (path === '/api/owner/overview' && request.method === 'GET') return finish(json(await getOwnerOverview(env, session.id)));
      if (path === '/api/owner/settings' && request.method === 'PATCH') return finish(json(await patchOwnerSettings(env, session.id, await body(request))));

"""+route_anchor
if route_anchor not in w: raise SystemExit('worker route missing')
w=w.replace(route_anchor,block,1)
p.write_text(w)

# Session defaults and reset
p=root/'src/worker/db/session.ts'; q=p.read_text()
event_anchor="  const events: Array<[string,string,string|null,string|null,number|null]> = ["
seed="""  await env.DB.prepare('INSERT OR IGNORE INTO demo_owner_settings(session_id,manager_sla_minutes,manager_notifications,owner_digest,sales_focus) VALUES (?,15,1,?,?)').bind(sessionId,'Ежедневно','Премиум экскурсии').run();
  const opsSeed = [
    ['MT-DEMO-1039','Менеджер 1','Уточнить время сбора в отеле','Клиент ещё не подтвердил детали — DEMO'],
    ['MT-DEMO-1040','Менеджер 2','Лобби отеля','Полная оплата получена — передать гиду — DEMO'],
    ['MT-DEMO-1041','Менеджер 1','Amiana — отдельная зона трансфера','Проверить трансфер и даты рождения участников — DEMO']
  ];
  for (const [display,assigned,pickup,note] of opsSeed) {
    const row=await env.DB.prepare('SELECT id FROM orders WHERE session_id=? AND display_id=?').bind(sessionId,display).first<{id:string}>();
    if(row) await env.DB.prepare('INSERT OR REPLACE INTO demo_order_operations(session_id,order_id,assigned_manager,pickup_note,internal_note) VALUES (?,?,?,?,?)').bind(sessionId,row.id,assigned,pickup,note).run();
  }

"""+event_anchor
if event_anchor not in q: raise SystemExit('session seed anchor missing')
q=q.replace(event_anchor,seed,1)
old="const tables = ['demo_tour_overrides','demo_user_created_tours','demo_availability','demo_promotions','demo_directions','manager_status_history','payments','order_participants','orders','analytics_events'];"
new="const tables = ['demo_tour_overrides','demo_user_created_tours','demo_availability','demo_promotions','demo_directions','demo_order_operations','demo_owner_settings','manager_status_history','payments','order_participants','orders','analytics_events'];"
if old not in q: raise SystemExit('reset anchor missing')
q=q.replace(old,new,1)
p.write_text(q)

# CSS
p=root/'src/client/styles/premium.css'; c=p.read_text()
if '/* role-owner-v2 */' not in c:
    c += r'''
/* role-owner-v2 */
.px-bottom-nav small{font-size:12px;font-weight:800;letter-spacing:0}.px-bottom-nav button{gap:5px;padding:8px 3px}.px-bottom-nav span{font-size:19px}.px-logo-official{width:118px;height:42px;object-fit:contain;object-position:left center;border-radius:0;background:transparent;mix-blend-mode:normal}.px-manager-editor{background:var(--px-paper);border:1px solid var(--px-line);border-radius:24px;padding:20px}.px-manager-editor h2{font-family:Georgia,serif;font-size:30px;font-weight:500;margin:8px 0}.px-manager-editor>div>p{font-size:11px;line-height:1.55;color:var(--px-muted);margin:0 0 18px}.px-manager-edit-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.px-owner-loading{padding:44px 0;color:var(--px-muted)}.px-owner-lead{display:grid;gap:16px;margin-top:22px;padding:24px;border-radius:26px;background:var(--px-green);color:#fff}.px-owner-lead h2{font-family:Georgia,serif;font-size:34px;line-height:1;font-weight:500;margin:9px 0 12px}.px-owner-lead p{max-width:680px;margin:0;font-size:12px;line-height:1.6;color:rgba(255,255,255,.72)}.px-owner-focus{border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:15px;display:grid;gap:6px}.px-owner-focus span{font-size:8px;letter-spacing:.12em;text-transform:uppercase;opacity:.65}.px-owner-focus b{font-family:Georgia,serif;font-size:21px;font-weight:500}.px-owner-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}.px-owner-metrics article{min-height:124px;background:var(--px-paper);border:1px solid var(--px-line);border-radius:20px;padding:15px;display:flex;flex-direction:column}.px-owner-metrics span{font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--px-muted)}.px-owner-metrics b{font-family:Georgia,serif;font-size:27px;font-weight:500;margin:auto 0 5px}.px-owner-metrics small{font-size:8px;color:var(--px-muted)}.px-owner-grid{display:grid;gap:12px;margin-top:12px}.px-owner-panel{background:var(--px-paper);border:1px solid var(--px-line);border-radius:24px;padding:20px}.px-owner-panel h3{font-family:Georgia,serif;font-size:27px;font-weight:500;margin:8px 0 16px}.px-owner-panel>p{font-size:10px;color:var(--px-muted);line-height:1.55;margin:14px 0 0}.px-owner-statuses{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.px-owner-statuses div{border:1px solid var(--px-line);border-radius:15px;padding:12px;display:grid;gap:14px}.px-owner-statuses span{font-size:8px;color:var(--px-muted)}.px-owner-statuses b{font-family:Georgia,serif;font-size:24px}.px-owner-source{display:grid;gap:7px;margin-top:13px}.px-owner-source>div{display:flex;justify-content:space-between;gap:10px}.px-owner-source b{font-size:11px}.px-owner-source span{font-size:9px;color:var(--px-muted)}.px-owner-source>i{height:5px;background:#e5e0d7;border-radius:999px;overflow:hidden}.px-owner-source em{display:block;height:100%;background:var(--px-sand)}.px-role-flow{display:grid;gap:8px}.px-role-flow>div{position:relative;border:1px solid var(--px-line);border-radius:18px;padding:15px;display:grid;grid-template-columns:34px 1fr;gap:5px 10px}.px-role-flow span{grid-row:1/3;color:var(--px-sand);font-family:Georgia,serif}.px-role-flow b{font-size:13px}.px-role-flow p{margin:0;font-size:10px;line-height:1.45;color:var(--px-muted)}.px-role-flow em{display:none}.px-owner-check{display:flex;align-items:center;gap:9px;margin:14px 0;font-size:11px}.px-owner-check input{accent-color:var(--px-green);width:18px;height:18px}.px-owner-orders{display:grid}.px-owner-orders>div{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--px-line)}.px-owner-orders>div:last-child{border-bottom:0}.px-owner-orders>div>div{display:grid;gap:4px}.px-owner-orders b{font-size:11px}.px-owner-orders span,.px-owner-orders small{font-size:8px;color:var(--px-muted)}.px-owner-orders strong{font-size:12px;text-align:right}.px-admin-tour-list em{font-size:10px;font-weight:800;white-space:nowrap;color:var(--px-green)}
@media(min-width:700px){.px-owner-lead{grid-template-columns:1.5fr .5fr;align-items:end}.px-owner-metrics{grid-template-columns:repeat(3,1fr)}.px-owner-grid{grid-template-columns:repeat(2,1fr)}.px-role-flow{grid-template-columns:repeat(4,1fr)}.px-role-flow>div{display:block;min-height:170px}.px-role-flow span{display:block;margin-bottom:30px}.px-role-flow p{margin-top:8px}.px-role-flow em{display:block;position:absolute;right:-17px;top:50%;font-style:normal;color:var(--px-sand);z-index:2}.px-role-flow>div:last-child em{display:none}}
'''
p.write_text(c)
print('v2b patch complete')
