'use strict';

// The store behind a page: the platform's globals on every storefront page (window.Shopify and
// window.ShopifyAnalytics), the type of the page, the theme, and the marketing pop-ups that cover
// a storefront.

const { Then, When } = require('@cucumber/cucumber');
const H = require('./store-helpers');

async function storefrontOf(world) {
  const result = await H.poll(world, () => {
    const S = window.__webshipStore;
    const info = S.storefront();
    return Object.assign({ done: info.hasGlobals || document.readyState === 'complete' }, info);
  }, null, H.budget(world));
  return result;
}

/**
 * The page is (or is not) a page of an online store on the platform: it carries the store's
 * globals (`window.Shopify` with the shop and its routes). A page of another site, an error page
 * of a proxy or the hosted checkout does not.
 *
 * Example #1: Then the page should be a storefront page
 * Example #2: Then this page should be a storefront page
 * Example #3: And the page should be a storefront page
 * Example #4: Then the page should not be a storefront page
 * Example #5: But this page should not be a storefront page
 */
Then(/^(?:the|this) page should( not)? be a storefront page$/, async function (not) {
  const info = await storefrontOf(this);
  if (!not && !info.hasGlobals) {
    throw H.failure(this.page, 'Expected a storefront page, but the page carries none of the store\'s globals.', {
      found: 'no window.Shopify with a shop or routes',
      hint: 'this may be another site, an error page, or the hosted checkout; check the address.',
    });
  }
  if (not && info.hasGlobals) {
    throw H.failure(this.page, `Expected a page outside the store, but it is a storefront page of "${info.shop}".`, {
      found: `page type "${info.pageType || '(none)'}"`,
      hint: 'a step that leaves the store (the checkout) may not have left it yet.',
    });
  }
});

/**
 * The page belongs to the store with that shop domain: the `shop` of `window.Shopify`, the
 * store's own domain on the platform, whatever domain the visitor sees.
 *
 * Example #1: Then the page should belong to the store "webship-demo-store.example"
 * Example #2: Then this page should belong to the store "webship-demo-store.example"
 * Example #3: And the page should belong to the store "my-store.example"
 * Example #4: Then the page should not belong to the store "another-store.example"
 * Example #5: But this page should not belong to the store "old-store.example"
 */
Then(/^(?:the|this) page should( not)? belong to the store "([^"]*)"$/, async function (not, shop) {
  const info = await storefrontOf(this);
  const same = info.shop.toLowerCase() === shop.toLowerCase();
  if (!not && !same) {
    throw H.failure(this.page, `Expected the page to belong to the store "${shop}", but it belongs to "${info.shop || '(no store)'}".`, {
      hint: 'the shop domain is the store\'s own domain on the platform, not always the one in the address bar.',
    });
  }
  if (not && same) throw H.failure(this.page, `Expected the page not to belong to the store "${shop}", but it does.`, { hint: 'the shop domain is the store\'s own domain on the platform; check the address the suite runs against.' });
});

/**
 * The type of the page, as the store reports it (`ShopifyAnalytics.meta.page.pageType`): "home",
 * "collection", "product", "searchresults", "cart", "page" and others.
 *
 * Example #1: Then the page type should be "product"
 * Example #2: Then the page type should be "collection"
 * Example #3: And the page type should be "searchresults"
 * Example #4: Then the page type should not be "home"
 * Example #5: But the page type should not be "cart"
 */
Then(/^the page type should( not)? be "([^"]*)"$/, async function (not, type) {
  const result = await H.poll(this, (wanted) => {
    const info = window.__webshipStore.storefront();
    return { done: info.pageType.toLowerCase() === wanted.toLowerCase() || document.readyState === 'complete', type: info.pageType };
  }, type, H.budget(this));
  const same = (result.type || '').toLowerCase() === type.toLowerCase();
  if (!not && !same) {
    throw H.failure(this.page, `Expected the page type "${type}", but it is "${result.type || '(none)'}".`, {
      hint: 'the type comes from the store\'s analytics data of the page; check that the page has loaded.',
    });
  }
  if (not && same) throw H.failure(this.page, `Expected the page type not to be "${type}", but it is.`, { hint: 'the type comes from the store\'s analytics data of the page; check the address.' });
});

/**
 * The store runs that theme: the theme's name in its settings (`window.Shopify.theme`), compared
 * with the schema name first, then with the name the merchant gave the copy.
 *
 * Example #1: Then the store should use the theme "Webship demo"
 * Example #2: And the store should use the theme "Webship demo"
 * Example #3: Then the store should use the theme "My theme"
 * Example #4: Then the store should not use the theme "Old theme"
 * Example #5: But the store should not use the theme "Retired theme"
 */
Then(/^the store should( not)? use the theme "([^"]*)"$/, async function (not, theme) {
  const info = await storefrontOf(this);
  const t = info.theme || { name: '', schema: '' };
  const wanted = theme.toLowerCase();
  const same = t.schema.toLowerCase() === wanted || t.name.toLowerCase() === wanted || t.name.toLowerCase().startsWith(`${wanted} `);
  if (!not && !same) {
    throw H.failure(this.page, `Expected the store to use the theme "${theme}", but it uses "${t.schema || '(unknown)'}".`, {
      found: `the theme's name in the store: "${t.name || '(none)'}"`,
      hint: 'a merchant may rename a copy of a theme; the schema name stays the theme\'s own.',
    });
  }
  if (not && same) throw H.failure(this.page, `Expected the store not to use the theme "${theme}", but it does.`, { hint: 'the theme\'s schema name is in window.Shopify.theme; a copy keeps it when renamed.' });
});

/**
 * Closes the marketing pop-ups that cover the page (a sign-up offer, a discount wheel): modal
 * dialogs that are not the store's own drawers, menus or cookie banner. Each is closed the way a
 * person closes it, with its close button or Escape. Does nothing when there is none. The steps of
 * this pack also close such a pop-up when it covers what they click.
 *
 * Example #1: When I close any pop-ups
 * Example #2: When I close any pop-up
 * Example #3: And I close any pop-ups
 * Example #4: When we close any pop-ups
 * Example #5: When close any pop-up
 */
When(/^(?:I |we )?close any pop-ups?$/, async function () {
  await H.closePopups(this);
});

/**
 * No marketing pop-up covers the page. The store's own drawers, menus and cookie banner do not
 * count.
 *
 * Example #1: Then no pop-up should cover the page
 * Example #2: And no pop-up should cover the page
 * Example #3: Then no pop-up should cover the page
 * Example #4: But no pop-up should cover the page
 * Example #5: * no pop-up should cover the page
 */
Then(/^no pop-up should cover the page$/, async function () {
  const result = await H.poll(this, () => {
    const list = window.__webshipStore.popups();
    return { done: !list.length, names: list.map((el) => window.__webshipStore.labelText(el) || window.__webshipStore.norm(el.textContent).slice(0, 60)) };
  }, null, Math.min(H.budget(this), 3000));
  if (!result.done) {
    throw H.failure(this.page, 'Expected no pop-up over the page, but one covers it.', {
      found: `pop-ups: ${H.listed(result.names)}`,
      hint: 'close it first: When I close any pop-ups.',
    });
  }
});
