from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str):
    p=Path(path); s=p.read_text()
    if new in s:
        print(label,'already applied'); return
    if old not in s:
        raise SystemExit(f'missing pattern: {label}')
    p.write_text(s.replace(old,new,1))
    print('applied',label)

# Premium routes and admin tab
replace_once('src/client/PremiumApp.tsx',
"import { AdminGroupsPage } from './AdminGroupsPage';\n",
"import { AdminGroupsPage } from './AdminGroupsPage';\nimport { CatalogV6Page } from './CatalogV6Page';\nimport { SiteTourPage } from './SiteTourPage';\nimport { AdminCrmPage } from './AdminCrmPage';\n",'premium imports')
replace_once('src/client/PremiumApp.tsx',
'    <Route path="/catalog" element={<TouristShell><CatalogPage /></TouristShell>} />\n    <Route path="/tour/:id" element={<TouristShell><TourPage /></TouristShell>} />',
'    <Route path="/catalog" element={<TouristShell><CatalogV6Page /></TouristShell>} />\n    <Route path="/tour/:id" element={<TouristShell><TourPage /></TouristShell>} />\n    <Route path="/site-tour/:slug" element={<TouristShell><SiteTourPage /></TouristShell>} />','catalog routes')
replace_once('src/client/PremiumApp.tsx',
'    <Route path="/admin/groups" element={<BackofficeShell title="Групповые заявки" role="admin"><AdminGroupsPage /></BackofficeShell>} />\n    <Route path="/admin/analytics"',
'    <Route path="/admin/groups" element={<BackofficeShell title="Групповые заявки" role="admin"><AdminGroupsPage /></BackofficeShell>} />\n    <Route path="/admin/crm" element={<BackofficeShell title="CRM и рассылки" role="admin"><AdminCrmPage /></BackofficeShell>} />\n    <Route path="/admin/analytics"','admin CRM route')
replace_once('src/client/PremiumApp.tsx',
"<button onClick={() => navigate('/admin/groups')}>Группы</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button>",
"<button onClick={() => navigate('/admin/groups')}>Группы</button><button onClick={() => navigate('/admin/crm')}>CRM</button><button onClick={() => navigate('/admin/analytics')}>Аналитика</button>",'admin CRM tab')

# Worker imports and endpoints
replace_once('src/worker/index.ts',
"import { adminPatchGroupDeparture, createGroupDeparture, joinGroupDeparture, listGroupDepartures } from './services/group-departures';\n",
"import { adminPatchGroupDeparture, createGroupDeparture, joinGroupDeparture, listGroupDepartures } from './services/group-departures';\nimport { campaignRecipients, createCampaign, listAdminCustomers, listCampaigns } from './services/admin-crm';\nimport { listRefundCases } from './services/refund-policy';\nimport { listSiteSyncOutbox } from './services/site-sync';\nimport { sourceSiteCatalog } from '../shared/site-catalog';\n",'worker imports')
replace_once('src/worker/index.ts',
"      if (path === '/api/destinations' && request.method === 'GET') return finish(json({ items: await getDestinations(env.DB, session.id) }));\n",
"      if (path === '/api/destinations' && request.method === 'GET') return finish(json({ items: await getDestinations(env.DB, session.id) }));\n      if (path === '/api/site-catalog' && request.method === 'GET') return finish(json({ catalog: sourceSiteCatalog() }));\n",'site catalog API')
replace_once('src/worker/index.ts',
"      if (path === '/api/admin/group-departures' && request.method === 'GET') return finish(json({ items: await listGroupDepartures(env, session.id) }));\n      m = match(path, /^\\/api\\/admin\\/group-departures\\/([^/]+)$/);\n      if (m && request.method === 'PATCH') return finish(json({ item: await adminPatchGroupDeparture(env, session.id, m[0], await body(request), actorId) }));\n\n",
"      if (path === '/api/admin/group-departures' && request.method === 'GET') return finish(json({ items: await listGroupDepartures(env, session.id) }));\n      m = match(path, /^\\/api\\/admin\\/group-departures\\/([^/]+)$/);\n      if (m && request.method === 'PATCH') return finish(json({ item: await adminPatchGroupDeparture(env, session.id, m[0], await body(request), actorId) }));\n      if (path === '/api/admin/customers' && request.method === 'GET') return finish(json({ items: await listAdminCustomers(env, session.id) }));\n      if (path === '/api/admin/campaigns' && request.method === 'GET') return finish(json({ items: await listCampaigns(env, session.id) }));\n      if (path === '/api/admin/campaigns' && request.method === 'POST') return finish(json({ item: await createCampaign(env, session.id, await body(request), actorId) }, 201));\n      m = match(path, /^\\/api\\/admin\\/campaigns\\/([^/]+)\\/recipients$/);\n      if (m && request.method === 'GET') return finish(json({ items: await campaignRecipients(env, session.id, m[0]) }));\n      if (path === '/api/admin/refunds' && request.method === 'GET') return finish(json({ items: await listRefundCases(env, session.id) }));\n      if (path === '/api/admin/site-sync' && request.method === 'GET') return finish(json({ items: await listSiteSyncOutbox(env, session.id) }));\n\n",'admin CRM APIs')

# Allow source-only catalog tours to participate in group gathering without enabling individual checkout.
gp=Path('src/worker/services/group-departures.ts'); s=gp.read_text()
if "findSourceSiteTour" not in s:
    s=s.replace("import { prepareGroupCancellationCampaign } from './admin-crm';\n", "import { prepareGroupCancellationCampaign } from './admin-crm';\nimport { findSourceSiteTour, sourceTourId } from '../../shared/site-catalog';\n",1)
    marker="function contactOf(member: GroupMemberInput) {\n  return [member.phone, member.telegram].filter(Boolean).join(' · ');\n}\n"
    helper=marker+"\nasync function resolveGroupTour(env:Env,sessionId:string,tourId:string){\n  const structured=await getTourByIdOrSlug(env.DB,sessionId,tourId);\n  if(structured?.published) return {id:structured.id,title:structured.title,structured:true};\n  const source=findSourceSiteTour(tourId);\n  if(source) return {id:sourceTourId(source.path),title:source.title,structured:false};\n  return null;\n}\n"
    if marker not in s: raise SystemExit('missing group helper marker')
    s=s.replace(marker,helper,1)
    old="  const tour = await getTourByIdOrSlug(env.DB,sessionId,tourId);\n  if (!tour || !tour.published) return;\n  const availability = await getAvailability(env.DB,sessionId,tour.id).catch(()=>[] as any[]);"
    new="  const tour = await resolveGroupTour(env,sessionId,tourId);\n  if (!tour) return;\n  const availability = tour.structured ? await getAvailability(env.DB,sessionId,tour.id).catch(()=>[] as any[]) : [];"
    if old not in s: raise SystemExit('missing ensure group tour block')
    s=s.replace(old,new,1)
    old="  const tour = await getTourByIdOrSlug(env.DB, sessionId, parsed.data.tourId);\n  if (!tour || !tour.published) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');"
    new="  const tour = await resolveGroupTour(env, sessionId, parsed.data.tourId);\n  if (!tour) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');"
    if old not in s: raise SystemExit('missing create group tour block')
    s=s.replace(old,new,1)
    gp.write_text(s)
    print('applied source-only group resolver')
else:
    print('source-only group resolver already applied')
