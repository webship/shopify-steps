'use strict';

// The cookie banner and the visitor's tracking consent: the banner the platform shows to visitors
// of regions that need one (found as the dialog or region about cookies with an accept button,
// or by the platform's own banner id), its preferences, and the consent itself, read with the
// platform's Customer Privacy API (Shopify.customerPrivacy.currentVisitorConsent()).

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

const PURPOSES = { analytics: 'analytics', marketing: 'marketing', preferences: 'preferences', 'sale of data': 'sale_of_data', sale_of_data: 'sale_of_data' };

async function banner(world, timeout) {
  return H.poll(world, () => {
    const S = window.__webshipStore;
    const b = S.cookieBanner();
    return { done: !!b, sel: b ? S.mark(b) : null, ready: document.readyState === 'complete' };
  }, null, timeout || H.budget(world));
}

/**
 * The cookie banner is (or is not) shown. The platform shows it to visitors in regions that need
 * one, until they make a choice; a theme or an app may draw its own.
 *
 * Example #1: Then I should see the cookie banner
 * Example #2: And I should see the cookie banner
 * Example #3: Then I should not see the cookie banner
 * Example #4: But we should not see the cookie banner
 * Example #5: Then we should see the cookie banner
 */
Then(/^(?:I |we )?should( not)? see the cookie banner$/, async function (not) {
  if (!not) {
    const found = await banner(this);
    if (!found.done) throw H.failure(this.page, 'Expected the cookie banner, but none is shown.', { hint: 'the banner shows to visitors of regions that need one (the EEA, the UK), until they choose.' });
    return;
  }
  await H.poll(this, () => ({ done: document.readyState === 'complete' }), null, H.budget(this));
  await H.settle(this);
  const found = await banner(this, 1500);
  if (found.done) throw H.failure(this.page, 'Expected no cookie banner, but one is shown.', { hint: 'the banner shows to visitors of regions that need one (the EEA, the UK), until they choose.' });
});

async function consentNow(world) {
  return H.inPage(world, () => window.__webshipStore.consent());
}

/**
 * Accepts or declines the cookies with the banner's own button, and waits until the banner is
 * gone and the store has recorded the choice.
 *
 * Example #1: When I accept the cookies
 * Example #2: When I decline the cookies
 * Example #3: And I accept the cookies
 * Example #4: When we decline the cookies
 * Example #5: When accept the cookies
 */
When(/^(?:I |we )?(accept|decline) the cookies$/, async function (choice) {
  const found = await banner(this);
  if (!found.done) throw H.failure(this.page, `Expected the cookie banner to ${choice} the cookies, but none is shown.`, { hint: 'the banner shows to visitors of regions that need one, until they choose.' });
  const button = await H.inPage(this, (a) => {
    const S = window.__webshipStore;
    const b = document.querySelector(a.sel);
    const re = a.choice === 'accept' ? /^(accept|accept all|agree|allow|allow all|i agree|ok)\b/i : /^(decline|decline all|reject|reject all|deny|refuse|no thanks)\b/i;
    const own = document.getElementById(a.choice === 'accept' ? 'shopify-pc__banner__btn-accept' : 'shopify-pc__banner__btn-decline');
    const hit = (own && S.visible(own) && own) || [...b.querySelectorAll('button, [role="button"], a')].find((x) => S.visible(x) && re.test(S.nameOf(x)));
    return hit ? { sel: S.mark(hit), name: S.nameOf(hit), names: [] } : { names: [...b.querySelectorAll('button, [role="button"], a')].filter(S.visible).map(S.nameOf) };
  }, { sel: found.sel, choice });
  if (!button.sel) throw H.failure(this.page, `Expected a button to ${choice} the cookies in the banner, but there is none.`, { found: `buttons ${H.listed(button.names)}`, hint: 'the banner\'s buttons are named Accept and Decline, or alike.' });
  await H.personClick(this, button.sel, `the banner's "${button.name}" button`);
  const result = await H.poll(this, () => {
    const S = window.__webshipStore;
    const c = S.consent();
    const decided = !c || Object.values(c).some((v) => v === 'yes' || v === 'no');
    return { done: !S.cookieBanner() && decided };
  }, null, H.budget(this));
  if (!result.done) throw H.failure(this.page, `Expected the banner to close and the choice to be recorded after "${button.name}", but it did not.`, { hint: 'the store records the choice with its Customer Privacy API; check the banner\'s buttons.' });
});

/**
 * Opens the cookie preferences: the banner's "Manage preferences" button, or the store's
 * "Cookie preferences" link when the banner is gone (the platform's privacy banner can also open
 * them by itself). Waits until the preferences are shown.
 *
 * Example #1: When I open the cookie preferences
 * Example #2: And I open the cookie preferences
 * Example #3: When we open the cookie preferences
 * Example #4: When open the cookie preferences
 * Example #5: Then I open the cookie preferences
 */
When(/^(?:I |we )?open the cookie preferences$/, async function () {
  const opener = await H.inPage(this, () => {
    const S = window.__webshipStore;
    const b = S.cookieBanner();
    const own = document.getElementById('shopify-pc__banner__btn-manage-prefs');
    if (own && S.visible(own)) return S.mark(own);
    const inBanner = b && [...b.querySelectorAll('button, [role="button"], a')].find((x) => S.visible(x) && /manage|preferences|settings|customi[sz]e|options/i.test(S.nameOf(x)));
    if (inBanner) return S.mark(inBanner);
    const link = [...document.querySelectorAll('a, button, [role="button"]')].find((x) => S.visible(x) && /cookie (preferences|settings)|privacy (preferences|settings)|manage cookies/i.test(S.nameOf(x)));
    return link ? S.mark(link) : null;
  });
  if (opener) await H.personClick(this, opener, 'the cookie preferences');
  else {
    const opened = await H.inPage(this, () => !!(window.privacyBanner && typeof window.privacyBanner.showPreferences === 'function' && (window.privacyBanner.showPreferences(), true)));
    if (!opened) throw H.failure(this.page, 'Expected a way to the cookie preferences (the banner\'s button or a "Cookie preferences" link), but there is none.', { hint: 'the store\'s footer usually has a "Cookie preferences" link.' });
  }
  const result = await H.poll(this, () => ({ done: !!window.__webshipStore.cookiePreferences() }), null, H.budget(this));
  if (!result.done) throw H.failure(this.page, 'Expected the cookie preferences to open, but they are not shown.', { hint: 'the preferences are a dialog about cookies with a box for each purpose.' });
});

/**
 * Allows or refuses one kind of cookies in the open cookie preferences ("Analytics", "Marketing",
 * "Preferences"), by its label.
 *
 * Example #1: When I allow the "Analytics" cookies
 * Example #2: When I refuse the "Marketing" cookies
 * Example #3: And I allow the "Preferences" cookies
 * Example #4: When we refuse the "Analytics" cookies
 * Example #5: When allow the "Marketing" cookies
 */
When(/^(?:I |we )?(allow|refuse) the "([^"]*)" cookies$/, async function (choice, kind) {
  const box = await H.inPage(this, (k) => {
    const S = window.__webshipStore;
    const prefs = S.cookiePreferences();
    if (!prefs) return { none: true };
    const boxes = [...prefs.querySelectorAll('input[type="checkbox"], [role="switch"], [role="checkbox"]')];
    const hit = boxes.find((b) => S.score(S.nameOf(b) || S.labelText(b), k) >= 2);
    return hit ? { sel: S.mark(hit), checked: hit.checked !== undefined ? hit.checked : hit.getAttribute('aria-checked') === 'true', disabled: hit.disabled } : { names: boxes.map((b) => S.nameOf(b)) };
  }, kind);
  if (box.none) throw H.failure(this.page, 'Expected the cookie preferences to be open, but they are not.', { hint: 'open them first: When I open the cookie preferences.' });
  if (!box.sel) throw H.failure(this.page, `Expected a choice "${kind}" in the cookie preferences, but there is none.`, { found: `choices ${H.listed(box.names)}`, hint: 'a choice is named by its label: "Analytics", "Marketing", "Preferences".' });
  if (box.disabled) throw H.failure(this.page, `Expected to change the "${kind}" cookies, but that choice cannot be changed.`, { hint: 'essential cookies are always on.' });
  const want = choice === 'allow';
  if (box.checked !== want) await H.personClick(this, box.sel, `the "${kind}" choice`);
});

/**
 * Saves the choices made in the cookie preferences, and waits until they are closed and recorded.
 *
 * Example #1: When I save the cookie preferences
 * Example #2: And I save the cookie preferences
 * Example #3: When we save the cookie preferences
 * Example #4: When save the cookie preferences
 * Example #5: Then I save the cookie preferences
 */
When(/^(?:I |we )?save the cookie preferences$/, async function () {
  const button = await H.inPage(this, () => {
    const S = window.__webshipStore;
    const prefs = S.cookiePreferences();
    if (!prefs) return { none: true };
    const own = document.getElementById('shopify-pc__prefs__header-save');
    const hit = (own && S.visible(own) && own) || [...prefs.querySelectorAll('button, [role="button"]')].find((x) => S.visible(x) && /save|confirm|apply|done/i.test(S.nameOf(x)));
    return hit ? { sel: S.mark(hit), name: S.nameOf(hit) } : { names: [...prefs.querySelectorAll('button')].map(S.nameOf) };
  });
  if (button.none) throw H.failure(this.page, 'Expected the cookie preferences to be open, but they are not.', { hint: 'open them first: When I open the cookie preferences.' });
  if (!button.sel) throw H.failure(this.page, 'Expected a button to save the cookie preferences, but there is none.', { found: `buttons ${H.listed(button.names)}`, hint: 'the preferences are saved with a button named Save, or alike.' });
  await H.personClick(this, button.sel, `the "${button.name}" button`);
  const result = await H.poll(this, () => {
    const S = window.__webshipStore;
    const c = S.consent();
    return { done: !S.cookiePreferences() && (!c || Object.values(c).some((v) => v === 'yes' || v === 'no')) };
  }, null, H.budget(this));
  if (!result.done) throw H.failure(this.page, 'Expected the cookie preferences to close and the choices to be recorded, but they did not.', { hint: 'the store records the choices with its Customer Privacy API.' });
});

/**
 * The visitor's tracking consent for one purpose ("analytics", "marketing", "preferences",
 * "sale of data"), as the store records it: "yes", "no" or "undecided".
 *
 * Example #1: Then the tracking consent for "analytics" should be "yes"
 * Example #2: Then the tracking consent for "marketing" should be "no"
 * Example #3: And the tracking consent for "preferences" should be "undecided"
 * Example #4: Then the tracking consent for "analytics" should not be "yes"
 * Example #5: But the tracking consent for "sale of data" should not be "undecided"
 */
Then(/^the tracking consent for "([^"]*)" should( not)? be "([^"]*)"$/, async function (purpose, not, value) {
  const key = PURPOSES[String(purpose).toLowerCase()];
  if (!key) throw H.failure(this.page, `Expected a purpose of the tracking consent, but "${purpose}" is not one.`, { found: 'purposes "analytics", "marketing", "preferences", "sale of data"', hint: 'name one of the purposes the store records.' });
  const wanted = String(value).toLowerCase() === 'undecided' ? '' : String(value).toLowerCase();
  if (!['yes', 'no', ''].includes(wanted)) throw H.failure(this.page, `Expected "yes", "no" or "undecided", but the step says "${value}".`, { hint: 'the store records "yes", "no" or nothing ("undecided") for each purpose.' });
  const deadline = Date.now() + H.budget(this);
  let c = null;
  for (;;) {
    c = await consentNow(this);
    const same = !!c && c[key] === wanted;
    if ((c && (not ? !same : same)) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  if (!c) throw H.failure(this.page, 'Expected to read the tracking consent, but the store has no Customer Privacy API on this page.', { hint: 'the store loads it with the cookie banner or with an app that asks for consent.' });
  const now = c[key] === '' ? 'undecided' : c[key];
  if (!not && c[key] !== wanted) throw H.failure(this.page, `Expected the tracking consent for "${purpose}" to be "${value}", but it is "${now}".`, { hint: 'the store records "yes", "no" or nothing ("undecided") for each purpose.' });
  if (not && c[key] === wanted) throw H.failure(this.page, `Expected the tracking consent for "${purpose}" not to be "${value}", but it is.`, { hint: 'the store records "yes", "no" or nothing ("undecided") for each purpose.' });
});

/**
 * The visitor has (or has not) made a choice about tracking: any purpose answered "yes" or "no".
 *
 * Example #1: Then the visitor's tracking consent should be decided
 * Example #2: Then the visitor's tracking consent should not be decided
 * Example #3: And the visitor's tracking consent should be decided
 * Example #4: But the visitor's tracking consent should not be decided
 * Example #5: * the visitor's tracking consent should be decided
 */
Then(/^the visitor's tracking consent should( not)? be decided$/, async function (not) {
  const deadline = Date.now() + H.budget(this);
  let c = null;
  for (;;) {
    c = await consentNow(this);
    const decided = !!c && Object.values(c).some((v) => v === 'yes' || v === 'no');
    if ((c && (not ? !decided : decided)) || Date.now() > deadline) break;
    await H.sleep(100);
  }
  if (!c) throw H.failure(this.page, 'Expected to read the tracking consent, but the store has no Customer Privacy API on this page.', { hint: 'the store loads it with the cookie banner or with an app that asks for consent.' });
  const decided = Object.values(c).some((v) => v === 'yes' || v === 'no');
  if (!not && !decided) throw H.failure(this.page, 'Expected the visitor to have made a choice about tracking, but every purpose is undecided.', { hint: 'a choice is made with the cookie banner or the cookie preferences.' });
  if (not && decided) throw H.failure(this.page, `Expected no choice about tracking yet, but the store records one: ${JSON.stringify(c)}.`, { hint: 'a new visitor has made no choice; the scenario may have made one before.' });
});
