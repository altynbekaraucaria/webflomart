/*
 * FLOMART catalog — shared data + card rendering for the SEO landing pages
 * (/rozy/, /piony/, /buket/<id>/ ...).
 *
 * The same file runs in two places:
 *   1. tools/build-pages.js (Node) — bakes a snapshot of the catalog into
 *      static HTML, so search engines see real products in the page source.
 *   2. The browser, on those pages — re-reads Firestore on every visit and
 *      re-renders, so a visitor always sees today's prices/stock even if the
 *      snapshot is a few hours old.
 *
 * It reads Firestore through its public REST API (the same public read access
 * the main site already uses) and mirrors the main site's rules: hidden items,
 * disabled categories, sale prices, auto-priced cakes/berries and the short
 * "Р1 / С3" display codes.
 */
(function (root) {
  'use strict';

  var PROJECT = 'flomart-website';
  var API = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/';
  var SITE = 'https://flomart.kz';
  var WHATSAPP = '77751596448';

  // Only the fields the pages need — keeps each visitor's download small.
  var MASKS = {
    categories: ['key', 'label', 'enabled', 'order', 'emoji'],
    flowers: ['price', 'markup', 'hidden'],
    settings: [],
    bouquets: ['name', 'desc', 'price', 'salePrice', 'category', 'categories', 'photoUrl', 'photos',
      'photoZoom', 'photoPosX', 'photoPosY', 'hidden', 'order', 'code', 'ingredients', 'comboLabel'],
    cakes: ['name', 'desc', 'price', 'photoUrl', 'photoZoom', 'photoPosX', 'photoPosY', 'hidden', 'order',
      'ingredients', 'autoPrice', 'filling'],
    berries: ['name', 'desc', 'price', 'photoUrl', 'photoZoom', 'photoPosX', 'photoPosY', 'hidden', 'order',
      'ingredients', 'autoPrice', 'subtitle', 'badge', 'qty']
  };

  // Stable, readable URL folders for each kind of product page.
  var KIND = {
    b: { dir: 'buket', label: 'Букет' },
    c: { dir: 'bento-tort', label: 'Бенто-торт' },
    s: { dir: 'nabor-klubniki', label: 'Клубника в шоколаде' }
  };

  // ── Firestore REST helpers ────────────────────────────────────────────────
  function decode(v) {
    if (v == null) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
    return null;
  }
  function decodeFields(fields) {
    var out = {};
    Object.keys(fields || {}).forEach(function (k) { out[k] = decode(fields[k]); });
    return out;
  }
  function decodeDoc(doc) {
    var o = decodeFields(doc.fields || {});
    o.id = String(doc.name || '').split('/').pop();
    return o;
  }

  // fetchFn: window.fetch in the browser, global fetch in Node 18+.
  function fetchCollection(fetchFn, name) {
    var docs = [];
    var mask = (MASKS[name] || []).map(function (f) { return '&mask.fieldPaths=' + encodeURIComponent(f); }).join('');
    function page(token) {
      var url = API + name + '?pageSize=300' + mask + (token ? '&pageToken=' + encodeURIComponent(token) : '');
      return fetchFn(url).then(function (r) {
        if (!r.ok) throw new Error('Firestore ' + name + ': HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        docs = docs.concat((j.documents || []).map(decodeDoc));
        return j.nextPageToken ? page(j.nextPageToken) : docs;
      });
    }
    return page('');
  }

  function fetchAll(fetchFn, names) {
    names = names || ['categories', 'flowers', 'settings', 'bouquets', 'cakes', 'berries'];
    var raw = {};
    return Promise.all(names.map(function (n) {
      return fetchCollection(fetchFn, n).then(function (d) { raw[n] = d; });
    })).then(function () { return raw; });
  }

  // ── Catalog rules (mirrors index.html) ───────────────────────────────────
  function byOrder(tieBreak) {
    return function (a, b) {
      var ao = a.order, bo = b.order;
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      return tieBreak(a, b);
    };
  }
  function byName(a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); }
  function byCode(a, b) { return (a.code || '').localeCompare(b.code || '', 'ru'); }

  function buildState(raw) {
    var categories = (raw.categories || []).slice().sort(byOrder(function () { return 0; }));
    var flowers = raw.flowers || [];
    var settings = {};
    (raw.settings || []).forEach(function (s) { Object.keys(s).forEach(function (k) { if (k !== 'id') settings[k] = s[k]; }); });
    settings.bentoPrice = settings.bentoPrice || 5000;

    var flowerById = {};
    flowers.forEach(function (f) { flowerById[f.id] = f; });
    function isHidden(item) {
      if (item.hidden) return true;
      return (item.ingredients || []).some(function (ing) { var f = flowerById[ing.flowerId]; return f && f.hidden; });
    }
    function autoPrice(item) {
      var total = (item.ingredients || []).reduce(function (s, ing) {
        var f = flowerById[ing.flowerId];
        return f ? s + ((f.price || 0) + (f.markup || 0)) * (ing.qty || 1) : s;
      }, 0);
      return Math.ceil(total / 100) * 100;
    }
    function catOf(key) {
      for (var i = 0; i < categories.length; i++) if (categories[i].key === key) return categories[i];
      return null;
    }
    function catEnabled(key) { var c = catOf(key); return c ? c.enabled !== false : true; }
    function bqCats(b) { return (b.categories && b.categories.length) ? b.categories : [b.category]; }

    var bouquets = (raw.bouquets || []).slice().sort(byOrder(byCode));
    var seq = {};
    bouquets.forEach(function (b) {
      var c = catOf(bqCats(b)[0]);
      var letter = (((c && c.label) || bqCats(b)[0] || '').trim()[0] || 'Б').toUpperCase();
      seq[letter] = (seq[letter] || 0) + 1;
      b.displayCode = letter + seq[letter];
      b.kind = 'b';
      b.cats = bqCats(b);
      var sale = b.salePrice && b.price && b.salePrice < b.price;
      b.oldPrice = sale ? b.price : null;
      b.finalPrice = sale ? b.salePrice : (b.price || null);
      b.visible = !isHidden(b) && b.cats.some(catEnabled);
    });

    var cakes = (raw.cakes || []).slice().sort(byOrder(byName));
    cakes.forEach(function (c) {
      c.kind = 'c';
      c.finalPrice = c.autoPrice && c.ingredients && c.ingredients.length ? autoPrice(c) : (c.price || settings.bentoPrice);
      c.filling = c.filling || 'Вупи Пай';
      c.visible = !isHidden(c);
    });

    var berries = (raw.berries || []).slice().sort(byOrder(byName));
    berries.forEach(function (s) {
      s.kind = 's';
      s.finalPrice = s.autoPrice && s.ingredients && s.ingredients.length ? autoPrice(s) : (s.price || null);
      s.visible = !isHidden(s);
    });

    return {
      categories: categories,
      bouquets: bouquets,
      cakes: cakes,
      berries: berries,
      settings: settings,
      catOf: catOf,
      catEnabled: catEnabled
    };
  }

  // Items for one landing page: {type:'category', key} | {type:'cakes'} | {type:'berries'}
  function itemsFor(state, source) {
    if (source.type === 'cakes') return state.cakes.filter(function (x) { return x.visible; });
    if (source.type === 'berries') return state.berries.filter(function (x) { return x.visible; });
    return state.bouquets.filter(function (b) { return b.visible && b.cats.indexOf(source.key) !== -1; });
  }

  function findItem(state, kind, id) {
    var list = kind === 'b' ? state.bouquets : kind === 'c' ? state.cakes : state.berries;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    // Thin, non-breaking thousands separator, same look as toLocaleString('ru').
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }
  function priceText(item) { return item.finalPrice ? money(item.finalPrice) + ' тг' : 'Цена по запросу'; }

  function cldUrl(url, width, settings) {
    if (!url) return url;
    var marker = '/image/upload/';
    var idx = url.indexOf(marker);
    if (idx === -1) return url;
    var chain = 'f_auto,q_auto' + (width ? ',w_' + width : '') + ',c_limit';
    if (settings) {
      // Same baked-in "FLOMART" watermark as the main site's large photos.
      var baseW = width || 800;
      var fontSize = Math.max(14, Math.round(baseW * (settings.watermarkSize || 17) / 100));
      var off = Math.max(6, Math.round(fontSize * (settings.watermarkOffset || 90) / 100));
      var pos = settings.watermarkPosition || 'south';
      var axis = {
        north_west: [off, off], north: [0, off], north_east: [off, off], west: [off, 0], center: [0, 0],
        east: [off, 0], south_west: [off, off], south: [0, off], south_east: [off, off]
      }[pos] || [0, off];
      chain += '/l_text:Arial_' + fontSize + '_bold:' + encodeURIComponent(settings.watermarkText || 'FLOMART') +
        ',co_white,o_' + (settings.watermarkOpacity || 45) + '/fl_layer_apply,g_' + pos + ',x_' + axis[0] + ',y_' + axis[1];
    }
    return url.slice(0, idx + marker.length) + chain + '/' + url.slice(idx + marker.length);
  }

  function framingCss(item) {
    var z = item.photoZoom || 1;
    var x = item.photoPosX != null ? item.photoPosX : 50;
    var y = item.photoPosY != null ? item.photoPosY : 50;
    return 'object-position:' + x + '% ' + y + '%;transform:scale(' + z + ');transform-origin:' + x + '% ' + y + '%;';
  }

  function photosOf(item) {
    var list = (item.photos || []).map(function (p) { return p && p.url; }).filter(Boolean);
    if (!list.length && item.photoUrl) list = [item.photoUrl];
    return list;
  }

  function itemPath(item) { return '/' + KIND[item.kind].dir + '/' + item.id + '/'; }
  function itemUrl(item) { return SITE + itemPath(item); }

  function orderText(item) {
    if (item.kind === 'b') return (item.displayCode ? item.displayCode + ' — ' : '') + item.name + ', ' + priceText(item);
    if (item.kind === 'c') return item.name + ', ' + item.filling + ', ' + priceText(item);
    return item.name + ', ' + priceText(item);
  }
  function whatsappUrl(item) {
    var text = 'Здравствуйте! Хочу заказать: ' + orderText(item) + '\n' + itemUrl(item);
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
  }

  function badgeOf(item) {
    if (item.kind === 'b') return item.displayCode || '';
    if (item.kind === 's') return item.badge || 'Новинка';
    return 'Новинка';
  }
  function emojiOf(item) { return item.kind === 'c' ? '🎂' : item.kind === 's' ? '🍓' : '💐'; }

  function priceHtml(item) {
    if (item.oldPrice) {
      return '<span class="price-old">' + money(item.oldPrice) + '</span><span class="price-sale">' + priceText(item) + '</span>';
    }
    return '<span class="price">' + priceText(item) + '</span>';
  }

  function cardHtml(item) {
    var photo = photosOf(item)[0];
    var img = photo
      ? '<img src="' + esc(cldUrl(photo, 500)) + '" alt="' + esc(item.name) + '" loading="lazy" style="' + framingCss(item) + '">'
      : '<div class="product-img-bg">' + emojiOf(item) + '</div>';
    return '<article class="product-card">' +
      '<a class="product-link" href="' + itemPath(item) + '">' +
        '<div class="product-img">' + img +
          '<span class="product-badge">' + esc(badgeOf(item)) + '</span>' +
          (item.oldPrice ? '<span class="sale-badge">🏷️ Акция</span>' : '') +
        '</div>' +
        '<div class="product-body"><h3 class="product-name">' + esc(item.name) + '</h3></div>' +
      '</a>' +
      '<div class="product-footer">' +
        '<div class="product-price">' + priceHtml(item) + '</div>' +
        '<a class="btn-order" href="' + esc(whatsappUrl(item)) + '" target="_blank" rel="noopener">Заказать</a>' +
      '</div>' +
    '</article>';
  }

  function gridHtml(items) {
    if (!items.length) return '<p class="cat-empty">Скоро здесь появятся новые позиции — напишите нам в WhatsApp, соберём на заказ.</p>';
    return items.map(cardHtml).join('');
  }

  var api = {
    SITE: SITE, WHATSAPP: WHATSAPP, KIND: KIND,
    fetchAll: fetchAll, buildState: buildState, itemsFor: itemsFor, findItem: findItem,
    esc: esc, money: money, priceText: priceText, priceHtml: priceHtml, cldUrl: cldUrl, framingCss: framingCss,
    photosOf: photosOf, itemPath: itemPath, itemUrl: itemUrl, whatsappUrl: whatsappUrl, orderText: orderText,
    cardHtml: cardHtml, gridHtml: gridHtml, emojiOf: emojiOf, badgeOf: badgeOf, decodeDoc: decodeDoc
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlomartCatalog = api;
})(this);
