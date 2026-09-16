(() => {
  'use strict';

  const adminButton = document.querySelector('.admin-top');
  if (adminButton) {
    // The public Mini App must not expose internal role navigation.
    // Admin and director cabinets live on the dedicated admin host.
    adminButton.remove();
  }

  // Real location photos are mirrored into the demo's private R2 bucket during
  // deploy. Runtime uses only same-origin R2 URLs so Telegram/browser clients
  // do not depend on third-party image hosts.
  const IMAGES = {
    muine: '/tour-media/muine-dunes-jeep/card-cover.jpg',
    orchidMonkey: '/tour-media/orchid-monkey-islands/card-cover.jpg',
    honTam: '/tour-media/hon-tam-island/card-cover.jpg',
  };

  const isMuiNe = value => /муйне|mui\s*ne/i.test(String(value || ''));

  function patchTourData() {
    try {
      if (typeof TOURS === 'undefined' || !Array.isArray(TOURS)) return;
      TOURS.forEach(tour => {
        const id = String(tour?.id || '');
        let image = '';
        if (id === 'orchid-monkey-islands') image = IMAGES.orchidMonkey;
        else if (id === 'hon-tam-island') image = IMAGES.honTam;
        else if (id === 'muine-dunes-jeep' || isMuiNe(tour?.title)) image = IMAGES.muine;
        if (!image) return;
        tour.image = image;
        tour.fallbackImage = image;
        tour.gallery = [image];
      });
    } catch (_) {}
  }

  function patchTripData() {
    try {
      if (typeof demoTrips === 'undefined' || !Array.isArray(demoTrips)) return;
      demoTrips.forEach(trip => {
        if (String(trip?.tourId || '') !== 'muine-dunes-jeep' && !isMuiNe(trip?.title)) return;
        trip.image = IMAGES.muine;
        trip.fallbackImage = IMAGES.muine;
        if ('gallery' in trip) trip.gallery = [IMAGES.muine];
      });
    } catch (_) {}
  }

  function applyImage(card, image) {
    if (!(card instanceof Element)) return;

    card.querySelectorAll('img').forEach(img => {
      img.src = image;
      img.removeAttribute('srcset');
      img.style.removeProperty('display');
      img.style.removeProperty('visibility');
      img.style.removeProperty('opacity');
    });

    const media = card.querySelector('.tour-image,.trip-image,.trip-photo,.card-image,.booking-image,.tour-photo,.wide-card-image,[class*="tour-image"],[class*="trip-image"],[class*="trip-photo"],[class*="card-image"],[class*="booking-image"],.photo,.thumb');
    if (media) {
      media.style.backgroundImage = `url("${image}")`;
      media.style.backgroundSize = 'cover';
      media.style.backgroundPosition = 'center';
      media.style.backgroundRepeat = 'no-repeat';
    }
  }

  function patchRenderedCards(root = document) {
    const selector = '.tour-card,.wide-card,.trip-card,.booking-card,.booked-card,.trip-item,[class*="tour-card"],[class*="trip-card"],[class*="booking-card"],article,.card';
    const cards = [];
    if (root instanceof Element && root.matches?.(selector)) cards.push(root);
    root.querySelectorAll?.(selector).forEach(card => cards.push(card));

    cards.forEach(card => {
      const text = String(card.textContent || '');
      if (/Остров Орхидей|Остров Обезьян/i.test(text)) applyImage(card, IMAGES.orchidMonkey);
      else if (/Остров Хон Там/i.test(text)) applyImage(card, IMAGES.honTam);
      else if (isMuiNe(text)) applyImage(card, IMAGES.muine);
    });
  }

  function patchAll(root = document) {
    patchTourData();
    patchTripData();
    patchRenderedCards(root);
  }

  const schedulePatch = root => requestAnimationFrame(() => patchAll(root || document));
  schedulePatch(document);
  window.setTimeout(() => patchAll(document), 100);
  window.setTimeout(() => patchAll(document), 500);
  window.setTimeout(() => patchAll(document), 1500);

  // Island tours are injected by catalog-show-press.js after this file runs,
  // and trip cards are rebuilt on navigation/actions. Re-apply on every DOM
  // mount so the correct images survive all re-renders.
  new MutationObserver(records => {
    patchTourData();
    patchTripData();
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) schedulePatch(node);
    }));
  }).observe(document.body, { childList:true, subtree:true });

  globalThis.MaxTourCardImages = { patchAll, images: IMAGES };
})();
