from pathlib import Path
p=Path('src/client/PremiumApp.tsx')
s=p.read_text()
old="await api.addTour({ title: title.trim(), direction: 'Нячанг', category: 'ДЕМО', published: true });"
new="await api.addTour({ title: title.trim(), direction: 'Нячанг', description: 'DEMO-экскурсия, созданная администратором.', priceMode: 'dynamic-request', adultMinor: 0, scheduleMode: 'request', images: [], published: true });"
if old not in s:
    raise SystemExit('admin add anchor missing')
p.write_text(s.replace(old,new,1))
print('admin add fixed')
