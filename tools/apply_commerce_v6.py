from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

# Worker wiring
p=Path('src/worker/index.ts')
s=p.read_text()
s=replace_once(s,
"import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';\nimport { managerStatusSchema } from '../shared/schemas';",
"import { authenticateTelegramStaff, getAuthReadiness, listAssignableStaff, listStaffAccounts, requireStaffRole, upsertStaffAccount } from './services/telegram-auth';\nimport { adminPatchGroupDeparture, createGroupDeparture, joinGroupDeparture, listGroupDepartures } from './services/group-departures';\nimport { managerStatusSchema } from '../shared/schemas';",'worker import')
s=replace_once(s,
"      if (path === '/api/booking/quote' && request.method === 'POST') {",
"      if (path === '/api/group-departures' && request.method === 'GET') return finish(json({ items: await listGroupDepartures(env, session.id, url.searchParams.get('tourId') ?? undefined) }));\n      if (path === '/api/group-departures' && request.method === 'POST') return finish(json({ item: await createGroupDeparture(env, session.id, await body(request)) }, 201));\n      m = match(path, /^\\/api\\/group-departures\\/([^/]+)\\/join$/);\n      if (m && request.method === 'POST') return finish(json({ item: await joinGroupDeparture(env, session.id, m[0], await body(request)) }));\n\n      if (path === '/api/booking/quote' && request.method === 'POST') {",'public group routes')
s=replace_once(s,
"      if (path === '/api/admin/tours' && request.method === 'GET') return finish(json({ items: await adminTours(env, session.id) }));",
"      if (path === '/api/admin/group-departures' && request.method === 'GET') return finish(json({ items: await listGroupDepartures(env, session.id) }));\n      m = match(path, /^\\/api\\/admin\\/group-departures\\/([^/]+)$/);\n      if (m && request.method === 'PATCH') return finish(json({ item: await adminPatchGroupDeparture(env, session.id, m[0], await body(request), actorId) }));\n\n      if (path === '/api/admin/tours' && request.method === 'GET') return finish(json({ items: await adminTours(env, session.id) }));",'admin group routes')
p.write_text(s)

# Client shell wiring
p=Path('src/client/PremiumApp.tsx')
s=p.read_text()
s=replace_once(s,
"import { CustomersPage } from './CustomersPage';",
"import { CustomersPage } from './CustomersPage';\nimport { BookingV2Page } from './BookingV2Page';\nimport { GroupDeparturesPage } from './GroupDeparturesPage';\nimport { AdminGroupsPage } from './AdminGroupsPage';",'client imports')
s=replace_once(s,
"    <Route path=\"/booking\" element={<TouristShell><BookingPage /></TouristShell>} />",
"    <Route path=\"/booking\" element={<TouristShell><BookingV2Page /></TouristShell>} />\n    <Route path=\"/groups/:tourId\" element={<TouristShell><GroupDeparturesPage /></TouristShell>} />",'booking routes')
s=replace_once(s,
"    <Route path=\"/admin/schedule\" element={<BackofficeShell title=\"Расписание и акции\" role=\"admin\"><SchedulePage /></BackofficeShell>} />",
"    <Route path=\"/admin/schedule\" element={<BackofficeShell title=\"Расписание и акции\" role=\"admin\"><SchedulePage /></BackofficeShell>} />\n    <Route path=\"/admin/groups\" element={<BackofficeShell title=\"Групповые заявки\" role=\"admin\"><AdminGroupsPage /></BackofficeShell>} />",'admin group route')
s=replace_once(s,
"<button onClick={() => navigate('/admin/schedule')}>Расписание</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button>",
"<button onClick={() => navigate('/admin/schedule')}>Расписание</button><button onClick={() => navigate('/admin/groups')}>Группы</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button>",'admin tabs')
s=replace_once(s,
"const { id = '' } = useParams(); const navigate = useNavigate(); const { setBooking, refresh } = useApp();",
"const { id = '' } = useParams(); const navigate = useNavigate(); const { refresh } = useApp();",'tour hook')
s=replace_once(s,
"const adultPrice = tour.pricingRules.adultMinor ?? tour.pricingRules.adultFromMinor ?? 0; const begin = () => { setBooking((b) => ({ ...b, tourId: tour.id, date: '', source: 'Telegram' })); api.event('start_booking', tour.id); navigate('/booking'); };",
"const adultPrice = tour.pricingRules.adultMinor ?? tour.pricingRules.adultFromMinor ?? 0; const begin = () => { api.event('start_booking', tour.id); navigate(`/booking?tourId=${tour.id}`); };",'tour booking entry')
s=s.replace('>Выбрать дату</button></div></>;','>Выбрать формат</button></div></>;')
p.write_text(s)
print('commerce v6 wiring applied')
