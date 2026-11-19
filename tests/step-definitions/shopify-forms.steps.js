'use strict';

// The platform's own forms that every storefront carries, found by their action and field names:
// the newsletter form (the customer form: contact[email], form_type "customer") and the storefront
// password form of a store that is not open yet (password, form_type "storefront_password").
// Newsletter sign-ups are tested through their refusals only: a sign-up that goes through makes a
// customer record in the store.

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

async function newsletter(world, timeout) {
  return H.poll(world, () => {
    const S = window.__webshipStore;
    const form = S.newsletterForm();
    if (!form) return { done: false };
    const email = form.querySelector('[name="contact[email]"]');
    return { done: S.visible(email), sel: S.mark(form), email: S.mark(email), visible: S.visible(email) };
  }, null, timeout || H.budget(world));
}

/**
 * The page shows (or does not show) the newsletter form: the store's customer form with its email
 * field.
 *
 * Example #1: Then I should see the newsletter form
 * Example #2: And I should see the newsletter form
 * Example #3: Then I should not see the newsletter form
 * Example #4: But we should not see the newsletter form
 * Example #5: Then we should see the newsletter form
 */
Then(/^(?:I |we )?should( not)? see the newsletter form$/, async function (not) {
  const found = await newsletter(this, not ? 3000 : H.budget(this));
  if (!not && !found.done) {
    throw H.failure(this.page, 'Expected the newsletter form, but the page shows none.', {
      found: found.sel ? 'the form is on the page but hidden' : 'no form with an email field that signs up customers',
      hint: 'a store may use another service for its newsletter; this step finds the store\'s own form.',
    });
  }
  if (not && found.done) throw H.failure(this.page, 'Expected no newsletter form, but the page shows one.', { hint: 'this step finds the store\'s own customer form with its email field.' });
});

/**
 * The newsletter form's email field is (or is not) required.
 *
 * Example #1: Then the newsletter email field should be required
 * Example #2: And the newsletter email field should be required
 * Example #3: Then the newsletter email field should not be required
 * Example #4: But the newsletter email field should not be required
 * Example #5: * the newsletter email field should be required
 */
Then(/^the newsletter email field should( not)? be required$/, async function (not) {
  const found = await newsletter(this);
  if (!found.done) throw H.failure(this.page, 'Expected the newsletter form, but the page shows none.', { hint: 'a store may use another service for its newsletter; this step finds the store\'s own form.' });
  const required = await H.inPage(this, (sel) => {
    const el = document.querySelector(sel);
    return el.required || el.getAttribute('aria-required') === 'true';
  }, found.email);
  if (!not && !required) throw H.failure(this.page, 'Expected the newsletter email field to be required, but it is not.', { hint: 'the field is required when it has the required attribute or aria-required="true".' });
  if (not && required) throw H.failure(this.page, 'Expected the newsletter email field not to be required, but it is.', { hint: 'the field is required when it has the required attribute or aria-required="true".' });
});

/**
 * Signs up for the newsletter with an email address: fills in the form's email field and presses
 * its button. The browser may refuse the address before anything is sent; otherwise waits for the
 * store's answer. For refusals: an address that goes through makes a customer record.
 *
 * Example #1: When I sign up for the newsletter with "not-an-email"
 * Example #2: When I sign up for the newsletter with "jane@example"
 * Example #3: And I sign up for the newsletter with ""
 * Example #4: When we sign up for the newsletter with "jane@@example.com"
 * Example #5: When sign up for the newsletter with "jane@example"
 */
When(/^(?:I |we )?sign up for the newsletter with "([^"]*)"$/, async function (email) {
  const found = await newsletter(this);
  if (!found.done) throw H.failure(this.page, 'Expected the newsletter form, but the page shows none.', { hint: 'a store may use another service for its newsletter; this step finds the store\'s own form.' });
  await this.page.locator(found.email).fill(email);
  const button = await H.inPage(this, (sel) => {
    const S = window.__webshipStore;
    const form = document.querySelector(sel);
    const b = [...form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')].find(S.visible);
    return b ? S.mark(b) : null;
  }, found.sel);
  const answer = H.waitForStoreResponse(this, /\/contact$/, { timeout: H.budget(this) });
  if (button) await H.personClick(this, button, 'the newsletter form\'s button');
  else await this.page.locator(found.email).press('Enter');
  const refused = await H.poll(this, (sel) => {
    const el = document.querySelector(sel);
    return { done: !!el && !el.validity.valid, message: el ? el.validationMessage : '' };
  }, found.email, 1500);
  if (refused.done) {
    this.__storeNewsletter = { by: 'browser', message: refused.message };
    return;
  }
  const response = await answer;
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  this.__storeNewsletter = { by: 'store', status: response ? response.status() : null };
  await H.settle(this);
});

/**
 * The newsletter sign-up was refused: by the browser (an address it does not accept, the field
 * shows as invalid) or by the store (the form comes back with its error). A message can be named:
 * the store's error, or the browser's own words.
 *
 * Example #1: Then the newsletter sign-up should be refused
 * Example #2: Then the newsletter sign-up should be refused with "Email is invalid."
 * Example #3: And the newsletter sign-up should be refused
 * Example #4: Then the newsletter sign-up should be refused with "Email can't be blank."
 * Example #5: But the newsletter sign-up should be refused with "invalid"
 */
Then(/^the newsletter sign-up should be refused(?: with "([^"]*)")?$/, async function (message) {
  const last = this.__storeNewsletter;
  if (!last) throw H.failure(this.page, 'Expected a refused newsletter sign-up, but the scenario has not signed up yet.', { hint: 'sign up first: When I sign up for the newsletter with "<address>".' });
  if (last.by === 'browser') {
    if (message && !H.norm(last.message).toLowerCase().includes(H.norm(message).toLowerCase())) {
      throw H.failure(this.page, `Expected the refusal "${message}", but the browser refused with "${last.message}".`, { hint: 'the browser checked the address before sending it; its words depend on the browser and its language.' });
    }
    return;
  }
  const result = await H.poll(this, (m) => {
    const S = window.__webshipStore;
    const form = S.newsletterForm();
    const errors = S.formErrors(form);
    const posted = /[?&]customer_posted=true/.test(location.search);
    const ok = !posted && errors.length > 0 && (!m || errors.some((e) => S.lower(e).includes(S.lower(m))));
    return { done: ok, errors, posted };
  }, message || '', H.budget(this));
  if (!result.done) {
    throw H.failure(this.page, result.posted
      ? 'Expected the newsletter sign-up to be refused, but the store accepted it.'
      : `Expected the newsletter sign-up to be refused${message ? ` with "${message}"` : ''}, but the form shows no such error.`, {
      found: `errors ${H.listed(result.errors)}`, hint: 'the store answers a refused sign-up with the form and its error; an accepted one with customer_posted=true in the address.' });
  }
});

async function passwordForm(world, timeout) {
  return H.poll(world, () => {
    const S = window.__webshipStore;
    const form = S.passwordForm();
    const field = form && form.querySelector('input[name="password"]');
    if (!form || !field) return { done: false };
    return { done: S.visible(field), sel: S.mark(form), field: S.mark(field) };
  }, null, timeout || H.budget(world));
}

/**
 * The page is (or is not) the store's password page: a store that is not open yet sends every
 * visitor there, with its storefront password form.
 *
 * Example #1: Then I should see the store password page
 * Example #2: And I should see the store password page
 * Example #3: Then I should not see the store password page
 * Example #4: But we should not see the store password page
 * Example #5: Then we should see the store password page
 */
Then(/^(?:I |we )?should( not)? see the store password page$/, async function (not) {
  const found = await passwordForm(this, not ? 3000 : H.budget(this));
  if (!not && !found.done) throw H.failure(this.page, 'Expected the store password page, but the page has no storefront password form.', { hint: 'the store may be open: its pages are shown without a password.' });
  if (not && found.done) throw H.failure(this.page, 'Expected to be past the store password page, but it is shown.', { hint: 'the store may still be closed: enter it with its password first.' });
});

/**
 * Enters a store that is not open yet with its password: fills in the storefront password form
 * and sends it, then waits for the store's answer.
 *
 * Example #1: When I enter the store with the password "webship-demo"
 * Example #2: When I enter the store with the password "wrong"
 * Example #3: And I enter the store with the password ""
 * Example #4: When we enter the store with the password "opening-soon"
 * Example #5: When enter the store with the password "letmein"
 */
When(/^(?:I |we )?enter the store with the password "([^"]*)"$/, async function (password) {
  const found = await passwordForm(this);
  if (!found.done) throw H.failure(this.page, 'Expected the store password page, but the page has no storefront password form.', { hint: 'the store may be open: its pages are shown without a password.' });
  await this.page.locator(found.field).fill(password);
  const answer = H.waitForStoreResponse(this, /\/password$/, { timeout: H.budget(this) });
  await this.page.locator(found.field).press('Enter');
  const refused = await H.poll(this, (sel) => {
    const el = document.querySelector(sel);
    return { done: !!el && !el.validity.valid };
  }, found.field, 1000);
  if (refused.done) return;
  await answer;
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  await H.settle(this);
});

/**
 * The store refused the password: the password page is shown again with its error, which can be
 * named.
 *
 * Example #1: Then the store password should be refused
 * Example #2: Then the store password should be refused with "Wrong password."
 * Example #3: And the store password should be refused
 * Example #4: But the store password should be refused with "Wrong password"
 * Example #5: * the store password should be refused
 */
Then(/^the store password should be refused(?: with "([^"]*)")?$/, async function (message) {
  const result = await H.poll(this, (m) => {
    const S = window.__webshipStore;
    const form = S.passwordForm();
    if (!form) return { done: false, noForm: true };
    const field = form.querySelector('input[name="password"]');
    const errors = S.formErrors(form);
    const byBrowser = field && !field.validity.valid;
    const ok = (errors.length > 0 && (!m || errors.some((e) => S.lower(e).includes(S.lower(m))))) || (!m && byBrowser);
    return { done: ok, errors };
  }, message || '', H.budget(this));
  if (result.noForm) throw H.failure(this.page, 'Expected the password to be refused, but the store let the visitor in.', { hint: 'a store that lets the visitor in has no password form any more.' });
  if (!result.done) throw H.failure(this.page, `Expected the store password to be refused${message ? ` with "${message}"` : ''}, but the form shows no such error.`, { found: `errors ${H.listed(result.errors)}`, hint: 'the error is the one the store shows in its password form.' });
});

/**
 * The visitor is in the store: a storefront page is shown, not the password page.
 *
 * Example #1: Then I should be in the store
 * Example #2: And I should be in the store
 * Example #3: Then we should be in the store
 * Example #4: But I should be in the store
 * Example #5: * we should be in the store
 */
Then(/^(?:I |we )?should be in the store$/, async function () {
  const result = await H.poll(this, () => {
    const S = window.__webshipStore;
    const info = S.storefront();
    return { done: !S.passwordForm() && info.hasGlobals && info.pageType !== 'password', type: info.pageType, path: location.pathname };
  }, null, H.budget(this));
  if (!result.done) throw H.failure(this.page, `Expected a page of the store, but the page is "${result.path}" (type "${result.type || '(none)'}").`, { hint: 'the password may have been refused.' });
});
