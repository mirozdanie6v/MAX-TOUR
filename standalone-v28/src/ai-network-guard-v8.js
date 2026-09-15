(() => {
  'use strict';

  const TIMEOUT_MS = 8000;
  const currentFetch = globalThis.fetch;
  if (typeof currentFetch !== 'function' || currentFetch.__maxTourAiNetworkGuardV8) return;

  function isAiChatRequest(input) {
    try {
      const raw = input instanceof Request ? input.url : String(input || '');
      const url = new URL(raw, location.href);
      return url.origin === location.origin && url.pathname === '/api/ai/chat';
    } catch (_) {
      return false;
    }
  }

  const guardedFetch = function(input, init = {}) {
    if (!isAiChatRequest(input) || init?.signal) return currentFetch.call(this, input, init);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new DOMException('AI request timed out', 'TimeoutError')), TIMEOUT_MS);
    return currentFetch.call(this, input, { ...init, signal:controller.signal })
      .finally(() => clearTimeout(timer));
  };

  guardedFetch.__maxTourAiNetworkGuardV8 = true;
  guardedFetch.__maxTourAiNetworkTimeoutMs = TIMEOUT_MS;
  globalThis.fetch = guardedFetch;

  globalThis.MaxTourAINetworkGuardV8 = {
    timeoutMs:TIMEOUT_MS,
    _test:{ isAiChatRequest },
  };
})();

(() => {
  'use strict';

  if (typeof document === 'undefined') return;

  function submitQuickLocation(button) {
    const value = String(button?.dataset?.locationV6Value || '').trim();
    if (!value) return false;

    const root = button.closest('#ai,[data-screen="ai"]') || button.closest('.ai-consultant-shell')?.parentElement;
    const form = root?.querySelector?.('[data-ai-form="chat"]');
    const textarea = form?.querySelector?.('textarea[name="message"]');
    if (!form || !textarea) return false;

    textarea.value = value;
    try { globalThis.MaxTourAI?._locationTest?.inspectInput?.(value); } catch (_) {}

    textarea.dispatchEvent(new Event('input', { bubbles:true }));
    if (typeof form.requestSubmit === 'function') form.requestSubmit();
    else form.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
    return true;
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-location-v6-value]');
    if (!button) return;
    if (!submitQuickLocation(button)) return;

    // Capture-phase handling keeps the first-screen location buttons working even
    // if later AI layers replace root.onclick during a mobile rerender.
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  globalThis.MaxTourAIFirstScreenQuickV19 = {
    submitQuickLocation,
  };
})();
