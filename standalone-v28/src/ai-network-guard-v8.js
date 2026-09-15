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
