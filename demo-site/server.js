#!/usr/bin/env node
'use strict';

// The demo store's small server: a stand-in for the platform's side of a storefront, written
// from its public documentation. It renders the demo theme's pages, answers the storefront Ajax
// API (/cart.js, /cart/add.js, /cart/change.js, /cart/update.js, /cart/clear.js,
// /products/<handle>.js, /search/suggest.json), the Section Rendering API (?section_id=,
// ?sections=, and the `sections` of the cart calls), and the forms by their actions (/cart/add,
// /cart, /localization, /contact, /password). It also serves a second storefront under /locked/,
// protected by a password. Carts live in memory, one per `cart` cookie.
//
// Node.js 24 or later, no dependencies:   node demo-site/server.js
// PORT (default 8080) and HOST (default 127.0.0.1) set where it listens.

const http = require('http');
const fs = require('fs');
const path = require('path');
const S = require('./lib/store');
const R = require('./lib/render');
const { SHOP, COUNTRIES, LANGUAGES } = require('./lib/catalog');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '127.0.0.1';
const ASSETS = path.join(__dirname, 'assets');
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// ---------------------------------------------------------------------------------------------
// Requests

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 1e6) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** Rails-like nested keys: items[0][id], updates[], updates[40001], contact[email]. */
function setNested(target, key, value) {
  const parts = [];
  const m = key.match(/^([^[]+)(.*)$/);
  if (!m) return;
  parts.push(m[1]);
  const re = /\[([^\]]*)\]/g;
  let x;
  while ((x = re.exec(m[2]))) parts.push(x[1]);
  let node = target;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    const last = i === parts.length - 1;
    if (p === '') {
      if (!Array.isArray(node.__list)) node.__list = [];
      if (last) { node.__list.push(value); return; }
      const obj = {};
      node.__list.push(obj);
      node = obj;
      continue;
    }
    if (last) { node[p] = value; return; }
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
}

function unlist(node) {
  if (Array.isArray(node)) return node.map(unlist);
  if (!node || typeof node !== 'object') return node;
  if (node.__list) return node.__list.map(unlist);
  const keys = Object.keys(node);
  if (keys.length && keys.every((k) => /^\d+$/.test(k))) return keys.sort((a, b) => a - b).map((k) => unlist(node[k]));
  const out = {};
  for (const k of keys) out[k] = unlist(node[k]);
  return out;
}

function parseMultipart(buffer, boundary) {
  const fields = [];
  const text = buffer.toString('utf8');
  for (const part of text.split(`--${boundary}`)) {
    const m = part.match(/name="([^"]*)"(?:; filename="[^"]*")?\r\n(?:[^\r\n]*\r\n)*\r\n([\s\S]*?)\r\n$/);
    if (m) fields.push([m[1], m[2]]);
  }
  return fields;
}

async function parseBody(req) {
  const buffer = await readBody(req);
  const type = String(req.headers['content-type'] || '');
  if (/application\/json/.test(type)) {
    try { return JSON.parse(buffer.toString('utf8') || '{}'); } catch (e) { return {}; }
  }
  let fields;
  const b = type.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if (/multipart\/form-data/.test(type) && b) fields = parseMultipart(buffer, b[1] || b[2]);
  else fields = [...new URLSearchParams(buffer.toString('utf8')).entries()];
  const out = {};
  for (const [k, v] of fields) setNested(out, k, v);
  return unlist(out);
}

// ---------------------------------------------------------------------------------------------
// Responses

function send(res, status, type, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body);
}

function sendJson(res, status, body, headers) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(body), headers);
}

function redirect(res, location, headers) {
  res.writeHead(302, Object.assign({ Location: location, 'Cache-Control': 'no-store' }, headers || {}));
  res.end();
}

function cookie(name, value, options) {
  const o = Object.assign({ path: '/', sameSite: 'Lax' }, options || {});
  return `${name}=${encodeURIComponent(value)}; Path=${o.path}; SameSite=${o.sameSite}${o.maxAge ? `; Max-Age=${o.maxAge}` : ''}`;
}

function productImage(handle) {
  const p = S.productByHandle.get(handle);
  if (!p) return null;
  const hues = { Bags: 32, Apparel: 210, Kitchen: 0, Stationery: 140 };
  const hue = hues[p.type] === undefined ? 260 : hues[p.type];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600" role="img" aria-label="${R.esc(p.title)}">
  <rect width="600" height="600" fill="hsl(${hue} 35% 88%)"/>
  <circle cx="300" cy="260" r="150" fill="hsl(${hue} 40% 62%)"/>
  <text x="300" y="520" font-family="sans-serif" font-size="44" text-anchor="middle" fill="hsl(${hue} 45% 25%)">${R.esc(p.title)}</text>
</svg>`;
}

// ---------------------------------------------------------------------------------------------
// The storefront

function contextFor(req, url) {
  let rest = url.pathname;
  let base = '/';
  let storefront = 'main';
  if (rest === '/locked' || rest.startsWith('/locked/')) {
    storefront = 'locked';
    base = '/locked/';
    rest = rest.slice('/locked'.length) || '/';
  }
  let lang = 'en';
  for (const l of LANGUAGES) {
    if (l.code !== 'en' && (rest === `/${l.code}` || rest.startsWith(`/${l.code}/`))) {
      lang = l.code;
      rest = rest.slice(l.code.length + 1) || '/';
    }
  }
  const jar = cookies(req);
  const country = COUNTRIES.some((c) => c.code === jar.localization) ? jar.localization : 'US';
  const known = jar.cart && S.cartFor(jar.cart).token === jar.cart;
  const cart = S.cartFor(known ? jar.cart : null);
  return {
    storefront,
    base,
    lang,
    root: lang === 'en' ? base : `${base}${lang}/`,
    country,
    cart,
    newCart: !known,
    jar,
    path: rest,
    pathNoRoot: rest + (url.search || ''),
    query: url.search ? url.search.slice(1) : '',
  };
}

function cartCookie(ctx) {
  return { 'Set-Cookie': cookie('cart', ctx.cart.token, { maxAge: 14 * 24 * 3600 }) };
}

function sectionsFor(ctx, ids) {
  const list = Array.isArray(ids) ? ids : String(ids || '').split(',');
  const out = {};
  const cart = S.cartJs(ctx.cart, ctx);
  for (const raw of list.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)) {
    if (raw === 'cart-drawer') out[raw] = R.drawerInner(ctx, cart);
    else if (raw === 'cart-icon') out[raw] = R.cartIcon(ctx, cart);
    else out[raw] = null;
  }
  return out;
}

function cartAnswer(res, ctx, result, body) {
  if (result.status !== 200) return sendJson(res, result.status, result.body, cartCookie(ctx));
  const answer = S.cartJs(ctx.cart, ctx);
  if (body && body.sections) answer.sections = sectionsFor(ctx, body.sections);
  return sendJson(res, 200, answer, cartCookie(ctx));
}

function itemsOf(body) {
  if (Array.isArray(body.items)) return body.items;
  if (body.items && typeof body.items === 'object') return Object.values(body.items);
  return [{ id: body.id, quantity: body.quantity, properties: body.properties }];
}

function html(res, status, markup, headers) {
  send(res, status, 'text/html; charset=utf-8', markup, headers);
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://demo.local');
  const method = req.method === 'HEAD' ? 'GET' : req.method;

  // Assets.
  if (url.pathname.startsWith('/assets/')) {
    const img = url.pathname.match(/^\/assets\/products\/([a-z0-9-]+)\.svg$/);
    if (img) {
      const svg = productImage(img[1]);
      return svg ? send(res, 200, TYPES['.svg'], svg, { 'Cache-Control': 'max-age=3600' }) : send(res, 404, 'text/plain', 'Not found');
    }
    const file = path.normalize(path.join(ASSETS, url.pathname.slice('/assets/'.length)));
    if (!file.startsWith(ASSETS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'text/plain', 'Not found');
    return send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', fs.readFileSync(file), { 'Cache-Control': 'no-cache' });
  }
  if (url.pathname === '/favicon.ico') return send(res, 204, 'image/x-icon', '');

  const ctx = contextFor(req, url);
  const p = ctx.path.replace(/\/+$/, '') || '/';
  const params = url.searchParams;
  const setCart = ctx.newCart ? cartCookie(ctx) : {};

  // The protected storefront: every page leads to its password page until the password is given.
  if (ctx.storefront === 'locked' && p !== '/password' && ctx.jar.storefront_digest !== 'granted') {
    return redirect(res, `${ctx.base}password`);
  }

  // The storefront password page.
  if (p === '/password') {
    if (ctx.storefront !== 'locked' || ctx.jar.storefront_digest === 'granted') return redirect(res, ctx.root);
    if (method === 'POST') {
      const body = await parseBody(req);
      if (body.password === SHOP.password) {
        return redirect(res, ctx.base, { 'Set-Cookie': cookie('storefront_digest', 'granted', { path: '/locked' }) });
      }
      return html(res, 200, R.passwordPage(ctx, { error: true }));
    }
    return html(res, 200, R.passwordPage(ctx, {}));
  }

  // The storefront Ajax API: the cart.
  if (p === '/cart.js' || p === '/cart.json') return sendJson(res, 200, S.cartJs(ctx.cart, ctx), setCart);
  if (method === 'POST' && p === '/cart/add.js') {
    const body = await parseBody(req);
    const result = S.addItems(ctx.cart, itemsOf(body));
    if (result.status !== 200) return sendJson(res, result.status, result.body, cartCookie(ctx));
    const answer = { items: result.lines.map((l) => S.lineJs(l, ctx)) };
    if (body.sections) answer.sections = sectionsFor(ctx, body.sections);
    return sendJson(res, 200, answer, cartCookie(ctx));
  }
  if (method === 'POST' && p === '/cart/change.js') {
    const body = await parseBody(req);
    return cartAnswer(res, ctx, S.changeLine(ctx.cart, body), body);
  }
  if (method === 'POST' && p === '/cart/update.js') {
    const body = await parseBody(req);
    return cartAnswer(res, ctx, S.updateCart(ctx.cart, body), body);
  }
  if (method === 'POST' && p === '/cart/clear.js') {
    const body = await parseBody(req);
    S.clearCart(ctx.cart);
    return cartAnswer(res, ctx, { status: 200 }, body);
  }

  // The cart's forms, without JavaScript.
  if (method === 'POST' && p === '/cart/add') {
    const body = await parseBody(req);
    S.addItems(ctx.cart, itemsOf(body));
    return redirect(res, `${ctx.root}cart`, cartCookie(ctx));
  }
  if (p === '/cart/change') {
    const body = method === 'POST' ? await parseBody(req) : Object.fromEntries(params.entries());
    S.changeLine(ctx.cart, body);
    return redirect(res, `${ctx.root}cart`, cartCookie(ctx));
  }
  if (p === '/cart/clear') {
    S.clearCart(ctx.cart);
    return redirect(res, `${ctx.root}cart`, cartCookie(ctx));
  }
  if (method === 'POST' && (p === '/cart' || p === '/cart/update')) {
    const body = await parseBody(req);
    S.updateCart(ctx.cart, { updates: body.updates, note: body.note, attributes: body.attributes });
    if (body.checkout !== undefined) return redirect(res, `${ctx.root}checkouts/cn/${ctx.cart.token}`, cartCookie(ctx));
    return redirect(res, `${ctx.root}cart`, cartCookie(ctx));
  }
  if (p === '/cart') {
    if (params.get('section_id') === 'cart-drawer' || params.get('section_id') === 'cart-icon') {
      return html(res, 200, sectionsFor(ctx, params.get('section_id'))[params.get('section_id')]);
    }
    return html(res, 200, R.cartPage(ctx), setCart);
  }

  // The hosted checkout is the platform's: the demo has a page that stands in for it.
  const co = p.match(/^\/checkouts\/cn\/([a-z0-9]+)$/);
  if (co) {
    let lines = S.cartJs(ctx.cart, ctx).items.map((i) => ({ quantity: i.quantity, title: i.title }));
    const buyNow = params.get('buy_now');
    if (buyNow) {
      const [id, qty] = buyNow.split(':');
      const found = S.variantById.get(parseInt(id, 10));
      lines = found ? [{ quantity: parseInt(qty, 10) || 1, title: S.hasOnlyDefaultVariant(found.product) ? found.product.title : `${found.product.title} - ${found.variant.title}` }] : [];
    }
    return html(res, 200, R.checkoutPage(ctx, lines));
  }

  // The localization form.
  if (method === 'POST' && p === '/localization') {
    const body = await parseBody(req);
    const country = COUNTRIES.find((c) => c.code === String(body.country_code || '').toUpperCase()) || S.country(ctx.country);
    const lang = LANGUAGES.find((l) => l.code === String(body.language_code || '').toLowerCase()) || LANGUAGES.find((l) => l.code === ctx.lang);
    let back = String(body.return_to || '/');
    if (!back.startsWith('/') || back.startsWith('//')) back = '/';
    const root = lang.code === 'en' ? ctx.base : `${ctx.base}${lang.code}/`;
    return redirect(res, root + back.replace(/^\//, ''), {
      'Set-Cookie': [cookie('localization', country.code, { maxAge: 14 * 24 * 3600 }), cookie('cart_currency', country.currency, { maxAge: 14 * 24 * 3600 })],
    });
  }

  // The newsletter (customer) form.
  if (method === 'POST' && p === '/contact') {
    const body = await parseBody(req);
    const email = String((body.contact && body.contact.email) || '').trim();
    let error = null;
    if (body.form_type === 'customer') {
      if (!email) error = 'blank';
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) error = 'invalid';
    }
    if (error) return html(res, 200, R.homePage(ctx, { email, error }));
    return redirect(res, `${ctx.root}?customer_posted=true#contact_form`);
  }

  // Predictive search.
  if (p === '/search/suggest.json') {
    const out = S.suggest(params, ctx);
    return sendJson(res, out.status, out.body);
  }
  if (p === '/search/suggest') return sendJson(res, 404, { status: 404, message: 'Not Found', description: 'Section not found' });

  // Pages.
  if (p === '/') {
    if (params.get('sections')) return sendJson(res, 200, sectionsFor(ctx, params.get('sections')));
    return html(res, 200, R.homePage(ctx, { posted: params.get('customer_posted') === 'true' }), setCart);
  }
  if (p === '/search') {
    const page = R.searchPage(ctx);
    if (params.get('section_id') === 'main-search') return html(res, 200, page.section);
    return html(res, 200, page.html, setCart);
  }
  if (p === '/collections') return redirect(res, `${ctx.root}collections/all`);
  const col = p.match(/^\/collections\/([a-z0-9-]+)$/);
  if (col) {
    const c = S.collection(col[1]);
    if (!c) return html(res, 404, R.notFoundPage(ctx));
    const page = R.collectionPage(ctx, c);
    if (params.get('section_id') === 'main-collection') return html(res, 200, page.section);
    return html(res, 200, page.html, setCart);
  }
  const prodJs = p.match(/^\/products\/([a-z0-9-]+)\.js$/);
  if (prodJs) {
    const product = S.productByHandle.get(prodJs[1]);
    return product ? sendJson(res, 200, S.productJs(product, ctx)) : sendJson(res, 404, { status: 404, message: 'Not Found', description: 'Product not found' });
  }
  const prod = p.match(/^(?:\/collections\/[a-z0-9-]+)?\/products\/([a-z0-9-]+)$/);
  if (prod) {
    const product = S.productByHandle.get(prod[1]);
    if (!product) return html(res, 404, R.notFoundPage(ctx));
    return html(res, 200, R.productPage(ctx, product, parseInt(params.get('variant') || '0', 10)), setCart);
  }
  const page = p.match(/^\/pages\/([a-z0-9-]+)$/);
  if (page) {
    const found = require('./lib/catalog').PAGES.find((x) => x.handle === page[1]);
    return found ? html(res, 200, R.contentPage(ctx, found.title, found.body, 'page', found.popup)) : html(res, 404, R.notFoundPage(ctx));
  }
  if (p === '/policies/privacy-policy') {
    return html(res, 200, R.contentPage(ctx, 'Privacy policy', 'The demo store keeps no personal data. Its cookies hold the cart, the country and the cookie choices of the visitor.', 'policy'));
  }
  return html(res, 404, R.notFoundPage(ctx));
}

const server = http.createServer((req, res) => {
  if (process.env.DEMO_LOG) res.on('finish', () => process.stdout.write(`${req.method} ${req.url} ${res.statusCode}\n`));
  handle(req, res).catch((e) => {
    process.stderr.write(`${req.method} ${req.url}: ${e.stack || e}\n`);
    if (!res.headersSent) send(res, 500, 'text/plain; charset=utf-8', 'The demo store could not answer this request.');
    else res.end();
  });
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(`The demo store answers at http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT} (Ctrl+C stops it).\n`);
  });
}

module.exports = { server, handle };
