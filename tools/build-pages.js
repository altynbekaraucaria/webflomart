#!/usr/bin/env node
/*
 * Gives every catalog category, block and product of flomart.kz its own
 * address, in Russian and English — flomart.kz/rozy/ ↔ /en/roses/,
 * /buket/<id>/ ↔ /en/bouquet/<id>/ … — by writing a copy of the normal site
 * (index.html) at each address with its own <title>, description, language
 * links and structured data for search engines. The page itself is the same
 * site; assets/flomart-router.js selects the category / opens the product and
 * keeps the address bar in sync while people browse.
 *
 * The English home page (en/index.html) is also built here from index.html, so
 * any change to the site reaches the English version on the next run.
 *
 *   node tools/build-pages.js                  # catalog from Firestore
 *   node tools/build-pages.js --fixture f.json # catalog from a saved REST dump
 *
 * Runs from .github/workflows/build-pages.yml (every 3 hours and whenever
 * index.html changes). It makes sure index.html loads the two route scripts
 * (adds them back if a re-uploaded index.html lacks them) and otherwise leaves
 * index.html and care.html alone. Folders it writes carry a ".generated"
 * marker and are rebuilt from scratch each run.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('../assets/flomart-catalog.js');
const R = require('../assets/flomart-routes.js');

const ROOT = path.resolve(__dirname, '..');
const SITE = C.SITE;
const esc = C.esc;
const LANGS = ['ru', 'en'];

// English home page texts (index.html carries the Russian ones).
const EN_HOME = {
  title: 'Buy Flowers & Bouquets in Astana with Delivery — FLOMART',
  description: 'Buy flowers and bouquets in Astana with delivery from FLOMART — fresh bouquets, cakes and chocolate-covered strawberries. City-wide delivery, online payment, fresh flowers every day.',
  ogDescription: 'Fresh bouquets, cakes and chocolate-covered strawberries delivered across Astana. Browse the catalog and order online.',
  twitterDescription: 'Fresh bouquets, cakes and chocolate-covered strawberries delivered across Astana.',
  ldDescription: 'Buy flowers and bouquets in Astana with delivery. Fresh flowers, cakes and chocolate-covered strawberries.',
};

// ── index.html hooks ───────────────────────────────────────────────────────
const HEAD_HOOK = `<!-- flomart-routes:head -->
<script src="/assets/flomart-routes.js"></script>
<script>
  // flomart.kz/buket/<id>/, /en/bouquet/<id>/ … → open that product: hand it to
  // the site's existing ?item= link before the catalog loads.
  (function () {
    var m = /^(?:\\/en)?\\/(buket|bento-tort|nabor-klubniki|bouquet|bento-cake|strawberry-set)\\/([^\\/]+)\\/?$/.exec(location.pathname);
    if (!m || /[?&]item=/.test(location.search)) return;
    var t = { 'buket': 'b', 'bento-tort': 'c', 'nabor-klubniki': 's', 'bouquet': 'b', 'bento-cake': 'c', 'strawberry-set': 's' }[m[1]];
    history.replaceState(null, '', location.pathname + (location.search ? location.search + '&' : '?') + 'item=' + t + '-' + m[2] + location.hash);
  })();
</script>
<!-- /flomart-routes:head -->`;
const BODY_HOOK = `<!-- flomart-routes:body -->
<script type="module" src="/assets/flomart-router.js"></script>
<!-- /flomart-routes:body -->`;

function ensureIndexHooks() {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/<!-- flomart-routes:head -->[\s\S]*?<!-- \/flomart-routes:head -->\n?/, '')
             .replace(/<!-- flomart-routes:body -->[\s\S]*?<!-- \/flomart-routes:body -->\n?/, '');
  html = html.replace(/<head>\n?/, m => m + HEAD_HOOK + '\n');
  const bodyEnd = html.lastIndexOf('</body>');
  html = html.slice(0, bodyEnd) + BODY_HOOK + '\n' + html.slice(bodyEnd);
  if (html !== before) fs.writeFileSync(file, html);
  return html;
}

// ── templates ──────────────────────────────────────────────────────────────
// Copies live one or more folders deep, so relative links (care.html, the hero
// video …) become absolute, and the large embedded pictures move to files so
// that the ~400 copies don't each carry ~400 KB of them.
function makeTemplates(indexHtml) {
  const inlineDir = path.join(ROOT, 'assets', 'inline');
  fs.rmSync(inlineDir, { recursive: true, force: true });
  fs.mkdirSync(inlineDir, { recursive: true });
  let html = indexHtml.replace(/data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]{2000,})/g, (m, type, b64) => {
    const ext = { 'svg+xml': 'svg', jpeg: 'jpg' }[type] || type;
    const name = crypto.createHash('sha1').update(b64).digest('hex').slice(0, 12) + '.' + ext;
    const out = path.join(inlineDir, name);
    if (!fs.existsSync(out)) fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    return '/assets/inline/' + name;
  });
  html = html.replace(/\b(href|src|poster)="(?!https?:|\/|#|data:|mailto:|tel:|javascript:|\$\{)([^"]+)"/g, '$1="/$2"');
  // Fixed literals used in JS strings, e.g. the footer's care.html link.
  html = html.replace(/href="care\.html"/g, 'href="/care.html"');

  const ru = html;
  let en = html.replace('<html lang="ru">', '<html lang="en">')
    .replace(/<meta property="og:locale" content="ru_RU">/, '<meta property="og:locale" content="en_US">')
    .replace(/<meta property="og:locale:alternate" content="en_US">/, '<meta property="og:locale:alternate" content="ru_RU">');
  en = setHead(en, { title: EN_HOME.title, description: EN_HOME.description, url: SITE + '/en/' });
  en = en.replace(/(<meta property="og:description" content=")[^"]*(">)/, (m, a, b) => a + esc(EN_HOME.ogDescription) + b)
    .replace(/(<meta name="twitter:description" content=")[^"]*(">)/, (m, a, b) => a + esc(EN_HOME.twitterDescription) + b);
  // The shop's structured data block in <head>.
  en = en.replace(/("description":\s*")Купить цветы и букеты в Астане с доставкой[^"]*(")/, (m, a, b) => a + EN_HOME.ldDescription + b)
    .replace(/("name":\s*")Астана(")/, '$1Astana$2')
    .replace(/("addressLocality":\s*")Астана(")/, '$1Astana$2')
    .replace(/("url":\s*"https:\/\/flomart\.kz\/)(")/, '$1en/$2');
  return { ru, en };
}

function setHead(html, { title, description, url, image }) {
  const rep = (re, val) => { html = html.replace(re, val); };
  rep(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  rep(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`);
  rep(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(url)}">`);
  rep(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  rep(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`);
  rep(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url)}">`);
  rep(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(title)}">`);
  rep(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(description)}">`);
  if (image) {
    rep(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(image)}">`);
    rep(/<meta property="og:image:(width|height)" content="[^"]*">\n?/g, '');
    rep(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(image)}">`);
  }
  return html;
}
// Language links: the same place on the Russian and English site.
function setAlternates(html, ruPath, enPath) {
  html = html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  const links = `<link rel="alternate" hreflang="ru" href="${SITE}${ruPath}">\n<link rel="alternate" hreflang="en" href="${SITE}${enPath}">\n<link rel="alternate" hreflang="x-default" href="${SITE}${ruPath}">\n`;
  return html.replace(/(<link rel="canonical" href="[^"]*">\n?)/, m => m + links);
}
function addLd(html, objs) {
  const tags = objs.map(o => '<script type="application/ld+json">' + JSON.stringify(o).replace(/</g, '\\u003c') + '</script>').join('\n');
  const i = html.indexOf('</head>');
  return html.slice(0, i) + tags + '\n' + html.slice(i);
}
// Category copies show the category name and a short text above the catalog
// right in the HTML (the router does the same when someone clicks a tab).
function setCatalogHeading(html, info) {
  return html.replace(
    /(<h2 class="section-title" data-i18n="catalog\.title">)[\s\S]*?(<\/h2>)/,
    (m, a, b) => a + esc(info.h1) + b + (info.intro ? `<p id="cat-route-intro" style="margin-top:12px;max-width:560px;font-size:14px;line-height:1.6;color:var(--text-muted,#8A6E8A);">${esc(info.intro)}</p>` : ''));
}

function writeCopy(urlPath, html) {
  const dir = path.join(ROOT, urlPath.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.generated'), 'Создано tools/build-pages.js — не редактировать вручную.\n');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
function cleanGenerated() {
  const productDirs = [...Object.values(R.KIND_DIRS.ru), ...Object.values(R.KIND_DIRS.en)];
  const sweep = (base, isTop) => {
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.') || (isTop && ['assets', 'tools', 'en'].includes(e.name))) continue;
      const p = path.join(base, e.name);
      if (fs.existsSync(path.join(p, '.generated')) || productDirs.includes(e.name)) fs.rmSync(p, { recursive: true, force: true });
    }
  };
  sweep(ROOT, true);
  const en = path.join(ROOT, 'en');
  if (fs.existsSync(en)) sweep(en, false);
}

const crumbsLd = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) });
const itemListLd = (name, items, lang) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name,
  itemListElement: items.slice(0, 100).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + R.productPath(it.kind, it.id, lang), name: nameOf(it, lang) })) });

function nameOf(item, lang) { return (lang === 'en' && item.nameEn) ? item.nameEn : item.name; }
function catLabel(cat, lang) { return (lang === 'en' && cat.labelEn) ? cat.labelEn : (cat.label || cat.key); }

function productDescription(item, lang) {
  const name = nameOf(item, lang);
  if (lang === 'en') {
    if (item.descEn && item.descEn.trim()) return item.descEn.trim();
    if (item.kind === 'b') return `${name} from FLOMART flower shop in Astana. Hand-arranged by our florist; delivery across Astana from 1 hour or pick-up at 45 Kenesary St.`;
    if (item.kind === 'c') return `${name}. Bento cake delivered across Astana — on its own or with a bouquet.`;
    return `${name}${item.subtitleEn ? ' — ' + item.subtitleEn : ''}. Chocolate-covered strawberries delivered across Astana — on their own or with a bouquet.`;
  }
  if (item.desc && item.desc.trim()) return item.desc.trim();
  if (item.kind === 'b') return `${name} от цветочного салона FLOMART в Астане. Флорист собирает букет вручную; доставка по Астане от 1 часа или самовывоз с ул. Кенесары 45.`;
  if (item.kind === 'c') return `${name}. Начинка: ${item.filling}. Бенто-торт с доставкой по Астане — отдельно или вместе с букетом.`;
  return `${name}${item.subtitle ? ' — ' + item.subtitle.toLowerCase() : ''}. Клубника в шоколаде с доставкой по Астане — отдельно или вместе с букетом.`;
}

function writeSitemap(paths) {
  // Each address lists its other-language twin, so search engines pair them.
  const entry = (pair, freq, prio) => [pair.ru, pair.en].map(loc => `  <url>\n    <loc>${SITE}${loc}</loc>\n` +
    `    <xhtml:link rel="alternate" hreflang="ru" href="${SITE}${pair.ru}"/>\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${pair.en}"/>\n` +
    `    <changefreq>${freq}</changefreq>\n    <priority>${loc === pair.ru ? prio : (prio - 0.1).toFixed(1)}</priority>\n  </url>`).join('\n');
  const lines = [entry({ ru: '/', en: '/en/' }, 'daily', 1.0),
    `  <url>\n    <loc>${SITE}/care.html</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`];
  paths.sections.forEach(p => lines.push(entry(p, 'daily', 0.9)));
  paths.products.forEach(p => lines.push(entry(p, 'weekly', 0.7)));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + lines.join('\n') + '\n</urlset>\n');
}

async function main() {
  const fx = process.argv.indexOf('--fixture');
  let raw;
  if (fx !== -1) {
    const dump = JSON.parse(fs.readFileSync(process.argv[fx + 1], 'utf8'));
    raw = {};
    for (const k of Object.keys(dump)) raw[k] = dump[k].map(C.decodeDoc);
  } else {
    raw = await C.fetchAll(fetch);
  }
  const state = C.buildState(raw);
  if (!state.bouquets.length) throw new Error('Каталог пустой — страницы не пересобираю, чтобы не стереть рабочие.');

  const indexHtml = ensureIndexHooks();
  cleanGenerated();
  const tpl = makeTemplates(indexHtml);
  const out = { sections: [], products: [] };

  // English home page, rebuilt from index.html every run.
  fs.mkdirSync(path.join(ROOT, 'en'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'en', 'index.html'), setAlternates(tpl.en, '/', '/en/'));

  const homeOf = { ru: {}, en: {} }; // category key → its page, per language
  for (const cat of state.categories) {
    if (cat.enabled === false) continue;
    const items = C.itemsFor(state, { type: 'category', key: cat.key });
    if (!items.length) continue;
    const pair = {};
    for (const lang of LANGS) pair[lang] = R.categoryPath({ key: cat.key, label: catLabel(cat, lang) }, lang);
    for (const lang of LANGS) {
      const info = R.categoryInfo({ key: cat.key, label: catLabel(cat, lang) }, lang);
      const p = pair[lang];
      homeOf[lang][cat.key] = { path: p, name: catLabel(cat, lang) };
      let html = setHead(tpl[lang], { title: info.title, description: info.description, url: SITE + p,
        image: C.photosOf(items[0])[0] ? C.cldUrl(C.photosOf(items[0])[0], 1200) : null });
      html = setAlternates(html, pair.ru, pair.en);
      html = setCatalogHeading(html, info);
      html = addLd(html, [crumbsLd([[lang === 'en' ? 'Home' : 'Главная', R.homePath(lang)], [catLabel(cat, lang), p]]), itemListLd(info.h1, items, lang)]);
      writeCopy(p, html);
    }
    out.sections.push(pair);
  }

  const sectionItems = { berries: C.itemsFor(state, { type: 'berries' }), cakes: C.itemsFor(state, { type: 'cakes' }), delivery: [] };
  for (const sec of Object.keys(R.SECTIONS)) {
    const items = sectionItems[sec] || [];
    const pair = { ru: R.sectionPath(sec, 'ru'), en: R.sectionPath(sec, 'en') };
    for (const lang of LANGS) {
      const s = R.sectionInfo(sec, lang);
      let html = setHead(tpl[lang], { title: s.title, description: s.description, url: SITE + pair[lang],
        image: items[0] && C.photosOf(items[0])[0] ? C.cldUrl(C.photosOf(items[0])[0], 1200) : null });
      html = setAlternates(html, pair.ru, pair.en);
      const ld = [crumbsLd([[lang === 'en' ? 'Home' : 'Главная', R.homePath(lang)], [s.name, pair[lang]]])];
      if (items.length) ld.push(itemListLd(s.name, items, lang));
      writeCopy(pair[lang], addLd(html, ld));
    }
    out.sections.push(pair);
  }

  const visible = [...state.bouquets, ...state.cakes, ...state.berries].filter(x => x.visible);
  for (const item of visible) {
    const pair = { ru: R.productPath(item.kind, item.id, 'ru'), en: R.productPath(item.kind, item.id, 'en') };
    const photos = C.photosOf(item);
    for (const lang of LANGS) {
      const p = pair[lang];
      let parent;
      if (item.kind === 'b') parent = item.cats.map(k => homeOf[lang][k]).find(Boolean) || null;
      else { const sec = item.kind === 'c' ? 'cakes' : 'berries'; parent = { path: R.sectionPath(sec, lang), name: R.sectionInfo(sec, lang).name }; }
      const name = nameOf(item, lang);
      const desc = productDescription(item, lang);
      const price = item.finalPrice ? C.money(item.finalPrice).replace(/ /g, ' ') + (lang === 'en' ? ' ₸' : ' тг') : '';
      const title = lang === 'en'
        ? `${name} — buy in Astana with delivery${price ? ', ' + price : ''} | FLOMART`
        : `${name} — купить в Астане с доставкой${price ? ', ' + price : ''} | FLOMART`;
      const metaDesc = `${name}${price ? (lang === 'en' ? ' for ' : ' за ') + price : ''}. ${desc}`.slice(0, 300);
      let html = setHead(tpl[lang], { title, description: metaDesc, url: SITE + p, image: photos[0] ? C.cldUrl(photos[0], 1200) : null });
      html = setAlternates(html, pair.ru, pair.en);
      const product = { '@context': 'https://schema.org', '@type': 'Product', name, description: desc,
        sku: item.kind === 'b' ? item.displayCode : item.id, brand: { '@type': 'Brand', name: 'FLOMART' },
        image: photos.slice(0, 5).map(ph => C.cldUrl(ph, 1200)), url: SITE + p };
      if (item.finalPrice) product.offers = { '@type': 'Offer', priceCurrency: 'KZT', price: item.finalPrice,
        availability: 'https://schema.org/InStock', url: SITE + p };
      const trail = [[lang === 'en' ? 'Home' : 'Главная', R.homePath(lang)]];
      if (parent) trail.push([parent.name, parent.path]);
      trail.push([name, p]);
      writeCopy(p, addLd(html, [crumbsLd(trail), product]));
    }
    out.products.push(pair);
  }

  writeSitemap(out);
  console.log(`Готово: ${out.sections.length} разделов и ${out.products.length} товаров × 2 языка.`);
}

main().catch(e => { console.error(e); process.exit(1); });
