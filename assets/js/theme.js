(() => {
  const key = 'novelara-theme';
  const saved = localStorage.getItem(key);
  const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved === 'dark' || saved === 'light' ? saved : (systemDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = initial;
  function mount() {
    if (document.getElementById('themeToggle')) return;
    const b = document.createElement('button');
    b.id = 'themeToggle';
    b.type = 'button';
    b.className = 'theme-toggle';
    b.setAttribute('aria-label', 'Ganti mode warna');
    b.title = 'Ganti mode terang/gelap';
    const update = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      b.textContent = dark ? '☀️ Terang' : '🌙 Gelap';
      b.setAttribute('aria-pressed', String(dark));
    };
    b.onclick = () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(key, next);
      update();
    };
    const host = document.querySelector('.header-inner, .nav-wrap, .admin-brand, .login-card');
    if (host && host.classList.contains('login-card')) {
      host.insertBefore(b, host.firstChild);
    } else if (host) {
      host.appendChild(b);
    } else {
      document.body.appendChild(b);
    }
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();