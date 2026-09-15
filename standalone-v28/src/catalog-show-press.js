(() => {
  'use strict';

  const TARGETS = new Set(['Показать', 'Сбросить']);
  const MARK = 'catalog-show-press';
  const PRESSED = 'catalog-show-pressed';
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

  function patchIndividualPrices(root = document) {
    const labels = [];
    if (root instanceof Element && root.matches?.('.tour-card .price-label')) labels.push(root);
    root.querySelectorAll?.('.tour-card .price-label').forEach(label => labels.push(label));

    let changed = 0;
    labels.forEach(label => {
      if (!INDIVIDUAL_WITH_FROM.test(normalize(label.textContent))) return;
      const value = label.parentElement?.querySelector('.price-value');
      if (!value) return;

      const price = normalize(value.textContent).replace(/^от\s+/i, '');
      if (!price) return;

      const from = document.createElement('span');
      from.className = 'catalog-price-from';
      from.textContent = 'от';

      const amount = document.createElement('span');
      amount.className = 'catalog-price-amount';
      amount.textContent = price;

      label.textContent = normalize(label.textContent).replace(/\s+от$/i, '');
      value.replaceChildren(from, amount);
      value.classList.add('catalog-individual-price-inline');
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
      });
    }
    if (records.some(record => record.type === 'childList')) patchIndividualPrices(document);
  });

  const initialize = () => {
    mark();
    patchIndividualPrices(document);
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
