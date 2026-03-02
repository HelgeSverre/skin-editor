// Runs in MAIN world — has access to page's JS context
// Patches XMLHttpRequest.setRequestHeader and fetch to capture Discord auth token

(function() {
  let lastToken = null;

  // Patch XMLHttpRequest
  const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (name.toLowerCase() === 'authorization' && value && !value.startsWith('Bot ')) {
      if (value !== lastToken) {
        lastToken = value;
        window.dispatchEvent(new CustomEvent('__skin_scraper_token__', { detail: { token: value } }));
      }
    }
    return origSetRequestHeader.apply(this, arguments);
  };

  // Patch fetch
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      if (init?.headers) {
        let auth = null;
        if (init.headers instanceof Headers) {
          auth = init.headers.get('Authorization') || init.headers.get('authorization');
        } else if (Array.isArray(init.headers)) {
          const pair = init.headers.find(([k]) => k.toLowerCase() === 'authorization');
          if (pair) auth = pair[1];
        } else if (typeof init.headers === 'object') {
          auth = init.headers['Authorization'] || init.headers['authorization'];
        }
        if (auth && !auth.startsWith('Bot ') && auth !== lastToken) {
          lastToken = auth;
          window.dispatchEvent(new CustomEvent('__skin_scraper_token__', { detail: { token: auth } }));
        }
      }
    } catch (e) {
      // Don't break Discord's fetch
    }
    return origFetch.apply(this, arguments);
  };
})();
