(() => {
  'use strict';

  const ROOT_SELECTOR = '#catalog-tours';
  const CARD_SELECTOR = '.tour-card';
  const LABEL_SELECTOR = '.price-label';
  const VALUE_SELECTOR = '.price-value';
  const INDIVIDUAL_WITH_FROM = /^индивидуальный\s+от$/i;
  const FROM_PREFIX = /^от\s+/i;

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();

  function patchCard(card) {
    if (!(card instanceof Element)) return 0;
    let changed = 0;

    card.querySelectorAll(LABEL_SELECTOR).forEach(label => {
      if (!INDIVIDUAL_WITH_FROM.test(normalize(label.textContent))) return;

      const priceBlock = label.parentElement;
      const value = priceBlock?.querySelector(VALUE_SELECTOR);
      if (!value) return;

      const labelText = normalize(label.textContent).replace(/\s+от$/i, '');
      const priceText = normalize(value.textContent).replace(FROM_PREFIX, '');
      if (!priceText) return;

      label.textContent = labelText;
      value.textContent = `от\u00A0${priceText}`;
      value.dataset.individualFromInline = 'true';
      changed += 1;
    });

    return changed;
  }

  function patchCatalog(root = document.querySelector(ROOT_SELECTOR)) {
    if (!root) return 0;
    let changed = 0;
    root.querySelectorAll(CARD_SELECTOR).forEach(card => {
      changed += patchCard(card);
    });
    return changed;
  }

  function start() {
    const root = document.querySelector(ROOT_SELECTOR);
    if (!root) return;

    patchCatalog(root);
    const observer = new MutationObserver(records => {
      if (!records.some(record => record.addedNodes?.length)) return;
      patchCatalog(root);
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  globalThis.MaxTourCatalogIndividualPrice = {
    patchCard,
    patchCatalog,
  };
})();
