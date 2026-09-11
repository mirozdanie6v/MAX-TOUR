(() => {
  'use strict';

  const state = {
    csrf: '', user: null, catalog: [], rules: [], analytics: {}, messages: [], broadcasts: [], tasks: [],
    query: '', orderFilter: 'all', customerFilter: 'all', selectedCustomerId: '', busy: false,
  };

  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const attrId = value => h(encodeURIComponent(String(value ?? '')));
  const decodeId = value => decodeURIComponent(String(value || ''));
  const lower = value => String(value || '').toLocaleLowerCase('ru-RU');
  const matches = (item, fields) => !state.query || fields.some(key => lower(item[key]).includes(state.query));
  const empty = text => `<div class="card empty">${h(text)}</div>`;

  async function api(path, options = {}) {
    const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
    if (!['GET', 'HEAD'].includes(options.method || 'GET') && state.csrf) headers['x-csrf-token'] = state.csrf;
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({ ok:false, error:'invalid_response' }));
    if (response.status === 401 && !path.includes('/auth/')) showAuth(false);
    if (!response.ok || data.ok === false) throw new Error(errorText(data.error));
    return data;
  }

  function errorText(code) {
    return ({
      credentials_invalid:'Неверная почта или пароль.', login_rate_limited:'Слишком много попыток. Повторите через 15 минут.',
      setup_token_invalid:'Неверный одноразовый код настройки.', setup_not_configured:'На сервере ещё не задан ADMIN_SETUP_TOKEN.',
      setup_closed:'Первый администратор уже создан.', csrf_invalid:'Сессия устарела. Обновите страницу.',
      forbidden:'Для вашей роли это действие недоступно.', unauthorized:'Необходимо войти.',
    })[code] || 'Не удалось выполнить действие. Повторите попытку.';
  }

  function authMarkup(setupRequired) {
    return `<main class="admin-auth" id="adminAuth">
      <section class="auth-card">
        <a class="auth-back" href="/">← Кабинет туриста</a>
        <img class="auth-logo" alt="MaxTour" src="${logoSrc}">
        <div class="auth-kicker">CRM · защищённый доступ</div>
        <h1>${setupRequired ? 'Создание администратора' : 'Вход в админ-панель'}</h1>
        <p>${setupRequired ? 'Первичная настройка выполняется один раз по секретному коду сервера.' : 'Данные клиентов и оплат доступны только сотрудникам с активной ролью.'}</p>
        <form id="adminAuthForm" class="auth-form">
          ${setupRequired ? '<label>Имя сотрудника<input name="displayName" autocomplete="name" required maxlength="100"></label>' : ''}
          <label>Рабочая почта<input name="email" type="email" autocomplete="username" required></label>
          <label>Пароль<input name="password" type="password" autocomplete="${setupRequired ? 'new-password' : 'current-password'}" minlength="12" required></label>
          ${setupRequired ? '<label>Одноразовый код настройки<input name="setupToken" type="password" autocomplete="off" required></label>' : ''}
          <button class="btn primary auth-submit" type="submit">${setupRequired ? 'Создать администратора' : 'Войти'}</button>
          <div class="auth-error" id="adminAuthError" role="alert"></div>
        </form>
      </section>
    </main>`;
  }

  function showAuth(setupRequired) {
    document.querySelector('.app').classList.add('admin-locked');
    document.getElementById('adminAuth')?.remove();
    document.body.insertAdjacentHTML('afterbegin', authMarkup(setupRequired));
    document.getElementById('adminAuthForm').addEventListener('submit', event => submitAuth(event, setupRequired));
  }

  async function submitAuth(event, setupRequired) {
    event.preventDefault();
    const form = event.currentTarget;
    const error = document.getElementById('adminAuthError');
    const submit = form.querySelector('button[type="submit"]');
    error.textContent = '';
    submit.disabled = true;
    const payload = Object.fromEntries(new FormData(form));
    try {
      if (setupRequired) {
        await api('/api/admin/auth/setup', { method:'POST', body:JSON.stringify(payload) });
        showToast('Администратор создан. Теперь войдите.');
        showAuth(false);
      } else {
        const result = await api('/api/admin/auth/login', { method:'POST', body:JSON.stringify(payload) });
        state.csrf = result.csrfToken;
        state.user = result.user;
        await loadWorkspace();
      }
    } catch (err) {
      error.textContent = err.message;
      submit.disabled = false;
    }
  }

  function hydrate(data) {
    departuresData.splice(0, departuresData.length, ...(data.departures || []));
    ordersData.splice(0, ordersData.length, ...(data.orders || []));
    customersData.splice(0, customersData.length, ...(data.customers || []));
    state.catalog = data.catalog || [];
    state.rules = data.notificationRules || [];
    state.analytics = data.analytics || {};
    state.messages = data.messages || [];
    state.broadcasts = data.broadcasts || [];
    state.tasks = data.tasks || [];
    state.csrf = data.csrfToken || state.csrf;
    state.user = data.user || state.user;
  }

  async function loadWorkspace(message = '') {
    document.querySelector('.app').classList.add('admin-loading');
    try {
      const data = await api('/api/admin/bootstrap');
      hydrate(data);
      document.getElementById('adminAuth')?.remove();
      document.querySelector('.app').classList.remove('admin-locked');
      setupHeader();
      renderAll();
      if (message) showToast(message);
    } catch (err) {
      if (!document.getElementById('adminAuth')) showFailure(err.message);
    } finally {
      document.querySelector('.app').classList.remove('admin-loading');
    }
  }

  function showFailure(message) {
    document.querySelector('.app').classList.add('admin-locked');
    document.body.insertAdjacentHTML('afterbegin', `<main class="admin-auth" id="adminAuth"><section class="auth-card"><h1>Не удалось загрузить кабинет</h1><p>${h(message)}</p><button class="btn primary" data-admin-action="reload">Повторить</button></section></main>`);
  }

  function setupHeader() {
    const pill = document.querySelector('.user-pill');
    if (pill) {
      const demo = state.user?.id === 'demo-public-admin';
      pill.innerHTML = `<span class="avatar">${h((state.user?.displayName || 'А')[0])}</span><span>${h(state.user?.displayName || 'Админ')} · ${h(roleName(state.user?.role))}</span>${demo ? '' : '<button class="logout-btn" type="button" data-admin-action="logout" aria-label="Выйти">↗</button>'}`;
    }
    const alertButton = document.querySelector('.icon-btn');
    if (alertButton) {
      alertButton.removeAttribute('onclick');
      alertButton.dataset.adminAction = 'attention';
      alertButton.textContent = String(ordersData.filter(x => x.action).length);
      alertButton.setAttribute('aria-label', 'Заказы, требующие внимания');
    }
    const input = document.querySelector('.search input');
    if (input && !input.dataset.ready) {
      input.dataset.ready = '1';
      input.addEventListener('input', () => {
        state.query = lower(input.value.trim());
        const mobileInput = document.querySelector('#mobileAdminSearch input');
        if (mobileInput && mobileInput.value !== input.value) mobileInput.value = input.value;
        renderSearchView();
      });
    }
    if (!document.getElementById('mobileAdminSearch')) {
      document.getElementById('mobileNav').insertAdjacentHTML('afterend', `<div class="mobile-admin-search" id="mobileAdminSearch"><span>${icons.search}</span><input type="search" placeholder="Поиск заказа, клиента, тура..." aria-label="Поиск по CRM"></div>`);
      document.querySelector('#mobileAdminSearch input').addEventListener('input', event => {
        state.query = lower(event.target.value.trim());
        if (input) input.value = event.target.value;
        renderSearchView();
      });
    }
  }

  function roleName(role) { return ({ manager:'Менеджер', admin:'Администратор', owner:'Владелец' })[role] || role || ''; }

  function renderAll() {
    renderDashboard(); renderDepartures(); renderOrders(); renderGroups(); renderCustomers();
    renderPayments(); renderCatalog(); renderTasks(); renderNotifications(); renderAnalytics();
  }

  function renderSearchView() {
    const current = document.querySelector('.view.active')?.id;
    ({ dashboard:renderDashboard, departures:renderDepartures, orders:renderOrders, groups:renderGroups,
      customers:renderCustomers, payments:renderPayments, catalog:renderCatalog, tasks:renderTasks, notifications:renderNotifications,
      analytics:renderAnalytics })[current]?.();
  }

  window.departureCard = function(dep) {
    const isGroup = dep.type === 'group';
    return `<article class="card departure-card">
      <div><div class="meta-row">${badgeStatus(h(dep.status))}<span class="badge ${isGroup ? 'dark' : 'blue'}">${isGroup ? 'Групповой' : 'Индивидуальный'}</span>${dep.action ? '<span class="badge red">Нужно действие</span>' : ''}</div>
      <h3 class="entity-title" style="margin-top:9px">${h(dep.tour)}</h3><div class="entity-meta">${h(dep.date)} · ${h(dep.time)}<br>${h(dep.city || 'Город не указан')} · ${h(dep.transport || 'Транспорт не назначен')}</div></div>
      <div class="metrics-box"><div class="metrics-title"><span>${isGroup ? 'Места' : 'Заказы'}</span><b>${isGroup ? `${dep.booked}/${dep.capacity}` : dep.orders.length}</b></div>
      ${isGroup ? `<div class="progress"><span style="width:${pct(dep)}%"></span></div>` : ''}
      <div class="money-list"><div class="money-line"><span>Онлайн получено</span><b>${money(dep.payments.online)}</b></div><div class="money-line"><span>Остаток</span><b>${money(dep.payments.guideDue)}</b></div></div></div>
      <div class="row-actions"><button class="btn primary" data-admin-action="open-departure" data-id="${attrId(dep.id)}">Открыть</button><button class="btn" data-admin-action="message-departure" data-id="${attrId(dep.id)}">Написать</button><button class="btn gold" data-admin-action="weather" data-id="${attrId(dep.id)}">Погода</button></div>
    </article>`;
  };

  window.renderDashboard = function() {
    const today = new Date().toISOString().slice(0, 10);
    const todayDeps = departuresData.filter(d => d.iso === today);
    const actionOrders = ordersData.filter(o => o.action);
    const paid = ordersData.reduce((sum, o) => sum + Number(o.paid || 0), 0);
    const due = ordersData.reduce((sum, o) => sum + Number(o.guideDue || 0), 0);
    document.getElementById('dashboard').innerHTML = `<section class="section"><div class="grid kpi-grid">
      <div class="card kpi"><div class="label">Выезды сегодня</div><div class="value">${todayDeps.length}</div><div class="hint">по данным D1</div></div>
      <div class="card kpi good"><div class="label">Туристов сегодня</div><div class="value">${todayDeps.reduce((s,d)=>s+d.booked,0)}</div><div class="hint">по участникам заказов</div></div>
      <div class="card kpi"><div class="label">Онлайн оплачено</div><div class="value">${money(paid)}</div><div class="hint">все подтверждённые суммы</div></div>
      <div class="card kpi warn"><div class="label">К оплате</div><div class="value">${money(due)}</div><div class="hint">остатки по заказам</div></div>
      <div class="card kpi danger"><div class="label">Требует действия</div><div class="value">${actionOrders.length}</div><div class="hint">оплата или статус</div></div>
    </div></section><section class="section status-strip"><div class="card card-pad"><div class="section-head"><div><h2 class="section-title">Что сделать сейчас</h2><p class="section-caption">Живая очередь по данным заказов.</p></div></div><div class="action-list">
      ${actionOrders.slice(0, 6).map(o => `<div class="action-item"><div class="action-dot">!</div><div><strong>${h(o.id)} · ${h(o.customer)}</strong><span>${h(o.tour)} · ${h(o.paymentStatus)}</span></div><button class="btn small primary" data-admin-action="open-order" data-id="${attrId(o.id)}">Открыть</button></div>`).join('') || '<div class="empty">Срочных задач нет</div>'}
    </div></div><div class="card card-pad"><h2 class="section-title">Контроль мест</h2><div class="chart-bar" style="margin-top:14px">${departuresData.filter(d=>d.type==='group').map(d=>`<div class="bar-row"><span>${h(d.tour)}</span><div class="bar-bg"><span style="width:${pct(d)}%"></span></div><b>${d.booked}/${d.capacity}</b></div>`).join('') || '<div class="empty">Групповых выездов пока нет</div>'}</div></div></section>
    <section class="section"><div class="section-head"><div><h2 class="section-title">Выезды сегодня</h2><p class="section-caption">Данные формируются из реальных заказов.</p></div><button class="btn" data-admin-action="go" data-view-target="departures">Все выезды</button></div><div class="departure-grid">${todayDeps.map(departureCard).join('') || empty('На сегодня выездов нет')}</div></section>`;
  };

  window.renderDepartures = function() {
    const list = departuresData.filter(d => matches(d, ['tour','date','city','status']));
    document.getElementById('departures').innerHTML = `<section class="section"><div class="section-head"><div><h2 class="section-title">Календарь выездов</h2><p class="section-caption">Сформирован из сохранённых заказов; поиск работает по туру, дате, городу и статусу.</p></div></div><div class="tabs"><button class="tab active" data-dep-filter="all">Все</button><button class="tab" data-dep-filter="group">Групповые</button><button class="tab" data-dep-filter="individual">Индивидуальные</button><button class="tab" data-dep-filter="action">Нужно действие</button></div><div id="departuresList" class="departure-grid">${list.map(departureCard).join('') || empty('Выездов пока нет')}</div></section>`;
  };

  function filteredOrders() {
    return ordersData.filter(o => matches(o, ['id','customer','phone','username','tour','date','city','paymentStatus','orderStatus']) && ({
      all:true, new:/нов/i.test(o.orderStatus), waiting:/жд/i.test(o.paymentStatus), deposit:/депозит/i.test(o.paymentStatus),
      paid:/100/i.test(o.paymentStatus), transfer:/перенос/i.test(o.orderStatus), refund:/возврат|отмен/i.test(`${o.paymentStatus} ${o.orderStatus}`),
    }[state.orderFilter] ?? true));
  }

  window.renderOrders = function() {
    const rows = filteredOrders().map(o => `<tr><td><div class="table-main">${h(o.id)}</div><div class="table-muted">${h(o.source)}</div></td><td><div class="table-main">${h(o.customer)}</div><div class="table-muted">${h(o.username)} ${h(o.phone)}</div></td><td><div class="table-main">${h(o.tour)}</div><div class="table-muted">${h(o.date)} · ${h(o.city)} · ${h(o.type)}</div></td><td>${h(o.people || o.peopleCount)}</td><td>${badgeStatus(h(o.paymentStatus))}<div class="table-muted">${money(o.paid)} / ${money(o.total)}</div></td><td>${badgeStatus(h(o.orderStatus))}</td><td><button class="btn small primary" data-admin-action="open-order" data-id="${attrId(o.id)}">Открыть</button></td></tr>`).join('');
    const tabs = [['all','Все'],['new','Новые'],['waiting','Ждут оплаты'],['deposit','Депозит'],['paid','Оплачено 100%'],['transfer','Переносы'],['refund','Возвраты']];
    document.getElementById('orders').innerHTML = `<section class="section"><div class="tabs">${tabs.map(([id,label])=>`<button class="tab ${state.orderFilter===id?'active':''}" data-order-filter="${id}">${label}</button>`).join('')}</div><div class="card data-table-card"><div class="table-scroll"><table><thead><tr><th>Заказ</th><th>Клиент</th><th>Поездка</th><th>Участники</th><th>Оплата</th><th>Статус</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="7"><div class="empty">Заказов по этому фильтру нет</div></td></tr>`}</tbody></table></div></div></section>`;
  };

  window.renderGroups = function() {
    const groups = departuresData.filter(d => d.type === 'group' && matches(d, ['tour','date','city','status']));
    document.getElementById('groups').innerHTML = `<section class="section"><div class="section-head"><div><h2 class="section-title">Управление групповым набором</h2><p class="section-caption">Вместимость и оплаты рассчитаны по текущим заказам.</p></div></div><div class="departure-grid">${groups.map(departureCard).join('') || empty('Групповых выездов пока нет')}</div></section>`;
  };

  function filteredCustomers() {
    return customersData.filter(c => matches(c, ['name','phone','username','segment','activeTrip','status']) && ({
      all:true, active:/актив/i.test(c.segment), waiting:/жд/i.test(c.status), balance:/депозит|остат/i.test(c.status), repeat:c.trips > 1, family:c.travelers > 2,
    }[state.customerFilter] ?? true));
  }

  window.renderCustomers = function() {
    const customers = filteredCustomers();
    if (!customers.some(c => c.id === state.selectedCustomerId)) state.selectedCustomerId = customers[0]?.id || '';
    const selected = customers.find(c => c.id === state.selectedCustomerId);
    const tabs = [['all','Все'],['active','Есть активная поездка'],['waiting','Ждут оплату'],['balance','Есть остаток'],['repeat','Повторные'],['family','Семьи']];
    document.getElementById('customers').innerHTML = `<section class="section"><div class="tabs">${tabs.map(([id,label])=>`<button class="tab ${state.customerFilter===id?'active':''}" data-customer-filter="${id}">${label}</button>`).join('')}</div><div class="customer-layout"><div class="card card-pad"><h2 class="section-title">Список клиентов</h2><p class="section-caption">Данные из D1, поиск по ФИО и контактам.</p><div class="customer-list" style="margin-top:12px">${customers.map(c=>`<button class="customer-row ${c.id===state.selectedCustomerId?'selected':''}" data-admin-action="select-customer" data-id="${attrId(c.id)}"><span class="client-avatar">${h(c.initials)}</span><span><span class="table-main">${h(c.name)}</span><span class="table-muted">${h(c.username)} ${h(c.phone)}<br>${h(c.segment)} · ${h(c.activeTrip)}</span></span></button>`).join('') || '<div class="empty">Клиентов пока нет</div>'}</div></div><div class="card profile-card" id="customerProfile">${selected ? customerProfile(selected) : '<div class="empty">Выберите клиента</div>'}</div></div></section>`;
  };

  function customerProfile(c) {
    const related = ordersData.filter(o => o.sessionId === c.id);
    const travelers = related[0]?.travelers || [];
    return `<div class="profile-head"><div><div class="profile-name">${h(c.name)}</div><div class="section-caption">${h(c.username)} · ${h(c.phone)} · ${h(c.source)}</div></div>${badgeStatus(h(c.status))}</div><div class="info-grid"><div class="info-tile"><b>${c.travelers}</b><span>путешественников</span></div><div class="info-tile"><b>${c.trips}</b><span>поездок</span></div><div class="info-tile"><b>${money(c.lifetime)}</b><span>оплачено</span></div></div><div class="section" style="margin-top:16px"><h3 class="section-title" style="font-size:18px">Основной и попутчики</h3><div class="traveler-list">${travelers.map(t=>`<div class="traveler"><span>${h(t[0])} · ${h(t[2])}</span><span>${h(t[1])}</span></div>`).join('') || '<div class="empty">Путешественников нет</div>'}</div></div><div class="section" style="margin-top:16px"><h3 class="section-title" style="font-size:18px">Активные и история</h3><div class="manifest">${related.map(o=>`<button class="order-mini order-mini-button" data-admin-action="open-order" data-id="${attrId(o.id)}"><span class="order-name">${h(o.tour)}</span><span class="order-sub">${h(o.date)} · ${h(o.paymentStatus)}</span></button>`).join('') || '<div class="empty">Истории нет</div>'}</div></div>${c.notes ? `<div class="editor-box"><div class="editor-title">Заметка менеджера</div><p class="section-caption">${h(c.notes)}</p></div>` : ''}<div class="tabs" style="margin-top:14px"><button class="btn primary" data-admin-action="message-customer" data-id="${attrId(c.id)}">Написать</button><button class="btn" data-admin-action="edit-customer" data-id="${attrId(c.id)}">Редактировать</button></div>`;
  }

  window.renderPayments = function() {
    const received = ordersData.reduce((s,o)=>s+Number(o.paid||0),0), due = ordersData.reduce((s,o)=>s+Number(o.guideDue||0),0);
    document.getElementById('payments').innerHTML = `<section class="section"><div class="grid kpi-grid"><div class="card kpi good"><div class="label">Онлайн получено</div><div class="value">${money(received)}</div><div class="hint">из D1</div></div><div class="card kpi"><div class="label">Депозиты</div><div class="value">${ordersData.filter(o=>/депозит/i.test(o.paymentStatus)).length}</div></div><div class="card kpi good"><div class="label">Оплачено 100%</div><div class="value">${ordersData.filter(o=>/100/i.test(o.paymentStatus)).length}</div></div><div class="card kpi warn"><div class="label">Остаток</div><div class="value">${money(due)}</div></div><div class="card kpi danger"><div class="label">Ждёт оплаты</div><div class="value">${ordersData.filter(o=>/жд/i.test(o.paymentStatus)).length}</div></div></div></section>${ordersData.length ? '<section class="section"><div class="card data-table-card"><div class="table-scroll"><table><thead><tr><th>Заказ</th><th>Клиент</th><th>Статус</th><th>Оплачено</th><th>Остаток</th><th></th></tr></thead><tbody>'+ordersData.map(o=>`<tr><td>${h(o.id)}</td><td>${h(o.customer)}</td><td>${badgeStatus(h(o.paymentStatus))}</td><td>${money(o.paid)}</td><td>${money(o.guideDue)}</td><td><button class="btn small primary" data-admin-action="open-order" data-id="${attrId(o.id)}">Открыть</button></td></tr>`).join('')+'</tbody></table></div></div></section>' : ''}`;
  };

  function tourView(tour) {
    const city = tour.city || tour.location || tour.region || '—';
    const format = Array.isArray(tour.types) ? tour.types.join(' + ') : (tour.type || tour.format || '—');
    const price = tour.priceLabel || tour.price || tour.priceFrom || '—';
    return { ...tour, city, format, price, capacity: tour.capacity || tour.maxPeople || '—', status: tour.published === false ? 'Черновик' : 'Опубликовано' };
  }

  window.renderCatalog = function() {
    const tours = state.catalog.map(tourView).filter(t => matches(t, ['title','city','format','status']));
    document.getElementById('catalog').innerHTML = `<section class="section"><div class="section-head"><div><h2 class="section-title">Туры, цены, расписания</h2><p class="section-caption">Изменения сохраняются в D1 и попадают в Mini App через общий bootstrap.</p></div><button class="btn primary" data-admin-action="edit-tour" data-id="">Добавить экскурсию</button></div><div class="card data-table-card"><div class="table-scroll"><table><thead><tr><th>Экскурсия</th><th>Город</th><th>Форматы</th><th>Цена</th><th>Вместимость</th><th>Статус</th><th></th></tr></thead><tbody>${tours.map(t=>`<tr><td><div class="table-main">${h(t.title)}</div></td><td>${h(t.city)}</td><td>${h(t.format)}</td><td>${h(t.price)}</td><td>${h(t.capacity)}</td><td>${badgeStatus(h(t.status))}</td><td><button class="btn small" data-admin-action="edit-tour" data-id="${attrId(t.id)}">Редактировать</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">Каталог не загружен</div></td></tr>'}</tbody></table></div></div></section>`;
  };

  function taskStatusLabel(status) {
    return ({ new:'Новая', in_progress:'В работе', done:'Выполнена', cancelled:'Отменена' })[status] || status || 'Новая';
  }

  function taskPriorityLabel(priority) {
    return ({ low:'Низкий', normal:'Обычный', high:'Высокий', urgent:'Срочный' })[priority] || 'Обычный';
  }

  function taskCard(task) {
    const status = taskStatusLabel(task.status);
    const priorityClass = task.priority === 'urgent' || task.priority === 'high' ? 'red' : task.priority === 'low' ? 'gray' : 'gold';
    const date = task.created_at ? new Date(task.created_at.replace(' ', 'T') + (task.created_at.includes('Z') ? '' : 'Z')).toLocaleString('ru-RU') : 'только что';
    const due = task.due_date ? ` · срок ${h(task.due_date)}` : '';
    return `<article class="card card-pad task-card"><div class="meta-row"><span class="badge ${task.status === 'done' ? 'green' : task.status === 'cancelled' ? 'gray' : 'blue'}">${h(status)}</span><span class="badge ${priorityClass}">${h(taskPriorityLabel(task.priority))}</span></div><h3 class="entity-title" style="margin-top:10px">${h(task.title)}</h3><p class="section-caption">${h(task.description || 'Без комментария')}</p><div class="entity-meta">От: директор · Ответственный: ${h(task.owner || 'Администратор')}<br>${h(date)}${due}</div><div class="row-actions">${task.status === 'new' ? `<button class="btn primary" data-admin-action="task-status" data-id="${attrId(task.id)}" data-status="in_progress">В работу</button>` : ''}${task.status === 'in_progress' ? `<button class="btn primary" data-admin-action="task-status" data-id="${attrId(task.id)}" data-status="done">Завершить</button>` : ''}${task.status !== 'done' && task.status !== 'cancelled' ? `<button class="btn" data-admin-action="task-status" data-id="${attrId(task.id)}" data-status="cancelled">Отменить</button>` : ''}</div></article>`;
  }

  window.renderTasks = function() {
    const open = state.tasks.filter(task => task.status === 'new' || task.status === 'in_progress');
    const done = state.tasks.filter(task => task.status === 'done' || task.status === 'cancelled');
    document.getElementById('tasks').innerHTML = `<section class="section"><div class="section-head"><div><h2 class="section-title">Задачи директора</h2><p class="section-caption">Новые задачи сохраняются в D1 и доступны администратору с любого устройства.</p></div><span class="badge ${open.length ? 'red' : 'green'}">Открытых: ${open.length}</span></div><div class="grid responsive-2">${open.map(taskCard).join('') || empty('Новых задач нет')}</div>${done.length ? `<div class="section-head" style="margin-top:24px"><h2 class="section-title">История</h2></div><div class="grid responsive-2">${done.map(taskCard).join('')}</div>` : ''}</section>`;
  };

  window.renderNotifications = function() {
    document.getElementById('notifications').innerHTML = `<section class="section"><div class="section-head"><div><h2 class="section-title">Автонапоминания</h2><p class="section-caption">Состояние каждого правила сохраняется в D1.</p></div></div><div class="grid responsive-2">${state.rules.map(r=>`<div class="card card-pad"><div class="profile-head"><div><div class="entity-title" style="font-size:17px">${h(r.title)}</div><div class="section-caption">${h(r.description)}</div></div><button class="switch ${r.enabled?'on':''}" type="button" data-admin-action="toggle-rule" data-id="${attrId(r.key)}" aria-pressed="${r.enabled}" aria-label="${r.enabled?'Выключить':'Включить'}"></button></div>${badgeStatus(r.requiresConfirmation?'Ручное подтверждение':(r.enabled?'Включено':'Выключено'))}</div>`).join('') || empty('Правила не найдены')}</div></section><section class="section"><div class="card card-pad"><h2 class="section-title">Ручная рассылка</h2><p class="section-caption">Сообщение сохраняется в очереди. Фактическая доставка начнётся после подключения Telegram/CRM-провайдера.</p><div class="tabs" style="margin-top:12px"><button class="btn primary" data-admin-action="broadcast">Создать рассылку</button><button class="btn" data-admin-action="broadcast-history">История (${state.broadcasts.length})</button></div></div></section>`;
  };

  window.renderAnalytics = function() {
    const a = state.analytics, maxSource = Math.max(1, ...(a.sources || []).map(x=>x[1])), maxTour = Math.max(1, ...(a.popular || []).map(x=>x[1]));
    document.getElementById('analytics').innerHTML = `<section class="section"><div class="grid kpi-grid"><div class="card kpi"><div class="label">Заказы</div><div class="value">${a.orderCount||0}</div><div class="hint">в D1</div></div><div class="card kpi good"><div class="label">Клиенты</div><div class="value">${a.customerCount||0}</div></div><div class="card kpi"><div class="label">Получено</div><div class="value">${money(a.received)}</div></div><div class="card kpi warn"><div class="label">Остаток</div><div class="value">${money(a.guideDue)}</div></div></div></section><section class="section status-strip"><div class="card card-pad"><h2 class="section-title">Источники заказов</h2><div class="chart-bar" style="margin-top:14px">${(a.sources||[]).map(x=>`<div class="bar-row"><span>${h(x[0])}</span><div class="bar-bg"><span style="width:${Math.round(x[1]/maxSource*100)}%"></span></div><b>${x[1]}</b></div>`).join('') || '<div class="empty">Данных нет</div>'}</div></div><div class="card card-pad"><h2 class="section-title">Популярные экскурсии</h2><div class="chart-bar" style="margin-top:14px">${(a.popular||[]).map(x=>`<div class="bar-row"><span>${h(x[0])}</span><div class="bar-bg"><span style="width:${Math.round(x[1]/maxTour*100)}%"></span></div><b>${x[1]}</b></div>`).join('') || '<div class="empty">Данных нет</div>'}</div></div></section>`;
  };

  window.openOrder = function(id) {
    const o = ordersData.find(x => x.id === id);
    if (!o) return showToast('Заказ не найден');
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${h(o.id)}</h2><p class="drawer-sub">${h(o.tour)} · ${h(o.date)} · ${h(o.type)}</p></div><button class="close" onclick="closeDrawer()">×</button></div><form class="admin-form" data-admin-form="booking" data-id="${attrId(o.id)}"><div class="card card-pad"><div class="profile-head"><div><div class="profile-name">${h(o.customer)}</div><div class="section-caption">${h(o.username)} · ${h(o.phone)} · ${h(o.source)}</div></div>${badgeStatus(h(o.orderStatus))}</div></div><div class="form-grid"><label>Статус заказа<input name="status" value="${h(o.orderStatus)}" required></label><label>Дата<input name="date" type="date" value="${h(o.iso)}" required></label><label>Время<input name="time" value="${h(o.time)}"></label><label>Стоимость, ₽<input name="total" type="number" min="0" value="${Number(o.total)||0}"></label><label>Оплачено, ₽<input name="paid" type="number" min="0" value="${Number(o.paid)||0}"></label><label>Остаток, ₽<input name="rest" type="number" min="0" value="${Number(o.guideDue)||0}"></label><label>Метод оплаты<input name="paymentMethod" value="${h(o.method)}"></label><label class="wide">Заметка<textarea name="adminNote" rows="3"></textarea></label></div><div class="traveler-list">${o.travelers.map(t=>`<div class="traveler"><span>${h(t[0])} · ${h(t[2])}</span><span>${h(t[1])}</span></div>`).join('') || '<div class="empty">Участников нет</div>'}</div><div class="drawer-actions"><button class="btn primary" type="submit">Сохранить изменения</button><button class="btn gold" type="button" data-admin-action="focus-transfer">Перенести дату</button><button class="btn" type="button" data-admin-action="message-order" data-id="${attrId(o.id)}">Написать клиенту</button></div><div class="form-error" role="alert"></div></form>`);
  };

  window.openDeparture = function(id) {
    const dep = departuresData.find(x => x.id === id);
    if (!dep) return showToast('Выезд не найден');
    const related = ordersData.filter(o => dep.orders.includes(o.id));
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${h(dep.tour)}</h2><p class="drawer-sub">${h(dep.date)} · ${h(dep.time)} · ${h(dep.city)}</p></div><button class="close" onclick="closeDrawer()">×</button></div><div class="card card-pad"><h3 class="section-title" style="font-size:18px">Заказы выезда</h3><div class="manifest" style="margin-top:12px">${related.map(o=>`<button class="order-mini order-mini-button" data-admin-action="open-order" data-id="${attrId(o.id)}"><span class="order-name">${h(o.id)} · ${h(o.customer)}</span><span class="order-sub">${h(o.people)} · ${h(o.paymentStatus)}</span></button>`).join('') || '<div class="empty">Заказов нет</div>'}</div><div class="drawer-actions"><button class="btn primary" data-admin-action="message-departure" data-id="${attrId(dep.id)}">Написать участникам</button><button class="btn" data-admin-action="export-manifest" data-id="${attrId(dep.id)}">Экспорт manifest</button><button class="btn gold" data-admin-action="weather" data-id="${attrId(dep.id)}">Отмена из-за погоды</button></div></div>`);
  };

  function messageForm({ bookingId = '', customerSessionId = '', title = 'Новое сообщение', preset = '' }) {
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${h(title)}</h2><p class="drawer-sub">Сообщение будет сохранено в очереди доставки.</p></div><button class="close" onclick="closeDrawer()">×</button></div><form class="admin-form" data-admin-form="message"><input type="hidden" name="bookingId" value="${h(bookingId)}"><input type="hidden" name="customerSessionId" value="${h(customerSessionId)}"><label>Канал<select name="channel"><option value="telegram">Telegram</option><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label><label>Тема<input name="subject" maxlength="250"></label><label>Сообщение<textarea name="body" rows="8" maxlength="4000" required>${h(preset)}</textarea></label><div class="drawer-actions"><button class="btn primary" type="submit">Поставить в очередь</button></div><div class="form-error" role="alert"></div></form>`);
  }

  function customerForm(customer) {
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${h(customer.name)}</h2><p class="drawer-sub">Контакты, сегмент и заметка сохраняются в CRM.</p></div><button class="close" onclick="closeDrawer()">×</button></div><form class="admin-form" data-admin-form="customer" data-id="${attrId(customer.id)}"><label>Телефон<input name="phone" value="${h(customer.phone)}"></label><label>Username<input name="username" value="${h(customer.username)}"></label><label>Источник<input name="source" value="${h(customer.source)}"></label><label>Сегмент<input name="segment" value="${h(customer.segment)}"></label><label>Статус<input name="status" value="${h(customer.status)}"></label><label>Заметка<textarea name="notes" rows="6" maxlength="4000">${h(customer.notes)}</textarea></label><div class="drawer-actions"><button class="btn primary" type="submit">Сохранить</button></div><div class="form-error" role="alert"></div></form>`);
  }

  function tourForm(tour = {}) {
    const view = tourView(tour);
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${tour.id?'Редактировать экскурсию':'Новая экскурсия'}</h2><p class="drawer-sub">Изменения сохраняются как master-source каталога.</p></div><button class="close" onclick="closeDrawer()">×</button></div><form class="admin-form" data-admin-form="tour" data-id="${attrId(tour.id || '')}"><label>ID<input name="id" value="${h(tour.id || '')}" ${tour.id?'readonly':''} pattern="[A-Za-z0-9_-]+" required></label><label>Название<input name="title" value="${h(tour.title || '')}" required></label><label>Город<input name="city" value="${h(view.city==='—'?'':view.city)}"></label><label>Формат<input name="type" value="${h(view.format==='—'?'':view.format)}"></label><label>Цена / подпись<input name="priceLabel" value="${h(view.price==='—'?'':view.price)}"></label><label>Вместимость<input name="capacity" type="number" min="1" value="${Number(view.capacity)||''}"></label><label class="check-label"><input name="published" type="checkbox" ${tour.published===false?'':'checked'}> Опубликовано</label><div class="drawer-actions"><button class="btn primary" type="submit">Сохранить экскурсию</button></div><div class="form-error" role="alert"></div></form>`);
  }

  function broadcastForm() {
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">Ручная рассылка</h2><p class="drawer-sub">Сохраняется в очереди; число получателей фиксируется при создании.</p></div><button class="close" onclick="closeDrawer()">×</button></div><form class="admin-form" data-admin-form="broadcast"><label>Сегмент<select name="segment"><option value="all">Все клиенты</option><option value="active">С активной поездкой</option><option value="balance">С остатком</option><option value="repeat">Повторные</option></select></label><label>Сообщение<textarea name="body" rows="9" maxlength="4000" required></textarea></label><div class="drawer-actions"><button class="btn primary" type="submit">Поставить в очередь</button></div><div class="form-error" role="alert"></div></form>`);
  }

  function broadcastHistory() {
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">История рассылок</h2><p class="drawer-sub">Последние сохранённые операции.</p></div><button class="close" onclick="closeDrawer()">×</button></div><div class="manifest">${state.broadcasts.map(b=>`<div class="order-mini"><div class="order-name">${h(b.segment)} · ${h(b.status)}</div><div class="order-sub">${h(b.created_at)} · ${Number(b.recipient_count)||0} получателей</div><p>${h(b.body)}</p></div>`).join('') || '<div class="empty">Рассылок пока нет</div>'}</div>`);
  }

  function exportManifest(id) {
    const dep = departuresData.find(x => x.id === id);
    if (!dep) return;
    const rows = [['Заказ','Клиент','Телефон','Участники','Оплата'], ...ordersData.filter(o=>dep.orders.includes(o.id)).map(o=>[o.id,o.customer,o.phone,o.people,o.paymentStatus])];
    const csv = rows.map(row => row.map(cell => `"${String(cell||'').replace(/"/g,'""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type:'text/csv;charset=utf-8' }));
    link.download = `manifest-${dep.iso || 'departure'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Manifest выгружен');
  }

  async function actionClick(event) {
    const target = event.target.closest('[data-admin-action]');
    if (!target) return;
    const action = target.dataset.adminAction;
    const id = decodeId(target.dataset.id || '');
    if (action === 'reload') return location.reload();
    if (action === 'logout') { try { await api('/api/admin/auth/logout', { method:'POST', body:'{}' }); } finally { location.reload(); } }
    if (action === 'go') return go(target.dataset.viewTarget);
    if (action === 'attention') { state.orderFilter='all'; state.query=''; go('orders'); renderOrders(); return; }
    if (action === 'open-order') return openOrder(id);
    if (action === 'open-departure') return openDeparture(id);
    if (action === 'select-customer') { state.selectedCustomerId=id; renderCustomers(); return; }
    if (action === 'edit-customer') return customerForm(customersData.find(c=>c.id===id));
    if (action === 'message-customer') return messageForm({ customerSessionId:id, title:`Сообщение: ${customersData.find(c=>c.id===id)?.name || 'клиент'}` });
    if (action === 'message-order') { const o=ordersData.find(x=>x.id===id); return messageForm({ bookingId:id, customerSessionId:o?.sessionId, title:`Сообщение по заказу ${id}` }); }
    if (action === 'message-departure') { const dep=departuresData.find(x=>x.id===id); return messageForm({ title:`Участникам: ${dep?.tour || ''}`, preset:`Информация по выезду ${dep?.date || ''}: ` }); }
    if (action === 'weather') { const dep=departuresData.find(x=>x.id===id); return messageForm({ title:'Предупреждение о погоде', preset:`В связи с погодными условиями выезд «${dep?.tour || ''}» требует переноса. Мы свяжемся с вами для выбора даты.` }); }
    if (action === 'export-manifest') return exportManifest(id);
    if (action === 'focus-transfer') {
      const form = target.closest('form');
      const date = form?.elements?.date;
      const status = form?.elements?.status;
      if (status && !/перенос/i.test(status.value)) status.value = 'Перенесён';
      date?.focus();
      date?.showPicker?.();
      return;
    }
    if (action === 'edit-tour') return tourForm(state.catalog.find(t=>String(t.id)===id) || {});
    if (action === 'broadcast') return broadcastForm();
    if (action === 'broadcast-history') return broadcastHistory();
    if (action === 'task-status') {
      target.disabled = true;
      try { await api(`/api/admin/tasks/${encodeURIComponent(id)}`, { method:'PATCH', body:JSON.stringify({ status: target.dataset.status }) }); await loadWorkspace('Статус задачи сохранён'); }
      catch (err) { showToast(err.message); target.disabled = false; }
      return;
    }
    if (action === 'toggle-rule') {
      const rule = state.rules.find(r=>r.key===id); if (!rule) return;
      target.disabled = true;
      try { await api(`/api/admin/notification-rules/${encodeURIComponent(id)}`, { method:'PATCH', body:JSON.stringify({ enabled:!rule.enabled }) }); await loadWorkspace('Настройка сохранена'); }
      catch (err) { showToast(err.message); target.disabled=false; }
    }
  }

  async function formSubmit(event) {
    const form = event.target.closest('[data-admin-form]');
    if (!form) return;
    event.preventDefault();
    if (state.busy) return;
    state.busy = true;
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector('.form-error');
    if (submit) submit.disabled = true;
    if (error) error.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    try {
      if (form.dataset.adminForm === 'booking') await api(`/api/admin/bookings/${encodeURIComponent(decodeId(form.dataset.id))}`, { method:'PATCH', body:JSON.stringify(data) });
      if (form.dataset.adminForm === 'customer') await api(`/api/admin/customers/${encodeURIComponent(decodeId(form.dataset.id))}`, { method:'PATCH', body:JSON.stringify(data) });
      if (form.dataset.adminForm === 'message') await api('/api/admin/messages', { method:'POST', body:JSON.stringify(data) });
      if (form.dataset.adminForm === 'broadcast') await api('/api/admin/broadcasts', { method:'POST', body:JSON.stringify(data) });
      if (form.dataset.adminForm === 'tour') {
        data.published = new FormData(form).has('published');
        data.capacity = Number(data.capacity) || undefined;
        await api(`/api/admin/tours/${encodeURIComponent(data.id)}`, { method:'PUT', body:JSON.stringify(data) });
      }
      closeDrawer();
      await loadWorkspace('Изменения сохранены в D1');
    } catch (err) {
      if (error) error.textContent = err.message; else showToast(err.message);
    } finally {
      state.busy = false;
      if (submit) submit.disabled = false;
    }
  }

  document.addEventListener('click', event => {
    const orderTab = event.target.closest('[data-order-filter]');
    if (orderTab) { state.orderFilter=orderTab.dataset.orderFilter; renderOrders(); return; }
    const customerTab = event.target.closest('[data-customer-filter]');
    if (customerTab) { state.customerFilter=customerTab.dataset.customerFilter; renderCustomers(); return; }
    const depTab = event.target.closest('[data-dep-filter]');
    if (depTab) {
      depTab.parentElement.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===depTab));
      const kind=depTab.dataset.depFilter;
      const list=departuresData.filter(d=>(kind==='all'||d.type===kind||(kind==='action'&&d.action))&&matches(d,['tour','date','city','status']));
      document.getElementById('departuresList').innerHTML=list.map(departureCard).join('')||empty('Выездов нет');
      return;
    }
    actionClick(event).catch(err => showToast(err.message));
  });
  document.addEventListener('submit', event => formSubmit(event));

  async function start() {
    document.querySelector('.app').classList.add('admin-locked');
    try {
      const status = await api('/api/admin/auth/session');
      if (!status.authenticated) return showAuth(status.setupRequired);
      state.csrf = status.csrfToken;
      state.user = status.user;
      await loadWorkspace();
    } catch (err) { showFailure(err.message); }
  }

  start();
})();
