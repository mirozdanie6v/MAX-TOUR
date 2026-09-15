(() => {
  'use strict';

  const BUTTON_SELECTOR = '#aiScreen .ai-quick-replies [data-ai-action="quick"]';
  const activePointers = new Map();
  let lastActivation = { value:'', at:0 };

  function quickButton(target) {
    return target instanceof Element ? target.closest(BUTTON_SELECTOR) : null;
  }

  function chatForm(button) {
    const screen = button?.closest('#aiScreen') || document.querySelector('#aiScreen');
    return screen?.querySelector('[data-ai-form="chat"]') || null;
  }

  function submitQuick(button, event) {
    if (!button || button.disabled) return false;
    const value = String(button.dataset.value || button.textContent || '').trim();
    if (!value) return false;

    const form = chatForm(button);
    const textarea = form?.querySelector('textarea[name="message"]');
    if (!form || !textarea || textarea.disabled) return false;

    const now = Date.now();
    if (lastActivation.value === value && now - lastActivation.at < 650) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      return true;
    }

    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    lastActivation = { value, at:now };

    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles:true }));
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    return true;
  }

  document.addEventListener('pointerdown', event => {
    const button = quickButton(event.target);
    if (!button) return;
    activePointers.set(event.pointerId, {
      button,
      x:Number(event.clientX) || 0,
      y:Number(event.clientY) || 0,
    });
  }, true);

  document.addEventListener('pointerup', event => {
    const start = activePointers.get(event.pointerId);
    activePointers.delete(event.pointerId);
    if (!start) return;
    const button = quickButton(event.target);
    if (!button || button !== start.button) return;
    const dx = (Number(event.clientX) || 0) - start.x;
    const dy = (Number(event.clientY) || 0) - start.y;
    if (Math.hypot(dx, dy) > 14) return;
    submitQuick(button, event);
  }, true);

  document.addEventListener('pointercancel', event => {
    activePointers.delete(event.pointerId);
  }, true);

  // Click remains as a fallback for browsers/WebViews without reliable pointer events.
  document.addEventListener('click', event => {
    const button = quickButton(event.target);
    if (button) submitQuick(button, event);
  }, true);

  globalThis.MaxTourAiQuickRepliesV24 = { submitQuick };
})();
