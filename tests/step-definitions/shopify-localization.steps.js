'use strict';

// The country and language selectors: the theme's controls for the platform's localization form
// (POST /localization with country_code and language_code), whether the theme draws a drop-down
// list or a list of buttons behind a disclosure. The store's answer is read from its globals
// (Shopify.country, Shopify.locale, Shopify.currency.active).

const { When, Then } = require('@cucumber/cucumber');
const H = require('./store-helpers');

async function choicesOf(world, kind) {
  return H.poll(world, (k) => {
    const S = window.__webshipStore;
    const list = S.localizationChoices(k);
    return { done: list.length > 0, choices: list.map((c) => ({ code: c.code, name: c.name })) };
  }, kind, Math.min(H.budget(world), 5000));
}

function matchChoice(choices, wanted) {
  const w = H.norm(wanted).toLowerCase();
  return choices.find((c) => c.code.toLowerCase() === w)
    || choices.find((c) => H.norm(c.name).toLowerCase() === w)
    || choices.find((c) => H.norm(c.name).toLowerCase().startsWith(`${w} `) || H.norm(c.name).toLowerCase().startsWith(`${w} (`))
    || null;
}

/**
 * Chooses a country (and with it the currency) or a language in the store's selector, the way a
 * person does: the entry of the drop-down list, or the button of the list behind the selector's
 * disclosure. The country is named as the selector shows it ("Canada") or by its code ("CA"). Waits
 * until the store has answered and the page shows the new country or language.
 *
 * Example #1: When I choose "Canada" as the country
 * Example #2: When I choose "Germany" as the country
 * Example #3: And I choose "Français" as the language
 * Example #4: When we choose "English" as the language
 * Example #5: When choose "GB" as the country
 */
When(/^(?:I |we )?choose "([^"]*)" as the (country|language)$/, async function (wanted, kind) {
  const found = await choicesOf(this, kind);
  if (!found.done) throw H.failure(this.page, `Expected a ${kind} selector, but the page has none.`, { hint: 'a store with one country (or one language) shows no selector for it.' });
  const choice = matchChoice(found.choices, wanted);
  if (!choice) throw H.failure(this.page, `Expected "${wanted}" in the ${kind} selector, but it is not there.`, { found: `${kind} choices ${H.listed(found.choices.map((c) => c.name), 20)}`, hint: 'a country is named as the selector shows it, or by its two-letter code; the store sells only to its markets.' });
  const target = await H.inPage(this, (a) => {
    const S = window.__webshipStore;
    const all = S.localizationChoices(a.kind).filter((c) => c.code === a.code);
    const select = all.find((c) => c.kind === 'select' && S.visible(c.select));
    if (select) return { kind: 'select', sel: S.mark(select.select) };
    const item = all.find((c) => c.kind === 'list' && S.visible(c.el));
    if (item) return { kind: 'click', sel: S.mark(item.el) };
    // Closed: the visible button or summary that controls the list holding an item.
    for (const c of all) {
      let box = c.el.parentElement;
      while (box && box !== c.form.parentElement) {
        if (box.id) {
          const opener = [...document.querySelectorAll(`[aria-controls="${CSS.escape(box.id)}"]`)].find(S.visible);
          if (opener) return { kind: 'open', sel: S.mark(opener), item: S.mark(c.el) };
        }
        const details = box.closest('details:not([open])');
        if (details && S.visible(details.querySelector('summary'))) return { kind: 'open', sel: S.mark(details.querySelector('summary')), item: S.mark(c.el) };
        box = box.parentElement;
      }
      const button = [...c.form.querySelectorAll('button[aria-expanded], summary')].find(S.visible);
      if (button) return { kind: 'open', sel: S.mark(button), item: S.mark(c.el) };
    }
    return null;
  }, { kind, code: choice.code });
  if (!target) throw H.failure(this.page, `The ${kind} selector is on the page but hidden, and no button opens it.`, { hint: 'it may live in a closed menu: open the menu first.' });
  const answer = H.waitForStoreResponse(this, /\/localization$/, { timeout: H.budget(this) });
  if (target.kind === 'select') {
    await this.page.locator(target.sel).selectOption(choice.code);
    const sent = await Promise.race([answer, H.sleep(2500).then(() => 'none')]);
    if (sent === 'none') {
      const submit = await H.inPage(this, (sel) => {
        const S = window.__webshipStore;
        const form = document.querySelector(sel).form;
        const b = form && [...form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')].find(S.visible);
        return b ? S.mark(b) : null;
      }, target.sel);
      if (submit) await H.personClick(this, submit, 'the selector\'s update button');
    }
  } else {
    if (target.kind === 'open') {
      await H.personClick(this, target.sel, `the ${kind} selector`);
      await H.poll(this, (sel) => ({ done: window.__webshipStore.visible(document.querySelector(sel)) }), target.item, 3000);
      target.sel = target.item;
    }
    await H.personClick(this, target.sel, `"${choice.name}" in the ${kind} selector`);
  }
  await answer;
  await this.page.waitForLoadState('domcontentloaded').catch(() => {});
  const result = await H.poll(this, (a) => {
    const info = window.__webshipStore.storefront();
    const now = a.kind === 'country' ? info.country : (info.locale || info.lang);
    return { done: a.kind === 'country' ? now.toUpperCase() === a.code.toUpperCase() : now.toLowerCase().split('-')[0] === a.code.toLowerCase().split('-')[0], now };
  }, { kind, code: choice.code }, H.budget(this));
  await H.settle(this);
  if (!result.done) throw H.failure(this.page, `Expected the store's ${kind} to become "${choice.name}" (${choice.code}), but it is "${result.now || '(none)'}".`, { hint: 'the store answers the localization form with a new page; check that the choice was sent.' });
});

async function current(world, kind, wanted, not) {
  const found = await choicesOf(world, kind);
  const choice = matchChoice(found.choices || [], wanted);
  const code = choice ? choice.code : wanted;
  const result = await H.poll(world, (a) => {
    const info = window.__webshipStore.storefront();
    let now = a.kind === 'country' ? info.country : a.kind === 'currency' ? info.currency : (info.locale || info.lang);
    now = now || '';
    const same = a.kind === 'language' ? now.toLowerCase().split('-')[0] === a.code.toLowerCase().split('-')[0] : now.toUpperCase() === a.code.toUpperCase();
    return { done: a.not ? !same : same, now };
  }, { kind, code, not: !!not }, H.budget(world));
  return { result, code, choices: found.choices || [] };
}

/**
 * The country of the store's visit (Shopify.country) is (or is not) that one, named as the
 * selector shows it or by its code.
 *
 * Example #1: Then the store country should be "Canada"
 * Example #2: Then the store country should be "US"
 * Example #3: And the store country should be "Germany"
 * Example #4: Then the store country should not be "United States"
 * Example #5: But the store country should not be "CA"
 */
Then(/^the store country should( not)? be "([^"]*)"$/, async function (not, wanted) {
  const { result, code } = await current(this, 'country', wanted, not);
  if (!result.done) throw H.failure(this.page, not ? `Expected the store country not to be "${wanted}", but it is.` : `Expected the store country "${wanted}" (${code}), but it is "${result.now || '(none)'}".`, { hint: 'the country comes from the store\'s answer (Shopify.country); a choice in the selector changes it.' });
});

/**
 * The language of the store's page (Shopify.locale) is (or is not) that one, named as the
 * selector shows it or by its code.
 *
 * Example #1: Then the store language should be "Français"
 * Example #2: Then the store language should be "en"
 * Example #3: And the store language should be "English"
 * Example #4: Then the store language should not be "fr"
 * Example #5: But the store language should not be "Deutsch"
 */
Then(/^the store language should( not)? be "([^"]*)"$/, async function (not, wanted) {
  const { result, code } = await current(this, 'language', wanted, not);
  if (!result.done) throw H.failure(this.page, not ? `Expected the store language not to be "${wanted}", but it is.` : `Expected the store language "${wanted}" (${code}), but it is "${result.now || '(none)'}".`, { hint: 'the language comes from the store\'s answer (Shopify.locale); a choice in the selector changes it.' });
});

/**
 * The currency of the store's prices for this visit (Shopify.currency.active) is (or is not) that
 * one, by its code.
 *
 * Example #1: Then the store currency should be "CAD"
 * Example #2: Then the store currency should be "USD"
 * Example #3: And the store currency should be "EUR"
 * Example #4: Then the store currency should not be "USD"
 * Example #5: But the store currency should not be "GBP"
 */
Then(/^the store currency should( not)? be "([^"]*)"$/, async function (not, wanted) {
  const { result } = await current(this, 'currency', wanted, not);
  if (!result.done) throw H.failure(this.page, not ? `Expected the store currency not to be "${wanted}", but it is.` : `Expected the store currency "${wanted}", but it is "${result.now || '(none)'}".`, { hint: 'the currency follows the country of the visit (Shopify.currency.active).' });
});

/**
 * The country or language selector does (or does not) offer that choice, by its name or code.
 *
 * Example #1: Then the country selector should list "Canada"
 * Example #2: Then the language selector should list "Français"
 * Example #3: And the country selector should list "GB"
 * Example #4: Then the country selector should not list "Atlantis"
 * Example #5: But the language selector should not list "Klingon"
 */
Then(/^the (country|language) selector should( not)? list "([^"]*)"$/, async function (kind, not, wanted) {
  const found = await choicesOf(this, kind);
  if (!found.done) throw H.failure(this.page, `Expected a ${kind} selector, but the page has none.`, { hint: 'a store with one country (or one language) shows no selector for it.' });
  const has = !!matchChoice(found.choices, wanted);
  if (!not && !has) throw H.failure(this.page, `Expected the ${kind} selector to list "${wanted}", but it does not.`, { found: `${found.choices.length} choices: ${H.listed(found.choices.map((c) => c.name), 15)}`, hint: 'the selector lists the countries of the store\'s markets, by name and code.' });
  if (not && has) throw H.failure(this.page, `Expected the ${kind} selector not to list "${wanted}", but it does.`, { hint: 'the selector lists the countries of the store\'s markets, by name and code.' });
});

/**
 * The country or language selector shows the visit's own country or language: its current value
 * is the one the store reports (Shopify.country, Shopify.locale), wherever the visitor is.
 *
 * Example #1: Then the country selector should show the current country
 * Example #2: Then the language selector should show the current language
 * Example #3: And the country selector should show the current country
 * Example #4: But the language selector should show the current language
 * Example #5: * the country selector should show the current country
 */
Then(/^the (country|language) selector should show the current (?:country|language)$/, async function (kind) {
  const result = await H.poll(this, (k) => {
    const S = window.__webshipStore;
    const info = S.storefront();
    const now = k === 'country' ? info.country : (info.locale || info.lang);
    const shown = S.localizationCurrent(k);
    const same = shown.length > 0 && shown.every((v) => (k === 'country' ? v.toUpperCase() === now.toUpperCase() : v.toLowerCase().split('-')[0] === now.toLowerCase().split('-')[0]));
    return { done: same, now, shown };
  }, kind, H.budget(this));
  if (!result.done) {
    throw H.failure(this.page, result.shown.length
      ? `Expected the ${kind} selector to show the current ${kind} "${result.now}", but it shows ${H.listed(result.shown)}.`
      : `Expected a ${kind} selector with a current value, but the page has none.`, { hint: 'the selector\'s current value is its chosen entry or its hidden field.' });
  }
});
