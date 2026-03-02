// Runs in ISOLATED world — can use chrome.runtime APIs
// Listens for token events from the MAIN world script and forwards to service worker

window.addEventListener('__skin_scraper_token__', (event) => {
  const token = event.detail?.token;
  if (token) {
    chrome.runtime.sendMessage({ type: 'TOKEN_CAPTURED', token }).catch(() => {
      // Service worker might not be ready yet, that's OK
    });
  }
});
