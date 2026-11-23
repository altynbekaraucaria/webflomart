#!/usr/bin/env node
/*
 * Gives every catalog category, block and product of flomart.kz its own
 * address — flomart.kz/rozy/, /klubnika-v-shokolade/, /buket/<id>/ … — by
 * writing a copy of the normal site (index.html) at each address with its own
 * <title>, description and structured data for search engines. The page itself
 * is the same site; assets/flomart-router.js selects the category / opens the
 * product and keeps the address bar in sync while people browse.
 *
 *   node tools/build-pages.js                  # catalog from Firestore
 *   node tools/build-pages.js --fixture f.json # catalog from a saved REST dump
 *
 * Runs from .github/workflows/build-pages.yml (every 3 hours and whenever
 * index.html changes). It makes sure index.html loads the two route scripts
 * (adds them back if a re-uploaded index.html lacks them) and otherwise leaves
 * index.html, care.html and en/ alone. Folders it writes carry a ".generated"
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

// ── index.html hooks ───────────────────────────────────────────────────────
const HEAD_HOOK = `<!-- flomart-routes:head -->
<script src="/assets/flomart-routes.js"></script>
<script>
  // flomart.kz/buket/<id>/ (and /bento-tort/, /nabor-klubniki/) → open that
  // product: hand it to the site's existing ?item= link before the catalog loads.
  (function () {
    var m = /^\\/(buket|bento-tort|nabor-klubniki)\\/([^\\/]+)\\/?$/.exec(location.pathname);
    if (!m || /[?&]item=/.test(location.search)) return;
    var t = { 'buket': 'b', 'bento-tort': 'c', 'nabor-klubniki': 's' }[m[1]];
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

// ── copy template ──────────────────────────────────────────────────────────
// Copies live one or two folders deep, so relative links (care.html, the hero
// video …) become absolute, and the large embedded pictures move to files so
// that ~200 copies don't each carry ~400 KB of them.
function makeTemplate(indexHtml) {
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
  // Each copy is the Russian page for one address: drop the language
  // alternates, which point at the home page.
  html = html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  return html;
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

function writeCopy(rel, html) {
  const dir = path.join(ROOT, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.generated'), 'Создано tools/build-pages.js — не редактировать вручную.\n');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
function cleanGenerated() {
  for (const top of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!top.isDirectory() || top.name.startsWith('.') || ['assets', 'tools', 'en'].includes(top.name)) continue;
    const p = path.join(ROOT, top.name);
    if (fs.existsSync(path.join(p, '.generated')) || Object.values(R.KIND_DIRS).includes(top.name)) fs.rmSync(p, { recursive: true, force: true });
  }
}

const crumbsLd = list => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SITE + c[1] })) });
const itemListLd = (name, items) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name,
  itemListElement: items.slice(0, 100).map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + R.productPath(it.kind, it.id), name: it.name })) });

function productDescription(item) {
  if (item.desc && item.desc.trim()) return item.desc.trim();
  if (item.kind === 'b') return `${item.name} от цветочного салона FLOMART в Астане. Флорист собирает букет вручную; доставка по Астане от 1 часа или самовывоз с ул. Кенесары 45.`;
  if (item.kind === 'c') return `${item.name}. Начинка: ${item.filling}. Бенто-торт с доставкой по Астане — отдельно или вместе с букетом.`;
  return `${item.name}${item.subtitle ? ' — ' + item.subtitle.toLowerCase() : ''}. Клубника в шоколаде с доставкой по Астане — отдельно или вместе с букетом.`;
}

function writeSitemap(paths) {
  const entry = (loc, freq, prio) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`;
  const lines = [entry('/', 'daily', '1.0'), entry('/en/', 'weekly', '0.5'), entry('/care.html', 'monthly', '0.6')];
  paths.sections.forEach(p => lines.push(entry(p, 'daily', '0.9')));
  paths.products.forEach(p => lines.push(entry(p, 'weekly', '0.7')));
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + lines.join('\n') + '\n</urlset>\n');
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
  const tpl = makeTemplate(indexHtml);
  const out = { sections: [], products: [] };
  const homeOf = {}; // category key → its page

  for (const cat of state.categories) {
    if (cat.enabled === false) continue;
    const items = C.itemsFor(state, { type: 'category', key: cat.key });
    if (!items.length) continue;
    const info = R.categoryInfo(cat);
    const p = '/' + info.slug + '/';
    homeOf[cat.key] = { path: p, name: cat.label || info.h1 };
    let html = setHead(tpl, { title: info.title, description: info.description, url: SITE + p,
      image: C.photosOf(items[0])[0] ? C.cldUrl(C.photosOf(items[0])[0], 1200) : null });
    html = setCatalogHeading(html, info);
    html = addLd(html, [crumbsLd([['Главная', '/'], [cat.label || info.h1, p]]), itemListLd(info.h1, items)]);
    writeCopy(info.slug, html);
    out.sections.push(p);
  }

  const sectionItems = { 'klubnika-v-shokolade': C.itemsFor(state, { type: 'berries' }), 'bento-torty': C.itemsFor(state, { type: 'cakes' }) };
  const sectionNames = { 'klubnika-v-shokolade': 'Клубника в шоколаде', 'bento-torty': 'Бенто-торты', 'dostavka-cvetov': 'Доставка цветов' };
  for (const slug of Object.keys(R.SECTIONS)) {
    const s = R.SECTIONS[slug];
    const items = sectionItems[slug] || [];
    const p = '/' + slug + '/';
    const html = setHead(tpl, { title: s.title, description: s.description, url: SITE + p,
      image: items[0] && C.photosOf(items[0])[0] ? C.cldUrl(C.photosOf(items[0])[0], 1200) : null });
    const ld = [crumbsLd([['Главная', '/'], [sectionNames[slug] || slug, p]])];
    if (items.length) ld.push(itemListLd(sectionNames[slug], items));
    writeCopy(slug, addLd(html, ld));
    out.sections.push(p);
  }

  const visible = [...state.bouquets, ...state.cakes, ...state.berries].filter(x => x.visible);
  for (const item of visible) {
    const p = R.productPath(item.kind, item.id);
    let parent;
    if (item.kind === 'b') parent = item.cats.map(k => homeOf[k]).find(Boolean) || null;
    else if (item.kind === 'c') parent = { path: '/bento-torty/', name: 'Бенто-торты' };
    else parent = { path: '/klubnika-v-shokolade/', name: 'Клубника в шоколаде' };
    const photos = C.photosOf(item);
    const desc = productDescription(item);
    const price = item.finalPrice ? C.money(item.finalPrice).replace(/ /g, ' ') + ' тг' : '';
    const title = `${item.name} — купить в Астане с доставкой${price ? ', ' + price : ''} | FLOMART`;
    const html = setHead(tpl, { title, description: `${item.name}${price ? ' за ' + price : ''}. ${desc}`.slice(0, 300),
      url: SITE + p, image: photos[0] ? C.cldUrl(photos[0], 1200) : null });
    const product = { '@context': 'https://schema.org', '@type': 'Product', name: item.name, description: desc,
      sku: item.kind === 'b' ? item.displayCode : item.id, brand: { '@type': 'Brand', name: 'FLOMART' },
      image: photos.slice(0, 5).map(ph => C.cldUrl(ph, 1200)), url: SITE + p };
    if (item.finalPrice) product.offers = { '@type': 'Offer', priceCurrency: 'KZT', price: item.finalPrice,
      availability: 'https://schema.org/InStock', url: SITE + p };
    const trail = [['Главная', '/']];
    if (parent) trail.push([parent.name, parent.path]);
    trail.push([item.name, p]);
    writeCopy(p.replace(/^\/|\/$/g, ''), addLd(html, [crumbsLd(trail), product]));
    out.products.push(p);
  }

  writeSitemap(out);
  console.log(`Готово: ${out.sections.length} разделов, ${out.products.length} страниц товаров.`);
}

main().catch(e => { console.error(e); process.exit(1); });
