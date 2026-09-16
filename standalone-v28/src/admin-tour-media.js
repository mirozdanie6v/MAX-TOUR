(() => {
  'use strict';

  const state = { csrf:'', tours:[], loading:false, loaded:false };
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  const ISLAND_TOURS = [
    {
      id:'orchid-monkey-islands', popular:true, title:'Остров Орхидей и Остров Обезьян', city:'Нячанг', region:'Острова Нячанга',
      duration:'1 день', time:'07:00 → около 16:00', image:'/tour-media/orchid-monkey-islands/card-cover.jpg',
      fallbackImage:'/tour-media/orchid-monkey-islands/card-cover.jpg', gallery:['/tour-media/orchid-monkey-islands/card-cover.jpg'],
      tags:['море','острова','лодка','животные','семья'], category:'Морские', childrenOk:true,
      group:{ from:'$36', adult:'$36', child:'$28', infant:'до 2 лет бесплатно', deposit:'30% или 100%', notes:['Русскоязычный гид','Микроавтобус и лодка','Обед, входные билеты и вода включены'], departures:[] },
      individual:{ from:'$350', tiers:['1–2 человека — $350','3 человека — $390','4 человека — $430','5 человек — $450','6 человек — $480'], deposit:'30% или 100%' },
      included:['Бутылка воды','Русскоязычный гид','Трансфер — микроавтобус и лодка','Обед','Все входные билеты'],
      searchText:'остров орхидей остров обезьян нячанг море острова лодка животные семья морская экскурсия', formatsLabel:'индивидуальный / групповой', priceFromUsd:36, published:true,
    },
    {
      id:'hon-tam-island', popular:true, title:'Остров Хон Там', city:'Нячанг', region:'Остров Хон Там', duration:'1 день', time:'07:00 → около 16:00',
      image:'/tour-media/hon-tam-island/card-cover.jpg', fallbackImage:'/tour-media/hon-tam-island/card-cover.jpg', gallery:['/tour-media/hon-tam-island/card-cover.jpg'],
      tags:['море','острова','снорклинг','пляж','лодка','семья'], category:'Морские', childrenOk:true,
      group:{ from:'$45', adult:'$45', child:'$35', infant:'до 2 лет бесплатно', deposit:'30% или 100%', notes:['Вариант с буфетом — $55','Буфет + грязевые ванны — $60','Русскоязычный гид','Микроавтобус и лодка','Обед, лежаки, маски и трубки включены'], departures:[] },
      included:['Бутылка воды','Русскоязычный гид','Трансфер — микроавтобус и лодка','Обед','Лежаки','Маски и трубки для снорклинга'],
      searchText:'остров хон там нячанг море острова пляж снорклинг лодка семья морская экскурсия', formatsLabel:'групповой', priceFromUsd:45, published:true,
    },
  ];

  function injectStyles() {
    if (document.getElementById('tourMediaAdminStyles')) return;
    const style = document.createElement('style');
    style.id = 'tourMediaAdminStyles';
    style.textContent = `
      .tour-media-manager{margin-bottom:18px}.tour-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:14px}
      .tour-media-card{overflow:hidden;padding:0}.tour-media-cover{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#eee8dc}
      .tour-media-body{padding:14px}.tour-media-title{font-weight:850;font-size:15px;line-height:1.2;margin-bottom:5px}.tour-media-path{font-size:11px;color:#8a8177;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:10px}
      .tour-media-edit-preview{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:18px;background:#eee8dc;border:1px solid rgba(23,23,19,.1)}
      .tour-media-file-note{font-size:12px;line-height:1.45;color:#746c62;margin-top:-4px}.tour-media-uploading{opacity:.6;pointer-events:none}
      @media(max-width:560px){.tour-media-grid{grid-template-columns:1fr 1fr;gap:10px}.tour-media-body{padding:11px}.tour-media-title{font-size:13px}.tour-media-card .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!['GET','HEAD'].includes(options.method || 'GET') && state.csrf) headers['x-csrf-token'] = state.csrf;
    const response = await fetch(path, { credentials:'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({ ok:false, error:'invalid_response' }));
    if (!response.ok || data.ok === false) {
      const messages = {
        image_type_invalid:'Поддерживаются JPG, PNG, WebP и AVIF.', image_too_large:'Фото слишком большое. Максимум 8 МБ.',
        image_empty:'Файл пустой.', media_storage_unavailable:'Хранилище фото временно недоступно.', csrf_invalid:'Сессия устарела. Обновите страницу.',
        forbidden:'Для вашей роли загрузка фото недоступна.', unauthorized:'Необходимо войти заново.', tour_not_found:'Экскурсия не найдена.',
      };
      throw new Error(messages[data.error] || 'Не удалось сохранить фотографию.');
    }
    return data;
  }

  function mergeTours(catalog) {
    const map = new Map((Array.isArray(catalog) ? catalog : []).map(tour => [String(tour.id), tour]));
    ISLAND_TOURS.forEach(tour => { if (!map.has(tour.id)) map.set(tour.id, tour); });
    return [...map.values()];
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    try {
      const data = await api('/api/admin/bootstrap');
      state.csrf = data.csrfToken || state.csrf;
      state.tours = mergeTours(data.catalog);
      state.loaded = true;
      renderPanel();
    } catch (_) {
      // The base admin application owns authentication/error UI.
    } finally {
      state.loading = false;
    }
  }

  function renderPanel() {
    const root = document.getElementById('catalog');
    if (!root || root.querySelector('#tourMediaManager')) return;
    const section = document.createElement('section');
    section.className = 'section tour-media-manager';
    section.id = 'tourMediaManager';
    section.innerHTML = `<div class="section-head"><div><h2 class="section-title">Фото экскурсий</h2><p class="section-caption">Загрузите новое главное фото — оно сохранится в R2 и сразу будет использоваться в Mini App.</p></div></div>
      <div class="tour-media-grid">${state.tours.map(tour => `<article class="card tour-media-card" data-tour-media-id="${h(tour.id)}">
        <img class="tour-media-cover" src="${h(tour.image || tour.fallbackImage || '')}" alt="${h(tour.title || '')}">
        <div class="tour-media-body"><div class="tour-media-title">${h(tour.title || tour.id)}</div><div class="tour-media-path">${h(tour.image || 'Фото не задано')}</div>
        <button class="btn small" type="button" data-tour-media-edit="${h(tour.id)}">Заменить фото</button></div></article>`).join('')}</div>`;
    root.prepend(section);
  }

  function openEditor(id) {
    const tour = state.tours.find(item => String(item.id) === String(id));
    if (!tour || typeof openDrawer !== 'function') return;
    openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">Фото экскурсии</h2><p class="drawer-sub">${h(tour.title || tour.id)}</p></div><button class="close" onclick="closeDrawer()">×</button></div>
      <form class="admin-form" id="tourMediaUploadForm">
        <img class="tour-media-edit-preview" id="tourMediaPreview" src="${h(tour.image || tour.fallbackImage || '')}" alt="Текущее фото">
        <label>Новое главное фото<input id="tourMediaFile" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required></label>
        <div class="tour-media-file-note">JPG, PNG, WebP или AVIF. Максимальный размер — 8 МБ. Старое фото останется в галерее, если оно было частью галереи.</div>
        <div class="drawer-actions"><button class="btn primary" type="submit">Загрузить и применить</button></div><div class="form-error" role="alert"></div>
      </form>`);

    const form = document.getElementById('tourMediaUploadForm');
    const fileInput = document.getElementById('tourMediaFile');
    const preview = document.getElementById('tourMediaPreview');
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { preview.src = String(reader.result || ''); };
      reader.readAsDataURL(file);
    });
    form?.addEventListener('submit', event => upload(event, tour));
  }

  async function ensureTourExists(tour) {
    const payload = { ...tour, id:String(tour.id), title:String(tour.title || tour.id), published:tour.published !== false };
    const result = await api(`/api/admin/tours/${encodeURIComponent(payload.id)}`, {
      method:'PUT', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload),
    });
    return result.tour || payload;
  }

  async function upload(event, tour) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.querySelector('input[type="file"]')?.files?.[0];
    const error = form.querySelector('.form-error');
    const submit = form.querySelector('[type="submit"]');
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) { error.textContent = 'Поддерживаются JPG, PNG, WebP и AVIF.'; return; }
    if (file.size > 8 * 1024 * 1024) { error.textContent = 'Фото слишком большое. Максимум 8 МБ.'; return; }
    error.textContent = '';
    submit.disabled = true;
    form.classList.add('tour-media-uploading');
    try {
      const storedTour = await ensureTourExists(tour);
      const result = await api(`/api/admin/tours/${encodeURIComponent(storedTour.id)}/image`, {
        method:'POST', headers:{ 'content-type':file.type, 'x-file-name':encodeURIComponent(file.name || 'image') }, body:file,
      });
      const index = state.tours.findIndex(item => String(item.id) === String(storedTour.id));
      if (index >= 0) state.tours[index] = result.tour;
      if (typeof closeDrawer === 'function') closeDrawer();
      document.getElementById('tourMediaManager')?.remove();
      renderPanel();
      if (typeof showToast === 'function') showToast('Фото экскурсии обновлено');
    } catch (err) {
      error.textContent = err.message;
    } finally {
      submit.disabled = false;
      form.classList.remove('tour-media-uploading');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-tour-media-edit]');
    if (button) openEditor(button.dataset.tourMediaEdit);
  });

  const observer = new MutationObserver(() => {
    const root = document.getElementById('catalog');
    if (!root || !root.childElementCount) return;
    if (!state.loaded) load();
    else renderPanel();
  });

  injectStyles();
  observer.observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load, { once:true });
  else load();
})();
