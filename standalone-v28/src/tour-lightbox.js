(() => {
  const MEDIA_PREFIX = '/tour-media/';
  let modal = null;
  let modalImage = null;
  let counter = null;
  let prevButton = null;
  let nextButton = null;
  let gallery = [];
  let index = 0;
  let previousOverflow = '';
  let catalogPromise = null;
  let touchStartX = null;

  function pathFromImage(image) {
    try {
      return new URL(image.currentSrc || image.src, window.location.href).pathname;
    } catch {
      return '';
    }
  }

  function isTourImage(image) {
    return image instanceof HTMLImageElement && pathFromImage(image).startsWith(MEDIA_PREFIX);
  }

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('/catalog.v28.json', { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);
          return response.json();
        })
        .catch(() => []);
    }
    return catalogPromise;
  }

  function uniquePaths(values) {
    return [...new Set(values.filter(value => typeof value === 'string' && value.startsWith(MEDIA_PREFIX)))];
  }

  async function resolveGallery(path) {
    const catalog = await loadCatalog();
    const tour = Array.isArray(catalog)
      ? catalog.find(item => uniquePaths([item.image, item.fallbackImage, ...(item.gallery || [])]).includes(path))
      : null;
    if (!tour) return { paths: [path], title: '' };
    const paths = uniquePaths([...(tour.gallery || []), tour.image, tour.fallbackImage]);
    return { paths: paths.length ? paths : [path], title: String(tour.title || '') };
  }

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'tour-lightbox';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Просмотр фотографии экскурсии');
    modal.innerHTML = `
      <div class="tour-lightbox__backdrop" data-lightbox-close></div>
      <div class="tour-lightbox__stage">
        <button class="tour-lightbox__close" type="button" data-lightbox-close aria-label="Закрыть фотографию">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <button class="tour-lightbox__nav tour-lightbox__nav--prev" type="button" data-lightbox-prev aria-label="Предыдущее фото">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <figure class="tour-lightbox__figure">
          <img class="tour-lightbox__image" alt="Фотография экскурсии">
          <figcaption class="tour-lightbox__caption">
            <span class="tour-lightbox__title"></span>
            <span class="tour-lightbox__counter"></span>
          </figcaption>
        </figure>
        <button class="tour-lightbox__nav tour-lightbox__nav--next" type="button" data-lightbox-next aria-label="Следующее фото">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>`;
    document.body.appendChild(modal);
    modalImage = modal.querySelector('.tour-lightbox__image');
    counter = modal.querySelector('.tour-lightbox__counter');
    prevButton = modal.querySelector('[data-lightbox-prev]');
    nextButton = modal.querySelector('[data-lightbox-next]');

    modal.addEventListener('click', event => {
      if (event.target.closest('[data-lightbox-close]')) close();
      if (event.target.closest('[data-lightbox-prev]')) move(-1);
      if (event.target.closest('[data-lightbox-next]')) move(1);
    });

    modal.addEventListener('touchstart', event => {
      touchStartX = event.touches?.[0]?.clientX ?? null;
    }, { passive: true });
    modal.addEventListener('touchend', event => {
      if (touchStartX == null) return;
      const endX = event.changedTouches?.[0]?.clientX;
      if (typeof endX === 'number' && Math.abs(endX - touchStartX) > 55 && gallery.length > 1) {
        move(endX < touchStartX ? 1 : -1);
      }
      touchStartX = null;
    }, { passive: true });
  }

  function render() {
    if (!modalImage || !gallery.length) return;
    modalImage.src = gallery[index];
    counter.textContent = gallery.length > 1 ? `${index + 1} / ${gallery.length}` : '';
    const hasMultiple = gallery.length > 1;
    prevButton.hidden = !hasMultiple;
    nextButton.hidden = !hasMultiple;
  }

  function move(delta) {
    if (gallery.length < 2) return;
    index = (index + delta + gallery.length) % gallery.length;
    render();
  }

  async function open(path, alt = '') {
    ensureModal();
    gallery = [path];
    index = 0;
    modalImage.alt = alt || 'Фотография экскурсии';
    modal.querySelector('.tour-lightbox__title').textContent = '';
    render();
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    modal.querySelector('.tour-lightbox__close').focus({ preventScroll: true });

    const resolved = await resolveGallery(path);
    if (modal.hidden) return;
    gallery = resolved.paths;
    index = Math.max(0, gallery.indexOf(path));
    modal.querySelector('.tour-lightbox__title').textContent = resolved.title;
    render();
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = previousOverflow;
    window.setTimeout(() => {
      if (!modal.classList.contains('is-open')) modal.hidden = true;
    }, 180);
  }

  document.addEventListener('click', event => {
    const image = event.target.closest?.('img');
    if (!isTourImage(image)) return;
    event.preventDefault();
    event.stopPropagation();
    open(pathFromImage(image), image.alt || '');
  }, true);

  document.addEventListener('keydown', event => {
    if (!modal || modal.hidden) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') move(-1);
    if (event.key === 'ArrowRight') move(1);
  });
})();
