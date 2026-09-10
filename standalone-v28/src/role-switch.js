(() => {
  const adminButton = document.querySelector('.admin-top');
  if (!adminButton) return;

  // The approved v3 cabinet replaces the legacy inline admin screen.
  // Keep every historical entry point inside the Mini App on the protected route.
  window.showAdmin = () => window.location.assign('/admin/');

  const roleSwitch = document.createElement('div');
  roleSwitch.className = 'max-role-switch';
  roleSwitch.setAttribute('aria-label', 'Переключение роли');
  roleSwitch.innerHTML = `
    <a class="max-role-switch__item is-active" href="/" aria-current="page">
      <span class="max-role-switch__long">Турист</span><span class="max-role-switch__short">Турист</span>
    </a>
    <a class="max-role-switch__item" href="/admin/" aria-label="Открыть кабинет администратора">
      <span class="max-role-switch__long">Админ</span><span class="max-role-switch__short">Админ</span>
    </a>`;

  adminButton.replaceWith(roleSwitch);
})();
