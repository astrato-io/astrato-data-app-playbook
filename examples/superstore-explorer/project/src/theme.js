// Imported first by main.js, before the app renders: light on open,
// whatever the system preference; only a saved choice of dark overrides it.
(() => {
  let choice = null;
  try {
    choice = localStorage.getItem('superstore-explorer.theme');
  } catch {}
  document.documentElement.dataset.theme = choice === 'dark' ? 'dark' : 'light';
})();
