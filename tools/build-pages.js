#!/usr/bin/env node
/*
 * Builds the SEO landing pages and one page per product from the live
 * Firestore catalog, and rewrites sitemap.xml.
 *
 *   node tools/build-pages.js                 # read Firestore over the network
 *   node tools/build-pages.js --fixture f.json # read a saved REST dump (testing)
 *
 * Runs automatically from .github/workflows/build-pages.yml. index.html,
 * care.html and en/ are never touched. Every folder this script creates
 * contains a ".generated" marker and is deleted and rebuilt on each run, so a
 * product removed in the admin panel also loses its page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../assets/flomart-catalog.js');
const { SHOP, DELIVERY_FACTS, CATEGORY_PAGES, SPECIAL_PAGES, DELIVERY_PAGE } = require('./pages-config.js');

const ROOT = path.resolve(__dirname, '..');
const SITE = C.SITE;
const esc = C.esc;
// Cache-busting version derived from the asset contents, so re-running the
// build with an unchanged catalog produces byte-identical pages (no empty commits).
const ASSET_VER = require('crypto').createHash('sha1')
  .update(['pages.css', 'flomart-catalog.js', 'pages-live.js'].map(f => fs.readFileSync(path.join(ROOT, 'assets', f))).join(''))
  .digest('hex').slice(0, 8);

// ── helpers ────────────────────────────────────────────────────────────────
const TRANSLIT = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
function slugify(s) {
  return String(s || '').toLowerCase().split('').map(ch => TRANSLIT[ch] != null ? TRANSLIT[ch] : ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'razdel';
}
function writePage(rel, html) {
  const dir = path.join(ROOT, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.generated'), 'Создано tools/build-pages.js — не редактировать вручную.\n');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
function cleanGenerated() {
  // Top-level folders, and product folders one level down (/buket/<id>/).
  for (const top of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!top.isDirectory() || top.name.startsWith('.') || ['assets', 'tools', 'en', 'node_modules'].includes(top.name)) continue;
    const topPath = path.join(ROOT, top.name);
    if (fs.existsSync(path.join(topPath, '.generated'))) { fs.rmSync(topPath, { recursive: true, force: true }); continue; }
    if (Object.values(C.KIND).some(k => k.dir === top.name)) fs.rmSync(topPath, { recursive: true, force: true });
  }
}
function ld(obj) { return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'; }
function waLink(text) { return 'https://wa.me/' + SHOP.whatsapp + '?text=' + encodeURIComponent(text); }

// ── layout ─────────────────────────────────────────────────────────────────
function layout({ title, description, canonical, image, body, jsonld = [], bodyAttrs = '', sections, activeSlug }) {
  const og = image || SITE + '/og-image.png';
  const sectionLinks = sections.map(s => `<a href="/${s.slug}/">${esc(s.nav)}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="FLOMART">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo-icon.png" type="image/png">
<link rel="preconnect" href="https://res.cloudinary.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garant:wght@300;400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/pages.css?v=${ASSET_VER}">
${jsonld.map(ld).join('\n')}
</head>
<body${bodyAttrs}>
<nav class="top">
  <a href="/" class="nav-logo"><img src="/assets/logo-full.png" alt="FLOMART — цветочный салон в Астане" width="166" height="40"></a>
  <div class="nav-right">
    <a href="/" class="nav-home">← Весь каталог</a>
    <a href="${esc(waLink('Здравствуйте! Хочу заказать букет.'))}" class="nav-wa" target="_blank" rel="noopener">WhatsApp</a>
  </div>
</nav>
${body}
<footer>
  <div>© ${new Date().getFullYear()} FLOMART · ${esc(SHOP.address)} · <a href="${SHOP.phoneHref}">${esc(SHOP.phone)}</a> · <a href="${SHOP.instagram}" target="_blank" rel="noopener">Instagram</a></div>
  <div class="links"><a href="/">Главная</a>${sectionLinks}<a href="/care.html">Уход за букетом</a></div>
</footer>
<script src="/assets/flomart-catalog.js?v=${ASSET_VER}"></script>
<script src="/assets/pages-live.js?v=${ASSET_VER}"></script>
</body>
</html>
`;
}

function sectionNav(sections, activeSlug) {
  return '<div class="sections">' + sections.map(s =>
    `<a href="/${s.slug}/"${s.slug === activeSlug ? ' class="active" aria-current="page"' : ''}>${esc(s.nav)}</a>`).join('') + '</div>';
}
function crumbs(list) {
  return '<div class="crumbs">' + list.map((c, i) => i === list.length - 1 ? esc(c.name) : `<a href="${c.path}">${esc(c.name)}</a>`).join(' / ') + '</div>';
}
function crumbsLd(list) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path })) };
}
function cta(title, text) {
  return `<section class="cta"><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="btns">
<a class="wa" href="${esc(waLink('Здравствуйте! Хочу заказать букет.'))}" target="_blank" rel="noopener">Написать в WhatsApp</a>
<a class="tel" href="${SHOP.phoneHref}">Позвонить ${esc(SHOP.phone)}</a></div></section>`;
}
const STORE_LD = {
  '@context': 'https://schema.org', '@type': 'Florist', name: 'FLOMART', url: SITE + '/', telephone: SHOP.phone,
  image: SITE + '/og-image.png',
  address: { '@type': 'PostalAddress', streetAddress: 'ул. Кенесары 45', addressLocality: 'Астана', addressCountry: 'KZ' },
  areaServed: 'Астана',
};

// ── pages ──────────────────────────────────────────────────────────────────
function categoryPage(state, page, sections) {
  const items = C.itemsFor(state, page.source);
  const minPrice = items.map(i => i.finalPrice).filter(Boolean).sort((a, b) => a - b)[0];
  const facts = [items.length ? `${items.length} ${plural(items.length, 'позиция', 'позиции', 'позиций')} в каталоге` : null,
    minPrice ? `от ${C.money(minPrice)} тг` : null, ...DELIVERY_FACTS.slice(0, 2)].filter(Boolean);
  const path_ = '/' + page.slug + '/';
  const trail = [{ name: 'Главная', path: '/' }, { name: page.nav, path: path_ }];
  const text = (page.text || []).map(([h, p]) => `<h2>${esc(h)}</h2><p>${p}</p>`).join('');
  const body = `${crumbs(trail)}
<header class="hero">
  <p class="eyebrow">Цветочный салон FLOMART · Астана</p>
  <h1>${esc(page.h1)}</h1>
  <p>${esc(page.intro)}</p>
  <div class="hero-facts">${facts.map(f => `<span>${esc(f)}</span>`).join('')}</div>
</header>
${sectionNav(sections, page.slug)}
<main>
  <div class="grid" id="live-grid">${C.gridHtml(items)}</div>
  <section class="text-block">${text}
    <h2>Доставка по Астане</h2>
    <p>Привезём заказ по любому адресу в Астане — от 1 часа после оформления. Стоимость доставки — от 2 000 тг, при заказе от 45 000 тг доставка бесплатная. Можно забрать самостоятельно в салоне: ${esc(SHOP.address)}. Подробнее — на странице <a href="/dostavka-cvetov/">доставки цветов</a>.</p>
    <h2>Как заказать</h2>
    <p>Нажмите «Заказать» под понравившейся позицией — откроется WhatsApp с готовым сообщением. Или позвоните: <a href="${SHOP.phoneHref}">${esc(SHOP.phone)}</a>. Оплата — Kaspi, Kaspi Red, картой, наличными или переводом.</p>
  </section>
  ${cta('Не нашли подходящий вариант?', 'Расскажите про повод и бюджет — флорист соберёт букет специально для вас.')}
</main>`;
  const listLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: page.h1,
    itemListElement: items.slice(0, 60).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: C.itemUrl(it), name: it.name })) };
  writePage(page.slug, layout({
    title: page.title, description: page.description, canonical: SITE + path_, sections, body,
    image: items[0] && C.photosOf(items[0])[0] ? C.cldUrl(C.photosOf(items[0])[0], 1200) : null,
    jsonld: [crumbsLd(trail), listLd, STORE_LD],
    bodyAttrs: ` data-page="category" data-source='${esc(JSON.stringify(page.source))}'`,
  }));
  return path_;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function productDescription(state, item, parent) {
  if (item.desc && item.desc.trim()) return item.desc.trim();
  if (item.kind === 'b') {
    return `${item.name} от цветочного салона FLOMART в Астане. ` +
      `Флорист собирает букет вручную; доставим по Астане от 1 часа или подготовим к самовывозу с ул. Кенесары 45.`;
  }
  if (item.kind === 'c') return `${item.name}. Начинка: ${item.filling}. Бенто-торт ручной работы с доставкой по Астане — отдельно или вместе с букетом.`;
  return `${item.name}${item.subtitle ? ' — ' + item.subtitle.toLowerCase() : ''}. Клубника в шоколаде с доставкой по Астане — отдельно или вместе с букетом.`;
}

function productPage(state, item, parent, sections) {
  const photos = C.photosOf(item);
  const ws = state.settings;
  const path_ = C.itemPath(item);
  const trail = [{ name: 'Главная', path: '/' }];
  if (parent) trail.push({ name: parent.nav, path: '/' + parent.slug + '/' });
  trail.push({ name: item.name, path: path_ });
  const desc = productDescription(state, item, parent);
  const kindLabel = C.KIND[item.kind].label;
  const code = item.kind === 'b' ? `Артикул ${item.displayCode}` : item.kind === 'c' ? `Начинка: ${item.filling}` : (item.subtitle || kindLabel);
  const main = photos[0]
    ? `<img id="main-photo" src="${esc(C.cldUrl(photos[0], 1000, ws))}" alt="${esc(item.name)}" style="${C.framingCss(item)}">`
    : `<div class="product-img-bg">${C.emojiOf(item)}</div>`;
  const thumbs = photos.length > 1 ? '<div class="thumbs">' + photos.map((p, i) =>
    `<button type="button" data-src="${esc(C.cldUrl(p, 1000, ws))}"${i === 0 ? ' class="active"' : ''} aria-label="Фото ${i + 1}"><img src="${esc(C.cldUrl(p, 200))}" alt="" loading="lazy"></button>`).join('') + '</div>' : '';

  let related = [];
  if (item.kind === 'b') {
    const key = parent && parent.source.key;
    related = state.bouquets.filter(b => b.visible && b.id !== item.id && key && b.cats.includes(key));
  } else {
    related = (item.kind === 'c' ? state.cakes : state.berries).filter(x => x.visible && x.id !== item.id);
  }
  related = related.slice(0, 4);

  const title = item.kind === 'b'
    ? `${item.name} — купить в Астане с доставкой${item.finalPrice ? ', ' + C.money(item.finalPrice) + ' тг' : ''} | FLOMART`
    : `${item.name} — ${kindLabel.toLowerCase()} в Астане${item.finalPrice ? ', ' + C.money(item.finalPrice) + ' тг' : ''} | FLOMART`;
  const metaDesc = `${item.name}${item.finalPrice ? ' за ' + C.money(item.finalPrice) + ' тг' : ''}. ${desc}`.slice(0, 300);

  const body = `${crumbs(trail)}
<main>
  <div class="product">
    <div class="gallery"><div class="gallery-main">${main}</div>${thumbs}</div>
    <div class="info">
      <div id="live-notice"></div>
      <p class="code">${esc(code)}</p>
      <h1 id="live-name">${esc(item.name)}</h1>
      <div class="product-price" id="live-price">${C.priceHtml(item)}</div>
      ${item.comboLabel ? `<p class="combo">🎁 ${esc(item.comboLabel)}</p>` : ''}
      <p class="desc">${esc(desc)}</p>
      <div class="actions">
        <a class="wa" id="live-order" href="${esc(C.whatsappUrl(item))}" target="_blank" rel="noopener">Заказать в WhatsApp</a>
        <a class="tel" href="${SHOP.phoneHref}">Позвонить</a>
      </div>
      <ul class="facts">
        <li><b>Доставка:</b> по Астане от 1 часа, от 2 000 тг; бесплатно от 45 000 тг</li>
        <li><b>Самовывоз:</b> ${esc(SHOP.address)}</li>
        <li><b>Оплата:</b> Kaspi, Kaspi Red, карта, наличные, перевод</li>
      </ul>
    </div>
  </div>
  ${related.length ? `<section class="related"><h2>Похожие</h2><div class="grid">${related.map(C.cardHtml).join('')}</div></section>` : ''}
</main>`;

  const productLd = { '@context': 'https://schema.org', '@type': 'Product', name: item.name, description: desc,
    sku: item.kind === 'b' ? item.displayCode : item.id, brand: { '@type': 'Brand', name: 'FLOMART' },
    image: photos.slice(0, 5).map(p => C.cldUrl(p, 1200)), url: SITE + path_ };
  if (item.finalPrice) productLd.offers = { '@type': 'Offer', priceCurrency: 'KZT', price: item.finalPrice,
    availability: 'https://schema.org/InStock', url: SITE + path_, seller: { '@type': 'Organization', name: 'FLOMART' } };

  writePage(path_.replace(/^\/|\/$/g, ''), layout({
    title, description: metaDesc, canonical: SITE + path_, sections, body,
    image: photos[0] ? C.cldUrl(photos[0], 1200) : null,
    jsonld: [crumbsLd(trail), productLd],
    bodyAttrs: ` data-page="product" data-kind="${item.kind}" data-id="${esc(item.id)}"`,
  }));
  return path_;
}

function deliveryPage(sections) {
  const p = DELIVERY_PAGE;
  const trail = [{ name: 'Главная', path: '/' }, { name: p.nav, path: '/' + p.slug + '/' }];
  const body = `${crumbs(trail)}
<header class="hero">
  <p class="eyebrow">Цветочный салон FLOMART · Астана</p>
  <h1>${esc(p.h1)}</h1>
  <p>Доставляем букеты, цветочные композиции, бенто-торты и клубнику в шоколаде по всей Астане. Просто назовите адрес — остальное наша забота.</p>
  <div class="hero-facts">${DELIVERY_FACTS.map(f => `<span>${esc(f)}</span>`).join('')}</div>
</header>
${sectionNav(sections, p.slug)}
<main>
  <section class="text-block" style="margin-top:0">
    <h2>Сроки</h2>
    <p>Доставка по Астане — от 1 часа после оформления заказа. Можно заказать заранее к нужной дате и времени: курьер привезёт букет в удобный интервал.</p>
    <h2>Стоимость</h2>
    <ul>
      <li>Доставка по городу — от 2 000 тг.</li>
      <li>При заказе от 45 000 тг — доставка бесплатно.</li>
      <li>Самовывоз из салона: ${esc(SHOP.address)} — бесплатно.</li>
    </ul>
    <h2>Бережная упаковка</h2>
    <p>Аккуратно упаковываем каждый букет, чтобы он доехал свежим и выглядел так же красиво, как на фото в каталоге.</p>
    <h2>Оплата</h2>
    <p>Наличные, карта, Kaspi, Kaspi Red, Western Union, PayPal, перевод на счёт; для юрлиц — оплата по счёту.</p>
    <h2>Как оформить заказ</h2>
    <p>Выберите букет в разделах ниже и нажмите «Заказать» — откроется WhatsApp с готовым сообщением. Или напишите / позвоните нам: <a href="${SHOP.phoneHref}">${esc(SHOP.phone)}</a> — уточним время и адрес доставки.</p>
    <h2>Что можно заказать с доставкой</h2>
    <ul>${sections.filter(s => s.slug !== p.slug).map(s => `<li><a href="/${s.slug}/">${esc(s.nav)}</a></li>`).join('')}</ul>
  </section>
  ${cta('Оформить заказ', 'Напишите в WhatsApp или позвоните — уточним время и адрес доставки.')}
</main>`;
  writePage(p.slug, layout({ title: p.title, description: p.description, canonical: SITE + '/' + p.slug + '/', sections, body,
    jsonld: [crumbsLd(trail), STORE_LD] }));
  return '/' + p.slug + '/';
}

function writeSitemap(paths) {
  const entry = (loc, freq, prio) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
  const lines = [entry('/', 'daily', '1.0'), entry('/care.html', 'monthly', '0.6')];
  paths.sections.forEach(p => lines.push(entry(p, 'daily', '0.9')));
  paths.products.forEach(p => lines.push(entry(p, 'weekly', '0.7')));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + lines.join('\n') + '\n</urlset>\n');
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const fixtureArg = process.argv.indexOf('--fixture');
  let raw;
  if (fixtureArg !== -1) {
    const dump = JSON.parse(fs.readFileSync(process.argv[fixtureArg + 1], 'utf8'));
    raw = {};
    for (const k of Object.keys(dump)) raw[k] = dump[k].map(C.decodeDoc);
  } else {
    raw = await C.fetchAll(fetch);
  }
  const state = C.buildState(raw);
  if (!state.bouquets.length) throw new Error('Каталог пустой — страницы не пересобираю, чтобы не стереть рабочие.');

  // Category pages: every enabled category that has at least one visible bouquet.
  const pages = [];
  for (const cat of state.categories) {
    if (cat.enabled === false) continue;
    if (!C.itemsFor(state, { type: 'category', key: cat.key }).length) continue;
    const cfg = CATEGORY_PAGES[cat.key] || {
      slug: slugify(cat.label || cat.key), nav: cat.label || cat.key,
      h1: `${cat.label} в Астане с доставкой`, title: `${cat.label} в Астане — купить с доставкой | FLOMART`,
      description: `${cat.label} в Астане: фото и цены, доставка по городу от 1 часа. Цветочный салон FLOMART.`,
      intro: `${cat.label} от цветочного салона FLOMART с доставкой по Астане.`, text: [],
    };
    pages.push({ ...cfg, source: { type: 'category', key: cat.key } });
  }
  if (C.itemsFor(state, { type: 'berries' }).length) pages.push({ ...SPECIAL_PAGES.berries, source: { type: 'berries' } });
  if (C.itemsFor(state, { type: 'cakes' }).length) pages.push({ ...SPECIAL_PAGES.cakes, source: { type: 'cakes' } });
  const sections = [...pages, DELIVERY_PAGE];

  cleanGenerated();
  const out = { sections: [], products: [] };
  pages.forEach(p => out.sections.push(categoryPage(state, p, sections)));
  out.sections.push(deliveryPage(sections));

  // Product pages. A bouquet's "home" section is its first enabled category.
  const pageByKey = {};
  pages.forEach(p => { if (p.source.type === 'category') pageByKey[p.source.key] = p; });
  state.bouquets.filter(b => b.visible).forEach(b => {
    const parent = b.cats.map(k => pageByKey[k]).find(Boolean);
    out.products.push(productPage(state, b, parent, sections));
  });
  const cakesPage = pages.find(p => p.source.type === 'cakes');
  const berriesPage = pages.find(p => p.source.type === 'berries');
  state.cakes.filter(c => c.visible).forEach(c => out.products.push(productPage(state, c, cakesPage, sections)));
  state.berries.filter(s => s.visible).forEach(s => out.products.push(productPage(state, s, berriesPage, sections)));

  writeSitemap(out);
  console.log(`Готово: ${out.sections.length} разделов, ${out.products.length} страниц товаров.`);
}

main().catch(e => { console.error(e); process.exit(1); });
