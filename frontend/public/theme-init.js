// Sets <html data-theme> from the saved choice before the app renders. Dark is the default.
(function () {
  var theme = 'dark';
  try {
    if (window.localStorage.getItem('socialboard-theme') === 'light') theme = 'light';
  } catch (e) {
    /* storage unavailable: keep the default */
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
