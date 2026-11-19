'use strict';

// Search: the predictive search of the header (a search box that asks the store for suggestions
// while a person types, through GET /search/suggest or /search/suggest.json) and the search
// itself. The search box is found as the search field of the store's search form, opened first
// when a theme keeps it behind a "Search" button. The results page is a product list: the product
// list steps of the collection file read it.

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

async function searchBox(world) {
  const find = () => {
    const S = window.__webshipStore;
    const input = S.searchInputs().find(S.visible);
    if (input) return { done: true, sel: S.mark(input) };
    const opener = S.searchOpeners()[0];
    return { done: false, opener: opener ? S.mark(opener) : null, name: opener ? S.nameOf(opener) : '' };
  };
  let found = await H.poll(world, find, null, 3000);
  if (!found.done && found.opener) {
    await H.personClick(world, found.opener, `the "${found.name}" button`);
    found = await H.poll(world, find, null, H.budget(world));
  }
  if (!found.done) {
    throw H.failure(world.page, 'Expected a search box, but the page has none, and no "Search" button shows one.', { hint: 'a store\'s search box belongs to a form that leads to its search page.' });
  }
  return found.sel;
}

async function suggestions(world, test, arg, timeout) {
  return H.poll(world, test, arg, timeout || H.budget(world));
}

/**
 * Types a text in the store's search box, a key at a time as a person does, and waits for the
 * store's suggestions (GET /search/suggest) and for the theme to show them. A search box behind a
 * "Search" button is opened first.
 *
 * Example #1: When I type "tote" in the search box
 * Example #2: When I type "wool" in the search box
 * Example #3: And I type "note" in the search box
 * Example #4: When we type "mug" into the search box
 * Example #5: When type "card" in the search box
 */
When(/^(?:I |we )?type "([^"]*)" in(?:to)? the search box$/, async function (text) {
  const sel = await searchBox(this);
  const box = this.page.locator(sel);
  await box.fill('');
  const answer = H.waitForStoreResponse(this, /\/search\/suggest(\.json)?$/, { method: 'GET' });
  await box.pressSequentially(text, { delay: 40 });
  const response = await answer;
  if (!response) {
    throw H.failure(this.page, `Expected the store to be asked for suggestions for "${text}", but no request went out.`, {
      hint: 'the theme may not have predictive search, or the store\'s language may not support it.',
    });
  }
  await suggestions(this, (s) => {
    const S = window.__webshipStore;
    const input = document.querySelector(s);
    const box = S.suggestionsOf(input);
    return { done: !!box && S.visible(box) && !box.getAttribute('aria-busy') };
  }, sel, H.budget(this));
  await H.settle(this);
});

/**
 * The suggestions of the search box are (or are not) shown.
 *
 * Example #1: Then the search suggestions should be shown
 * Example #2: And the search suggestions should be shown
 * Example #3: Then the search suggestions should not be shown
 * Example #4: But the search suggestions should not be shown
 * Example #5: * the search suggestions should be shown
 */
Then(/^the search suggestions should( not)? be shown$/, async function (not) {
  const result = await suggestions(this, (wanted) => {
    const S = window.__webshipStore;
    const boxes = S.searchInputs().map(S.suggestionsOf).filter(Boolean);
    const shown = boxes.some((b) => S.visible(b) && S.norm(b.textContent));
    return { done: wanted ? shown : !shown };
  }, !not);
  if (!result.done) throw H.failure(this.page, not ? 'Expected no search suggestions, but they are shown.' : 'Expected the search suggestions to be shown, but they are not.', { hint: 'type in the search box first: When I type "<text>" in the search box.' });
});

/**
 * The search suggestions do (or do not) list an entry (a product, a collection, a page or a
 * suggested search), by its title.
 *
 * Example #1: Then the search suggestions should list "Canvas Tote"
 * Example #2: And the search suggestions should list "Wool Beanie"
 * Example #3: Then the search suggestions should not list "Enamel Mug"
 * Example #4: But the search suggestions should not list "Linen Apron"
 * Example #5: Then the search suggestions should list "Bags"
 */
Then(/^the search suggestions should( not)? list "([^"]*)"$/, async function (not, title) {
  const result = await suggestions(this, (a) => {
    const S = window.__webshipStore;
    const boxes = S.searchInputs().map(S.suggestionsOf).filter((b) => b && S.visible(b));
    const names = boxes.flatMap((b) => S.suggestionLinks(b).map((l) => S.nameOf(l)));
    const has = names.some((n) => S.score(n, a.title) >= 2);
    return { done: boxes.length > 0 && (a.not ? !has : has), shown: boxes.length > 0, names };
  }, { title, not: !!not });
  if (!result.shown) throw H.failure(this.page, `Expected the search suggestions${not ? '' : ` to list "${title}"`}, but none are shown.`, { hint: 'type in the search box first.' });
  if (!result.done) {
    throw H.failure(this.page, not ? `Expected the search suggestions not to list "${title}", but they do.` : `Expected the search suggestions to list "${title}", but they do not.`, { found: `suggestions ${H.listed(result.names)}`, hint: 'a suggestion is named by its title; the store decides which products it suggests for a text.' });
  }
});

/**
 * Opens one of the search suggestions, by its title, and waits for its page.
 *
 * Example #1: When I choose the search suggestion "Canvas Tote"
 * Example #2: And I choose the search suggestion "Wool Beanie"
 * Example #3: When we choose the search suggestion "Field Notebook"
 * Example #4: When choose the search suggestion "Bags"
 * Example #5: When I choose the search suggestion "Enamel Mug"
 */
When(/^(?:I |we )?choose the search suggestion "([^"]*)"$/, async function (title) {
  const found = await suggestions(this, (t) => {
    const S = window.__webshipStore;
    const boxes = S.searchInputs().map(S.suggestionsOf).filter((b) => b && S.visible(b));
    const links = boxes.flatMap((b) => S.suggestionLinks(b));
    // A product, a collection or a page before a suggested search with the same words.
    const rank = (l) => S.score(S.nameOf(l), t) + (/\/products\//.test(l.getAttribute('href') || '') ? 0.6 : /\/search\b/.test(l.getAttribute('href') || '') ? 0 : 0.3);
    const hit = links.filter((l) => S.score(S.nameOf(l), t) >= 2).sort((a, b) => rank(b) - rank(a))[0];
    return hit ? { done: true, sel: S.mark(hit), href: hit.href } : { done: false, names: links.map((l) => S.nameOf(l)) };
  }, title);
  if (!found.done) throw H.failure(this.page, `Expected a search suggestion "${title}", but there is none.`, { found: `suggestions ${H.listed(found.names)}`, hint: 'type a text that names it first; the store decides which entries it suggests.' });
  const nav = this.page.waitForURL((url) => url.toString() !== this.page.url(), { timeout: H.budget(this) }).catch(() => null);
  await H.personClick(this, found.sel, `the search suggestion "${title}"`);
  await nav;
  await H.settle(this, 3000);
});

/**
 * Closes the search suggestions with Escape, as a keyboard user does, and waits until they are
 * gone.
 *
 * Example #1: When I close the search suggestions
 * Example #2: And I close the search suggestions
 * Example #3: When we close the search suggestions
 * Example #4: When close the search suggestions
 * Example #5: Then I close the search suggestions
 */
When(/^(?:I |we )?close the search suggestions$/, async function () {
  const input = await H.inPage(this, () => {
    const S = window.__webshipStore;
    const i = S.searchInputs().find((x) => S.visible(x) && S.suggestionsOf(x) && S.visible(S.suggestionsOf(x)));
    return i ? S.mark(i) : null;
  });
  if (!input) throw H.failure(this.page, 'Expected search suggestions to close, but none are shown.', { hint: 'type in the search box first: When I type "<text>" in the search box.' });
  await this.page.locator(input).press('Escape');
  const result = await suggestions(this, (s) => {
    const S = window.__webshipStore;
    const box = S.suggestionsOf(document.querySelector(s));
    return { done: !box || !S.visible(box) };
  }, input, H.budget(this));
  if (!result.done) throw H.failure(this.page, 'Expected the search suggestions to close with Escape, but they are still shown.', { hint: 'the theme may close its suggestions another way; check its search box.' });
});

/**
 * Searches the store for a text: types it in the search box and sends the search with Enter, then
 * waits for the search results page.
 *
 * Example #1: When I search the store for "tote"
 * Example #2: When I search the store for "wool"
 * Example #3: And I search the store for "notebook"
 * Example #4: When we search the store for "nothing like this"
 * Example #5: When search the store for "mug"
 */
When(/^(?:I |we )?search the store for "([^"]*)"$/, async function (text) {
  const sel = await searchBox(this);
  const box = this.page.locator(sel);
  await box.fill(text);
  const nav = this.page.waitForURL((url) => /\/search\b/.test(url.pathname), { timeout: H.budget(this) }).catch(() => null);
  await box.press('Enter');
  await nav;
  await H.settle(this, 3000);
  const on = /\/search\b/.test(new URL(this.page.url()).pathname);
  if (!on) throw H.failure(this.page, `Expected the search results page for "${text}", but the page is "${new URL(this.page.url()).pathname}".`, { hint: 'a suggestion may have been chosen with Enter; close the suggestions first.' });
});
