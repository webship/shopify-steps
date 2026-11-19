'use strict';

// Shared helpers for the step files of this pack, and for a project's own steps.
//
// Not a step file: it registers no step definitions. It puts the page side of the pack
// (store-probe.js) into every page the World opens, and holds the plumbing the steps use: the
// wait budgets, running a probe in the page, polling until the store reached a state, clicking
// the way a person does (closing a marketing pop-up that covers the page first), waiting for the
// storefront's own requests (/cart/add, /cart/change, /search/suggest, ...) and the failure
// messages.
//
// No step sleeps for a fixed time: they wait for the store's own signals (its Ajax answers, the
// form's variant field, the URL a theme pushes, a dialog that opened and stopped moving), looked
// at every 50 ms from Node.js.

const webship = require('webship-js/tests/step-definitions/webship');
const { storeProbe } = require('./store-probe');

const { friendly, failure, onNewPage, smartSettle } = webship;

const PROBE = `(${storeProbe.toString()})();`;

if (typeof onNewPage === 'function') {
  onNewPage(async (world, page) => {
    try { await page.addInitScript(PROBE); } catch (e) { /* a closed page needs nothing */ }
  });
}

/** The per-step wait: `minWaitTime.page`, at least 10 seconds; STORE_WAIT_MS sets it outright. */
function budget(world) {
  const fixed = Number(process.env.STORE_WAIT_MS);
  if (Number.isFinite(fixed) && fixed > 0) return Math.min(fixed, 40000);
  const page = world && world.minWaitTime && world.minWaitTime.page;
  return Math.min(Math.max(page || 0, 10000), 40000);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function norm(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‘’‚‛′]/g, "'").replace(/[“”„″]/g, '"').replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** A list for a failure message: `"a", "b"` or `(none)`. */
function listed(values, max) {
  const items = [...new Set((values || []).map(norm).filter(Boolean))];
  const limit = max || 12;
  if (!items.length) return '(none)';
  const shown = items.slice(0, limit).map((v) => `"${v}"`).join(', ');
  return items.length > limit ? `${shown} and ${items.length - limit} more` : shown;
}

function excerpt(text, max) {
  const clean = norm(text);
  const limit = max || 160;
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

/** Put the page side into the current page when it is not there yet. */
async function ensureProbe(world) {
  let there = false;
  try {
    there = await world.page.evaluate(() => !!(window.__webshipStore && window.__webshipStore.version === 1));
  } catch (e) {
    there = false;
  }
  if (!there) {
    try { await world.page.evaluate(PROBE); } catch (e) { /* the page is navigating: the next call retries */ }
  }
}

/** Run `fn(arg)` in the page, where `window.__webshipStore` is the page side's library. */
async function inPage(world, fn, arg) {
  await ensureProbe(world);
  return world.page.evaluate(fn, arg === undefined ? null : arg);
}

/**
 * Look at the page every 50 ms until `fn(arg)` returns a value with `done: true`, or the time is
 * up; returns the last value. A page that navigates meanwhile is looked at again.
 */
async function poll(world, fn, arg, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let last = { done: false };
  for (;;) {
    let value = null;
    try {
      await ensureProbe(world);
      value = await world.page.evaluate(fn, arg === undefined ? null : arg);
    } catch (e) {
      value = { done: false, error: e.message };
    }
    if (value) last = value;
    if (value && value.done) return value;
    if (Date.now() + 50 >= deadline) return last;
    await sleep(50);
  }
}

/** Close the marketing pop-ups that cover the page (not the store's own drawers or banners). */
async function closePopups(world) {
  let closed = 0;
  for (let round = 0; round < 3; round += 1) {
    const found = await inPage(world, () => {
      const S = window.__webshipStore;
      const list = S.popups();
      if (!list.length) return null;
      const el = list[0];
      const close = S.closeControl(el);
      return { dialog: S.mark(el), close: close ? S.mark(close) : null, name: S.labelText(el) || S.norm(el.textContent).slice(0, 60) };
    });
    if (!found) break;
    if (found.close) {
      await world.page.locator(found.close).click({ timeout: 3000 }).catch(() => {});
    } else {
      await world.page.keyboard.press('Escape').catch(() => {});
    }
    await poll(world, (sel) => ({ done: !document.querySelector(sel) || !window.__webshipStore.visible(document.querySelector(sel)) }), found.dialog, 3000);
    closed += 1;
  }
  return closed;
}

/**
 * Click an element the way a person does. A marketing pop-up that covers it is closed first,
 * as a person closes it; then the click is tried once more.
 */
async function personClick(world, selector, what, options) {
  const locator = world.page.locator(selector).first();
  // In the middle of the window, as a person scrolls to it: a sticky header or a banner at the
  // foot of the page does not cover it there.
  try { await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })); } catch (e) { /* gone or detached: the click says so */ }
  try {
    await locator.click(Object.assign({ timeout: 5000 }, options || {}));
    return;
  } catch (e) {
    const covered = /intercepts pointer events|not visible|outside of the viewport/i.test(String(e.message));
    if (!covered || !(await closePopups(world))) {
      throw friendly({ action: 'click', target: what, cause: e, hint: 'something may cover it (a pop-up or a banner), or it may be hidden in a closed menu.' });
    }
    try { await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })); } catch (e2) { /* idem */ }
  }
  try {
    await locator.click(Object.assign({ timeout: 5000 }, options || {}));
  } catch (e) {
    throw friendly({ action: 'click', target: what, cause: e, hint: 'a pop-up was closed first, but the element still could not be clicked.' });
  }
}

/** Wait for the storefront's answer to a request whose path matches `re` (POST by default). */
function waitForStoreResponse(world, re, options) {
  const o = Object.assign({ method: 'POST', timeout: budget(world) }, options || {});
  return world.page.waitForResponse((response) => {
    try {
      const request = response.request();
      return (!o.method || request.method() === o.method) && re.test(new URL(response.url()).pathname);
    } catch (e) {
      return false;
    }
  }, { timeout: o.timeout }).catch(() => null);
}

/** Read the cart with the storefront Ajax API, in the browser's own session (GET /cart.js). */
async function readCart(world) {
  return inPage(world, async () => {
    const root = window.__webshipStore.root();
    try {
      const r = await fetch(`${root}cart.js`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!r.ok) return { error: `GET ${root}cart.js answered ${r.status}` };
      return { cart: await r.json() };
    } catch (e) {
      return { error: e.message };
    }
  });
}

/** Parse a money text the way a person reads it: "$1,234.50" -> 1234.5, "€25,76 EUR" -> 25.76. */
function parseMoney(text) {
  const raw = String(text).replace(/[^\d.,]/g, '');
  if (!raw) return NaN;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let s = raw;
  if (lastComma > lastDot && raw.length - lastComma === 3) s = raw.replace(/\./g, '').replace(',', '.');
  else s = raw.replace(/,/g, '');
  return Number(s);
}

async function settle(world, timeout) {
  try { await smartSettle(world.page, timeout || 1500); } catch (e) { /* settling is best effort */ }
}

module.exports = {
  webship, friendly, failure, budget, sleep, norm, listed, excerpt, ensureProbe, inPage, poll,
  closePopups, personClick, waitForStoreResponse, readCart, parseMoney, settle, PROBE,
};
