(function() {
  if (typeof navigator === 'undefined') return;
  var sent = {};
  function track() {
    var key = location.pathname;
    if (sent[key]) return;
    sent[key] = 1;
    var data = {
      page: location.pathname,
      referrer: document.referrer || '',
      screenWidth: screen.width,
      screenHeight: screen.height,
      language: navigator.language || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    };
    fetch('/api/v1/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(function(){});
  }
  if (document.readyState === 'complete') track();
  else window.addEventListener('load', track);
  // Track SPA navigation
  var oldPush = history.pushState;
  history.pushState = function() {
    oldPush.apply(this, arguments);
    setTimeout(track, 100);
  };
  window.addEventListener('popstate', function() { setTimeout(track, 100); });
})();
