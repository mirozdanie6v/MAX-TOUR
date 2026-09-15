(() => {
  const adminButton = document.querySelector('.admin-top');
  if (!adminButton) return;

  // The public Mini App must not expose internal role navigation.
  // Admin and director cabinets live on the dedicated admin host.
  adminButton.remove();
})();
