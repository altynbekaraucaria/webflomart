/*
 * FLOMART — keeps the address bar in step with what the visitor is looking at
 * on the normal site, without changing how the site looks:
 *   category tab "Розы"            → flomart.kz/rozy/      ("Все" → flomart.kz/)
 *   product card opened            → flomart.kz/buket/<id>/ (closed → back)
 *   menu "Торты/Клубника/Доставка" → flomart.kz/bento-torty/ ...
 * and, when someone lands directly on one of those addresses (from Google, a
 * shared link), selects that category / scrolls to that block. Product links
 * are opened by the small script in <head> that turns /buket/<id>/ into the
 * site's existing ?item=b-<id> link before the catalog loads.
 *
 * Loaded as a module after the site's own module script, so filterBouquets,
 * openViewModal and closeViewModal already exist here.
 */
(function () {
  'use strict';
  var R = window.FlomartRoutes;
  if (!R || /^\/en(\/|$)/.test(location.pathname)) return;

  var HOME_TITLE = document.title;
  var HOME_DESC = (document.querySelector('meta[name="description"]') || {}).content || '';
  var titleEl = document.querySelector('#catalog .section-title');
  var listPath = null;          // address to return to when a product is closed
  var applyingRoute = false;    // true while we follow the address (no new history entry)

  // Categories as the site currently shows them in its tabs: [{key, label}]
  function siteCategories() {
    var out = [];
    document.querySelectorAll('#cat-tabs .cat-tab').forEach(function (btn) {
      var m = (btn.getAttribute('onclick') || '').match(/'([^']+)'/);
      if (m && m[1] !== 'all') out.push({ key: m[1], label: btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim() });
    });
    return out;
  }
  function categoryPath(key) {
    if (key === 'all') return '/';
    var cat = siteCategories().filter(function (c) { return c.key === key; })[0] || { key: key };
    return '/' + R.categoryInfo(cat).slug + '/';
  }
  function setMeta(title, desc) {
    document.title = title;
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', desc);
  }

  // Catalog heading + short text for a category address.
  function showCategoryHeading(key) {
    if (!titleEl) return;
    var intro = document.getElementById('cat-route-intro');
    if (key === 'all') {
      if (titleEl.getAttribute('data-route-h')) titleEl.innerHTML = window.t ? window.t('catalog.title') : titleEl.innerHTML;
      titleEl.removeAttribute('data-route-h');
      if (intro) intro.remove();
      return;
    }
    var cat = siteCategories().filter(function (c) { return c.key === key; })[0] || { key: key };
    var info = R.categoryInfo(cat);
    titleEl.textContent = info.h1;
    titleEl.setAttribute('data-route-h', '1');
    if (!intro) {
      intro = document.createElement('p');
      intro.id = 'cat-route-intro';
      intro.style.cssText = 'margin-top:12px;max-width:560px;font-size:14px;line-height:1.6;color:var(--text-muted,#8A6E8A);';
      titleEl.insertAdjacentElement('afterend', intro);
    }
    intro.textContent = info.intro || '';
    intro.style.display = info.intro ? '' : 'none';
  }

  function go(path, state) {
    if (location.pathname === path) return;
    history.pushState(state || null, '', path);
  }

  // ── category tabs ──────────────────────────────────────────────────────
  var origFilter = window.filterBouquets;
  if (typeof origFilter === 'function') {
    window.filterBouquets = function (cat, btn) {
      origFilter(cat, btn);
      showCategoryHeading(cat);
      if (applyingRoute) return;
      var path = categoryPath(cat);
      go(path);
      if (cat === 'all') setMeta(HOME_TITLE, HOME_DESC);
      else { var c = siteCategories().filter(function (x) { return x.key === cat; })[0] || { key: cat }; var i = R.categoryInfo(c); setMeta(i.title, i.description); }
    };
  }

  // ── product view ───────────────────────────────────────────────────────
  function productName(kind, id) {
    var list = kind === 'b' ? window.rawBouquets : kind === 'c' ? window.rawCakes : window.rawBerries;
    var it = (list || []).filter(function (x) { return x.id === id; })[0];
    return it && it.name;
  }
  var origOpen = window.openViewModal;
  if (typeof origOpen === 'function') {
    window.openViewModal = function () {
      var r = origOpen.apply(this, arguments);
      var kind = arguments[11], id = arguments[12];
      if (kind && id && R.KIND_DIRS[kind]) {
        var here = R.parse(location.pathname);
        if (here.type !== 'product') listPath = location.pathname;
        var name = productName(kind, id) || arguments[3];
        if (name) setMeta(String(name).replace(/<[^>]*>/g, '') + ' — купить в Астане с доставкой | FLOMART', document.querySelector('meta[name="description"]').content);
        if (location.pathname !== R.productPath(kind, id)) {
          if (here.type === 'product') history.replaceState({ flomartProduct: 1 }, '', R.productPath(kind, id));
          else history.pushState({ flomartProduct: 1 }, '', R.productPath(kind, id));
        }
      }
      return r;
    };
  }
  var origClose = window.closeViewModal;
  if (typeof origClose === 'function') {
    window.closeViewModal = function () {
      var r = origClose.apply(this, arguments);
      if (R.parse(location.pathname).type === 'product') {
        if (history.state && history.state.flomartProduct) history.back();
        else {
          // Opened straight from a product link: show the product's section.
          history.replaceState(null, '', listPath || '/');
          var back = R.parse(listPath || '/', siteCategories());
          if (back.type === 'category' && typeof origFilter === 'function') {
            applyingRoute = true;
            try { origFilter(back.key); showCategoryHeading(back.key); } finally { applyingRoute = false; }
          }
        }
        restoreMetaFor(listPath || '/');
      }
      return r;
    };
  }
  function restoreMetaFor(path) {
    var r = R.parse(path, siteCategories());
    if (r.type === 'category') { var c = siteCategories().filter(function (x) { return x.key === r.key; })[0] || { key: r.key }; var i = R.categoryInfo(c); setMeta(i.title, i.description); }
    else if (r.type === 'section') setMeta(R.SECTIONS[r.slug].title, R.SECTIONS[r.slug].description);
    else setMeta(HOME_TITLE, HOME_DESC);
  }

  // ── menu links to blocks that have their own address ──────────────────
  var anchorToSlug = {};
  Object.keys(R.SECTIONS).forEach(function (slug) { anchorToSlug[R.SECTIONS[slug].anchor] = slug; });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    var id = a.getAttribute('href').slice(1);
    var slug = anchorToSlug[id];
    var target = id && document.getElementById(id);
    if (!target || id === 'catalog') return; // catalog keeps the current category address
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (slug) {
      go('/' + slug + '/');
      setMeta(R.SECTIONS[slug].title, R.SECTIONS[slug].description);
    } else if (R.parse(location.pathname).type !== 'home') {
      go('/'); // "О нас", "Контакты", "Акции" belong to the home page
      setMeta(HOME_TITLE, HOME_DESC);
    }
  });

  // ── back / forward ─────────────────────────────────────────────────────
  window.addEventListener('popstate', function () {
    var r = R.parse(location.pathname, siteCategories());
    var modal = document.getElementById('view-modal');
    if (r.type !== 'product' && modal && modal.style.display !== 'none') origClose();
    applyingRoute = true;
    try {
      if (r.type === 'category') window.filterBouquets(r.key);
      else if (r.type === 'home' && typeof origFilter === 'function') { origFilter('all'); showCategoryHeading('all'); }
    } finally { applyingRoute = false; }
    restoreMetaFor(location.pathname);
  });

  // ── landing directly on an address ─────────────────────────────────────
  function whenCatalogReady(cb) {
    var tries = 0;
    (function wait() {
      var grid = document.getElementById('catalog-all');
      if ((grid && grid.children.length && document.querySelector('#cat-tabs .cat-tab')) || tries++ > 60) cb();
      else setTimeout(wait, 150);
    })();
  }
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  var start = R.parse(location.pathname);
  if (start.type === 'other') start = R.parse(location.pathname, siteCategories());
  if (start.type === 'category') {
    whenCatalogReady(function () {
      var r = R.parse(location.pathname, siteCategories());
      if (r.type !== 'category') return;
      applyingRoute = true;
      try { origFilter(r.key); showCategoryHeading(r.key); } finally { applyingRoute = false; }
      // Blocks above the catalog (promotions) finish loading a moment later
      // and push it down — line it up again once they have.
      setTimeout(function () { scrollToId('catalog'); }, 700);
    });
  } else if (start.type === 'section') {
    whenCatalogReady(function () { setTimeout(function () { scrollToId(start.anchor); }, 400); });
  } else if (start.type === 'product') {
    listPath = null; // closing goes to the product's home page, or "/"
    whenCatalogReady(function () {
      if (window.rawBouquets && start.kind === 'b') {
        var b = window.rawBouquets.filter(function (x) { return x.id === start.id; })[0];
        var cats = b ? ((b.categories && b.categories.length) ? b.categories : [b.category]) : [];
        if (cats[0]) listPath = categoryPath(cats[0]);
      } else if (start.kind === 'c') listPath = '/bento-torty/';
      else if (start.kind === 's') listPath = '/klubnika-v-shokolade/';
    });
  }
})();
