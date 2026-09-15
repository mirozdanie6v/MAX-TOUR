(() => {
  'use strict';

  const previous = globalThis.MaxTourAI;
  const locationTest = previous?._locationTest;
  if (!previous?.mount || !locationTest?.inspectInput || !locationTest?.placeFrom || !locationTest?.placesFrom) return;

  const CASE_FIXES = [
    [/\bханоя\b/giu, 'Ханой'],
    [/\bханою\b/giu, 'Ханой'],
    [/\bнячанга\b/giu, 'Нячанг'],
    [/\bдананга\b/giu, 'Дананг'],
    [/\bфукуока\b/giu, 'Фукуок'],
    [/\bдалата\b/giu, 'Далат'],
    [/\bхойана\b/giu, 'Хойан'],
    [/\bхалонга\b/giu, 'Халонг'],
    [/\bнинь\s*биня\b/giu, 'Ниньбинь'],
    [/\bфу[йи]ена\b/giu, 'Фуйен'],
    [/\bфан\s*тьета\b/giu, 'Фантьет'],
  ];

  function normalizeRussianCases(value) {
    return CASE_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value || ''));
  }

  function placeFromFragment(fragment) {
    const normalized = normalizeRussianCases(fragment);
    return locationTest.placeFrom(normalized) || locationTest.placesFrom(normalized)?.[0] || '';
  }

  function correctionTarget(value) {
    const normalized = normalizeRussianCases(value).trim();
    if (!normalized) return '';

    const contrast = normalized.match(/(?:^|[\s,;])не\s+[^,;.!?]{0,40}?[,;]?\s+а\s+(.+)$/iu);
    if (contrast) {
      const target = placeFromFragment(contrast[1]);
      if (target) return target;
    }

    const explicitOrigin = normalized.match(/(?:^|[\s,;])(?:выезд|старт|отправление)\s+(?:будет\s+)?из\s+(.+)$/iu)
      || normalized.match(/(?:^|[\s,;])из\s+(.+)$/iu);
    if (explicitOrigin) {
      const target = placeFromFragment(explicitOrigin[1]);
      if (target) return target;
    }

    const located = normalized.match(/(?:^|[\s,;])(?:я|мы|сейчас|нахожусь|находимся|живу|живём|живем)\b[^.!?]{0,24}?(?:в|на)\s+(.+)$/iu);
    if (located) {
      const target = placeFromFragment(located[1]);
      if (target) return target;
    }

    if (/^(?:нет|нет,|неверно|ошибка|поправка|точнее|всё-таки|все-таки)\b/iu.test(normalized)
      || /(?:имею|имел|имела|имели)\s+в\s+виду/iu.test(normalized)) {
      const places = locationTest.placesFrom(normalizedRussianCasesForLookup(normalized));
      if (places.length) return places[places.length - 1];
    }

    return '';
  }

  function normalizedRussianCasesForLookup(value) {
    return normalizeRussianCases(value);
  }

  function applyCorrection(value) {
    const target = correctionTarget(value);
    if (!target) return '';
    locationTest.inspectInput(`выезд из ${target}`);
    return target;
  }

  globalThis.MaxTourAI = {
    ...previous,
    mount(root) {
      previous.mount(root);

      root.addEventListener('submit', event => {
        const value = event.target?.querySelector?.('textarea[name="message"]')?.value?.trim();
        if (value) applyCorrection(value);
      }, true);

      root.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        const value = event.target?.closest?.('textarea[name="message"]')?.value?.trim();
        if (value) applyCorrection(value);
      }, true);
    },
    _locationCorrectionV17: { normalizeRussianCases, correctionTarget, applyCorrection },
  };
})();
