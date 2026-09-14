(() => {
  const referrerHost = (() => {
    try { return new URL(document.referrer).hostname; } catch { return ''; }
  })();
  const isProductionEmbed = window.parent !== window && referrerHost === 'max-tour.viiversion.com';
  if (!isProductionEmbed) return;

  document.documentElement.classList.add('max-tour-production-embed');

  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const upper = (value) => normalize(value).toLocaleUpperCase('ru-RU');

  const exactLeaf = (label) => {
    const wanted = upper(label);
    return [...document.querySelectorAll('body *')].find((el) => {
      if (upper(el.textContent) !== wanted) return false;
      return ![...el.children].some((child) => normalize(child.textContent));
    }) || null;
  };

  const radius = (el) => {
    const cs = getComputedStyle(el);
    return Math.max(
      parseFloat(cs.borderTopLeftRadius) || 0,
      parseFloat(cs.borderTopRightRadius) || 0,
      parseFloat(cs.borderBottomLeftRadius) || 0,
      parseFloat(cs.borderBottomRightRadius) || 0,
    );
  };

  const chooseTile = (leaf, mode = 'small') => {
    let node = leaf?.parentElement || null;
    let best = null;
    let bestScore = -Infinity;
    for (let depth = 0; node && node !== document.body && depth < 6; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const cs = getComputedStyle(node);
      let score = 0;
      if (radius(node) >= 12) score += 5;
      if ((parseFloat(cs.borderTopWidth) || 0) > 0) score += 2;
      if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') score += 1;
      if (mode === 'small') {
        if (rect.width <= innerWidth * 0.52) score += 4;
        if (rect.height >= 48 && rect.height <= 230) score += 3;
      } else {
        if (rect.width >= innerWidth * 0.65) score += 4;
        if (rect.height >= 64 && rect.height <= 240) score += 3;
      }
      if (node.querySelectorAll('*').length <= 10) score += 1;
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  };

  const centerKnownDetailTiles = () => {
    ['ВЗРОСЛЫЙ', 'РЕБЁНОК', 'МАЛЫШИ', 'ДЕПОЗИТ', 'ГРУППА', 'ВОЗВРАТ'].forEach((label) => {
      const leaf = exactLeaf(label);
      const tile = chooseTile(leaf, 'small');
      if (tile) tile.classList.add('production-center-tile');
    });

    ['Маршрут', 'Включено'].forEach((label) => {
      const leaf = exactLeaf(label);
      const tile = chooseTile(leaf, 'wide');
      if (tile && leaf) {
        tile.classList.add('production-center-wide');
        leaf.classList.add('production-center-label');
      }
    });
  };

  const centerCompactRoundedTiles = () => {
    document.querySelectorAll('div,button,a,li,article,span').forEach((el) => {
      if (el.closest('.production-center-wide')) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (rect.width > innerWidth * 0.52 || rect.height < 34 || rect.height > 210) return;
      if (radius(el) < 12) return;
      const text = normalize(el.textContent);
      if (!text || text.length > 110) return;
      if (el.querySelectorAll('*').length > 7) return;
      el.classList.add('production-center-tile');
    });
  };

  let scheduled = false;
  const apply = () => {
    scheduled = false;
    centerKnownDetailTiles();
    centerCompactRoundedTiles();
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  });
  addEventListener('resize', schedule, { passive: true });
})();
