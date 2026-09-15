(() => {
  const adminButton = document.querySelector('.admin-top');
  if (adminButton) {
    // The public Mini App must not expose internal role navigation.
    // Admin and director cabinets live on the dedicated admin host.
    adminButton.remove();
  }

  // The supplied v28 prototype contains a foreign Taj Mahal photo on the
  // booked Mui Ne demo trip. Remove only that trip-card photo; catalog and
  // excursion photos elsewhere remain untouched.
  const MUI_NE_TRIP_TITLE = 'Муйне: дюны, Рыбацкая деревня и ручей Фей';

  function removeMuiNeBookedTripPhoto() {
    const title = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,strong,b'))
      .find(node => String(node.textContent || '').trim().includes(MUI_NE_TRIP_TITLE));
    if (!title) return;

    const card = title.closest('.trip-card, .booking-card, .booked-card, .trip-item, article, [class*="trip-card"], [class*="booking-card"], .card')
      || title.parentElement;
    if (!card) return;

    const image = card.querySelector('img');
    if (!image) return;

    const media = image.closest('picture, .trip-image, .trip-photo, .card-image, .booking-image, [class*="trip-image"], [class*="trip-photo"]');
    if (media && media !== card) media.remove();
    else image.remove();
  }

  const cleanTripPhoto = () => requestAnimationFrame(removeMuiNeBookedTripPhoto);
  cleanTripPhoto();

  // The trips screen is re-rendered after tab changes and booking actions.
  // Keep the correction applied whenever that DOM is rebuilt.
  new MutationObserver(cleanTripPhoto).observe(document.body, { childList: true, subtree: true });
})();
