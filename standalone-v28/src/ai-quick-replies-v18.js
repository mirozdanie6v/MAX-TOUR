(() => {
  'use strict';

  const QUESTION_SETS = [
    {
      id:'preferences',
      match:text => /что\s+вам[^?]{0,80}(?:интересн|больше)|что\s+интересн|природ[^?]{0,50}мор[^?]{0,50}(?:истор|город|культур)|мор[^?]{0,50}природ[^?]{0,50}(?:истор|город|культур)/iu.test(text),
      options:[
        ['Природа','Хочу природу и красивые виды'],
        ['Море','Хочу море и острова'],
        ['История и культура','Хочу историю, культуру и достопримечательности'],
      ],
    },
    {
      id:'budget',
      match:text => /подешевле|без\s+переплат|программа\s+интереснее|чуть\s+дороже|цена\s+важнее/iu.test(text) && /\?/u.test(text),
      options:[
        ['Подешевле','Подешевле'],
        ['Интереснее программа','Хочу более интересную и насыщенную программу'],
      ],
    },
    {
      id:'party',
      match:text => /сколько\s+(?:вас|человек)|кто\s+едет|вы\s+вдво[её]м|каким\s+составом|состав\s+группы/iu.test(text),
      options:[
        ['2 взрослых','Нас 2 взрослых'],
        ['С ребёнком','2 взрослых и ребёнок 7 лет'],
      ],
    },
    {
      id:'date',
      match:text => /(?:на\s+какой\s+день|когда\s+(?:хотите|планируете)|какая\s+дата|по\s+дате|день\s+поездки)/iu.test(text),
      options:[
        ['Сегодня','Сегодня'],
        ['Завтра','Завтра'],
        ['Дата гибкая','Дата гибкая'],
      ],
    },
    {
      id:'format',
      match:text => /группов[^?]{0,45}индивиду|индивидуальн[^?]{0,45}групп|какой\s+формат/iu.test(text),
      options:[
        ['Групповой','Хочу групповой формат'],
        ['Индивидуальный','Хочу индивидуальную экскурсию'],
        ['Сравнить','Сравните оба формата'],
      ],
    },
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value || '').replace(/\s+/g,' ').trim();

  function lastBotQuestion(root) {
    const nodes = [...root.querySelectorAll('.ai-msg.bot .ai-msg-text')];
    return normalize(nodes.at(-1)?.textContent || '');
  }

  function setForQuestion(text) {
    return QUESTION_SETS.find(set => set.match(text)) || null;
  }

  function expectedHtml(set) {
    return set.options.map(([label,value]) => `<button type="button" data-ai-action="quick" data-value="${esc(value)}">${esc(label)}</button>`).join('');
  }

  function sync(root) {
    if (!root) return;
    const question = lastBotQuestion(root);
    const set = setForQuestion(question);
    let box = root.querySelector('.ai-quick-replies');

    if (!set) {
      // If the latest assistant message is not a question covered by quick actions,
      // never leave a stale answer set from a previous turn on screen.
      if (box && /\?\s*$/u.test(question)) box.remove();
      return;
    }

    if (!box) {
      const below = root.querySelector('.ai-chat-below');
      if (!below) return;
      box = document.createElement('div');
      box.className = 'ai-quick-replies';
      below.prepend(box);
    }

    const signature = `${set.id}:${question}`;
    if (box.dataset.aiQuickV18 === signature) return;
    box.dataset.aiQuickV18 = signature;
    box.innerHTML = expectedHtml(set);
  }

  let queued = false;
  function schedule(root) {
    if (queued) return;
    queued = true;
    const run = () => { queued = false; sync(root); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  function mount() {
    const root = document.getElementById('ai') || document.querySelector('[data-screen="ai"], .ai-consultant-shell')?.closest?.('[id]');
    if (!root) return false;
    schedule(root);
    const observer = new MutationObserver(() => schedule(root));
    observer.observe(root, { childList:true, subtree:true });
    return true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else if (!mount()) {
    const boot = new MutationObserver(() => { if (mount()) boot.disconnect(); });
    boot.observe(document.documentElement, { childList:true, subtree:true });
  }

  globalThis.MaxTourAIQuickRepliesV18 = { setForQuestion, lastBotQuestion, sync };
})();
