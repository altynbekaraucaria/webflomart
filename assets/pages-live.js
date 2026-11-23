/* Live refresh for the generated landing/product pages: the HTML already holds a
   snapshot of the catalog (for search engines and instant display); this
   re-reads Firestore so visitors always see current prices and stock. */
(function () {
  'use strict';
  var C = window.FlomartCatalog;
  var body = document.body;

  // Product gallery thumbnails.
  var main = document.getElementById('main-photo');
  document.querySelectorAll('.thumbs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (main) main.src = btn.getAttribute('data-src');
      document.querySelectorAll('.thumbs button').forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });

  if (!C || !window.fetch || !body) return;
  var page = body.getAttribute('data-page');
  if (page !== 'category' && page !== 'product') return;

  C.fetchAll(window.fetch.bind(window)).then(function (raw) {
    var state = C.buildState(raw);
    if (!state.bouquets.length) return; // never replace good content with an empty load

    if (page === 'category') {
      var source = JSON.parse(body.getAttribute('data-source') || '{}');
      var grid = document.getElementById('live-grid');
      if (grid) grid.innerHTML = C.gridHtml(C.itemsFor(state, source));
      return;
    }

    var item = C.findItem(state, body.getAttribute('data-kind'), body.getAttribute('data-id'));
    var notice = document.getElementById('live-notice');
    if (!item || !item.visible) {
      if (notice) notice.innerHTML = '<div class="notice">Сейчас этой позиции нет в наличии. Напишите нам в WhatsApp — соберём похожую, или посмотрите варианты ниже.</div>';
      return;
    }
    var price = document.getElementById('live-price');
    if (price) price.innerHTML = C.priceHtml(item);
    var name = document.getElementById('live-name');
    if (name) name.textContent = item.name;
    var order = document.getElementById('live-order');
    if (order) order.href = C.whatsappUrl(item);
  }).catch(function () { /* keep the snapshot already in the page */ });
})();
