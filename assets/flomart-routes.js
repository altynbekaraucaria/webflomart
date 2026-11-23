/*
 * FLOMART — readable addresses for the catalog (flomart.kz/rozy/, /piony/,
 * /buket/<id>/ ...). Shared by:
 *   - assets/flomart-router.js (browser): changes the address bar as the
 *     visitor picks a category / opens a product on the normal site;
 *   - tools/build-pages.js (Node): writes a copy of the normal site at each
 *     of these addresses, with its own <title>/description for search engines.
 * A category added later in the admin panel gets an address automatically
 * (transliterated label) even without an entry below.
 */
(function (root) {
  'use strict';

  // key = category key from the admin panel
  var CATEGORIES = {
    roses: {
      slug: 'rozy', h1: 'Розы в Астане с доставкой',
      title: 'Купить розы в Астане с доставкой — букеты из роз | FLOMART',
      description: 'Букеты из роз в Астане: красные, белые, розовые и пионовидные розы. Фото и цены всех букетов, доставка по городу от 1 часа. Цветочный салон FLOMART на Кенесары 45.',
      intro: 'Букеты из свежих роз — классические красные, нежные розовые и белые, ароматные пионовидные. Нужного количества или оттенка нет на фото? Напишите нам — соберём под ваш повод и бюджет.'
    },
    spray: {
      slug: 'kustovye-rozy', h1: 'Букеты из кустовых роз в Астане',
      title: 'Кустовые розы в Астане — купить букет с доставкой | FLOMART',
      description: 'Букеты из кустовых и пионовидных кустовых роз в Астане. Пышные, нежные, с доставкой по городу от 1 часа. Фото и цены — FLOMART, Кенесары 45.',
      intro: 'На каждой ветке кустовой розы несколько бутонов, поэтому букеты получаются пышными и выглядят объёмнее при той же цене.'
    },
    peonies: {
      slug: 'piony', h1: 'Пионы в Астане с доставкой',
      title: 'Купить пионы в Астане с доставкой — букеты из пионов | FLOMART',
      description: 'Букеты из пионов в Астане: разные сорта и оттенки. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
      intro: 'Пионы — сезонный цветок, выбор сортов меняется. Если нужного оттенка нет, напишите нам — подскажем, что есть сейчас.'
    },
    hydrangeas: {
      slug: 'gortenzii', h1: 'Гортензии в Астане с доставкой',
      title: 'Гортензии в Астане — купить букет с доставкой | FLOMART',
      description: 'Букеты с гортензией в Астане: монобукеты и сборные букеты, комбо с бенто-тортом. Фото и цены, доставка по городу. FLOMART, Кенесары 45.',
      intro: 'Крупные пышные соцветия гортензии сами по себе выглядят как букет — монобукеты и сборные букеты с ней.'
    },
    christ: {
      slug: 'hrizantemy', h1: 'Хризантемы в Астане с доставкой',
      title: 'Хризантемы в Астане — купить букет с доставкой | FLOMART',
      description: 'Букеты из хризантем в Астане: стойкие, яркие, по доступной цене. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
      intro: 'Хризантемы — одни из самых стойких цветов и долго стоят в вазе.'
    },
    mixed: {
      slug: 'sbornye-bukety', h1: 'Сборные авторские букеты в Астане',
      title: 'Сборные букеты в Астане — авторские букеты с доставкой | FLOMART',
      description: 'Авторские сборные букеты в Астане: сочетания роз, гортензий, хризантем и сезонных цветов. Фото и цены, доставка по городу от 1 часа. FLOMART.',
      intro: 'Каждый сборный букет флорист собирает вручную. Назовите повод и бюджет — соберём букет в нужной гамме.'
    },
    premium: {
      slug: 'premium-bukety', h1: 'Премиальные букеты в Астане',
      title: 'Премиум букеты в Астане — большие букеты с доставкой | FLOMART',
      description: 'Большие и премиальные букеты в Астане: от 51 розы, композиции в корзинах, гигантские букеты. Фото и цены, доставка по городу. FLOMART.',
      intro: 'Букеты для особых случаев: большие монобукеты, гигантские композиции и корзины с цветами. Доставка от 45 000 тг — бесплатно.'
    },
    compositions: {
      slug: 'cvetochnye-kompozicii', h1: 'Цветочные композиции в Астане',
      title: 'Цветочные композиции в Астане — в коробке и корзине | FLOMART',
      description: 'Цветочные композиции в коробках и корзинах в Астане. Не нужна ваза — цветы стоят во флористической губке. Фото и цены, доставка по городу. FLOMART.',
      intro: 'Композиция в коробке или корзине — готовый подарок: не нужна ваза, цветы держатся во влажной флористической губке.'
    },
    tulips: {
      slug: 'tyulpany', h1: 'Тюльпаны в Астане с доставкой',
      title: 'Тюльпаны в Астане — купить букет с доставкой | FLOMART',
      description: 'Букеты из тюльпанов в Астане. Фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
      intro: ''
    }
  };

  // Blocks of the main page that get their own address.
  var SECTIONS = {
    'klubnika-v-shokolade': {
      anchor: 'berry-section',
      title: 'Клубника в шоколаде в Астане — наборы с доставкой | FLOMART',
      description: 'Наборы клубники в шоколаде в Астане: в белом, молочном и розовом шоколаде, с декором. Фото и цены, доставка по городу вместе с букетом. FLOMART.'
    },
    'bento-torty': {
      anchor: 'cakes-section',
      title: 'Бенто-торты в Астане — заказать с доставкой | FLOMART',
      description: 'Бенто-торты в Астане с надписью и рисунком на любой повод. Фото дизайнов и цены, доставка вместе с букетом. FLOMART.'
    },
    'dostavka-cvetov': {
      anchor: 'delivery',
      title: 'Доставка цветов по Астане от 1 часа — FLOMART',
      description: 'Доставка цветов и букетов по Астане от 1 часа. Стоимость от 2 000 тг, бесплатно при заказе от 45 000 тг. Оплата Kaspi, картой, наличными. FLOMART, Кенесары 45.'
    }
  };

  // Product addresses: /buket/<id>/, /bento-tort/<id>/, /nabor-klubniki/<id>/
  var KIND_DIRS = { b: 'buket', c: 'bento-tort', s: 'nabor-klubniki' };

  var TRANSLIT = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
  function slugify(s) {
    return String(s || '').toLowerCase().split('').map(function (ch) { return TRANSLIT[ch] != null ? TRANSLIT[ch] : ch; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Page info for a category; `cat` is the admin-panel category object (key/label).
  function categoryInfo(cat) {
    var known = CATEGORIES[cat.key];
    if (known) return known;
    var label = cat.label || cat.key;
    return {
      slug: slugify(label) || slugify(cat.key) || cat.key,
      h1: label + ' в Астане с доставкой',
      title: label + ' в Астане — купить с доставкой | FLOMART',
      description: label + ' в Астане: фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.',
      intro: ''
    };
  }

  function productPath(kind, id) { return '/' + KIND_DIRS[kind] + '/' + id + '/'; }

  // Parse a path. `categories` (optional) is the admin list, to resolve slugs of
  // categories without an entry in CATEGORIES.
  function parse(pathname, categories) {
    var parts = String(pathname || '/').split('/').filter(Boolean);
    if (!parts.length) return { type: 'home' };
    if (parts.length === 2) {
      for (var k in KIND_DIRS) if (KIND_DIRS[k] === parts[0]) return { type: 'product', kind: k, id: parts[1] };
    }
    if (parts.length !== 1) return { type: 'other' };
    var slug = parts[0];
    if (SECTIONS[slug]) return { type: 'section', slug: slug, anchor: SECTIONS[slug].anchor };
    for (var key in CATEGORIES) if (CATEGORIES[key].slug === slug) return { type: 'category', key: key, slug: slug };
    var list = categories || [];
    for (var i = 0; i < list.length; i++) if (categoryInfo(list[i]).slug === slug) return { type: 'category', key: list[i].key, slug: slug };
    return { type: 'other' };
  }

  var api = { CATEGORIES: CATEGORIES, SECTIONS: SECTIONS, KIND_DIRS: KIND_DIRS, slugify: slugify,
    categoryInfo: categoryInfo, productPath: productPath, parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FlomartRoutes = api;
})(this);
