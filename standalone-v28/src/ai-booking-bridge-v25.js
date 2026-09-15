(() => {
  'use strict';

  if (typeof document === 'undefined') return;

  const AI_STATE_KEY = 'max-tour-ai-consultant-v5';
  const BOOKING_INTENT_KEY = 'max-tour-ai-booking-intent-v1';
  let transitionInFlight = false;

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const lower = value => clean(value).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');

  function readAiState() {
    try { return JSON.parse(sessionStorage.getItem(AI_STATE_KEY) || 'null') || {}; }
    catch (_) { return {}; }
  }

  function tourById(id) {
    try { return Array.isArray(TOURS) ? TOURS.find(tour => String(tour?.id) === String(id)) || null : null; }
    catch (_) { return null; }
  }

  function bookingIntent(tourId) {
    const state = readAiState();
    const slots = state?.slots || {};
    const tour = tourById(tourId);
    const tripType = String(slots.tripType || '');
    const format = tripType === 'group' || tripType === 'individual' ? tripType : 'compare';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(slots.date || '')) ? String(slots.date) : '';
    return {
      tourId:String(tourId || ''),
      title:clean(tour?.title || ''),
      format,
      date,
      adults:Math.max(1, Number(slots.adults || 0)),
      children:Array.isArray(slots.children) ? slots.children.slice(0, 12) : [],
      infants:Math.max(0, Number(slots.infants || 0)),
      createdAt:new Date().toISOString(),
      source:'AI-консультант',
    };
  }

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0;
  }

  function activeTourScreen() {
    const candidates = [
      document.getElementById('tourScreen'),
      ...document.querySelectorAll('[id*="tour" i][class*="screen" i], [data-screen="tour"]'),
    ].filter(Boolean);
    return candidates.find(isVisible) || null;
  }

  function bookingButtonInTour(screen) {
    if (!screen) return null;
    const buttons = [...screen.querySelectorAll('button,[role="button"]')].filter(button => {
      if (!isVisible(button) || button.disabled) return false;
      if (button.closest('#aiScreen') || button.matches('[data-ai-action]')) return false;
      const text = lower(button.textContent || button.getAttribute('aria-label') || '');
      return /^(?:присоединиться|забронировать|оформить|выбрать дату|к бронированию)$/.test(text)
        || /присоединиться|забронировать|оформить бронирование|перейти к бронированию/.test(text);
    });
    return buttons[0] || null;
  }

  function bookingScreenVisible() {
    const direct = document.getElementById('bookingScreen');
    if (direct && isVisible(direct)) return true;
    return [...document.querySelectorAll('[id*="booking" i][class*="screen" i], [data-screen="booking"]')].some(isVisible);
  }

  function openTourSafely(tourId) {
    if (typeof globalThis.openTour !== 'function') return false;
    globalThis.openTour(tourId);
    return true;
  }

  function continueOnceToBooking(attempt = 0) {
    if (bookingScreenVisible()) {
      transitionInFlight = false;
      return;
    }

    const screen = activeTourScreen();
    if (screen) {
      const button = bookingButtonInTour(screen);
      if (button && !button.dataset.aiBridgeClicked) {
        button.dataset.aiBridgeClicked = '1';
        button.click();
        window.setTimeout(() => {
          transitionInFlight = false;
        }, 700);
        return;
      }
    }

    if (attempt < 20) {
      window.setTimeout(() => continueOnceToBooking(attempt + 1), 100);
      return;
    }

    // Safe fallback: leave the real tour card open instead of repeatedly
    // clicking controls across the whole document. The customer can continue
    // manually and the app remains responsive.
    transitionInFlight = false;
  }

  function handleAiBookingClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.('#aiScreen [data-ai-action="book-tour"]');
    if (!button) return;

    // The manager-approval guard is registered earlier in capture phase. If it
    // blocks this click with stopImmediatePropagation, this handler is never
    // reached, which preserves the approval-before-payment rule.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (transitionInFlight) return;
    const tourId = clean(button.dataset.id || button.closest('[data-tour-id]')?.dataset.tourId || '');
    if (!tourId) return;

    transitionInFlight = true;
    try { sessionStorage.setItem(BOOKING_INTENT_KEY, JSON.stringify(bookingIntent(tourId))); } catch (_) {}

    try {
      if (!openTourSafely(tourId)) {
        transitionInFlight = false;
        return;
      }
      window.setTimeout(() => continueOnceToBooking(0), 80);
    } catch (error) {
      console.warn('[MAX TOUR AI] safe booking bridge failed:', error);
      transitionInFlight = false;
    }
  }

  document.addEventListener('click', handleAiBookingClick, true);

  globalThis.MaxTourAiBookingBridgeV25 = {
    bookingIntent,
    activeTourScreen,
    bookingButtonInTour,
    bookingScreenVisible,
    _test:{ isVisible },
  };
})();
