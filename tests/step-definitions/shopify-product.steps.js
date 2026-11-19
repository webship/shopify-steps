'use strict';

// The product page: the variant picker (found by the name of each option, whether the theme draws
// it as buttons, a drop-down list or a menu), the quantity, the add to cart button and the
// sold-out state, the dynamic checkout button and the price. The truth about the chosen variant is
// the product form's own `id` field, read with the store's product data
// (ShopifyAnalytics.meta.product, GET /products/<handle>.js).

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

/** The product form, its chosen variant and that variant's data, read in the page. */
async function variantState(world) {
  return H.inPage(world, async () => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { noForm: true };
    const id = S.variantId(form);
    const handle = S.productHandle();
    const meta = S.meta();
    let title = null;
    let available = null;
    const fromMeta = meta && meta.product && (meta.product.variants || []).find((v) => String(v.id) === id);
    if (fromMeta) title = fromMeta.public_title || 'Default Title';
    try {
      window.__webshipStoreProducts = window.__webshipStoreProducts || {};
      if (handle && !window.__webshipStoreProducts[handle]) {
        const r = await fetch(`${S.root()}products/${encodeURIComponent(handle)}.js`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
        if (r.ok) window.__webshipStoreProducts[handle] = await r.json();
      }
      const product = window.__webshipStoreProducts[handle];
      const v = product && product.variants.find((x) => String(x.id) === id);
      if (v) {
        available = !!v.available;
        if (!title) title = v.public_title || v.title;
      }
    } catch (e) { /* the product data is a help, not a must */ }
    const add = S.addButton(form);
    return {
      id,
      handle,
      title,
      available,
      add: add ? { sel: S.mark(add), name: S.nameOf(add), disabled: add.disabled || add.getAttribute('aria-disabled') === 'true', visible: S.visible(add) } : null,
    };
  });
}

function noForm(world) {
  return H.failure(world.page, 'Expected a product form (a form that adds to the cart), but the page has none.', {
    hint: 'open a product page first; a store may also hide the form for a product it does not sell in the visitor\'s country.',
  });
}

/**
 * Chooses a value of one option of the product (its colour, its size, ...) in the variant picker,
 * the way a person does: the button or swatch with that name, or the entry of the drop-down list
 * labelled with the option's name. Waits until the theme shows the choice and has updated the
 * product form's variant.
 *
 * Example #1: When I choose "Navy" for "Color"
 * Example #2: When I choose "L/XL" for "Size"
 * Example #3: And I choose "128 pages" for "Pages"
 * Example #4: When we choose "Polished" for "Finish"
 * Example #5: When choose "Black" for "Color"
 */
When(/^(?:I |we )?choose "([^"]*)" for "([^"]*)"$/, async function (value, option) {
  const find = (a) => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { done: true, noForm: true };
    const { group, names } = S.optionGroup(form, a.option);
    if (!group) return { done: false, names };
    const choice = S.optionChoice(group, a.value);
    const values = S.optionChoices(group).map((c) => c.label);
    if (!choice) return { done: false, group: group.name, values };
    if (group.kind === 'select') return { done: true, kind: 'select', sel: S.mark(group.el), value: choice.value, chosen: choice.chosen };
    // The label a person clicks (a swatch, a size button), or the radio itself without one.
    const label = choice.el.labels && [...choice.el.labels].find(S.visible);
    const target = label || choice.el;
    return { done: true, kind: 'click', sel: S.mark(target), chosen: choice.chosen };
  };
  const found = await H.poll(this, find, { value, option }, H.budget(this));
  if (found.noForm) throw noForm(this);
  if (!found.done) {
    throw H.failure(this.page, found.group
      ? `Expected "${value}" among the values of "${option}", but there is none.`
      : `Expected an option "${option}" in the variant picker, but there is none.`, {
      found: found.group ? `values of "${found.group}": ${H.listed(found.values)}` : `options ${H.listed(found.names)}`,
      hint: 'an option is named by its label or the legend of its group; a value by its name on the button or in the list.',
    });
  }
  if (!found.chosen) {
    if (found.kind === 'select') await this.page.locator(found.sel).selectOption(found.value);
    else await H.personClick(this, found.sel, `"${value}" for "${option}"`);
  }
  const done = await H.poll(this, (a) => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { done: false };
    const { group } = S.optionGroup(form, a.option);
    const choice = group && S.optionChoice(group, a.value);
    const meta = S.meta();
    const v = meta && meta.product && (meta.product.variants || []).find((x) => String(x.id) === S.variantId(form));
    const inVariant = !v || !v.public_title || S.lower(v.public_title).split(' / ').includes(S.lower(a.value)) || S.lower(v.public_title) === S.lower(a.value);
    return { done: !!choice && choice.chosen && inVariant && !form.closest('[aria-busy="true"]') && !form.querySelector('[aria-busy="true"]') };
  }, { value, option }, H.budget(this));
  if (!done.done) {
    throw H.failure(this.page, `Expected "${value}" to be chosen for "${option}" after choosing it, but it is not.`, {
      hint: 'the theme may not have answered yet, or the value may be one that cannot be combined with the others.',
    });
  }
  await H.settle(this);
});

/**
 * A value of an option is (or is not) the one chosen in the variant picker.
 *
 * Example #1: Then "Navy" should be chosen for "Color"
 * Example #2: Then "S/M" should be chosen for "Size"
 * Example #3: And "64 pages" should be chosen for "Pages"
 * Example #4: Then "Rust" should not be chosen for "Color"
 * Example #5: But "L/XL" should not be chosen for "Size"
 */
Then(/^"([^"]*)" should( not)? be chosen for "([^"]*)"$/, async function (value, not, option) {
  const result = await H.poll(this, (a) => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { done: true, noForm: true };
    const { group, names } = S.optionGroup(form, a.option);
    if (!group) return { done: false, names };
    const choice = S.optionChoice(group, a.value);
    const chosen = S.optionChoices(group).filter((c) => c.chosen).map((c) => c.label);
    if (!choice) return { done: false, missing: true, values: S.optionChoices(group).map((c) => c.label) };
    return { done: a.not ? !choice.chosen : choice.chosen, chosen };
  }, { value, option, not: !!not }, H.budget(this));
  if (result.noForm) throw noForm(this);
  if (result.names) throw H.failure(this.page, `Expected an option "${option}" in the variant picker, but there is none.`, { found: `options ${H.listed(result.names)}`, hint: 'an option is named by its label or the legend of its group.' });
  if (result.missing) throw H.failure(this.page, `Expected "${value}" among the values of "${option}", but there is none.`, { found: `values ${H.listed(result.values)}`, hint: 'a value is named as its button or its entry in the list shows it.' });
  if (!result.done) {
    throw H.failure(this.page, not
      ? `Expected "${value}" not to be chosen for "${option}", but it is.`
      : `Expected "${value}" to be chosen for "${option}", but it is not.`, { found: `chosen: ${H.listed(result.chosen)}`, hint: 'a value is chosen when its button is checked or its entry is selected.' });
  }
});

/**
 * The variant the product form will add is (or is not) the one with that title: its option
 * values joined with " / " ("S/M / Navy"), as the store names it.
 *
 * Example #1: Then the selected variant should be "S/M / Navy"
 * Example #2: Then the selected variant should be "Black"
 * Example #3: And the selected variant should be "128 pages"
 * Example #4: Then the selected variant should not be "L/XL / Rust"
 * Example #5: But the selected variant should not be "Olive"
 */
Then(/^the selected variant should( not)? be "([^"]*)"$/, async function (not, title) {
  let state = null;
  const deadline = Date.now() + H.budget(this);
  for (;;) {
    state = await variantState(this);
    if (state.noForm) throw noForm(this);
    const same = H.norm(state.title).toLowerCase() === H.norm(title).toLowerCase();
    if ((not ? !same : same) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  const same = H.norm(state.title).toLowerCase() === H.norm(title).toLowerCase();
  if (!not && !same) {
    throw H.failure(this.page, `Expected the selected variant "${title}", but it is "${state.title || '(unknown)'}".`, {
      found: `the product form's variant id ${state.id || '(none)'}`,
      hint: 'a variant is named by its option values joined with " / ", in the order of the options.',
    });
  }
  if (not && same) throw H.failure(this.page, `Expected the selected variant not to be "${title}", but it is.`, { hint: 'a variant is named by its option values joined with " / ".' });
});

/**
 * The selected variant can (or cannot) be bought: the store's product data says whether it is
 * available.
 *
 * Example #1: Then the selected variant should be available
 * Example #2: And the selected variant should be available
 * Example #3: Then the selected variant should not be available
 * Example #4: But the selected variant should not be available
 * Example #5: * the selected variant should be available
 */
Then(/^the selected variant should( not)? be available$/, async function (not) {
  const state = await variantState(this);
  if (state.noForm) throw noForm(this);
  if (state.available === null) {
    throw H.failure(this.page, 'Expected to read whether the selected variant is available, but the store gave no product data.', {
      found: `product "${state.handle || '(unknown)'}", variant ${state.id || '(none)'}`,
      hint: 'the store answers GET /products/<handle>.js on every product page; check the page is a product page.',
    });
  }
  if (!not && !state.available) throw H.failure(this.page, `Expected the selected variant "${state.title}" to be available, but it is sold out.`, { hint: 'choose another variant, or check the product\'s stock in the store.' });
  if (not && state.available) throw H.failure(this.page, `Expected the selected variant "${state.title}" not to be available, but it is.`, { hint: 'the store\'s product data (GET /products/<handle>.js) says whether a variant can be bought.' });
});

async function quantityField(world) {
  const found = await H.poll(world, () => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { done: true, noForm: true };
    const input = S.quantityInput(form);
    return input ? { done: true, sel: S.mark(input), value: input.value } : { done: false };
  }, null, H.budget(world));
  if (found.noForm) throw noForm(world);
  if (!found.done) {
    throw H.failure(world.page, 'Expected a quantity field on the product page, but there is none.', {
      hint: 'many themes leave the quantity out of the product page; the merchant chooses it.',
    });
  }
  return found;
}

/**
 * Sets the quantity of the product page to a number (its quantity field).
 *
 * Example #1: When I set the quantity to 3
 * Example #2: When I set the quantity to 1
 * Example #3: And I set the quantity to 2
 * Example #4: When we set the quantity to 5
 * Example #5: When set the quantity to 10
 */
When(/^(?:I |we )?set the quantity to (\d+)$/, async function (number) {
  const field = await quantityField(this);
  const locator = this.page.locator(field.sel);
  await locator.fill(String(number));
  await locator.press('Tab');
  await H.settle(this);
});

/**
 * Raises or lowers the quantity of the product page by one, with its plus or minus button.
 *
 * Example #1: When I increase the quantity
 * Example #2: When I decrease the quantity
 * Example #3: And I increase the quantity
 * Example #4: When we decrease the quantity
 * Example #5: When increase the quantity
 */
When(/^(?:I |we )?(increase|decrease) the quantity$/, async function (way) {
  const field = await quantityField(this);
  const button = await H.inPage(this, (a) => {
    const S = window.__webshipStore;
    const input = document.querySelector(a.sel);
    let box = input.parentElement;
    for (let i = 0; i < 3 && box; i += 1) {
      const buttons = [...box.querySelectorAll('button, [role="button"]')].filter(S.visible);
      const re = a.way === 'increase' ? /increase|plus|more|add one|augmenter|erhöhen|\+/i : /decrease|minus|less|remove one|réduire|verringern|−|-/i;
      const hit = buttons.find((b) => re.test(`${S.nameOf(b)} ${b.getAttribute('name') || ''}`));
      if (hit) return S.mark(hit);
      box = box.parentElement;
    }
    return null;
  }, { sel: field.sel, way });
  if (!button) throw H.failure(this.page, `Expected a button to ${way} the quantity next to its field, but there is none.`, { hint: 'set it with: When I set the quantity to <number>.' });
  const before = Number(field.value);
  await H.personClick(this, button, `the button to ${way} the quantity`);
  const result = await H.poll(this, (a) => {
    const input = document.querySelector(a.sel);
    return { done: !!input && Number(input.value) !== a.before, value: input && input.value };
  }, { sel: field.sel, before }, 3000);
  if (!result.done && !(way === 'decrease' && before <= 1)) throw H.failure(this.page, `Expected the quantity to ${way} from ${before}, but it stayed ${result.value}.`, { hint: 'the button may stop at the field\'s minimum or maximum.' });
});

/**
 * The quantity field of the product page holds that number.
 *
 * Example #1: Then the quantity should be 3
 * Example #2: Then the quantity should be 1
 * Example #3: And the quantity should be 2
 * Example #4: Then the quantity should not be 0
 * Example #5: But the quantity should not be 5
 */
Then(/^the quantity should( not)? be (\d+)$/, async function (not, number) {
  const field = await quantityField(this);
  const n = parseInt(number, 10);
  const result = await H.poll(this, (a) => {
    const input = document.querySelector(a.sel);
    const same = !!input && Number(input.value) === a.n;
    return { done: a.not ? !same : same, value: input && input.value };
  }, { sel: field.sel, n, not: !!not }, H.budget(this));
  if (!result.done) throw H.failure(this.page, not ? `Expected the quantity not to be ${n}, but it is.` : `Expected the quantity ${n}, but it is ${result.value}.`, { hint: 'the quantity is the value of the product form\'s quantity field.' });
});

/**
 * Adds the product, with the chosen variant and quantity, to the cart: presses the product form's
 * add button and waits for the store's answer (POST /cart/add or /cart/add.js), then for the
 * theme to show it (a cart drawer, a notification, or the cart page).
 *
 * Example #1: When I add the product to the cart
 * Example #2: And I add the product to the cart
 * Example #3: When we add the product to the cart
 * Example #4: When add the product to the cart
 * Example #5: Then I add the product to the cart
 */
When(/^(?:I |we )?add the product to the cart$/, async function () {
  const state = await variantState(this);
  if (state.noForm) throw noForm(this);
  if (!state.add) throw H.failure(this.page, 'Expected an add to cart button in the product form, but there is none.', { hint: 'the button sends the product form; a theme may put it outside the form with form="…".' });
  if (state.add.disabled) {
    throw H.failure(this.page, `Expected to add the product to the cart, but its button "${state.add.name}" is disabled.`, {
      found: `the selected variant "${state.title || state.id}"${state.available === false ? ', sold out' : ''}`,
      hint: 'choose a variant that is available, or check it with: Then the product should be sold out.',
    });
  }
  const answer = H.waitForStoreResponse(this, /\/cart\/add(\.js)?$/);
  await H.personClick(this, state.add.sel, `the "${state.add.name}" button`);
  const response = await answer;
  if (!response) {
    throw H.failure(this.page, 'Expected the store to answer the add to cart request, but no request went out.', {
      hint: 'the button may not belong to the product form, or the theme may add to the cart another way.',
    });
  }
  let body = null;
  try { body = await response.json(); } catch (e) { body = null; }
  this.__storeLastAdd = { status: response.status(), body };
  await H.settle(this, 3000);
});

/**
 * The product, with the chosen variant, is (or is not) sold out: its add button is disabled and
 * the store's product data says it is not available.
 *
 * Example #1: Then the product should be sold out
 * Example #2: And the product should be sold out
 * Example #3: Then the product should not be sold out
 * Example #4: But the product should not be sold out
 * Example #5: * the product should be sold out
 */
Then(/^the product should( not)? be sold out$/, async function (not) {
  let state = null;
  const deadline = Date.now() + H.budget(this);
  for (;;) {
    state = await variantState(this);
    if (state.noForm) throw noForm(this);
    const sold = !!state.add && state.add.disabled && state.available !== true;
    if ((not ? !sold : sold) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  const sold = !!state.add && state.add.disabled && state.available !== true;
  if (!not && !sold) {
    throw H.failure(this.page, `Expected the product to be sold out, but "${state.title || state.id}" can be added to the cart.`, {
      found: `the add button "${state.add ? state.add.name : '(none)'}" is ${state.add && state.add.disabled ? 'disabled' : 'enabled'}`, hint: 'a product is sold out when its add button is disabled and the store has none of the variant.' });
  }
  if (not && sold) throw H.failure(this.page, `Expected the product not to be sold out, but "${state.title || state.id}" is.`, { found: `the add button reads "${state.add.name}"`, hint: 'a product is sold out when its add button is disabled and the store has none of the variant.' });
});

/**
 * The add to cart button of the product form can (or cannot) be pressed.
 *
 * Example #1: Then I should be able to add the product to the cart
 * Example #2: And I should be able to add the product to the cart
 * Example #3: Then I should not be able to add the product to the cart
 * Example #4: But we should not be able to add the product to the cart
 * Example #5: Then we should be able to add the product to the cart
 */
Then(/^(?:I |we )?should( not)? be able to add the product to the cart$/, async function (not) {
  let state = null;
  const deadline = Date.now() + H.budget(this);
  for (;;) {
    state = await variantState(this);
    if (state.noForm) throw noForm(this);
    const can = !!state.add && !state.add.disabled && state.add.visible;
    if ((not ? !can : can) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  const can = !!state.add && !state.add.disabled && state.add.visible;
  if (!not && !can) throw H.failure(this.page, `Expected the add to cart button to work, but it is ${state.add ? 'disabled' : 'missing'}.`, { found: state.add ? `"${state.add.name}"` : 'no button', hint: 'the button is disabled for a variant that is sold out or a combination that does not exist.' });
  if (not && can) throw H.failure(this.page, `Expected the add to cart button to be disabled, but "${state.add.name}" can be pressed.`, { hint: 'the button is disabled for a variant that is sold out or a combination that does not exist.' });
});

/**
 * The store refused the last add to the cart (a sold-out variant, more than the stock): its
 * answer was an error, and the theme shows the message, which can be named.
 *
 * Example #1: Then adding to the cart should be refused
 * Example #2: Then adding to the cart should be refused with "You can't add more Canvas Tote - Natural to the cart."
 * Example #3: And adding to the cart should be refused
 * Example #4: Then adding to the cart should be refused with "is already sold out"
 * Example #5: But adding to the cart should be refused with "You can't add more"
 */
Then(/^adding to the cart should be refused(?: with "([^"]*)")?$/, async function (message) {
  const last = this.__storeLastAdd;
  if (!last) throw H.failure(this.page, 'Expected a refused add to the cart, but the scenario has not added anything yet.', { hint: 'add first: When I add the product to the cart.' });
  if (last.status < 400) {
    throw H.failure(this.page, `Expected the store to refuse the add to the cart, but it accepted it (${last.status}).`, { found: last.body && last.body.items ? `added ${H.listed(last.body.items.map((i) => `${i.quantity} × ${i.title}`))}` : '', hint: 'the store refuses a sold-out variant or more than its stock.' });
  }
  if (message) {
    const result = await H.poll(this, (m) => {
      const S = window.__webshipStore;
      const shown = [...document.querySelectorAll('[role="alert"], [aria-live], [class*="error" i]')].filter(S.visible).map((el) => S.norm(el.textContent)).filter(Boolean);
      return { done: shown.some((t) => S.lower(t).includes(S.lower(m))), shown };
    }, message, H.budget(this));
    if (!result.done) {
      throw H.failure(this.page, `Expected the refusal "${message}" on the page, but it is not shown.`, {
        found: `the store answered "${last.body && last.body.description ? last.body.description : last.status}"; messages on the page: ${H.listed(result.shown)}`, hint: 'the theme shows the store\'s refusal near the product form.' });
    }
  }
});

/**
 * The product form shows (or does not show) the dynamic checkout button: the platform's button
 * that takes the visitor straight to the checkout ("Buy it now", or a wallet's own button), drawn
 * in its own container in the form.
 *
 * Example #1: Then I should see the dynamic checkout button
 * Example #2: And I should see the dynamic checkout button
 * Example #3: Then I should not see the dynamic checkout button
 * Example #4: But we should not see the dynamic checkout button
 * Example #5: Then we should see the dynamic checkout button
 */
Then(/^(?:I |we )?should( not)? see the dynamic checkout button$/, async function (not) {
  const result = await H.poll(this, (a) => {
    const S = window.__webshipStore;
    const form = S.productForm();
    if (!form) return { done: true, noForm: true };
    const shown = !!S.paymentButton(form);
    return { done: a.not ? !shown : shown, shown };
  }, { not: !!not }, not ? Math.min(H.budget(this), 5000) : H.budget(this));
  if (result.noForm) throw noForm(this);
  if (!result.done) {
    throw H.failure(this.page, not ? 'Expected no dynamic checkout button, but the product form shows one.' : 'Expected the dynamic checkout button in the product form, but it is not shown.', {
      hint: not ? 'the platform shows it for a variant that can be bought.' : 'the merchant may have turned it off, or the variant may be sold out.',
    });
  }
});

/**
 * Presses the dynamic checkout button of the product form, which leaves the store for the
 * checkout. Waits until the page has changed.
 *
 * Example #1: When I press the dynamic checkout button
 * Example #2: And I press the dynamic checkout button
 * Example #3: When we press the dynamic checkout button
 * Example #4: When press the dynamic checkout button
 * Example #5: Then I press the dynamic checkout button
 */
When(/^(?:I |we )?press the dynamic checkout button$/, async function () {
  const target = await H.poll(this, () => {
    const S = window.__webshipStore;
    const form = S.productForm();
    const box = form && S.paymentButton(form);
    if (!box) return { done: false };
    const inner = [...box.querySelectorAll('button, [role="button"], a')].find(S.visible);
    return { done: true, sel: S.mark(inner || box) };
  }, null, H.budget(this));
  if (!target.done) throw H.failure(this.page, 'Expected the dynamic checkout button in the product form, but it is not shown.', { hint: 'the merchant may have turned it off, or the variant may be sold out.' });
  const before = this.page.url();
  await H.personClick(this, target.sel, 'the dynamic checkout button');
  const deadline = Date.now() + H.budget(this);
  while (this.page.url() === before && Date.now() < deadline) await H.sleep(100);
  await H.settle(this, 3000);
});

/**
 * The price shown with the product (the first price of the product's price block, a sale price
 * when it is on sale) is (or is not) that amount. Amounts are compared as numbers: "$24" and
 * "$24.00" are the same.
 *
 * Example #1: Then the product price should be "$24.00"
 * Example #2: Then the product price should be "$9.00"
 * Example #3: And the product price should be "€25.76 EUR"
 * Example #4: Then the product price should not be "$12.00"
 * Example #5: But the product price should not be "$0.00"
 */
Then(/^the product price should( not)? be "([^"]*)"$/, async function (not, amount) {
  const wanted = H.parseMoney(amount);
  const read = async () => H.inPage(this, () => {
    const S = window.__webshipStore;
    const form = S.productForm();
    const area = form ? S.productArea(form) : document.querySelector('main') || document.body;
    const blocks = [...area.querySelectorAll('[class*="price" i], product-price, [data-product-price], [id*="price" i]')]
      .filter((el) => S.visible(el) && /\d/.test(el.textContent) && !el.closest('form [name="add"], button'));
    for (const block of blocks) {
      const clone = block.cloneNode(true);
      clone.querySelectorAll('s, del, strike, [class*="compare" i], [class*="was" i], .visually-hidden, [class*="visually-hidden" i], [class*="sr-only" i]').forEach((x) => x.remove());
      const m = S.norm(clone.textContent).match(/[^\d\s]{0,3}\s?\d[\d.,]*(?:\s?[A-Z]{3})?/);
      if (m) return { text: m[0].trim() };
    }
    return { text: null };
  });
  let shown = await read();
  const deadline = Date.now() + H.budget(this);
  for (;;) {
    const same = shown.text !== null && H.parseMoney(shown.text) === wanted;
    if ((not ? !same : same) || Date.now() > deadline) break;
    await H.sleep(100);
    shown = await read();
  }
  const same = shown.text !== null && H.parseMoney(shown.text) === wanted;
  if (!not && !same) {
    throw H.failure(this.page, `Expected the product price "${amount}", but it is "${shown.text || '(no price found)'}".`, {
      hint: 'the price is read from the product\'s price block; prices follow the visitor\'s currency.',
    });
  }
  if (not && same) throw H.failure(this.page, `Expected the product price not to be "${amount}", but it is.`, { hint: 'the price is read from the product\'s price block, as a number.' });
});
