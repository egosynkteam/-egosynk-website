// Shared header and footer for the store's secondary pages (see site.css). Loaded as the
// first thing in <body>, so the header is in place before the page paints; the footer
// goes in once the page has loaded.
(function(){
  const here = location.pathname;
  const cur = (href) => href === here ? ' aria-current="page"' : '';
  const body = document.body;
  body.classList.add('site-shell');

  const nav = document.createElement('header');
  nav.className = 'site-nav';
  nav.innerHTML = `
    <a class="site-logo" href="/"><span>EGO</span>SYNK</a>
    <div class="site-right">
      <a class="site-shop" href="/#shop">Shop</a>
      <a class="site-icon" href="/account.html" title="Account" aria-label="Account"${cur('/account.html')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </a>
      <a class="site-icon" href="/#bag" title="Bag" aria-label="Bag">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <span class="site-count" id="siteBagCount" hidden></span>
      </a>
    </div>`;
  body.prepend(nav);

  // Same bag the home and product pages use.
  function bagCount(){
    let cart = [];
    try{ cart = JSON.parse(localStorage.getItem('egosynk_cart') || sessionStorage.getItem('egosynk_cart') || '[]'); } catch(e){}
    const n = Array.isArray(cart) ? cart.reduce((s, c) => s + (Number(c.qty) || 0), 0) : 0;
    const el = document.getElementById('siteBagCount');
    el.textContent = n; el.hidden = !n;
  }
  bagCount();
  addEventListener('storage', (e) => { if(e.key === 'egosynk_cart') bagCount(); });

  const links = [
    ['/#shop', 'Shop'], ['/shipping-policy.html', 'Shipping'], ['/refund-policy.html', 'Returns & exchanges'],
    ['/terms.html', 'Terms'], ['/privacy-policy.html', 'Privacy'], ['/contact.html', 'Contact'], ['/bulk.html', 'Bulk orders'],
  ];
  document.addEventListener('DOMContentLoaded', () => {
    const foot = document.createElement('footer');
    foot.className = 'site-foot';
    foot.innerHTML = `<div class="site-links">${links.map(([h, t]) => `<a href="${h}"${cur(h)}>${t.replace('&', '&amp;')}</a>`).join('')}
      <a href="#" onclick="window.egoCookieSettings&&egoCookieSettings();return false;">Cookie settings</a></div>
      <div class="site-legal">© ${new Date().getFullYear()} EGOSYNK.COM · GSTIN 27AKHPY6964E1ZI</div>`;
    body.append(foot);
  });
})();
