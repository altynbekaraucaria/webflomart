/*
 * FLOMART — readable addresses for the catalog, in Russian and English:
 *   flomart.kz/rozy/            ↔ flomart.kz/en/roses/
 *   flomart.kz/buket/<id>/      ↔ flomart.kz/en/bouquet/<id>/
 *   flomart.kz/bento-torty/     ↔ flomart.kz/en/bento-cakes/ …
 * Shared by:
 *   - assets/flomart-router.js (browser): changes the address bar as the
 *     visitor picks a category / opens a product on the normal site;
 *   - tools/build-pages.js (Node): writes a copy of the normal site at each
 *     of these addresses, with its own <title>/description for search engines.
 * A category added later in the admin panel gets an address automatically
 * (transliterated label / English label) even without an entry below.
 */
(function (root) {
  'use strict';

  // key = category key from the admin panel
  var CATEGORIES = {
    roses: {
      ru: { slug: 'rozy', h1: 'Розы в Астане с доставкой',
        title: 'Купить розы в Астане с доставкой — букеты из роз | FLOMART',
        description: 'Букеты из роз в Астане: красные, белые, розовые и пионовидные розы. Фото и цены всех букетов, доставка по городу от 1 часа. Цветочный салон FLOMART на Кенесары 45.',
        intro: 'Букеты из свежих роз — классические красные, нежные розовые и белые, ароматные пионовидные. Нужного количества или оттенка нет на фото? Напишите нам — соберём под ваш повод и бюджет.' },
      en: { slug: 'roses', h1: 'Roses in Astana with delivery',
        title: 'Buy Roses in Astana with Delivery — Rose Bouquets | FLOMART',
        description: 'Rose bouquets in Astana: red, white, pink and garden roses. Photos and prices of every bouquet, delivery across the city from 1 hour. FLOMART flower shop, 45 Kenesary St.',
        intro: 'Bouquets of fresh roses — classic red, soft pink and white, fragrant garden roses. Need a different number or colour? Message us and we will make one for your occasion and budget.' }
    },
    spray: {
      ru: { slug: 'kustovye-rozy', h1: 'Букеты из кустовых роз в Астане',
        title: 'Кустовые розы в Астане — купить букет с доставкой | FLOMART',
        description: 'Букеты из кустовых и пионовидных кустовых роз в Астане. Пышные, нежные, с доставкой по городу от 1 часа. Фото и цены — FLOMART, Кенесары 45.',
        intro: 'На каждой ветке кустовой розы несколько бутонов, поэтому букеты получаются пышными и выглядят объёмнее при той же цене.' },
      en: { slug: 'spray-roses', h1: 'Spray rose bouquets in Astana',
        title: 'Spray Roses in Astana — Bouquets with Delivery | FLOMART',
        description: 'Spray rose and garden spray rose bouquets in Astana. Lush and delicate, delivered across the city from 1 hour. Photos and prices — FLOMART, 45 Kenesary St.',
        intro: 'Every spray rose stem carries several buds, so the bouquets look fuller for the same price.' }
    },
    peonies: {
      ru: { slug: 'piony', h1: 'Пионы в Астане с доставкой',
        title: 'Купить пионы в Астане с доставкой — букеты из пионов | FLOMART',
        description: 'Букеты из пионов в Астане: разные сорта и оттенки. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
        intro: 'Пионы — сезонный цветок, выбор сортов меняется. Если нужного оттенка нет, напишите нам — подскажем, что есть сейчас.' },
      en: { slug: 'peonies', h1: 'Peonies in Astana with delivery',
        title: 'Buy Peonies in Astana with Delivery — Peony Bouquets | FLOMART',
        description: 'Peony bouquets in Astana in different varieties and colours. Photos and prices, delivery across the city from 1 hour. FLOMART flower shop.',
        intro: 'Peonies are seasonal, so the varieties change. If you don’t see the colour you want, message us and we will tell you what is available now.' }
    },
    hydrangeas: {
      ru: { slug: 'gortenzii', h1: 'Гортензии в Астане с доставкой',
        title: 'Гортензии в Астане — купить букет с доставкой | FLOMART',
        description: 'Букеты с гортензией в Астане: монобукеты и сборные букеты, комбо с бенто-тортом. Фото и цены, доставка по городу. FLOMART, Кенесары 45.',
        intro: 'Крупные пышные соцветия гортензии сами по себе выглядят как букет — монобукеты и сборные букеты с ней.' },
      en: { slug: 'hydrangeas', h1: 'Hydrangeas in Astana with delivery',
        title: 'Hydrangeas in Astana — Bouquets with Delivery | FLOMART',
        description: 'Hydrangea bouquets in Astana: single-flower and mixed bouquets, combos with a bento cake. Photos and prices, delivery across the city. FLOMART, 45 Kenesary St.',
        intro: 'Big, lush hydrangea heads look like a bouquet on their own — single-flower and mixed bouquets.' }
    },
    christ: {
      ru: { slug: 'hrizantemy', h1: 'Хризантемы в Астане с доставкой',
        title: 'Хризантемы в Астане — купить букет с доставкой | FLOMART',
        description: 'Букеты из хризантем в Астане: стойкие, яркие, по доступной цене. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
        intro: 'Хризантемы — одни из самых стойких цветов и долго стоят в вазе.' },
      en: { slug: 'chrysanthemums', h1: 'Chrysanthemums in Astana with delivery',
        title: 'Chrysanthemums in Astana — Bouquets with Delivery | FLOMART',
        description: 'Chrysanthemum bouquets in Astana: long-lasting, bright and affordable. Photos and prices, delivery across the city from 1 hour. FLOMART flower shop.',
        intro: 'Chrysanthemums are among the longest-lasting flowers in a vase.' }
    },
    mixed: {
      ru: { slug: 'sbornye-bukety', h1: 'Сборные авторские букеты в Астане',
        title: 'Сборные букеты в Астане — авторские букеты с доставкой | FLOMART',
        description: 'Авторские сборные букеты в Астане: сочетания роз, гортензий, хризантем и сезонных цветов. Фото и цены, доставка по городу от 1 часа. FLOMART.',
        intro: 'Каждый сборный букет флорист собирает вручную. Назовите повод и бюджет — соберём букет в нужной гамме.' },
      en: { slug: 'mixed-bouquets', h1: 'Mixed designer bouquets in Astana',
        title: 'Mixed Bouquets in Astana — Designer Bouquets with Delivery | FLOMART',
        description: 'Designer mixed bouquets in Astana: roses, hydrangeas, chrysanthemums and seasonal flowers. Photos and prices, delivery across the city from 1 hour. FLOMART.',
        intro: 'Every mixed bouquet is arranged by hand. Tell us the occasion and budget and we will make one in the colours you like.' }
    },
    premium: {
      ru: { slug: 'premium-bukety', h1: 'Премиальные букеты в Астане',
        title: 'Премиум букеты в Астане — большие букеты с доставкой | FLOMART',
        description: 'Большие и премиальные букеты в Астане: от 51 розы, композиции в корзинах, гигантские букеты. Фото и цены, доставка по городу. FLOMART.',
        intro: 'Букеты для особых случаев: большие монобукеты, гигантские композиции и корзины с цветами. Доставка от 45 000 тг — бесплатно.' },
      en: { slug: 'premium-bouquets', h1: 'Premium bouquets in Astana',
        title: 'Premium Bouquets in Astana — Large Bouquets with Delivery | FLOMART',
        description: 'Large and premium bouquets in Astana: 51 roses and more, flower baskets, giant bouquets. Photos and prices, delivery across the city. FLOMART.',
        intro: 'Bouquets for special occasions: large single-flower bouquets, giant arrangements and flower baskets. Free delivery on orders from 45,000 ₸.' }
    },
    compositions: {
      ru: { slug: 'cvetochnye-kompozicii', h1: 'Цветочные композиции в Астане',
        title: 'Цветочные композиции в Астане — в коробке и корзине | FLOMART',
        description: 'Цветочные композиции в коробках и корзинах в Астане. Не нужна ваза — цветы стоят во флористической губке. Фото и цены, доставка по городу. FLOMART.',
        intro: 'Композиция в коробке или корзине — готовый подарок: не нужна ваза, цветы держатся во влажной флористической губке.' },
      en: { slug: 'flower-arrangements', h1: 'Flower arrangements in Astana',
        title: 'Flower Arrangements in Astana — in a Box or Basket | FLOMART',
        description: 'Flower arrangements in boxes and baskets in Astana. No vase needed — the flowers sit in floral foam. Photos and prices, delivery across the city. FLOMART.',
        intro: 'An arrangement in a box or basket is a ready gift: no vase needed, the flowers stay in moist floral foam.' }
    },
    tulips: {
      ru: { slug: 'tyulpany', h1: 'Тюльпаны в Астане с доставкой',
        title: 'Тюльпаны в Астане — купить букет с доставкой | FLOMART',
        description: 'Букеты из тюльпанов в Астане. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.', intro: '' },
      en: { slug: 'tulips', h1: 'Tulips in Astana with delivery',
        title: 'Tulips in Astana — Bouquets with Delivery | FLOMART',
        description: 'Tulip bouquets in Astana. Photos and prices, delivery across the city from 1 hour. FLOMART flower shop.', intro: '' }
    }
  };

  // Blocks of the main page that get their own address.
  var SECTIONS = {
    berries: { anchor: 'berry-section',
      ru: { slug: 'klubnika-v-shokolade', name: 'Клубника в шоколаде',
        title: 'Клубника в шоколаде в Астане — наборы с доставкой | FLOMART',
        description: 'Наборы клубники в шоколаде в Астане: в белом, молочном и розовом шоколаде, с декором. Фото и цены, доставка по городу вместе с букетом. FLOMART.' },
      en: { slug: 'chocolate-strawberries', name: 'Chocolate strawberries',
        title: 'Chocolate-Covered Strawberries in Astana — Gift Sets with Delivery | FLOMART',
        description: 'Chocolate-covered strawberry sets in Astana: white, milk and pink chocolate with decorations. Photos and prices, delivered on their own or with a bouquet. FLOMART.' } },
    cakes: { anchor: 'cakes-section',
      ru: { slug: 'bento-torty', name: 'Бенто-торты',
        title: 'Бенто-торты в Астане — заказать с доставкой | FLOMART',
        description: 'Бенто-торты в Астане с надписью и рисунком на любой повод. Фото дизайнов и цены, доставка вместе с букетом. FLOMART.' },
      en: { slug: 'bento-cakes', name: 'Bento cakes',
        title: 'Bento Cakes in Astana — Order with Delivery | FLOMART',
        description: 'Bento cakes in Astana with a message or drawing for any occasion. Designs and prices, delivered with a bouquet. FLOMART.' } },
    delivery: { anchor: 'delivery',
      ru: { slug: 'dostavka-cvetov', name: 'Доставка цветов',
        title: 'Доставка цветов по Астане от 1 часа — FLOMART',
        description: 'Доставка цветов и букетов по Астане от 1 часа. Стоимость от 2 000 тг, бесплатно при заказе от 45 000 тг. Оплата Kaspi, картой, наличными. FLOMART, Кенесары 45.' },
      en: { slug: 'flower-delivery', name: 'Flower delivery',
        title: 'Flower Delivery in Astana from 1 Hour — FLOMART',
        description: 'Flower and bouquet delivery across Astana from 1 hour. From 2,000 ₸, free on orders from 45,000 ₸. Pay by Kaspi, card or cash. FLOMART, 45 Kenesary St.' } }
  };

  // Product addresses
  var KIND_DIRS = {
    ru: { b: 'buket', c: 'bento-tort', s: 'nabor-klubniki' },
    en: { b: 'bouquet', c: 'bento-cake', s: 'strawberry-set' }
  };

  var TRANSLIT = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
  function slugify(s) {
    return String(s || '').toLowerCase().split('').map(function (ch) { return TRANSLIT[ch] != null ? TRANSLIT[ch] : ch; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function L(lang) { return lang === 'en' ? 'en' : 'ru'; }
  function prefix(lang) { return L(lang) === 'en' ? '/en' : ''; }

  // Page info for a category in a language. `cat` = {key, label} — label in
  // that language (labelEn on the English site).
  function categoryInfo(cat, lang) {
    lang = L(lang);
    var known = CATEGORIES[cat.key];
    if (known) return known[lang];
    var label = cat.label || cat.key;
    if (lang === 'en') return { slug: slugify(label) || cat.key, h1: label + ' in Astana with delivery',
      title: label + ' in Astana — Buy with Delivery | FLOMART',
      description: label + ' in Astana: photos and prices, delivery across the city from 1 hour. FLOMART flower shop.', intro: '' };
    return { slug: slugify(label) || slugify(cat.key) || cat.key, h1: label + ' в Астане с доставкой',
      title: label + ' в Астане — купить с доставкой | FLOMART',
      description: label + ' в Астане: фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.', intro: '' };
  }
  function categoryPath(cat, lang) { return prefix(lang) + '/' + categoryInfo(cat, lang).slug + '/'; }
  function sectionInfo(id, lang) { return SECTIONS[id][L(lang)]; }
  function sectionPath(id, lang) { return prefix(lang) + '/' + SECTIONS[id][L(lang)].slug + '/'; }
  function productPath(kind, id, lang) { return prefix(lang) + '/' + KIND_DIRS[L(lang)][kind] + '/' + id + '/'; }
  function homePath(lang) { return L(lang) === 'en' ? '/en/' : '/'; }

  // Parse a path → {lang, type: home|category|section|product|other, ...}.
  // `categories` (optional) = [{key, label}] in that language, to resolve
  // slugs of categories without an entry in CATEGORIES.
  function parse(pathname, categories) {
    var parts = String(pathname || '/').split('/').filter(Boolean);
    var lang = 'ru';
    if (parts[0] === 'en') { lang = 'en'; parts.shift(); }
    var out = { lang: lang };
    if (!parts.length) { out.type = 'home'; return out; }
    if (parts.length === 2) {
      var dirs = KIND_DIRS[lang];
      for (var k in dirs) if (dirs[k] === parts[0]) { out.type = 'product'; out.kind = k; out.id = parts[1]; return out; }
    }
    out.type = 'other';
    if (parts.length !== 1) return out;
    var slug = parts[0];
    for (var s in SECTIONS) if (SECTIONS[s][lang].slug === slug) { out.type = 'section'; out.section = s; out.anchor = SECTIONS[s].anchor; return out; }
    for (var key in CATEGORIES) if (CATEGORIES[key][lang].slug === slug) { out.type = 'category'; out.key = key; return out; }
    var list = categories || [];
    for (var i = 0; i < list.length; i++) if (categoryInfo(list[i], lang).slug === slug) { out.type = 'category'; out.key = list[i].key; return out; }
    return out;
  }

  // Same place in the other language. `labels` (optional) = {key: label in
  // the target language} for categories without an entry in CATEGORIES.
  function counterpart(pathname, toLang, categories, labels) {
    var r = parse(pathname, categories);
    if (r.type === 'category') return categoryPath({ key: r.key, label: (labels || {})[r.key] }, toLang);
    if (r.type === 'section') return sectionPath(r.section, toLang);
    if (r.type === 'product') return productPath(r.kind, r.id, toLang);
    return homePath(toLang);
  }

  var api = { CATEGORIES: CATEGORIES, SECTIONS: SECTIONS, KIND_DIRS: KIND_DIRS, slugify: slugify,
    categoryInfo: categoryInfo, categoryPath: categoryPath, sectionInfo: sectionInfo, sectionPath: sectionPath,
    productPath: productPath, homePath: homePath, parse: parse, counterpart: counterpart };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlomartRoutes = api;
})(this);
