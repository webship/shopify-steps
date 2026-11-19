'use strict';

// The store side of the demo: carts, the catalogue queries (filters, sorting, pages, search) and
// the JSON shapes of the storefront Ajax API, written from its public documentation
// (shopify.dev/docs/api/ajax). Nothing here is the platform's code.

const crypto = require('crypto');
const { SHOP, PRODUCTS, COLLECTIONS, PAGES, SORT_OPTIONS, COUNTRIES, PER_PAGE } = require('./catalog');

const productByHandle = new Map(PRODUCTS.map((p) => [p.handle, p]));
const variantById = new Map();
for (const p of PRODUCTS) for (const v of p.variants) variantById.set(v.id, { product: p, variant: v });

// ---------------------------------------------------------------------------------------------
// Money

function country(code) {
  return COUNTRIES.find((c) => c.code === code) || COUNTRIES[0];
}

/** Cents of the store's currency converted to cents of the visitor's currency. */
function convert(cents, ctx) {
  const rate = country(ctx.country).rate;
  return Math.round(cents * rate);
}

/** "$28.00", or "$38.08 CAD" for a currency other than the store's. */
function money(cents, ctx) {
  const c = country(ctx.country);
  const amount = (convert(cents, ctx) / 100).toFixed(2);
  return c.currency === SHOP.currency ? `${c.symbol}${amount}` : `${c.symbol}${amount} ${c.currency}`;
}

// ---------------------------------------------------------------------------------------------
// Products

function minPrice(p) {
  return Math.min(...p.variants.map((v) => v.price));
}

function maxPrice(p) {
  return Math.max(...p.variants.map((v) => v.price));
}

function available(p) {
  return p.variants.some((v) => v.available);
}

function hasOnlyDefaultVariant(p) {
  return p.options.length === 0;
}

function productUrl(p, ctx, variant) {
  return `${ctx.root}products/${p.handle}${variant ? `?variant=${variant.id}` : ''}`;
}

function imageUrl(p) {
  return `/assets/products/${p.handle}.svg`;
}

/** The product object of GET /products/<handle>.js. */
function productJs(p, ctx) {
  const prices = p.variants.map((v) => convert(v.price, ctx));
  const compares = p.variants.map((v) => (v.compareAtPrice ? convert(v.compareAtPrice, ctx) : 0));
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: `<p>${p.description}</p>`,
    published_at: p.createdAt,
    created_at: p.createdAt,
    vendor: p.vendor,
    type: p.type,
    tags: p.tags,
    price: Math.min(...prices),
    price_min: Math.min(...prices),
    price_max: Math.max(...prices),
    available: available(p),
    price_varies: new Set(prices).size > 1,
    compare_at_price: Math.min(...compares) || null,
    compare_at_price_min: Math.min(...compares),
    compare_at_price_max: Math.max(...compares),
    compare_at_price_varies: new Set(compares).size > 1,
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      option1: v.options[0] || null,
      option2: v.options[1] || null,
      option3: v.options[2] || null,
      sku: v.sku,
      requires_shipping: true,
      taxable: true,
      featured_image: null,
      available: v.available,
      name: hasOnlyDefaultVariant(p) ? p.title : `${p.title} - ${v.title}`,
      public_title: hasOnlyDefaultVariant(p) ? null : v.title,
      options: v.options,
      price: convert(v.price, ctx),
      weight: 300,
      compare_at_price: v.compareAtPrice ? convert(v.compareAtPrice, ctx) : null,
      inventory_management: 'shopify',
      barcode: '',
    })),
    images: [imageUrl(p)],
    featured_image: imageUrl(p),
    options: p.options.length ? p.options.map((o) => ({ name: o.name, position: o.position, values: o.values })) : [{ name: 'Title', position: 1, values: ['Default Title'] }],
    url: productUrl(p, ctx),
  };
}

/** The product object of the predictive search API (prices as decimal strings). */
function suggestProduct(p, ctx) {
  const dec = (c) => (convert(c, ctx) / 100).toFixed(2);
  const compares = p.variants.map((v) => v.compareAtPrice || 0);
  return {
    available: available(p),
    body: `<p>${p.description}</p>`,
    compare_at_price_max: dec(Math.max(...compares)),
    compare_at_price_min: dec(Math.min(...compares)),
    handle: p.handle,
    id: p.id,
    image: imageUrl(p),
    price: dec(minPrice(p)),
    price_max: dec(maxPrice(p)),
    price_min: dec(minPrice(p)),
    tags: p.tags,
    title: p.title,
    type: p.type,
    url: `${productUrl(p, ctx)}?_pos=1&_psq=${encodeURIComponent(ctx.query || '')}&_ss=e&_v=1.0`,
    variants: [],
    vendor: p.vendor,
    featured_image: { url: imageUrl(p), alt: p.title, aspect_ratio: 1 },
  };
}

// ---------------------------------------------------------------------------------------------
// Collections, filters, sorting, pages

const FILTER_KEYS = ['filter.v.availability', 'filter.v.price.gte', 'filter.v.price.lte', 'filter.p.product_type', 'filter.v.option.color'];

/** The filters of a query string: { availability: ['1'], gte, lte, types: [], colors: [] }. */
function readFilters(params) {
  const decimal = (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(',', '.')));
  return {
    availability: params.getAll('filter.v.availability'),
    gte: decimal(params.get('filter.v.price.gte')),
    lte: decimal(params.get('filter.v.price.lte')),
    types: params.getAll('filter.p.product_type'),
    colors: params.getAll('filter.v.option.color'),
  };
}

function variantColor(p, v) {
  const i = p.options.findIndex((o) => o.name === 'Color');
  return i === -1 ? null : v.options[i];
}

/** A product is kept when one of its variants passes every variant filter, as on the platform. */
function matches(p, f, ctx, skip) {
  if (skip !== 'type' && f.types.length && !f.types.includes(p.type)) return false;
  return p.variants.some((v) => {
    if (skip !== 'availability' && f.availability.length && !f.availability.includes(v.available ? '1' : '0')) return false;
    const price = convert(v.price, ctx) / 100;
    if (skip !== 'price' && f.gte !== null && !(price >= f.gte)) return false;
    if (skip !== 'price' && f.lte !== null && !(price <= f.lte)) return false;
    if (skip !== 'color' && f.colors.length && !f.colors.includes(variantColor(p, v))) return false;
    return true;
  });
}

function sortProducts(list, sortBy, baseOrder) {
  const by = {
    manual: (a, b) => baseOrder.indexOf(a.handle) - baseOrder.indexOf(b.handle),
    'best-selling': (a, b) => a.bestSelling - b.bestSelling,
    'title-ascending': (a, b) => a.title.localeCompare(b.title),
    'title-descending': (a, b) => b.title.localeCompare(a.title),
    'price-ascending': (a, b) => minPrice(a) - minPrice(b) || a.title.localeCompare(b.title),
    'price-descending': (a, b) => minPrice(b) - minPrice(a) || a.title.localeCompare(b.title),
    'created-ascending': (a, b) => a.createdAt.localeCompare(b.createdAt),
    'created-descending': (a, b) => b.createdAt.localeCompare(a.createdAt),
  }[sortBy] || ((a, b) => baseOrder.indexOf(a.handle) - baseOrder.indexOf(b.handle));
  return list.slice().sort(by);
}

function validSort(sortBy, fallback) {
  return SORT_OPTIONS.some(([value]) => value === sortBy) ? sortBy : fallback;
}

/** The values of each filter with their counts, given the other active filters. */
function filterGroups(products, f, ctx) {
  const count = (skip, test) => products.filter((p) => matches(p, f, ctx, skip) && test(p)).length;
  const colors = [];
  for (const p of products) for (const v of p.variants) { const c = variantColor(p, v); if (c && !colors.includes(c)) colors.push(c); }
  const types = [];
  for (const p of products) if (!types.includes(p.type)) types.push(p.type);
  const maxDollars = Math.ceil(Math.max(...products.map((p) => convert(maxPrice(p), ctx))) / 100);
  return {
    availability: [
      { value: '1', key: 'inStock', count: count('availability', (p) => p.variants.some((v) => v.available)), active: f.availability.includes('1') },
      { value: '0', key: 'outOfStock', count: count('availability', (p) => p.variants.some((v) => !v.available)), active: f.availability.includes('0') },
    ],
    types: types.sort().map((t) => ({ value: t, label: t, count: count('type', (p) => p.type === t), active: f.types.includes(t) })),
    colors: colors.map((c) => ({ value: c, label: c, count: count('color', (p) => p.variants.some((v) => variantColor(p, v) === c)), active: f.colors.includes(c) })),
    price: { gte: f.gte, lte: f.lte, max: maxDollars },
  };
}

function collection(handle) {
  return COLLECTIONS.find((c) => c.handle === handle) || null;
}

/** A page of a collection: { products, total, page, pages, sortBy, filters, groups }. */
function queryCollection(c, params, ctx) {
  const base = c.products.map((h) => productByHandle.get(h)).filter(Boolean);
  const f = readFilters(params);
  const sortBy = validSort(params.get('sort_by'), 'manual');
  const filtered = sortProducts(base.filter((p) => matches(p, f, ctx)), sortBy, c.products);
  return paginate(filtered, params, { sortBy, filters: f, groups: filterGroups(base, f, ctx) });
}

function paginate(list, params, extra) {
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(params.get('page') || '1', 10) || 1), pages);
  return Object.assign({ products: list.slice((page - 1) * PER_PAGE, page * PER_PAGE), total: list.length, page, pages }, extra);
}

function words(text) {
  return String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Products whose title, type, tags or vendor hold every word of the query (word starts). */
function searchProducts(q) {
  const wanted = words(q);
  if (!wanted.length) return [];
  return PRODUCTS.filter((p) => {
    const have = words([p.title, p.type, p.vendor, p.tags.join(' ')].join(' '));
    return wanted.every((w) => have.some((h) => h.startsWith(w)));
  });
}

function searchPages(q) {
  const wanted = words(q);
  if (!wanted.length) return [];
  return PAGES.filter((pg) => wanted.every((w) => words(pg.title).some((h) => h.startsWith(w))));
}

function searchCollections(q) {
  const wanted = words(q);
  if (!wanted.length) return [];
  return COLLECTIONS.filter((c) => c.handle !== 'all' && wanted.every((w) => words(c.title).some((h) => h.startsWith(w))));
}

function querySearch(params, ctx) {
  const q = (params.get('q') || '').trim();
  const sortBy = validSort(params.get('sort_by'), 'manual');
  const found = searchProducts(q);
  return paginate(sortProducts(found, sortBy, found.map((p) => p.handle)), params, { sortBy, q, pages_found: searchPages(q) });
}

/** GET /search/suggest.json */
function suggest(params, ctx) {
  const q = (params.get('q') || '').trim();
  const types = (params.get('resources[type]') || 'query,product,collection,page').split(',').map((t) => t.trim());
  const limit = Math.min(Math.max(parseInt(params.get('resources[limit]') || '10', 10) || 10, 1), 10);
  const scope = params.get('resources[limit_scope]') || 'all';
  const unavailable = params.get('resources[options][unavailable_products]') || 'last';
  if (!['show', 'hide', 'last'].includes(unavailable)) {
    return { status: 422, body: { status: '422', message: 'Invalid parameter error', description: 'Invalid option for `unavailable_products` parameter' } };
  }
  const local = Object.assign({}, ctx, { query: q });
  let products = searchProducts(q);
  if (unavailable === 'hide') products = products.filter(available);
  if (unavailable === 'last') products = products.filter(available).concat(products.filter((p) => !available(p)));
  const results = { queries: [], products: [], collections: [], pages: [], articles: [] };
  let left = limit;
  const take = (list) => {
    const n = scope === 'each' ? limit : Math.max(0, left);
    const taken = list.slice(0, n);
    if (scope !== 'each') left -= taken.length;
    return taken;
  };
  if (types.includes('query') && q) {
    const titles = products.map((p) => p.title.toLowerCase());
    const texts = [...new Set([q.toLowerCase()].concat(titles))];
    results.queries = take(texts).map((text) => ({
      text,
      styled_text: text.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i'), '<mark>$1</mark>'),
      url: `${ctx.root}search?q=${encodeURIComponent(text)}&_pos=1&_psq=${encodeURIComponent(q)}&_ss=e&_v=1.0`,
    }));
  }
  if (types.includes('product')) results.products = take(products).map((p) => suggestProduct(p, local));
  if (types.includes('collection')) {
    results.collections = take(searchCollections(q)).map((c) => ({ body: `<p>${c.description}</p>`, handle: c.handle, id: COLLECTIONS.indexOf(c) + 1, featured_image: null, published_at: '2026-01-01T09:00:00Z', title: c.title, url: `${ctx.root}collections/${c.handle}` }));
  }
  if (types.includes('page')) {
    results.pages = take(searchPages(q)).map((pg) => ({ author: 'Webship Demo Store', body: `<p>${pg.body}</p>`, handle: pg.handle, id: PAGES.indexOf(pg) + 1, published_at: '2026-01-01T09:00:00Z', title: pg.title, url: `${ctx.root}pages/${pg.handle}` }));
  }
  return { status: 200, body: { resources: { results } } };
}

// ---------------------------------------------------------------------------------------------
// Carts, kept in memory by the token of the `cart` cookie. A new browser context gets a new cart.

const CARTS = new Map();
const MAX_CARTS = 2000;

function newToken() {
  return crypto.randomBytes(16).toString('hex');
}

function cartFor(token) {
  if (token && CARTS.has(token)) {
    const cart = CARTS.get(token);
    CARTS.delete(token);
    CARTS.set(token, cart);
    return cart;
  }
  const cart = { token: token || newToken(), note: '', attributes: {}, items: [] };
  CARTS.set(cart.token, cart);
  while (CARTS.size > MAX_CARTS) CARTS.delete(CARTS.keys().next().value);
  return cart;
}

function lineKey(variantId, properties) {
  const hash = crypto.createHash('md5').update(JSON.stringify(properties || {})).digest('hex');
  return `${variantId}:${hash}`;
}

function cartError(status, description, message) {
  return { status, body: { status, message: message || 'Cart Error', description } };
}

/** Add items ([{id, quantity, properties}]); returns { status, body: { items } } as /cart/add.js does. */
function addItems(cart, items) {
  const added = [];
  for (const raw of items) {
    const id = parseInt(raw.id, 10);
    const quantity = Math.max(1, parseInt(raw.quantity === undefined ? 1 : raw.quantity, 10) || 1);
    const found = variantById.get(id);
    if (!found) return cartError(422, 'Cannot find variant');
    const { product: p, variant: v } = found;
    const name = hasOnlyDefaultVariant(p) ? p.title : `${p.title} - ${v.title}`;
    if (!v.available) return cartError(422, `The product '${name}' is already sold out.`);
    const key = lineKey(id, raw.properties);
    let line = cart.items.find((l) => l.key === key);
    const inCart = line ? line.quantity : 0;
    if (inCart >= v.inventory) return cartError(422, `You can't add more ${name} to the cart.`);
    const room = v.inventory - inCart;
    if (!line) {
      line = { key, variantId: id, quantity: 0, properties: raw.properties || {} };
      cart.items.unshift(line);
    }
    line.quantity += Math.min(quantity, room);
    added.push(line);
    // As documented: when the quantity is more than the stock, the cart takes what there is.
    if (quantity > room) return cartError(422, `You can't add more ${name} to the cart.`);
  }
  return { status: 200, lines: added };
}

/** POST /cart/change.js: one line by `line` (1-based) or `id` (variant id or line key). */
function changeLine(cart, body) {
  let index = -1;
  if (body.line !== undefined && body.line !== null && body.line !== '') {
    index = parseInt(body.line, 10) - 1;
  } else if (body.id !== undefined && body.id !== null && body.id !== '') {
    const id = String(body.id);
    index = cart.items.findIndex((l) => l.key === id || String(l.variantId) === id);
  }
  if (index < 0 || index >= cart.items.length) {
    return { status: 400, body: { status: 'bad_request', message: 'no valid id or line parameter', description: 'no valid id or line parameter' } };
  }
  const quantity = parseInt(body.quantity, 10);
  if (Number.isFinite(quantity)) setQuantity(cart, index, quantity);
  if (body.properties && typeof body.properties === 'object') cart.items[index].properties = body.properties;
  return { status: 200 };
}

function setQuantity(cart, index, quantity) {
  if (quantity <= 0) cart.items.splice(index, 1);
  else cart.items[index].quantity = quantity;
}

/** POST /cart/update.js: updates (object or array), note, attributes. */
function updateCart(cart, body) {
  const updates = body.updates;
  if (Array.isArray(updates)) {
    const quantities = updates.map((q) => parseInt(q, 10));
    for (let i = cart.items.length - 1; i >= 0; i -= 1) {
      if (Number.isFinite(quantities[i])) setQuantity(cart, i, quantities[i]);
    }
  } else if (updates && typeof updates === 'object') {
    for (const [id, raw] of Object.entries(updates)) {
      const quantity = parseInt(raw, 10);
      if (!Number.isFinite(quantity)) continue;
      const index = cart.items.findIndex((l) => l.key === id || String(l.variantId) === id);
      if (index !== -1) setQuantity(cart, index, quantity);
      else if (quantity > 0) {
        if (!variantById.has(parseInt(id, 10))) return { status: 404, body: { status: 404, message: 'Cart Error', description: 'Cannot find variant' } };
        cart.items.push({ key: lineKey(parseInt(id, 10), {}), variantId: parseInt(id, 10), quantity, properties: {} });
      }
    }
  }
  if (typeof body.note === 'string') cart.note = body.note;
  if (body.attributes && typeof body.attributes === 'object') Object.assign(cart.attributes, body.attributes);
  return { status: 200 };
}

function clearCart(cart) {
  cart.items = [];
}

/** A line item as /cart.js gives it. */
function lineJs(line, ctx) {
  const { product: p, variant: v } = variantById.get(line.variantId);
  const price = convert(v.price, ctx);
  const only = hasOnlyDefaultVariant(p);
  return {
    id: v.id,
    properties: line.properties,
    quantity: line.quantity,
    variant_id: v.id,
    key: line.key,
    title: only ? p.title : `${p.title} - ${v.title}`,
    price,
    original_price: price,
    discounted_price: price,
    line_price: price * line.quantity,
    original_line_price: price * line.quantity,
    total_discount: 0,
    discounts: [],
    sku: v.sku,
    grams: 300,
    vendor: p.vendor,
    taxable: true,
    product_id: p.id,
    product_has_only_default_variant: only,
    gift_card: false,
    final_price: price,
    final_line_price: price * line.quantity,
    url: `${ctx.root}products/${p.handle}?variant=${v.id}`,
    featured_image: { aspect_ratio: 1, alt: p.title, height: 600, url: imageUrl(p), width: 600 },
    image: imageUrl(p),
    handle: p.handle,
    requires_shipping: true,
    product_type: p.type,
    product_title: p.title,
    product_description: p.description,
    variant_title: only ? null : v.title,
    variant_options: v.options,
    options_with_values: only ? [{ name: 'Title', value: 'Default Title' }] : p.options.map((o, i) => ({ name: o.name, value: v.options[i] })),
    line_level_discount_allocations: [],
    line_level_total_discount: 0,
    quantity_rule: { min: 1, max: v.inventory, increment: 1 },
    has_components: false,
  };
}

/** The cart object of GET /cart.js. */
function cartJs(cart, ctx) {
  const items = cart.items.map((l) => lineJs(l, ctx));
  const total = items.reduce((n, i) => n + i.final_line_price, 0);
  return {
    token: cart.token,
    note: cart.note,
    attributes: cart.attributes,
    original_total_price: total,
    total_price: total,
    total_discount: 0,
    total_weight: items.reduce((n, i) => n + i.grams * i.quantity, 0),
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    items,
    requires_shipping: items.length > 0,
    currency: country(ctx.country).currency,
    items_subtotal_price: total,
    cart_level_discount_applications: [],
  };
}

module.exports = {
  SHOP, PRODUCTS, COLLECTIONS, PAGES, SORT_OPTIONS, COUNTRIES, FILTER_KEYS,
  productByHandle, variantById, country, convert, money, minPrice, maxPrice, available, hasOnlyDefaultVariant,
  productUrl, imageUrl, productJs, collection, queryCollection, querySearch, suggest, readFilters,
  cartFor, addItems, changeLine, updateCart, clearCart, cartJs, lineJs, newToken,
};
