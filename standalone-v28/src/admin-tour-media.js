(() => {
  'use strict';

  // Despite the historical filename, this module is now the single tour editor.
  // It replaces the former separate "Фото экскурсий" manager and intercepts
  // every Catalog -> Edit action before the legacy compact drawer can open.
  const state = { csrf:'', tours:[], loading:false, loaded:false };
  const h = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const lines = value => String(value || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  const textLines = value => Array.isArray(value) ? value.filter(Boolean).join('\n') : String(value || '');
  const pretty = value => JSON.stringify(value ?? {}, null, 2);
  const toNumber = value => {
    const raw = String(value ?? '').trim().replace(',', '.');
    if (!raw) return undefined;
    const result = Number(raw);
    return Number.isFinite(result) ? result : undefined;
  };

  const TOP_LEVEL_FIELDS = new Set([
    'id','title','city','location','region','category','duration','time','type','types','format','formatsLabel',
    'priceLabel','price','priceFrom','priceFromUsd','capacity','maxPeople','published','childrenOk','popular',
    'image','fallbackImage','gallery','tags','searchText','description','subtitle','program','included','notIncluded',
    'excluded','whatToTake','recommendations','group','individual',
  ]);
  const GROUP_FIELDS = new Set(['from','adult','child','infant','deposit','notes','departures']);
  const INDIVIDUAL_FIELDS = new Set(['from','adult','child','infant','deposit','notes','tiers','departures']);

  function injectStyles() {
    if (document.getElementById('unifiedTourEditorStyles')) return;
    const style = document.createElement('style');
    style.id = 'unifiedTourEditorStyles';
    style.textContent = `
      .unified-tour-form{display:grid;gap:18px;padding-bottom:90px}.unified-tour-section{display:grid;gap:12px;padding:15px;border:1px solid rgba(226,196,155,.78);border-radius:22px;background:#fffaf2}
      .unified-tour-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.unified-tour-section-head h3{margin:0;font-size:16px;line-height:1.15}.unified-tour-section-head p{margin:4px 0 0;color:#826853;font-size:11px;line-height:1.4}
      .unified-tour-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.unified-tour-form label{display:grid;gap:6px;color:#765641;font-size:11px;font-weight:900}.unified-tour-form input,.unified-tour-form select,.unified-tour-form textarea{width:100%;border:1px solid #ead8c0;border-radius:14px;background:#fff;padding:10px 11px;color:#271005;font:inherit;font-size:13px;font-weight:700;outline:0}.unified-tour-form input,.unified-tour-form select{min-height:42px}.unified-tour-form textarea{resize:vertical;line-height:1.45}.unified-tour-form input:focus,.unified-tour-form textarea:focus,.unified-tour-form select:focus{border-color:#d8a33c;box-shadow:0 0 0 3px rgba(216,163,60,.12)}
      .unified-tour-checks{display:flex;gap:14px;flex-wrap:wrap}.unified-tour-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center!important;gap:8px!important}.unified-tour-check input{width:18px!important;height:18px!important;min-height:0!important}
      .unified-tour-photo{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:start}.unified-tour-preview{width:150px;aspect-ratio:16/10;border-radius:16px;object-fit:cover;background:#eee8dc;border:1px solid rgba(23,23,19,.1)}.unified-tour-photo-copy{display:grid;gap:10px}.unified-tour-file-note{font-size:11px;line-height:1.4;color:#826853}.unified-tour-json{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:11px!important;font-weight:600!important;tab-size:2}
      .unified-tour-save{position:sticky;bottom:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;margin:0 -4px;padding:12px 4px;background:linear-gradient(180deg,rgba(255,253,248,0),rgba(255,253,248,.94) 24%,#fffdf8 50%)}.unified-tour-save-note{font-size:11px;line-height:1.35;color:#826853}.unified-tour-uploading{opacity:.62;pointer-events:none}.unified-tour-error{color:#b00016;font-size:12px;font-weight:800;min-height:18px}.unified-tour-wide{grid-column:1/-1}
      @media(max-width:620px){.unified-tour-grid{grid-template-columns:1fr}.unified-tour-photo{grid-template-columns:1fr}.unified-tour-preview{width:100%;max-width:280px}.unified-tour-save{align-items:stretch;flex-direction:column}.unified-tour-save .btn{width:100%}.unified-tour-wide{grid-column:auto}}
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
        image_type_invalid:'Поддерживаются JPG, PNG, WebP и AVIF.',
        image_too_large:'Фото слишком большое. Максимум 8 МБ.',
        image_empty:'Файл пустой.',
        media_storage_unavailable:'Хранилище фото временно недоступно.',
        csrf_invalid:'Сессия устарела. Обновите страницу.',
        forbidden:'Для вашей роли это действие недоступно.',
        unauthorized:'Необходимо войти заново.',
        tour_not_found:'Экскурсия не найдена.',
        tour_invalid:'Проверьте ID и название экскурсии.',
      };
      throw new Error(messages[data.error] || 'Не удалось сохранить экскурсию.');
    }
    return data;
  }

  async function load(force = false) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true;
    try {
      const data = await api('/api/admin/bootstrap');
      state.csrf = data.csrfToken || state.csrf;
      state.tours = Array.isArray(data.catalog) ? data.catalog : [];
      state.loaded = true;
    } finally {
      state.loading = false;
    }
  }

  function extraObject(source, knownFields) {
    const result = {};
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    Object.entries(source).forEach(([key, value]) => {
      if (!knownFields.has(key)) result[key] = value;
    });
    return result;
  }

  function parseJsonField(form, name, fallback = {}) {
    const field = form.elements.namedItem(name);
    const raw = String(field?.value || '').trim();
    if (!raw) return fallback;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error(`Поле «${field?.dataset?.label || name}» содержит некорректный JSON.`); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Поле «${field?.dataset?.label || name}» должно содержать JSON-объект.`);
    return parsed;
  }

  function parseJsonArray(form, name, fallback = []) {
    const field = form.elements.namedItem(name);
    const raw = String(field?.value || '').trim();
    if (!raw) return fallback;
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error(`Поле «${field?.dataset?.label || name}» содержит некорректный JSON.`); }
    if (!Array.isArray(parsed)) throw new Error(`Поле «${field?.dataset?.label || name}» должно содержать JSON-массив.`);
    return parsed;
  }

  function formatValues(tour) {
    if (Array.isArray(tour.types)) return tour.types;
    if (tour.type) return [tour.type];
    if (tour.format) return [tour.format];
    return [];
  }

  function arrayValue(tour, preferred, fallback) {
    if (Array.isArray(tour?.[preferred])) return tour[preferred];
    if (fallback && Array.isArray(tour?.[fallback])) return tour[fallback];
    return [];
  }

  function section(title, note, body) {
    return `<section class="unified-tour-section"><div class="unified-tour-section-head"><div><h3>${h(title)}</h3><p>${h(note)}</p></div></div>${body}</section>`;
  }

  async function openEditor(id = '') {
    try {
      await load(true);
      const tour = state.tours.find(item => String(item.id) === String(id)) || {};
      const isNew = !tour.id;
      const group = tour.group && typeof tour.group === 'object' && !Array.isArray(tour.group) ? tour.group : {};
      const individual = tour.individual && typeof tour.individual === 'object' && !Array.isArray(tour.individual) ? tour.individual : {};
      const topExtras = extraObject(tour, TOP_LEVEL_FIELDS);
      const groupExtras = extraObject(group, GROUP_FIELDS);
      const individualExtras = extraObject(individual, INDIVIDUAL_FIELDS);
      const formats = formatValues(tour);
      const gallery = Array.isArray(tour.gallery) ? tour.gallery : [];
      const preview = tour.image || tour.fallbackImage || gallery[0] || '';
      const capacity = tour.capacity ?? tour.maxPeople ?? '';
      const priceFromUsd = tour.priceFromUsd ?? '';

      openDrawer(`<div class="drawer-head"><div><h2 class="drawer-title">${isNew ? 'Новая экскурсия' : 'Редактировать экскурсию'}</h2><p class="drawer-sub">Все данные экскурсии, цены, программа и фотографии — в одной форме.</p></div><button class="close" onclick="closeDrawer()">×</button></div>
        <form class="unified-tour-form" id="unifiedTourForm" data-tour-id="${h(tour.id || '')}">
          ${section('Основная информация','Название, география, формат и публикация.',`<div class="unified-tour-grid">
            <label>ID<input name="id" value="${h(tour.id || '')}" ${isNew ? '' : 'readonly'} pattern="[A-Za-z0-9_-]+" required></label>
            <label>Название<input name="title" value="${h(tour.title || '')}" required maxlength="250"></label>
            <label>Город<input name="city" value="${h(tour.city || tour.location || '')}"></label>
            <label>Регион / локация<input name="region" value="${h(tour.region || '')}"></label>
            <label>Категория<input name="category" value="${h(tour.category || '')}"></label>
            <label>Длительность<input name="duration" value="${h(tour.duration || '')}" placeholder="Например, 1 день"></label>
            <label>Время / график<input name="time" value="${h(tour.time || '')}" placeholder="07:00 → 18:00"></label>
            <label>Подпись форматов<input name="formatsLabel" value="${h(tour.formatsLabel || '')}"></label>
            <label class="unified-tour-wide">Форматы — по одному на строку<textarea name="typesText" rows="3">${h(textLines(formats))}</textarea></label>
            <label>Вместимость<input name="capacity" type="number" min="1" value="${h(capacity)}"></label>
            <label>Цена «от», USD<input name="priceFromUsd" type="number" min="0" step="0.01" value="${h(priceFromUsd)}"></label>
            <label class="unified-tour-wide">Цена / подпись<input name="priceLabel" value="${h(tour.priceLabel || tour.price || tour.priceFrom || '')}" placeholder="Например, от $45"></label>
          </div><div class="unified-tour-checks"><label class="unified-tour-check"><input name="published" type="checkbox" ${tour.published === false ? '' : 'checked'}> Опубликовано</label><label class="unified-tour-check"><input name="popular" type="checkbox" ${tour.popular ? 'checked' : ''}> Популярное</label><label class="unified-tour-check"><input name="childrenOk" type="checkbox" ${tour.childrenOk === false ? '' : 'checked'}> Подходит детям</label></div>`) }

          ${section('Цены и групповой формат','Тарифы, депозит, примечания и расписание группового тура.',`<div class="unified-tour-grid">
            <label>Цена от<input name="groupFrom" value="${h(group.from || '')}"></label><label>Взрослый<input name="groupAdult" value="${h(group.adult || '')}"></label>
            <label>Ребёнок<input name="groupChild" value="${h(group.child || '')}"></label><label>Младенец<input name="groupInfant" value="${h(group.infant || '')}"></label>
            <label class="unified-tour-wide">Депозит / оплата<input name="groupDeposit" value="${h(group.deposit || '')}"></label>
            <label class="unified-tour-wide">Примечания — по одному на строку<textarea name="groupNotes" rows="5">${h(textLines(group.notes))}</textarea></label>
            <label class="unified-tour-wide">Отправления / расписание (JSON)<textarea class="unified-tour-json" name="groupDepartures" data-label="Отправления группового тура" rows="6">${h(pretty(Array.isArray(group.departures) ? group.departures : []))}</textarea></label>
            <label class="unified-tour-wide">Доп. параметры группового тура (JSON)<textarea class="unified-tour-json" name="groupExtras" data-label="Дополнительные параметры группового тура" rows="5">${h(pretty(groupExtras))}</textarea></label>
          </div>`) }

          ${section('Индивидуальный формат','Тарифы по количеству участников и дополнительные правила.',`<div class="unified-tour-grid">
            <label>Цена от<input name="individualFrom" value="${h(individual.from || '')}"></label><label>Депозит / оплата<input name="individualDeposit" value="${h(individual.deposit || '')}"></label>
            <label class="unified-tour-wide">Тарифы — по одному на строку<textarea name="individualTiers" rows="6">${h(textLines(individual.tiers))}</textarea></label>
            <label class="unified-tour-wide">Примечания — по одному на строку<textarea name="individualNotes" rows="4">${h(textLines(individual.notes))}</textarea></label>
            <label class="unified-tour-wide">Отправления / расписание (JSON)<textarea class="unified-tour-json" name="individualDepartures" data-label="Отправления индивидуального тура" rows="5">${h(pretty(Array.isArray(individual.departures) ? individual.departures : []))}</textarea></label>
            <label class="unified-tour-wide">Доп. параметры индивидуального тура (JSON)<textarea class="unified-tour-json" name="individualExtras" data-label="Дополнительные параметры индивидуального тура" rows="5">${h(pretty(individualExtras))}</textarea></label>
          </div>`) }

          ${section('Описание и программа','Весь контент карточки экскурсии.',`<div class="unified-tour-grid">
            <label class="unified-tour-wide">Краткое описание<textarea name="description" rows="6">${h(tour.description || '')}</textarea></label>
            <label class="unified-tour-wide">Подзаголовок / дополнительное описание<textarea name="subtitle" rows="3">${h(tour.subtitle || '')}</textarea></label>
            <label class="unified-tour-wide">Программа — по одному пункту на строку<textarea name="program" rows="7">${h(textLines(arrayValue(tour,'program')))}</textarea></label>
            <label>Что включено — по строкам<textarea name="included" rows="7">${h(textLines(arrayValue(tour,'included')))}</textarea></label>
            <label>Что не включено — по строкам<textarea name="notIncluded" rows="7">${h(textLines(arrayValue(tour,'notIncluded','excluded')))}</textarea></label>
            <label>Что взять с собой — по строкам<textarea name="whatToTake" rows="6">${h(textLines(arrayValue(tour,'whatToTake')))}</textarea></label>
            <label>Рекомендации — по строкам<textarea name="recommendations" rows="6">${h(textLines(arrayValue(tour,'recommendations')))}</textarea></label>
            <label>Теги — по одному на строку<textarea name="tags" rows="6">${h(textLines(arrayValue(tour,'tags')))}</textarea></label>
            <label>Поисковые ключи<textarea name="searchText" rows="6">${h(tour.searchText || '')}</textarea></label>
          </div>`) }

          ${section('Фотографии','Главное фото и галерея теперь редактируются здесь, без отдельного блока «Фото экскурсий».',`<div class="unified-tour-photo">
            <img class="unified-tour-preview" id="unifiedTourPreview" src="${h(preview)}" alt="Текущее фото экскурсии">
            <div class="unified-tour-photo-copy">
              <label>Главное фото — URL<input name="image" value="${h(tour.image || '')}" placeholder="/tour-media/..."></label>
              <label>Загрузить новое главное фото<input id="unifiedTourFile" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label>
              <div class="unified-tour-file-note">JPG, PNG, WebP или AVIF, до 8 МБ. Если выбран файл, он загружается в R2 после сохранения остальных полей.</div>
              <label>Галерея — один URL на строку<textarea name="gallery" rows="7">${h(textLines(gallery))}</textarea></label>
            </div>
          </div>`) }

          ${section('Дополнительные данные','Редкие поля исходного каталога не теряются: их можно редактировать здесь.',`<label>Дополнительные поля экскурсии (JSON)<textarea class="unified-tour-json" name="topExtras" data-label="Дополнительные поля экскурсии" rows="10">${h(pretty(topExtras))}</textarea></label>`) }

          <div class="unified-tour-save"><div><div class="unified-tour-save-note">Одна кнопка сохраняет карточку, цены, программу, правила и фотографии.</div><div class="unified-tour-error" role="alert"></div></div><button class="btn primary" type="submit">Сохранить все изменения</button></div>
        </form>`);

      const form = document.getElementById('unifiedTourForm');
      const fileInput = document.getElementById('unifiedTourFile');
      const previewNode = document.getElementById('unifiedTourPreview');
      const imageInput = form?.elements.namedItem('image');
      imageInput?.addEventListener('input', () => { if (imageInput.value.trim()) previewNode.src = imageInput.value.trim(); });
      fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { previewNode.src = String(reader.result || ''); };
        reader.readAsDataURL(file);
      });
      form?.addEventListener('submit', submitUnifiedTour);
    } catch (error) {
      if (typeof showToast === 'function') showToast(error.message || 'Не удалось открыть экскурсию');
    }
  }

  function buildTourPayload(form, base) {
    const data = new FormData(form);
    const id = String(data.get('id') || '').trim().replace(/[^a-z0-9_-]/gi, '-').toLowerCase().slice(0, 100);
    const title = String(data.get('title') || '').trim();
    if (!id || !title) throw new Error('ID и название экскурсии обязательны.');

    const topExtras = parseJsonField(form, 'topExtras', {});
    const groupExtras = parseJsonField(form, 'groupExtras', {});
    const individualExtras = parseJsonField(form, 'individualExtras', {});
    const groupDepartures = parseJsonArray(form, 'groupDepartures', []);
    const individualDepartures = parseJsonArray(form, 'individualDepartures', []);
    const types = lines(data.get('typesText'));
    const capacity = toNumber(data.get('capacity'));
    const priceFromUsd = toNumber(data.get('priceFromUsd'));
    const image = String(data.get('image') || '').trim();
    const gallery = lines(data.get('gallery'));

    const group = {
      ...(base.group && typeof base.group === 'object' && !Array.isArray(base.group) ? base.group : {}),
      ...groupExtras,
      from:String(data.get('groupFrom') || '').trim(),
      adult:String(data.get('groupAdult') || '').trim(),
      child:String(data.get('groupChild') || '').trim(),
      infant:String(data.get('groupInfant') || '').trim(),
      deposit:String(data.get('groupDeposit') || '').trim(),
      notes:lines(data.get('groupNotes')),
      departures:groupDepartures,
    };
    const individual = {
      ...(base.individual && typeof base.individual === 'object' && !Array.isArray(base.individual) ? base.individual : {}),
      ...individualExtras,
      from:String(data.get('individualFrom') || '').trim(),
      deposit:String(data.get('individualDeposit') || '').trim(),
      tiers:lines(data.get('individualTiers')),
      notes:lines(data.get('individualNotes')),
      departures:individualDepartures,
    };

    const payload = {
      ...base,
      ...topExtras,
      id,
      title,
      city:String(data.get('city') || '').trim(),
      region:String(data.get('region') || '').trim(),
      category:String(data.get('category') || '').trim(),
      duration:String(data.get('duration') || '').trim(),
      time:String(data.get('time') || '').trim(),
      formatsLabel:String(data.get('formatsLabel') || '').trim(),
      types,
      type:types[0] || String(base.type || ''),
      priceLabel:String(data.get('priceLabel') || '').trim(),
      published:data.has('published'),
      popular:data.has('popular'),
      childrenOk:data.has('childrenOk'),
      tags:lines(data.get('tags')),
      searchText:String(data.get('searchText') || '').trim(),
      description:String(data.get('description') || ''),
      subtitle:String(data.get('subtitle') || ''),
      program:lines(data.get('program')),
      included:lines(data.get('included')),
      notIncluded:lines(data.get('notIncluded')),
      whatToTake:lines(data.get('whatToTake')),
      recommendations:lines(data.get('recommendations')),
      group,
      individual,
      image,
      fallbackImage:image || String(base.fallbackImage || ''),
      gallery,
    };
    if (capacity == null) { delete payload.capacity; }
    else payload.capacity = capacity;
    if (priceFromUsd == null) { delete payload.priceFromUsd; }
    else payload.priceFromUsd = priceFromUsd;
    return payload;
  }

  async function submitUnifiedTour(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const errorNode = form.querySelector('.unified-tour-error');
    const submit = form.querySelector('[type="submit"]');
    const originalId = form.dataset.tourId || '';
    const base = state.tours.find(item => String(item.id) === String(originalId)) || {};
    const file = form.elements.namedItem('imageFile')?.files?.[0];
    errorNode.textContent = '';

    if (file) {
      if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) { errorNode.textContent = 'Поддерживаются JPG, PNG, WebP и AVIF.'; return; }
      if (file.size > 8 * 1024 * 1024) { errorNode.textContent = 'Фото слишком большое. Максимум 8 МБ.'; return; }
    }

    submit.disabled = true;
    form.classList.add('unified-tour-uploading');
    try {
      let payload = buildTourPayload(form, base);
      const saved = await api(`/api/admin/tours/${encodeURIComponent(payload.id)}`, {
        method:'PUT', headers:{ 'content-type':'application/json' }, body:JSON.stringify(payload),
      });
      payload = saved.tour || payload;

      if (file) {
        const uploaded = await api(`/api/admin/tours/${encodeURIComponent(payload.id)}/image`, {
          method:'POST', headers:{ 'content-type':file.type, 'x-file-name':encodeURIComponent(file.name || 'image') }, body:file,
        });
        payload = uploaded.tour || payload;
      }

      const index = state.tours.findIndex(item => String(item.id) === String(payload.id));
      if (index >= 0) state.tours[index] = payload;
      else state.tours.push(payload);
      if (typeof closeDrawer === 'function') closeDrawer();
      await load(true).catch(() => {});
      if (typeof window.renderCatalog === 'function') window.renderCatalog();
      if (typeof showToast === 'function') showToast('Экскурсия сохранена');
    } catch (error) {
      errorNode.textContent = error.message || 'Не удалось сохранить экскурсию.';
    } finally {
      submit.disabled = false;
      form.classList.remove('unified-tour-uploading');
    }
  }

  // Capture phase is intentional: the base admin app still contains its old
  // compact form for backwards compatibility, but users only reach this editor.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-admin-action="edit-tour"]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void openEditor(decodeURIComponent(String(button.dataset.id || '')));
  }, true);

  injectStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => load().catch(() => {}), { once:true });
  else load().catch(() => {});
})();
