/* EGOSYNK cookie consent + analytics loader.
 *
 * Nothing that tracks visitors loads until they press "Accept". The choice is kept in
 * localStorage (egosynk_consent = granted | denied) and can be changed from the footer's
 * "Cookie settings" link. Tag IDs come from admin → Settings → Analytics via
 * /.netlify/functions/site-config; with no IDs set, no banner is shown at all.
 *
 * Pages report store events with egoTrack(name, params). Events before consent (or with
 * consent declined) are simply dropped.
 */
(function () {
  var KEY = 'egosynk_consent';
  var config = null;
  var loaded = false;
  var queue = [];

  function getChoice() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setChoice(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadScript(src) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function loadTags() {
    if (loaded || !config) return;
    loaded = true;
    if (config.ga4Id) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      // Consent Mode v2: everything granted only because the visitor accepted.
      window.gtag('consent', 'default', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
      window.gtag('js', new Date());
      window.gtag('config', config.ga4Id, { anonymize_ip: true });
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.ga4Id));
    }
    if (config.metaPixelId) {
      /* Meta's standard pixel bootstrap */
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!window._fbq) window._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      loadScript('https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', config.metaPixelId);
      window.fbq('track', 'PageView');
    }
    queue.splice(0).forEach(function (e) { send(e[0], e[1]); });
  }

  // GA4 recommended e-commerce events, mirrored to Meta's standard events.
  var META = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase' };
  function send(name, params) {
    if (window.gtag && config && config.ga4Id) window.gtag('event', name, params || {});
    if (window.fbq && config && config.metaPixelId && META[name]) {
      var p = params || {};
      window.fbq('track', META[name], { value: p.value, currency: p.currency || 'INR',
        content_ids: (p.items || []).map(function (i) { return String(i.item_id); }), content_type: 'product' });
    }
  }

  window.egoTrack = function (name, params) {
    if (getChoice() !== 'granted') return;
    if (loaded) send(name, params); else queue.push([name, params]);
  };

  function banner() {
    if (document.getElementById('egoConsent')) return;
    var el = document.createElement('div');
    el.id = 'egoConsent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie choices');
    el.innerHTML =
      '<p>We use cookies for analytics and ads to improve EGOSYNK — only if you agree. ' +
      '<a href="/privacy-policy.html#cookies">Details</a></p>' +
      '<div><button type="button" data-v="denied">Decline</button><button type="button" data-v="granted" class="yes">Accept</button></div>';
    var css = document.createElement('style');
    css.textContent =
      '#egoConsent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:520px;margin:0 auto;background:#17181B;color:#EDEAE3;' +
      'border:1px solid #2A2B2F;border-radius:6px;padding:14px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;' +
      'font:13px/1.5 Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.45)}' +
      '#egoConsent p{flex:1 1 240px;margin:0;color:#A8A6A0}#egoConsent a{color:#E63950}' +
      '#egoConsent div{display:flex;gap:8px}#egoConsent button{border:1px solid #A8A6A0;background:none;color:#EDEAE3;' +
      'padding:9px 16px;border-radius:2px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.05em;cursor:pointer}' +
      '#egoConsent button.yes{background:#C41E3A;border-color:#C41E3A}';
    document.head.appendChild(css);
    el.addEventListener('click', function (e) {
      var v = e.target && e.target.getAttribute('data-v');
      if (!v) return;
      setChoice(v);
      el.remove();
      if (v === 'granted') withConfig(loadTags);
      else if (loaded) location.reload(); // withdrawing consent: reload without the tags
    });
    document.body.appendChild(el);
  }

  window.egoCookieSettings = function () { banner(); };

  function withConfig(cb) {
    if (config) return cb();
    fetch('/.netlify/functions/site-config').then(function (r) { return r.json(); }).then(function (c) { config = c; cb(); }).catch(function () {});
  }

  function start() {
    var choice = getChoice();
    if (choice === 'denied') return;
    withConfig(function () {
      if (!config.ga4Id && !config.metaPixelId) return; // nothing to consent to
      if (choice === 'granted') loadTags(); else banner();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
