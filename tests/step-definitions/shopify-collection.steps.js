'use strict';

// The collection page and the search results page: the theme's facets form (the platform's filter
// parameters: filter.v.availability, filter.v.price.gte and .lte, filter.p.product_type,
// filter.v.option.<name>, ...), the sort (sort_by), the product list and its pages. Facets are
// found by the heading of their group and the label of their value; the sort by the name of its
// option ("Price, low to high"), whatever control the theme draws for it.

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

/**
 * Open the closed disclosure, menu or drawer that holds a hidden control, the way a person does.
 * A theme may draw the same filter twice (a side panel for wide screens, a drawer for narrow
 * ones): the control that counts is the one a person can see, so the result names the visible
 * twin of the control (same name and value) once there is one.
 */
async function reveal(world, markSelector) {
  const look = (sel) => {
    const S = window.__webshipStore;
    const el = document.querySelector(sel);
    if (!el) return { gone: true };
    const twins = el.name && (el.type === 'checkbox' || el.type === 'radio')
      ? [...document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]`)].filter((x) => x.value === el.value)
      : [el];
    const seen = twins.find((x) => S.visible(x) || (x.labels && [...x.labels].some(S.visible)) || (x.closest('[role="option"]') && S.visible(x.closest('[role="option"]'))));
    return seen ? { shown: true, sel: S.mark(seen) } : { shown: false };
  };
  for (let round = 0; round < 3; round += 1) {
    const now = await H.inPage(world, look, markSelector);
    if (now.shown || now.gone) return now;
    const step = await H.inPage(world, (sel) => {
      const S = window.__webshipStore;
      const el = document.querySelector(sel);
      const details = el.closest('details:not([open])');
      if (details) {
        const summary = details.querySelector(':scope > summary');
        if (summary && S.visible(summary)) return { open: S.mark(summary), what: S.nameOf(summary) };
      }
      // A drawer or a dialog that holds it: the visible button that controls it, or a "Filter" button.
      let box = el.parentElement;
      while (box && box !== document.body) {
        if (box.id) {
          const opener = [...document.querySelectorAll(`[aria-controls="${CSS.escape(box.id)}"]`)].find(S.visible);
          if (opener) return { open: S.mark(opener), what: S.nameOf(opener) };
        }
        box = box.parentElement;
      }
      const filter = [...document.querySelectorAll('button, summary, [role="button"], a')]
        .find((b) => S.visible(b) && !S.inOverlay(b) && /^(filter|filters|filter and sort|filter & sort|filtrer|filtern|filtrar)\b/i.test(S.nameOf(b)));
      if (filter) return { open: S.mark(filter), what: S.nameOf(filter) };
      return { stuck: true };
    }, markSelector);
    if (step.stuck) return step;
    await H.personClick(world, step.open, step.what || 'the panel that holds it');
    await H.poll(world, (sel) => {
      const S = window.__webshipStore;
      const el = document.querySelector(sel);
      if (!el) return { done: true };
      const twins = el.name ? [...document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]`)].filter((x) => x.value === el.value) : [el];
      return { done: twins.some((x) => S.visible(x) || (x.labels && [...x.labels].some(S.visible))) };
    }, markSelector, 3000);
  }
  const last = await H.inPage(world, look, markSelector);
  return last.shown ? last : { stuck: true };
}

/** Click a filter or sort input: its visible label, the option that wraps it, or itself. */
async function clickChoice(world, markSelector, what) {
  const target = await H.inPage(world, (sel) => {
    const S = window.__webshipStore;
    const el = document.querySelector(sel);
    if (!el) return null;
    const label = el.labels && [...el.labels].find(S.visible);
    const option = (label && label.closest('[role="option"]')) || el.closest('[role="option"]');
    if (option && S.visible(option)) return S.mark(option);
    if (label) return S.mark(label);
    return S.mark(el);
  }, markSelector);
  if (!target) throw H.friendly({ action: 'click', target: what, hint: 'the page changed before it could be clicked.' });
  await H.personClick(world, target, what);
}

/** Wait until the address carries (or no longer carries) a filter or a sort. */
async function waitForQuery(world, test, timeout) {
  const result = await H.poll(world, (t) => {
    const params = new URLSearchParams(location.search);
    const busy = !!document.querySelector('[aria-busy="true"]');
    let ok;
    if (t.kind === 'has') ok = params.getAll(t.name).includes(t.value);
    else if (t.kind === 'lacks') ok = !params.getAll(t.name).includes(t.value);
    else if (t.kind === 'no-filters') ok = ![...params.keys()].some((k) => k.startsWith('filter.'));
    else if (t.kind === 'equals') ok = params.get(t.name) === t.value;
    else if (t.kind === 'number') ok = params.get(t.name) !== null && Number(params.get(t.name)) === t.value;
    else if (t.kind === 'page') ok = Number(params.get('page') || '1') === t.value;
    return { done: ok && !busy && document.readyState !== 'loading', query: location.search };
  }, test, timeout || H.budget(world));
  await H.settle(world);
  return result;
}

async function findFacet(world, value, group) {
  return H.poll(world, (a) => {
    const S = window.__webshipStore;
    const r = S.findFacet(a.value, a.group);
    if (!r.input) return { done: false, groups: r.groups, values: r.values };
    return { done: true, sel: S.mark(r.input), name: r.input.name, val: r.input.value, checked: r.input.checked, groups: r.groups, values: r.values };
  }, { value, group }, H.budget(world));
}

/**
 * Filters the products by a value of one of the store's filters: the box of that value in the
 * group of that heading ("Availability", "Price", "Product type", "Color", a group of the
 * merchant's own). A closed group or a filter drawer is opened first. Waits until the address
 * carries the filter and the list has been loaded again. A value that is already chosen is kept.
 *
 * Example #1: When I filter the products by "In stock" under "Availability"
 * Example #2: When I filter the products by "Bags" under "Product type"
 * Example #3: And I filter the products by "Navy" under "Color"
 * Example #4: When we filter the products by "Low Light" under "Light Requirements"
 * Example #5: When filter the products by "Out of stock" under "Availability"
 */
When(/^(?:I |we )?filter the products by "([^"]*)" under "([^"]*)"$/, async function (value, group) {
  const found = await findFacet(this, value, group);
  if (!found.done) {
    throw H.failure(this.page, `Expected a filter "${value}" under "${group}", but there is none.`, {
      found: `filter groups ${H.listed(found.groups)}; values there ${H.listed(found.values)}`,
      hint: 'a filter is named by the heading of its group and the label of its value; the merchant chooses which filters a collection shows.',
    });
  }
  if (found.checked) return;
  const shown = await reveal(this, found.sel);
  if (shown.stuck) throw H.failure(this.page, `The filter "${value}" under "${group}" is on the page but hidden, and no button opens it.`, { hint: 'open the filters first (When I press "Filter").' });
  await clickChoice(this, shown.sel || found.sel, `the "${value}" filter`);
  const done = await waitForQuery(this, { kind: 'has', name: found.name, value: found.val });
  if (!done.done) {
    throw H.failure(this.page, `Expected the address to carry the filter ${found.name}=${found.val} after choosing "${value}", but it does not.`, {
      found: `the address query "${done.query || '(none)'}"`,
      hint: 'the theme may apply filters with a button of its own; press it, or check that the filter box was clicked.',
    });
  }
});

/**
 * Removes a chosen filter: unticks its box, or uses the "remove" link the theme shows for it.
 *
 * Example #1: When I remove the "In stock" filter
 * Example #2: When I remove the "Bags" filter
 * Example #3: And I remove the "Navy" filter
 * Example #4: When we remove the "Low Light" filter
 * Example #5: When remove the "Out of stock" filter
 */
When(/^(?:I |we )?remove the "([^"]*)" filter$/, async function (value) {
  const found = await findFacet(this, value, null);
  if (!found.done) throw H.failure(this.page, `Expected a filter "${value}", but there is none.`, { found: `filters ${H.listed(found.values)}`, hint: 'a filter is named by the label of its value; choose it first.' });
  if (!found.checked) {
    throw H.failure(this.page, `Expected the filter "${value}" to be chosen, so that it can be removed, but it is not.`, { hint: 'choose it first, or check the spelling.' });
  }
  const link = await H.inPage(this, (v) => {
    const S = window.__webshipStore;
    const el = [...document.querySelectorAll('a[href], button')].find((x) => S.visible(x) && S.score(S.nameOf(x).replace(/^(remove filter|remove|supprimer le filtre)\s*:?\s*/i, '').replace(/\s*[✕×]$/, ''), v) >= 2 && /filter|remove|✕|×/i.test(`${S.nameOf(x)} ${x.textContent} ${x.getAttribute('href') || ''}`) && !x.closest('dialog:not([open])'));
    return el ? S.mark(el) : null;
  }, value);
  const visibleBox = await H.inPage(this, (sel) => {
    const S = window.__webshipStore;
    const el = document.querySelector(sel);
    return !!el && (S.visible(el) || (el.labels && [...el.labels].some(S.visible)));
  }, found.sel);
  if (visibleBox) await clickChoice(this, found.sel, `the "${value}" filter`);
  else if (link) await H.personClick(this, link, `the link that removes the "${value}" filter`);
  else {
    const shown = await reveal(this, found.sel);
    await clickChoice(this, shown.sel || found.sel, `the "${value}" filter`);
  }
  const done = await waitForQuery(this, { kind: 'lacks', name: found.name, value: found.val });
  if (!done.done) throw H.failure(this.page, `Expected the filter "${value}" to be removed, but the address still carries it.`, { found: `the address query "${done.query}"`, hint: 'remove it with its box or the theme\'s own remove link.' });
});

/**
 * Clears every chosen filter, with the theme's "Clear all" (or "Remove all") link, or by
 * unticking each box. The sort stays.
 *
 * Example #1: When I clear all filters
 * Example #2: And I clear all filters
 * Example #3: When we clear all filters
 * Example #4: When clear all filters
 * Example #5: Then I clear all filters
 */
When(/^(?:I |we )?clear all filters$/, async function () {
  const clear = await H.inPage(this, () => {
    const S = window.__webshipStore;
    const el = [...document.querySelectorAll('a[href], button, [role="button"]')].find((x) => S.visible(x) && /^(clear all|remove all|reset|clear filters|tout effacer)\b/i.test(S.nameOf(x)));
    return el ? S.mark(el) : null;
  });
  if (clear) {
    await H.personClick(this, clear, 'the link that clears the filters');
  } else {
    for (let i = 0; i < 20; i += 1) {
      const next = await H.inPage(this, () => {
        const S = window.__webshipStore;
        const box = S.facetInputs().find((x) => x.checked);
        return box ? { sel: S.mark(box), name: box.name, value: box.value } : null;
      });
      if (!next) break;
      const shown = await reveal(this, next.sel);
      await clickChoice(this, shown.sel || next.sel, 'a chosen filter');
      await waitForQuery(this, { kind: 'lacks', name: next.name, value: next.value });
    }
  }
  const done = await waitForQuery(this, { kind: 'no-filters' });
  if (!done.done) throw H.failure(this.page, 'Expected no filter in the address after clearing them, but some are left.', { found: `the address query "${done.query}"`, hint: 'the theme\'s "Clear all" link may keep some filters; untick them one by one.' });
});

/**
 * A filter is (or is not) chosen: its box is ticked and the address carries it.
 *
 * Example #1: Then the products should be filtered by "In stock" under "Availability"
 * Example #2: Then the products should be filtered by "Bags" under "Product type"
 * Example #3: And the products should be filtered by "Navy" under "Color"
 * Example #4: Then the products should not be filtered by "Out of stock" under "Availability"
 * Example #5: But the products should not be filtered by "Kitchen" under "Product type"
 */
Then(/^the products should( not)? be filtered by "([^"]*)" under "([^"]*)"$/, async function (not, value, group) {
  const found = await findFacet(this, value, group);
  if (!found.done) {
    throw H.failure(this.page, `Expected a filter "${value}" under "${group}", but there is none.`, { found: `filter groups ${H.listed(found.groups)}; values there ${H.listed(found.values)}`, hint: 'a filter is named by the heading of its group and the label of its value.' });
  }
  const result = await H.poll(this, (a) => {
    const el = document.querySelector(a.sel);
    const inQuery = new URLSearchParams(location.search).getAll(a.name).includes(a.val);
    const chosen = !!el && el.checked && inQuery;
    return { done: a.not ? !chosen : chosen, checked: !!el && el.checked, inQuery };
  }, Object.assign({ not: !!not }, found), H.budget(this));
  if (!result.done) {
    throw H.failure(this.page, not
      ? `Expected the products not to be filtered by "${value}", but they are.`
      : `Expected the products to be filtered by "${value}" under "${group}", but they are not.`, {
      found: `box ${result.checked ? 'ticked' : 'not ticked'}, address ${result.inQuery ? 'carries' : 'does not carry'} ${found.name}=${found.val}`, hint: 'a filter is chosen when its box is ticked and the address carries it.' });
  }
});

/**
 * Filters the products by price: the "from" and "to" fields of the price filter
 * (filter.v.price.gte and filter.v.price.lte), in the visitor's currency. A closed price group is
 * opened first. Waits until the address carries both.
 *
 * Example #1: When I filter the products by price from 10 to 30
 * Example #2: When I filter the products by price from 0 to 20
 * Example #3: And I filter the products by price from 15.50 to 40
 * Example #4: When we filter the products by price from 20 to 100
 * Example #5: When filter the products by price from 5 to 25
 */
When(/^(?:I |we )?filter the products by price from (\d+(?:[.,]\d+)?) to (\d+(?:[.,]\d+)?)$/, async function (from, to) {
  // The field is looked up again for each value: a theme may load its list (and its filters)
  // again as soon as the first one changes.
  const field = (name) => H.poll(this, (n) => {
    const S = window.__webshipStore;
    const list = [...document.querySelectorAll(`input[name="${n}"]`)];
    const el = list.find(S.visible) || list[0];
    return el ? { done: !document.querySelector('[aria-busy="true"]'), sel: S.mark(el) } : { done: false };
  }, name, H.budget(this));
  const first = await field('filter.v.price.gte');
  if (!first.sel) throw H.failure(this.page, 'Expected the price filter (its "from" and "to" fields), but the page has none.', { hint: 'the merchant chooses which filters a collection shows.' });
  const shown = await reveal(this, first.sel);
  if (shown.stuck) throw H.failure(this.page, 'The price filter is on the page but hidden, and no button opens it.', { hint: 'open the filters first (When I press "Filter").' });
  const a = Number(String(from).replace(',', '.'));
  const b = Number(String(to).replace(',', '.'));
  for (const [name, value] of [['filter.v.price.gte', from], ['filter.v.price.lte', to]]) {
    const now = await field(name);
    if (!now.sel) throw H.failure(this.page, `Expected the price filter's field ${name}, but the page has none.`, { hint: 'the price filter has a "from" and a "to" field.' });
    await this.page.locator(now.sel).fill(String(value), { timeout: H.budget(this) });
    await H.settle(this);
  }
  const done = await waitForQuery(this, { kind: 'number', name: 'filter.v.price.lte', value: b });
  const both = await waitForQuery(this, { kind: 'number', name: 'filter.v.price.gte', value: a }, 3000);
  if (!done.done || !both.done) {
    throw H.failure(this.page, `Expected the address to carry the price filter from ${from} to ${to}, but it does not.`, {
      found: `the address query "${both.query || done.query}"`,
      hint: 'the theme may apply the price with a button of its own; press it.',
    });
  }
});

/**
 * The price filter is set from one price to another (the address and the fields agree).
 *
 * Example #1: Then the price filter should be from 10 to 30
 * Example #2: Then the price filter should be from 0 to 20
 * Example #3: And the price filter should be from 15.50 to 40
 * Example #4: Then the price filter should be from 20 to 100
 * Example #5: But the price filter should be from 5 to 25
 */
Then(/^the price filter should be from (\d+(?:[.,]\d+)?) to (\d+(?:[.,]\d+)?)$/, async function (from, to) {
  const a = Number(String(from).replace(',', '.'));
  const b = Number(String(to).replace(',', '.'));
  const result = await H.poll(this, (w) => {
    const params = new URLSearchParams(location.search);
    const gte = params.get('filter.v.price.gte');
    const lte = params.get('filter.v.price.lte');
    return { done: gte !== null && lte !== null && Number(gte) === w.a && Number(lte) === w.b, gte, lte };
  }, { a, b }, H.budget(this));
  if (!result.done) {
    throw H.failure(this.page, `Expected the price filter from ${from} to ${to}, but it is from ${result.gte === null ? '(none)' : result.gte} to ${result.lte === null ? '(none)' : result.lte}.`, { hint: 'the price filter is filter.v.price.gte and filter.v.price.lte in the address.' });
  }
});

/**
 * Sorts the products by one of the store's sort options, named as the page shows it ("Featured",
 * "Best selling", "Alphabetically, A-Z", "Price, low to high", "Price, high to low", "Date, new to
 * old", ...): a drop-down list, a list of choices or a menu, whichever the theme draws. Waits until
 * the address carries the sort (sort_by) and the list has been loaded again.
 *
 * Example #1: When I sort the products by "Price, low to high"
 * Example #2: When I sort the products by "Alphabetically, Z-A"
 * Example #3: And I sort the products by "Best selling"
 * Example #4: When we sort the products by "Date, new to old"
 * Example #5: When sort the products by "Price, high to low"
 */
When(/^(?:I |we )?sort the products by "([^"]*)"$/, async function (label) {
  const found = await H.poll(this, (wanted) => {
    const S = window.__webshipStore;
    const value = S.sortValue(wanted);
    if (!value) return { done: false, labels: S.sortLabels() };
    const controls = S.sortControls();
    const select = controls.find((c) => c.tagName === 'SELECT' && S.visible(c));
    if (select) return { done: true, kind: 'select', sel: S.mark(select), value };
    const radio = controls.find((c) => c.tagName === 'INPUT' && c.value === value && (S.visible(c) || (c.labels && [...c.labels].some(S.visible)) || (c.closest('[role="option"]') && S.visible(c.closest('[role="option"]')))));
    if (radio) return { done: true, kind: 'radio', sel: S.mark(radio), value };
    const hidden = controls.find((c) => c.tagName === 'INPUT' && c.value === value) || controls.find((c) => c.tagName === 'SELECT');
    return { done: true, kind: 'hidden', sel: S.mark(hidden), value };
  }, label, H.budget(this));
  if (!found.done) {
    throw H.failure(this.page, `Expected a sort option "${label}", but there is none.`, {
      found: `sort options ${H.listed(found.labels)}`,
      hint: 'the options are named as the page shows them, in the store\'s language.',
    });
  }
  if (found.kind === 'select') {
    await this.page.locator(found.sel).selectOption(found.value);
  } else {
    if (found.kind === 'hidden') {
      const shown = await reveal(this, found.sel);
      if (shown.stuck) throw H.failure(this.page, `The sort option "${label}" is on the page but hidden, and no button opens it.`, { hint: 'open the sort menu first (When I press "Sort").' });
      const again = await H.inPage(this, (value) => {
        const S = window.__webshipStore;
        const shown = (x) => S.visible(x) || (x.labels && [...x.labels].some(S.visible)) || (x.closest('[role="option"]') && S.visible(x.closest('[role="option"]')));
        const inputs = S.sortControls().filter((x) => x.tagName === 'INPUT' && x.value === value);
        const c = inputs.find(shown) || S.sortControls().find((x) => x.tagName === 'SELECT' && S.visible(x)) || inputs[0];
        return c ? { sel: S.mark(c), select: c.tagName === 'SELECT' } : null;
      }, found.value);
      if (again && again.select) { await this.page.locator(again.sel).selectOption(found.value); found.kind = 'done'; } else if (again) found.sel = again.sel;
    }
    if (found.kind !== 'done') await clickChoice(this, found.sel, `the sort option "${label}"`);
  }
  const done = await waitForQuery(this, { kind: 'equals', name: 'sort_by', value: found.value });
  if (!done.done) {
    throw H.failure(this.page, `Expected the address to carry sort_by=${found.value} after choosing "${label}", but it does not.`, { found: `the address query "${done.query || '(none)'}"`, hint: 'the theme may apply the sort with a button of its own; press it.' });
  }
});

/**
 * The products are (or are not) sorted by that option: the address carries it, or, with no sort
 * in the address, the sort control shows it.
 *
 * Example #1: Then the products should be sorted by "Price, low to high"
 * Example #2: Then the products should be sorted by "Featured"
 * Example #3: And the products should be sorted by "Alphabetically, A-Z"
 * Example #4: Then the products should not be sorted by "Best selling"
 * Example #5: But the products should not be sorted by "Price, high to low"
 */
Then(/^the products should( not)? be sorted by "([^"]*)"$/, async function (not, label) {
  const result = await H.poll(this, (a) => {
    const S = window.__webshipStore;
    const value = S.sortValue(a.label);
    if (!value) return { done: false, missing: true, labels: S.sortLabels() };
    const inQuery = new URLSearchParams(location.search).get('sort_by');
    let current = inQuery;
    if (!current) {
      const controls = S.sortControls();
      const select = controls.find((c) => c.tagName === 'SELECT');
      const radio = controls.find((c) => c.tagName === 'INPUT' && c.checked);
      current = (radio && radio.value) || (select && select.value) || null;
    }
    const same = current === value;
    return { done: a.not ? !same : same, current, value };
  }, { label, not: !!not }, H.budget(this));
  if (result.missing) throw H.failure(this.page, `Expected a sort option "${label}", but there is none.`, { found: `sort options ${H.listed(result.labels)}`, hint: 'the options are named as the page shows them, in the store\'s language.' });
  if (!result.done) {
    throw H.failure(this.page, not
      ? `Expected the products not to be sorted by "${label}", but they are.`
      : `Expected the products to be sorted by "${label}" (${result.value}), but they are sorted by ${result.current || '(the default)'}.`, { hint: 'the sort is sort_by in the address, or the sort control\'s value when the address has none.' });
  }
});

async function gridOf(world, test, arg) {
  return H.poll(world, test, arg, H.budget(world));
}

/**
 * The product list of the page (the grid of a collection or of the search results) does (or does
 * not) show a product, by its title.
 *
 * Example #1: Then the product list should include "Canvas Tote"
 * Example #2: Then the product list should include "Wool Beanie"
 * Example #3: And the product list should include "Enamel Mug"
 * Example #4: Then the product list should not include "Linen Apron"
 * Example #5: But the product list should not include "Desk Tray"
 */
Then(/^the product list should( not)? include "([^"]*)"$/, async function (not, title) {
  const result = await gridOf(this, (a) => {
    const S = window.__webshipStore;
    const items = S.gridProducts();
    const has = items.some((p) => S.score(p.title, a.title) >= 2 || p.handle === a.title.toLowerCase());
    return { done: !document.querySelector('[aria-busy="true"]') && (a.not ? !has : has), has, titles: items.map((p) => p.title) };
  }, { title, not: !!not });
  if (!result.done) {
    throw H.failure(this.page, not
      ? `Expected the product list not to include "${title}", but it does.`
      : `Expected the product list to include "${title}", but it does not.`, { found: `products ${H.listed(result.titles)}`, hint: 'a product is named by its title in the product list of the page.' });
  }
});

/**
 * The product list of the page shows that many products (on this page of the list).
 *
 * Example #1: Then the product list should show 6 products
 * Example #2: Then the product list should show 1 product
 * Example #3: And the product list should show 2 products
 * Example #4: Then the product list should show 0 products
 * Example #5: But the product list should show 7 products
 */
Then(/^the product list should show (\d+) products?$/, async function (count) {
  const n = parseInt(count, 10);
  const result = await gridOf(this, (wanted) => {
    const items = window.__webshipStore.gridProducts();
    return { done: !document.querySelector('[aria-busy="true"]') && items.length === wanted, count: items.length, titles: items.map((p) => p.title) };
  }, n);
  if (!result.done) {
    throw H.failure(this.page, `Expected the product list to show ${n} product(s), but it shows ${result.count}.`, { found: `products ${H.listed(result.titles)}`, hint: 'the count is of the products on this page of the list; the store pages its lists.' });
  }
});

/**
 * The product list shows exactly these products, in this order (one title per row of the table).
 *
 * Example #1: Then the product list should show these products in order:
 * Example #2: And the product list should show these products in order:
 * Example #3: Then the product list should show these products in order:
 * Example #4: But the product list should show these products in order:
 * Example #5: * the product list should show these products in order:
 */
Then(/^the product list should show these products in order:$/, async function (table) {
  const wanted = table.raw().map((row) => row[0]).filter(Boolean);
  const result = await gridOf(this, (w) => {
    const S = window.__webshipStore;
    const items = S.gridProducts().map((p) => p.title);
    const same = items.length === w.length && items.every((t, i) => S.score(t, w[i]) >= 2);
    return { done: !document.querySelector('[aria-busy="true"]') && same, titles: items };
  }, wanted);
  if (!result.done) {
    throw H.failure(this.page, `Expected the product list to show, in order: ${H.listed(wanted, 30)}.`, { found: `in order: ${H.listed(result.titles, 30)}`, hint: 'a product is named by its title; the table lists them in the order of the page.' });
  }
});

/**
 * Goes to a page of the product list with its pagination: a page by its number, or the next or
 * previous page. Waits until the address carries the page and the list has loaded.
 *
 * Example #1: When I go to page 2 of the product list
 * Example #2: When I go to page 1 of the product list
 * Example #3: And I go to page 3 of the product list
 * Example #4: When we go to page 2 of the product list
 * Example #5: When go to page 2 of the product list
 */
When(/^(?:I |we )?go to page (\d+) of the product list$/, async function (number) {
  await goToPage(this, { page: parseInt(number, 10) });
});

/**
 * Goes to the next or the previous page of the product list, with its pagination.
 *
 * Example #1: When I go to the next page of the product list
 * Example #2: When I go to the previous page of the product list
 * Example #3: And I go to the next page of the product list
 * Example #4: When we go to the previous page of the product list
 * Example #5: When go to the next page of the product list
 */
When(/^(?:I |we )?go to the (next|previous) page of the product list$/, async function (direction) {
  const current = await H.inPage(this, () => Number(new URLSearchParams(location.search).get('page') || '1'));
  await goToPage(this, { page: direction === 'next' ? current + 1 : current - 1, direction });
});

async function goToPage(world, want) {
  const link = await H.poll(world, (w) => {
    const S = window.__webshipStore;
    const navs = [...document.querySelectorAll('nav, [role="navigation"]')].filter((n) => S.visible(n) && ((/pag/i.test(S.labelText(n)) || /pag/i.test(n.className)) || n.querySelector('a[href*="page="]')));
    const links = navs.flatMap((n) => [...n.querySelectorAll('a[href]')]).filter(S.visible);
    let el = null;
    if (w.direction) el = links.find((a) => (w.direction === 'next' ? /next|suivant|›|»|→/i : /prev|précédent|‹|«|←/i).test(`${S.nameOf(a)} ${a.getAttribute('rel') || ''}`));
    if (!el) el = links.find((a) => S.norm(a.textContent) === String(w.page) || S.lower(S.labelText(a)) === `page ${w.page}`);
    return el ? { done: true, sel: S.mark(el), pages: links.map((a) => S.norm(a.textContent)) } : { done: false, pages: links.map((a) => S.norm(a.textContent) || S.labelText(a)), navs: navs.length };
  }, want, H.budget(world));
  if (!link.done) {
    throw H.failure(world.page, `Expected a link to ${want.direction ? `the ${want.direction} page` : `page ${want.page}`} of the product list, but there is none.`, {
      found: link.navs ? `pagination links ${H.listed(link.pages)}` : 'no pagination on the page',
      hint: 'a list that fits on one page has no pagination.',
    });
  }
  await H.personClick(world, link.sel, `the link to page ${want.page}`);
  const done = await waitForQuery(world, { kind: 'page', value: want.page });
  if (!done.done) throw H.failure(world.page, `Expected page ${want.page} of the product list, but the address is "${done.query || '(none)'}".`, { hint: 'the page is the "page" of the address; the first page has none.' });
}

/**
 * The product list is on that page (the address, and the page the pagination marks as current).
 *
 * Example #1: Then the product list should be on page 2
 * Example #2: Then the product list should be on page 1
 * Example #3: And the product list should be on page 3
 * Example #4: But the product list should be on page 1
 * Example #5: * the product list should be on page 2
 */
Then(/^the product list should be on page (\d+)$/, async function (number) {
  const n = parseInt(number, 10);
  const result = await H.poll(this, (wanted) => {
    const S = window.__webshipStore;
    const page = Number(new URLSearchParams(location.search).get('page') || '1');
    const navs = [...document.querySelectorAll('nav, [role="navigation"]')].filter((n) => (/pag/i.test(S.labelText(n)) || /pag/i.test(n.className)) || n.querySelector('a[href*="page="]'));
    const current = navs.map((n) => n.querySelector('[aria-current="page"]')).find(Boolean);
    const marked = current ? Number(current.textContent.trim()) : page;
    return { done: page === wanted && marked === wanted, page, marked };
  }, n, H.budget(this));
  if (!result.done) throw H.failure(this.page, `Expected page ${n} of the product list, but the address says ${result.page} and the pagination marks ${result.marked}.`, { hint: 'the page is the "page" of the address and the one the pagination marks as current.' });
});
