'use strict';

// The cart: the cart drawer a theme opens from its header (found as the open dialog or panel that
// holds the cart), the cart page, their lines (quantity, remove) and the note, and the store's own
// record of the cart, read with the storefront Ajax API (GET /cart.js). Changes wait for the
// store's answer (/cart/change, /cart/update), then for the theme to show it. The pack stops at
// the checkout button: the checkout is the platform's own hosted page.

const { Given, When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

async function drawerState(world) {
  return H.inPage(world, () => {
    const S = window.__webshipStore;
    const d = S.cartDrawer();
    return d ? { open: true, settled: S.settled(d), sel: S.mark(d), name: S.labelText(d) } : { open: false, settled: true };
  });
}

async function waitDrawer(world, open, timeout) {
  const result = await H.poll(world, (wanted) => {
    const S = window.__webshipStore;
    const d = S.cartDrawer();
    const isOpen = !!d;
    return { done: isOpen === wanted && (!d || S.settled(d)), open: isOpen, name: d ? S.labelText(d) : '' };
  }, open, timeout || H.budget(world));
  return result;
}

/**
 * Opens the cart drawer with the cart button of the header (the link or button named as the cart,
 * or leading to the cart page), and waits until the drawer is shown and has stopped moving.
 *
 * Example #1: When I open the cart drawer
 * Example #2: And I open the cart drawer
 * Example #3: When we open the cart drawer
 * Example #4: When open the cart drawer
 * Example #5: Then I open the cart drawer
 */
When(/^(?:I |we )?open the cart drawer$/, async function () {
  const now = await drawerState(this);
  if (now.open) return;
  const control = await H.poll(this, () => {
    const S = window.__webshipStore;
    const list = S.cartControls();
    return list.length ? { done: true, sel: S.mark(list[0]), name: S.nameOf(list[0]) } : { done: false };
  }, null, H.budget(this));
  if (!control.done) {
    throw H.failure(this.page, 'Expected a cart button in the header, but there is none.', { hint: 'the cart button is named as the cart (or bag) or leads to the cart page.' });
  }
  const before = this.page.url();
  await H.personClick(this, control.sel, `the cart button "${control.name}"`);
  const result = await waitDrawer(this, true);
  if (!result.done) {
    const moved = this.page.url() !== before && /\/cart\/?(\?|$)/.test(new URL(this.page.url()).pathname + new URL(this.page.url()).search);
    throw H.failure(this.page, 'Expected the cart drawer to open, but no drawer holding the cart is shown.', {
      found: moved ? 'the cart button led to the cart page' : `the cart button "${control.name}" was pressed`,
      hint: moved ? 'this theme has no cart drawer: use the cart page (When I go to the cart page).' : 'the drawer may still be loading; check that the button opens it.',
    });
  }
});

/**
 * Closes the open cart drawer with its close button (or Escape) and waits until it is gone.
 *
 * Example #1: When I close the cart drawer
 * Example #2: And I close the cart drawer
 * Example #3: When we close the cart drawer
 * Example #4: When close the cart drawer
 * Example #5: Then I close the cart drawer
 */
When(/^(?:I |we )?close the cart drawer$/, async function () {
  const close = await H.inPage(this, () => {
    const S = window.__webshipStore;
    const d = S.cartDrawer();
    if (!d) return { none: true };
    const c = S.closeControl(d);
    return c ? { sel: S.mark(c), name: S.nameOf(c) } : { escape: true };
  });
  if (close.none) throw H.failure(this.page, 'Expected an open cart drawer to close, but none is open.', { hint: 'open it first: When I open the cart drawer.' });
  if (close.escape) await this.page.keyboard.press('Escape');
  else await H.personClick(this, close.sel, `the drawer's "${close.name}" button`);
  const result = await waitDrawer(this, false);
  if (!result.done) throw H.failure(this.page, 'Expected the cart drawer to close, but it is still open.', { found: `"${result.name}"`, hint: 'the drawer may close with Escape or its close button only; check them.' });
});

/**
 * The cart drawer is open (shown and done moving) or closed.
 *
 * Example #1: Then the cart drawer should be open
 * Example #2: Then the cart drawer should be closed
 * Example #3: And the cart drawer should be open
 * Example #4: But the cart drawer should be closed
 * Example #5: * the cart drawer should be open
 */
Then(/^the cart drawer should be (open|closed)$/, async function (state) {
  const result = await waitDrawer(this, state === 'open');
  if (!result.done) {
    throw H.failure(this.page, `Expected the cart drawer to be ${state}, but it is ${result.open ? 'open' : 'closed'}.`, {
      found: result.name ? `the drawer "${result.name}"` : 'no drawer holding the cart', hint: 'the drawer is the open dialog or panel that holds the cart; open it first: When I open the cart drawer.' });
  }
});

/** The lines of the open drawer, or of the cart page: [{ title, quantity, sel, remove }]. */
async function linesOf(world, where) {
  return H.inPage(world, (w) => {
    const S = window.__webshipStore;
    const scope = w === 'drawer' ? S.cartDrawer() : (S.cartDrawer() || document.querySelector('main, [role="main"]') || document.body);
    if (!scope) return { scope: false, lines: [] };
    const seen = new Set();
    const lines = [];
    for (const link of scope.querySelectorAll('a[href*="/products/"]')) {
      let box = link.parentElement;
      let found = null;
      for (let i = 0; i < 6 && box && box !== scope; i += 1) {
        const qty = box.querySelector('input[name^="updates"], input[type="number"], [role="spinbutton"]');
        if (qty) { found = { box, qty }; break; }
        box = box.parentElement;
      }
      if (!found || seen.has(found.box)) continue;
      seen.add(found.box);
      const remove = [...found.box.querySelectorAll('a[href], button, [role="button"]')].find((b) => S.visible(b)
        && (/remove|delete|supprimer|entfernen|eliminar/i.test(S.nameOf(b)) || /quantity=0/.test(b.getAttribute('href') || '')));
      lines.push({
        title: S.norm(link.textContent) || S.labelText(link),
        quantity: Number(found.qty.value || found.qty.getAttribute('aria-valuenow') || 0),
        qty: S.mark(found.qty),
        remove: remove ? S.mark(remove) : null,
      });
    }
    return { scope: true, lines };
  }, where);
}

/**
 * The open cart drawer does (or does not) list a product, by its title.
 *
 * Example #1: Then the cart drawer should list "Wool Beanie"
 * Example #2: And the cart drawer should list "Canvas Tote"
 * Example #3: Then the cart drawer should not list "Enamel Mug"
 * Example #4: But the cart drawer should not list "Linen Apron"
 * Example #5: Then the cart drawer should list "Field Notebook"
 */
Then(/^the cart drawer should( not)? list "([^"]*)"$/, async function (not, title) {
  const deadline = Date.now() + H.budget(this);
  let state;
  for (;;) {
    state = await linesOf(this, 'drawer');
    const has = state.lines.some((l) => H.norm(l.title).toLowerCase() === H.norm(title).toLowerCase() || H.norm(l.title).toLowerCase().startsWith(`${H.norm(title).toLowerCase()} `));
    if ((state.scope && (not ? !has : has)) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  if (!state.scope) throw H.failure(this.page, 'Expected an open cart drawer, but none is open.', { hint: 'open it first: When I open the cart drawer.' });
  const has = state.lines.some((l) => H.norm(l.title).toLowerCase() === H.norm(title).toLowerCase() || H.norm(l.title).toLowerCase().startsWith(`${H.norm(title).toLowerCase()} `));
  if (!not && !has) throw H.failure(this.page, `Expected the cart drawer to list "${title}", but it does not.`, { found: `lines ${H.listed(state.lines.map((l) => `${l.quantity} × ${l.title}`))}`, hint: 'a line is named by its product title; open the drawer after adding.' });
  if (not && has) throw H.failure(this.page, `Expected the cart drawer not to list "${title}", but it does.`, { hint: 'a line is named by its product title; remove it first.' });
});

/**
 * The open cart drawer has (or has no) lines.
 *
 * Example #1: Then the cart drawer should be empty
 * Example #2: And the cart drawer should be empty
 * Example #3: Then the cart drawer should not be empty
 * Example #4: But the cart drawer should not be empty
 * Example #5: * the cart drawer should be empty
 */
Then(/^the cart drawer should( not)? be empty$/, async function (not) {
  const deadline = Date.now() + H.budget(this);
  let state;
  for (;;) {
    state = await linesOf(this, 'drawer');
    const empty = state.lines.length === 0;
    if ((state.scope && (not ? !empty : empty)) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  if (!state.scope) throw H.failure(this.page, 'Expected an open cart drawer, but none is open.', { hint: 'open it first: When I open the cart drawer.' });
  if (!not && state.lines.length) throw H.failure(this.page, 'Expected the cart drawer to be empty, but it has lines.', { found: H.listed(state.lines.map((l) => `${l.quantity} × ${l.title}`)), hint: 'the lines of the drawer come from the store\'s cart; empty it first.' });
  if (not && !state.lines.length) throw H.failure(this.page, 'Expected the cart drawer to have lines, but it is empty.', { hint: 'the lines of the drawer come from the store\'s cart; add a product first.' });
});

/**
 * Goes to the cart page of the store (its cart route, in the visitor's language and market).
 *
 * Example #1: When I go to the cart page
 * Example #2: And I go to the cart page
 * Example #3: When we go to the cart page
 * Example #4: When go to the cart page
 * Example #5: Given I go to the cart page
 */
When(/^(?:I |we )?go to the cart page$/, async function () {
  let root = '/';
  try { root = await H.inPage(this, () => window.__webshipStore.root()); } catch (e) { root = '/'; }
  const current = this.page.url();
  const base = /^https?:/.test(current) ? new URL(current).origin : String(this.launchUrl || '').replace(/\/+$/, '');
  await H.webship.gotoUrl(this.page, `${base}${root}cart`);
  await H.settle(this, 3000);
});

/**
 * The page is the cart page of the store.
 *
 * Example #1: Then I should be on the cart page
 * Example #2: And I should be on the cart page
 * Example #3: Then we should be on the cart page
 * Example #4: Then I should not be on the cart page
 * Example #5: But we should not be on the cart page
 */
Then(/^(?:I |we )?should( not)? be on the cart page$/, async function (not) {
  const result = await H.poll(this, (wanted) => {
    const info = window.__webshipStore.storefront();
    const on = info.pageType === 'cart' || /\/cart\/?$/.test(location.pathname);
    return { done: wanted ? on : !on, path: location.pathname, type: info.pageType };
  }, !not, H.budget(this));
  if (!result.done) {
    throw H.failure(this.page, not ? 'Expected to have left the cart page, but it is still shown.' : `Expected the cart page, but the page is "${result.path}" (type "${result.type || '(none)'}").`, { hint: 'the cart page is the store\'s /cart route, in the visitor\'s language.' });
  }
});

async function cartLine(world, title) {
  const deadline = Date.now() + H.budget(world);
  let state;
  for (;;) {
    state = await linesOf(world, 'any');
    const line = state.lines.find((l) => H.norm(l.title).toLowerCase() === H.norm(title).toLowerCase())
      || state.lines.find((l) => H.norm(l.title).toLowerCase().startsWith(H.norm(title).toLowerCase()));
    if (line) return line;
    if (Date.now() > deadline) break;
    await H.sleep(100);
  }
  throw H.failure(world.page, `Expected a line "${title}" in the cart drawer or on the cart page, but there is none.`, {
    found: `lines ${H.listed(state.lines.map((l) => `${l.quantity} × ${l.title}`))}`,
    hint: 'open the cart drawer or go to the cart page first.',
  });
}

/** After a change of the lines: the store's answer, or the cart form's own update button. */
async function afterLineChange(world, answer) {
  let response = await answer;
  if (!response) {
    const update = await H.inPage(world, () => {
      const S = window.__webshipStore;
      const b = [...document.querySelectorAll('form button[name="update"], form input[name="update"], form button[type="submit"]')].find((x) => S.visible(x) && /update|mettre/i.test(S.nameOf(x)));
      return b ? S.mark(b) : null;
    });
    if (update) {
      const nav = world.page.waitForNavigation({ timeout: H.budget(world) }).catch(() => null);
      await H.personClick(world, update, 'the cart\'s update button');
      response = await nav;
    }
  }
  await H.settle(world, 3000);
  return response;
}

/**
 * Changes the quantity of a line of the cart (in the open cart drawer, or on the cart page) and
 * waits for the store's answer (POST /cart/change or /cart/update) and the cart shown again.
 *
 * Example #1: When I change the quantity of "Wool Beanie" to 2 in the cart
 * Example #2: When I change the quantity of "Canvas Tote" to 3 in the cart
 * Example #3: And I change the quantity of "Enamel Mug" to 1 in the cart
 * Example #4: When we change the quantity of "Field Notebook" to 0 in the cart
 * Example #5: When change the quantity of "Wool Beanie" to 4 in the cart
 */
When(/^(?:I |we )?change the quantity of "([^"]*)" to (\d+) in the cart$/, async function (title, number) {
  const line = await cartLine(this, title);
  const answer = H.waitForStoreResponse(this, /\/cart\/(change|update)(\.js)?$/, { timeout: 4000 });
  // Typed, then committed with Tab, as a person does: one change event, as in a browser.
  const field = this.page.locator(line.qty);
  await field.fill(String(number));
  await field.press('Tab');
  const response = await afterLineChange(this, answer);
  if (!response) throw H.failure(this.page, `Expected the store to answer the change of "${title}", but no request went out.`, { hint: 'the theme may need its own update button pressed.' });
  const n = parseInt(number, 10);
  const result = await H.poll(this, async (a) => {
    const r = await fetch(`${window.__webshipStore.root()}cart.js`, { credentials: 'same-origin' });
    const cart = await r.json();
    const qty = cart.items.filter((i) => i.product_title.toLowerCase() === a.title.toLowerCase() || i.title.toLowerCase() === a.title.toLowerCase()).reduce((s, i) => s + i.quantity, 0);
    return { done: qty === a.n || (a.n === 0 && qty === 0), qty };
  }, { title, n }, H.budget(this));
  if (!result.done) throw H.failure(this.page, `Expected ${n} of "${title}" in the cart after the change, but the store holds ${result.qty}.`, { hint: 'the store may not have enough stock for that quantity.' });
});

/**
 * Removes a line from the cart with its remove button (in the open cart drawer, or on the cart
 * page) and waits until the store no longer holds it.
 *
 * Example #1: When I remove "Wool Beanie" from the cart
 * Example #2: When I remove "Canvas Tote" from the cart
 * Example #3: And I remove "Enamel Mug" from the cart
 * Example #4: When we remove "Field Notebook" from the cart
 * Example #5: When remove "Brass Pen" from the cart
 */
When(/^(?:I |we )?remove "([^"]*)" from the cart$/, async function (title) {
  const line = await cartLine(this, title);
  if (!line.remove) throw H.failure(this.page, `Expected a remove button on the line "${title}", but there is none.`, { hint: `set its quantity to 0 instead: When I change the quantity of "${title}" to 0 in the cart.` });
  const answer = H.waitForStoreResponse(this, /\/cart\/(change|update)(\.js)?$/, { method: null, timeout: H.budget(this) });
  await H.personClick(this, line.remove, `the remove button of "${title}"`);
  await answer;
  await H.settle(this, 3000);
  const result = await H.poll(this, async (t) => {
    const r = await fetch(`${window.__webshipStore.root()}cart.js`, { credentials: 'same-origin' });
    const cart = await r.json();
    const left = cart.items.filter((i) => i.product_title.toLowerCase() === t.toLowerCase());
    return { done: left.length === 0, left: left.length };
  }, title, H.budget(this));
  if (!result.done) throw H.failure(this.page, `Expected "${title}" to be gone from the cart, but the store still holds it.`, { hint: 'the theme may remove a line only after a confirmation; check its remove button.' });
});

/**
 * Writes the note of the order in the cart's note field (in the open cart drawer, or on the cart
 * page) and waits until the store has kept it (POST /cart/update).
 *
 * Example #1: When I write the cart note "Gift wrap, please"
 * Example #2: When I write the order note "Leave at the door"
 * Example #3: And I write the cart note "No invoice in the box"
 * Example #4: When we write the cart note "Call before delivery"
 * Example #5: When write the cart note ""
 */
When(/^(?:I |we )?write the (?:cart|order) note "([^"]*)"$/, async function (note) {
  const field = await H.poll(this, () => {
    const S = window.__webshipStore;
    const scope = S.cartDrawer() || document;
    const t = [...scope.querySelectorAll('textarea[name="note"], input[name="note"]')].find(S.visible);
    return t ? { done: true, sel: S.mark(t) } : { done: false };
  }, null, H.budget(this));
  if (!field.done) throw H.failure(this.page, 'Expected a note field in the cart, but there is none.', { hint: 'open the cart drawer or the cart page; the merchant may have turned the note off.' });
  const answer = H.waitForStoreResponse(this, /\/cart\/update(\.js)?$/, { timeout: 4000 });
  await this.page.locator(field.sel).fill(note);
  await this.page.locator(field.sel).press('Tab');
  const response = await afterLineChange(this, answer);
  const result = await H.poll(this, async (n) => {
    const r = await fetch(`${window.__webshipStore.root()}cart.js`, { credentials: 'same-origin' });
    const cart = await r.json();
    return { done: cart.note === n, note: cart.note };
  }, note, response ? H.budget(this) : 3000);
  if (!result.done) throw H.failure(this.page, `Expected the store to keep the note "${note}", but it holds "${result.note || ''}".`, { hint: 'the theme may keep the note only when the cart is updated or sent to the checkout.' });
});

async function cartOf(world) {
  const result = await H.readCart(world);
  if (!result.cart) throw H.failure(world.page, 'Expected to read the cart from the store (GET /cart.js), but it did not answer.', { found: result.error, hint: 'the page may not be a page of the store yet: open one first.' });
  return result.cart;
}

async function pollCart(world, test) {
  const deadline = Date.now() + H.budget(world);
  let cart;
  for (;;) {
    cart = await cartOf(world);
    if (test(cart) || Date.now() > deadline) return cart;
    await H.sleep(150);
  }
}

const lineName = (i) => `${i.quantity} × ${i.title}`;
const sameProduct = (i, title) => [i.product_title, i.title].some((t) => H.norm(t).toLowerCase() === H.norm(title).toLowerCase());

/**
 * The store's cart is (or is not) empty (GET /cart.js).
 *
 * Example #1: Then the cart should be empty
 * Example #2: And the cart should be empty
 * Example #3: Then the cart should not be empty
 * Example #4: But the cart should not be empty
 * Example #5: * the cart should be empty
 */
Then(/^the cart should( not)? be empty$/, async function (not) {
  const cart = await pollCart(this, (c) => (not ? c.item_count > 0 : c.item_count === 0));
  if (!not && cart.item_count) throw H.failure(this.page, `Expected the cart to be empty, but it holds ${cart.item_count} item(s).`, { found: H.listed(cart.items.map(lineName)), hint: 'the store keeps the cart of this browser; a scenario starts with an empty one.' });
  if (not && !cart.item_count) throw H.failure(this.page, 'Expected the cart to hold something, but it is empty.', { hint: 'the store keeps the cart of this browser; add a product first.' });
});

/**
 * The store's cart holds that many items in all (the sum of its lines' quantities).
 *
 * Example #1: Then the cart should hold 2 items
 * Example #2: Then the cart should hold 1 item
 * Example #3: And the cart should hold 3 items
 * Example #4: Then the cart should hold 0 items
 * Example #5: But the cart should hold 5 items
 */
Then(/^the cart should hold (\d+) items?$/, async function (number) {
  const n = parseInt(number, 10);
  const cart = await pollCart(this, (c) => c.item_count === n);
  if (cart.item_count !== n) throw H.failure(this.page, `Expected the cart to hold ${n} item(s), but it holds ${cart.item_count}.`, { found: H.listed(cart.items.map(lineName)), hint: 'the count is the sum of the quantities of every line.' });
});

/**
 * The store's cart does (or does not) hold a product, by its title.
 *
 * Example #1: Then the cart should contain "Wool Beanie"
 * Example #2: And the cart should contain "Canvas Tote"
 * Example #3: Then the cart should not contain "Enamel Mug"
 * Example #4: But the cart should not contain "Linen Apron"
 * Example #5: Then the cart should contain "Field Notebook"
 */
Then(/^the cart should( not)? contain "([^"]*)"$/, async function (not, title) {
  const cart = await pollCart(this, (c) => (not ? !c.items.some((i) => sameProduct(i, title)) : c.items.some((i) => sameProduct(i, title))));
  const has = cart.items.some((i) => sameProduct(i, title));
  if (!not && !has) throw H.failure(this.page, `Expected the cart to contain "${title}", but it does not.`, { found: H.listed(cart.items.map(lineName)), hint: 'a product is named by its title, without the variant.' });
  if (not && has) throw H.failure(this.page, `Expected the cart not to contain "${title}", but it does.`, { found: H.listed(cart.items.map(lineName)), hint: 'a product is named by its title, without the variant.' });
});

/**
 * The store's cart holds that many of a product (all its lines of that title together).
 *
 * Example #1: Then the cart should contain 2 of "Wool Beanie"
 * Example #2: Then the cart should contain 1 of "Canvas Tote"
 * Example #3: And the cart should contain 3 of "Enamel Mug"
 * Example #4: But the cart should contain 5 of "Canvas Tote"
 * Example #5: * the cart should contain 2 of "Field Notebook"
 */
Then(/^the cart should contain (\d+) of "([^"]*)"$/, async function (number, title) {
  const n = parseInt(number, 10);
  const count = (c) => c.items.filter((i) => sameProduct(i, title)).reduce((s, i) => s + i.quantity, 0);
  const cart = await pollCart(this, (c) => count(c) === n);
  if (count(cart) !== n) throw H.failure(this.page, `Expected ${n} of "${title}" in the cart, but it holds ${count(cart)}.`, { found: H.listed(cart.items.map(lineName)), hint: 'the count adds up every line of that product.' });
});

/**
 * The total of the store's cart, in the visitor's currency, is that amount (compared as a number:
 * "$48" and "$48.00" are the same).
 *
 * Example #1: Then the cart total should be "$48.00"
 * Example #2: Then the cart total should be "$0.00"
 * Example #3: And the cart total should be "$56.00"
 * Example #4: Then the cart total should be "€44.16 EUR"
 * Example #5: But the cart total should be "$16"
 */
Then(/^the cart total should be "([^"]*)"$/, async function (amount) {
  const wanted = Math.round(H.parseMoney(amount) * 100);
  const cart = await pollCart(this, (c) => c.total_price === wanted);
  if (cart.total_price !== wanted) {
    throw H.failure(this.page, `Expected the cart total ${amount}, but it is ${(cart.total_price / 100).toFixed(2)} ${cart.currency}.`, { found: H.listed(cart.items.map(lineName)), hint: 'the total is the cart\'s total price in the visitor\'s currency.' });
  }
});

/**
 * The cart button of the header shows that count (in its name or its badge; no badge is 0).
 *
 * Example #1: Then the cart count should be 2
 * Example #2: Then the cart count should be 0
 * Example #3: And the cart count should be 1
 * Example #4: Then the cart count should not be 0
 * Example #5: But the cart count should not be 3
 */
Then(/^the cart count should( not)? be (\d+)$/, async function (not, number) {
  const n = parseInt(number, 10);
  const result = await H.poll(this, (a) => {
    const S = window.__webshipStore;
    const control = S.cartControls()[0];
    if (!control) return { done: false, none: true };
    const visibleText = [...control.querySelectorAll('*')].filter((x) => S.visible(x) && !x.children.length).map((x) => x.textContent).join(' ');
    const text = `${S.labelText(control)} ${visibleText}`;
    const numbers = (text.match(/\d+/g) || []).map(Number);
    const count = numbers.length ? numbers[numbers.length - 1] : 0;
    const shown = numbers.includes(a.n) || (a.n === 0 && !numbers.length);
    return { done: a.not ? !shown : shown, count, name: S.norm(text) };
  }, { n, not: !!not }, H.budget(this));
  if (result.none) throw H.failure(this.page, 'Expected a cart button in the header, but there is none.', { hint: 'the cart button is named as the cart (or bag) or leads to the cart page.' });
  if (!result.done) throw H.failure(this.page, not ? `Expected the cart count not to be ${n}, but it is.` : `Expected the cart count ${n}, but the cart button shows ${result.count}.`, { found: `the cart button: "${result.name}"`, hint: 'the count is read from the cart button\'s name and badge; no badge counts as 0.' });
});

/**
 * Puts a product in the cart without the product page, through the store's Ajax API (POST
 * /cart/add.js): a number of a product by its handle, and a variant by its title (the first one
 * that can be bought when none is named). Then shows the page again. For a store of your own:
 * never use it on a store that is not yours.
 *
 * Example #1: Given the cart holds 2 of the product "wool-beanie"
 * Example #2: Given the cart holds 1 of the product "canvas-tote" in "Black"
 * Example #3: And the cart holds 3 of the product "enamel-mug"
 * Example #4: Given the cart holds 2 of the product "wool-beanie" in "L/XL / Navy"
 * Example #5: Given the cart holds 1 of the product "field-notebook" in "128 pages"
 */
Given(/^the cart holds (\d+) of the product "([^"]*)"(?: in "([^"]*)")?$/, async function (number, handle, variant) {
  if (!/^https?:/.test(this.page.url())) {
    await H.webship.gotoUrl(this.page, H.webship.resolveUrl(this.launchUrl, '/'));
  }
  const result = await H.inPage(this, async (a) => {
    const root = window.__webshipStore.root();
    const r = await fetch(`${root}products/${encodeURIComponent(a.handle)}.js`, { credentials: 'same-origin' });
    if (!r.ok) return { error: `GET ${root}products/${a.handle}.js answered ${r.status}` };
    const product = await r.json();
    const v = a.variant
      ? product.variants.find((x) => x.title.toLowerCase() === a.variant.toLowerCase())
      : product.variants.find((x) => x.available) || product.variants[0];
    if (!v) return { error: `the product has no variant "${a.variant}"`, variants: product.variants.map((x) => x.title) };
    const add = await fetch(`${root}cart/add.js`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: v.id, quantity: a.n }] }),
    });
    const body = await add.json();
    return add.ok ? { ok: true } : { error: body.description || body.message || `POST cart/add.js answered ${add.status}` };
  }, { handle, variant: variant || null, n: parseInt(number, 10) });
  if (!result.ok) {
    throw H.failure(this.page, `Expected to put ${number} of "${handle}"${variant ? ` (${variant})` : ''} in the cart, but the store refused.`, {
      found: `${result.error}${result.variants ? `; variants ${H.listed(result.variants)}` : ''}`,
      hint: 'the product is named by its handle (the last part of its address).',
    });
  }
  await this.page.reload({ waitUntil: 'domcontentloaded' });
  await H.settle(this, 3000);
});

/**
 * Presses the checkout button of the cart (in the open cart drawer, or on the cart page), which
 * sends the cart to the platform's hosted checkout. Waits until the page has left the cart.
 *
 * Example #1: When I check out
 * Example #2: And I check out
 * Example #3: When we check out
 * Example #4: When check out
 * Example #5: Then I check out
 */
When(/^(?:I |we )?check out$/, async function () {
  const button = await H.poll(this, () => {
    const S = window.__webshipStore;
    const scope = S.cartDrawer() || document;
    const b = [...scope.querySelectorAll('[name="checkout"], a[href*="/checkout"]')].find(S.visible);
    return b ? { done: true, sel: S.mark(b), name: S.nameOf(b) } : { done: false };
  }, null, H.budget(this));
  if (!button.done) throw H.failure(this.page, 'Expected a checkout button in the cart, but there is none.', { hint: 'open the cart drawer or the cart page first; an empty cart has no checkout button.' });
  const before = this.page.url();
  await H.personClick(this, button.sel, `the "${button.name}" button`);
  const deadline = Date.now() + H.budget(this);
  while (this.page.url() === before && Date.now() < deadline) await H.sleep(100);
  await H.settle(this, 3000);
});

/**
 * The page is (or is not) the platform's hosted checkout (its address holds /checkouts/), where
 * this pack stops.
 *
 * Example #1: Then I should be on the checkout
 * Example #2: And I should be on the checkout
 * Example #3: Then we should be on the checkout
 * Example #4: Then I should not be on the checkout
 * Example #5: But we should not be on the checkout
 */
Then(/^(?:I |we )?should( not)? be on the checkout$/, async function (not) {
  const deadline = Date.now() + H.budget(this);
  const onCheckout = () => /\/checkouts?\//.test(new URL(this.page.url()).pathname);
  while ((not ? onCheckout() : !onCheckout()) && Date.now() < deadline) await H.sleep(100);
  if (!not && !onCheckout()) throw H.failure(this.page, `Expected the checkout, but the page is "${new URL(this.page.url()).pathname}".`, { hint: 'the checkout button sends the cart to the platform\'s checkout; an empty cart stays.' });
  if (not && onCheckout()) throw H.failure(this.page, 'Expected to stay in the store, but the page is the checkout.', { hint: 'the checkout button leaves the store; this step checks that the page did not.' });
});

/**
 * The note of the order, as the store keeps it with the cart (GET /cart.js), is (or is not) that
 * text.
 *
 * Example #1: Then the cart note should be "Gift wrap, please"
 * Example #2: And the cart note should be ""
 * Example #3: Then the cart note should not be "Leave at the door"
 * Example #4: But the cart note should not be ""
 * Example #5: Then the cart note should be "Call before delivery"
 */
Then(/^the cart note should( not)? be "([^"]*)"$/, async function (not, note) {
  const cart = await pollCart(this, (c) => (not ? c.note !== note : c.note === note));
  if (!not && cart.note !== note) throw H.failure(this.page, `Expected the cart note "${note}", but the store keeps "${cart.note || ''}".`, { hint: 'the note is kept when the theme sends it to the store (POST /cart/update).' });
  if (not && cart.note === note) throw H.failure(this.page, `Expected the cart note not to be "${note}", but it is.`, { hint: 'the note is the one the store keeps with the cart.' });
});
