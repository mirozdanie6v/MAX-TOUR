(() => {
  'use strict';

  const TARGETS = new Set(['Показать', 'Сбросить']);
  const MARK = 'catalog-show-press';
  const PRESSED = 'catalog-show-pressed';
  const CATALOG = '#catalog-tours';
  const INDIVIDUAL_WITH_FROM = /^индивидуальный\s+от$/i;
  const pressedAt = new WeakMap();

  const normalize = value => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[→›»]+\s*$/g, '')
    .trim();

  function isTarget(button) {
    return button instanceof HTMLButtonElement && TARGETS.has(normalize(button.textContent));
  }

  function mark(root = document) {
    root.querySelectorAll?.('button').forEach(button => {
      if (isTarget(button)) button.classList.add(MARK);
    });
  }

  function catalogRootFor(root = document) {
    if (root === document) return document.querySelector(CATALOG);
    if (!(root instanceof Element)) return null;
    if (root.matches(CATALOG)) return root;
    return root.closest(CATALOG) || root.querySelector(CATALOG);
  }

  function patchIndividualPrices(root = document) {
    const catalog = catalogRootFor(root);
    if (!catalog) return 0;
    let changed = 0;

    catalog.querySelectorAll('.tour-card .price-label').forEach(label => {
      if (!INDIVIDUAL_WITH_FROM.test(normalize(label.textContent))) return;
      const value = label.parentElement?.querySelector('.price-value');
      if (!value) return;

      const price = normalize(value.textContent).replace(/^от\s+/i, '');
      if (!price) return;

      label.textContent = normalize(label.textContent).replace(/\s+от$/i, '');
      value.textContent = `от\u00A0${price}`;
      value.dataset.individualFromInline = 'true';
      changed += 1;
    });

    return changed;
  }

  function targetFromEvent(event) {
    const button = event.target?.closest?.(`button.${MARK}`);
    return button && isTarget(button) ? button : null;
  }

  function press(button) {
    if (!button || button.disabled) return;
    pressedAt.set(button, performance.now());
    button.classList.add(PRESSED);
  }

  function release(button) {
    if (!button) return;
    const started = pressedAt.get(button) || performance.now();
    const elapsed = performance.now() - started;
    const delay = Math.max(0, 110 - elapsed);
    window.setTimeout(() => button.classList.remove(PRESSED), delay);
  }

  document.addEventListener('pointerdown', event => {
    const button = targetFromEvent(event);
    if (button) press(button);
  }, true);

  document.addEventListener('pointerup', event => release(targetFromEvent(event)), true);
  document.addEventListener('pointercancel', event => release(targetFromEvent(event)), true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const button = event.target?.closest?.(`button.${MARK}`);
    if (button && isTarget(button)) press(button);
  }, true);

  document.addEventListener('keyup', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const button = event.target?.closest?.(`button.${MARK}`);
    if (button) release(button);
  }, true);

  const observer = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.('button') && isTarget(node)) node.classList.add(MARK);
        mark(node);
        patchIndividualPrices(node);
      });
    }
  });

  const initialize = () => {
    mark();
    patchIndividualPrices();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
  observer.observe(document.documentElement, { childList: true, subtree: true });

  globalThis.MaxTourCatalogUi = {
    patchIndividualPrices,
  };
})();
