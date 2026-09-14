(() => {
  'use strict';

  const TARGET = 'Показать';
  const MARK = 'catalog-show-press';
  const PRESSED = 'catalog-show-pressed';
  const pressedAt = new WeakMap();

  const normalize = value => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[→›»]+\s*$/g, '')
    .trim();

  function isTarget(button) {
    return button instanceof HTMLButtonElement && normalize(button.textContent) === TARGET;
  }

  function mark(root = document) {
    root.querySelectorAll?.('button').forEach(button => {
      if (isTarget(button)) button.classList.add(MARK);
    });
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
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mark(), { once: true });
  } else {
    mark();
  }
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
