'use strict';

// The catalogue of the demo store: our own products, collections and settings. Prices are in
// cents of the store's currency (USD), as the platform's Ajax API gives them.

const SHOP = {
  name: 'Webship Demo Store',
  domain: 'webship-demo-store.example',
  currency: 'USD',
  passwordMessage: 'We open our doors soon. Enter the password to look around.',
  // The second storefront the demo serves, under /locked/, is protected by this password.
  password: 'webship-demo',
};

let nextVariantId = 40001;

/**
 * A product with its options and variants. `variants` lists [values, price, inventory,
 * compareAtPrice]; inventory 0 means sold out.
 */
function product(id, handle, title, type, options, variants, extra) {
  const made = {
    id,
    handle,
    title,
    type,
    vendor: 'Webship Goods',
    tags: (extra && extra.tags) || [],
    description: (extra && extra.description) || '',
    createdAt: (extra && extra.createdAt) || '2026-01-01T09:00:00Z',
    bestSelling: (extra && extra.bestSelling) || 99,
    options: options.map((o, i) => ({ name: o[0], position: i + 1, values: o[1] })),
    variants: variants.map(([values, price, inventory, compareAt]) => {
      const vid = nextVariantId++;
      const list = values.length ? values : ['Default Title'];
      return {
        id: vid,
        title: list.join(' / '),
        options: list,
        price,
        compareAtPrice: compareAt || null,
        inventory,
        available: inventory > 0,
        sku: `WS-${id}-${vid}`,
      };
    }),
  };
  return made;
}

const PRODUCTS = [
  product(1001, 'canvas-tote', 'Canvas Tote', 'Bags',
    [['Color', ['Natural', 'Black', 'Olive']]],
    [[['Natural'], 2800, 5], [['Black'], 2800, 12], [['Olive'], 2800, 0]],
    { description: 'A sturdy tote of heavy cotton canvas with a flat bottom and an inside pocket.', createdAt: '2026-03-02T09:00:00Z', bestSelling: 1, tags: ['bags', 'cotton'] }),
  product(1002, 'wool-beanie', 'Wool Beanie', 'Apparel',
    [['Size', ['S/M', 'L/XL']], ['Color', ['Grey', 'Navy', 'Rust']]],
    [[['S/M', 'Grey'], 2400, 8], [['S/M', 'Navy'], 2400, 8], [['S/M', 'Rust'], 2400, 3],
      [['L/XL', 'Grey'], 2400, 6], [['L/XL', 'Navy'], 2400, 4], [['L/XL', 'Rust'], 2400, 0]],
    { description: 'A ribbed beanie knitted from soft merino wool.', createdAt: '2026-02-10T09:00:00Z', bestSelling: 2, tags: ['wool', 'winter'] }),
  product(1003, 'enamel-mug', 'Enamel Mug', 'Kitchen',
    [],
    [[[], 1600, 30]],
    { description: 'A steel mug with a white enamel finish, for the desk and the camp.', createdAt: '2026-01-15T09:00:00Z', bestSelling: 3, tags: ['kitchen'] }),
  product(1004, 'linen-apron', 'Linen Apron', 'Kitchen',
    [],
    [[[], 4200, 0]],
    { description: 'A washed linen apron with two front pockets. Sold out until spring.', createdAt: '2026-01-20T09:00:00Z', bestSelling: 7, tags: ['kitchen', 'linen'] }),
  product(1005, 'field-notebook', 'Field Notebook', 'Stationery',
    [['Pages', ['64 pages', '128 pages']]],
    [[['64 pages'], 1200, 40], [['128 pages'], 1800, 25]],
    { description: 'A pocket notebook with a dot grid and a sewn binding.', createdAt: '2026-04-01T09:00:00Z', bestSelling: 4, tags: ['paper'] }),
  product(1006, 'brass-pen', 'Brass Pen', 'Stationery',
    [['Finish', ['Raw', 'Polished']]],
    [[['Raw'], 3400, 10], [['Polished'], 3800, 2]],
    { description: 'A solid brass pen that takes standard refills.', createdAt: '2026-02-25T09:00:00Z', bestSelling: 6, tags: ['writing'] }),
  product(1007, 'cotton-socks', 'Cotton Socks', 'Apparel',
    [['Size', ['S', 'M', 'L']]],
    [[['S'], 900, 15, 1200], [['M'], 900, 15, 1200], [['L'], 900, 15, 1200]],
    { description: 'Organic cotton socks, now on sale.', createdAt: '2026-03-20T09:00:00Z', bestSelling: 5, tags: ['cotton', 'sale'] }),
  product(1008, 'desk-tray', 'Desk Tray', 'Stationery',
    [['Color', ['Black', 'Natural']]],
    [[['Black'], 2200, 9], [['Natural'], 2200, 9]],
    { description: 'A folded steel tray for pens, cards and keys.', createdAt: '2026-04-12T09:00:00Z', bestSelling: 8, tags: ['desk'] }),
];

const COLLECTIONS = [
  { handle: 'all', title: 'Products', description: 'Everything the store sells.', products: PRODUCTS.map((p) => p.handle) },
  { handle: 'bags', title: 'Bags', description: 'Totes and pouches.', products: ['canvas-tote'] },
  { handle: 'apparel', title: 'Apparel', description: 'Warm things to wear.', products: ['wool-beanie', 'cotton-socks'] },
  { handle: 'kitchen', title: 'Kitchen', description: 'For the table and the stove.', products: ['enamel-mug', 'linen-apron'] },
  { handle: 'stationery', title: 'Stationery', description: 'Paper, pens and the desk.', products: ['field-notebook', 'brass-pen', 'desk-tray'] },
];

const PAGES = [
  { handle: 'about', title: 'About us', body: 'The Webship Demo Store is a small shop made to test storefronts. Nothing here is for sale.' },
  { handle: 'shipping', title: 'Shipping', body: 'Orders leave in two working days. Shipping is free above $50.' },
  // A page with the kind of marketing pop-up many stores show over their pages.
  { handle: 'welcome', title: 'Welcome', body: 'New here? Have a look around the store.', popup: true },
];

// The platform's sort options, with the names it gives them.
const SORT_OPTIONS = [
  ['manual', 'Featured'],
  ['best-selling', 'Best selling'],
  ['title-ascending', 'Alphabetically, A-Z'],
  ['title-descending', 'Alphabetically, Z-A'],
  ['price-ascending', 'Price, low to high'],
  ['price-descending', 'Price, high to low'],
  ['created-ascending', 'Date, old to new'],
  ['created-descending', 'Date, new to old'],
];

// The countries of the store's markets, with their currencies. The demo converts at fixed rates.
const COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', rate: 1 },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: '$', rate: 1.36 },
  { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€', rate: 0.92 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', rate: 0.79 },
];

// Countries whose visitors see the cookie banner (the European Economic Area and the United
// Kingdom), the way the platform's automated settings show it for a store with a market there.
const CONSENT_REGIONS = ['DE', 'GB'];

const LANGUAGES = [
  { code: 'en', name: 'English', root: '/' },
  { code: 'fr', name: 'Français', root: '/fr/' },
];

const PER_PAGE = 6;

module.exports = { SHOP, PRODUCTS, COLLECTIONS, PAGES, SORT_OPTIONS, COUNTRIES, CONSENT_REGIONS, LANGUAGES, PER_PAGE };
