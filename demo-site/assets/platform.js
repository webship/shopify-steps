/*
 * A stand-in for what the platform adds to every storefront page in the demo store: the
 * `Shopify.loadFeatures` loader, the Customer Privacy API (`Shopify.customerPrivacy`, written from
 * its public documentation, shopify.dev/docs/api/customer-privacy) and a cookie banner with its
 * preferences dialog. Our own code and markup; nothing here is the platform's.
 *
 * The banner shows to visitors whose country is in the EEA or the UK (the demo takes the country
 * of its country selector; the platform locates the visitor), until they make a choice.
 */
(function () {
  'use strict';

  var shopify = window.Shopify = window.Shopify || {};
  var config = window.__demoPrivacy || {};
  var COOKIE = '_tracking_consent';
  var PURPOSES = ['analytics', 'marketing', 'preferences', 'sale_of_data'];

  function read() {
    var match = document.cookie.match(/(?:^|;\s*)_tracking_consent=([^;]*)/);
    var stored = {};
    if (match) {
      try { stored = JSON.parse(decodeURIComponent(match[1])); } catch (e) { stored = {}; }
    }
    var out = {};
    PURPOSES.forEach(function (p) { out[p] = stored[p] === 'yes' || stored[p] === 'no' ? stored[p] : ''; });
    return out;
  }

  function write(consent) {
    document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(consent)) + '; Path=/; SameSite=Lax; Max-Age=31536000';
  }

  var customerPrivacy = {
    currentVisitorConsent: function () { return read(); },
    setTrackingConsent: function (consent, callback) {
      var current = read();
      PURPOSES.forEach(function (p) {
        if (consent && typeof consent[p] === 'boolean') current[p] = consent[p] ? 'yes' : 'no';
      });
      write(current);
      Promise.resolve().then(function () {
        document.dispatchEvent(new CustomEvent('visitorConsentCollected', {
          detail: {
            marketingAllowed: current.marketing === 'yes',
            saleOfDataAllowed: current.sale_of_data !== 'no',
            analyticsAllowed: current.analytics === 'yes',
            preferencesAllowed: current.preferences === 'yes',
          },
        }));
        if (typeof callback === 'function') callback();
      });
    },
    analyticsProcessingAllowed: function () { return read().analytics === 'yes'; },
    marketingAllowed: function () { return read().marketing === 'yes'; },
    preferencesProcessingAllowed: function () { return read().preferences === 'yes'; },
    saleOfDataAllowed: function () { return read().sale_of_data !== 'no'; },
    saleOfDataRegion: function () { return false; },
    shouldShowBanner: function () { return !!config.showBanner; },
    getRegion: function () { return config.region || ''; },
    consentId: function () { return 'demo-consent'; },
  };

  shopify.loadFeatures = function (features, callback) {
    var list = Array.isArray(features) ? features : [];
    var unknown = list.filter(function (f) { return !f || f.name !== 'consent-tracking-api'; });
    if (!unknown.length) shopify.customerPrivacy = customerPrivacy;
    Promise.resolve().then(function () {
      if (typeof callback === 'function') callback(unknown.length ? new Error('Unknown feature') : null);
    });
  };

  // ---------------------------------------------------------------------------------------------
  // The cookie banner and its preferences dialog.

  function undecided() {
    var c = read();
    return PURPOSES.every(function (p) { return c[p] === ''; });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function choose(consent) {
    shopify.customerPrivacy.setTrackingConsent(consent, function () {
      var banner = document.getElementById('privacy-banner');
      if (banner) banner.remove();
      var prefs = document.getElementById('privacy-preferences');
      if (prefs && prefs.open) prefs.close();
    });
  }

  function all(value) {
    return { analytics: value, marketing: value, preferences: value, sale_of_data: value };
  }

  function preferencesDialog() {
    var existing = document.getElementById('privacy-preferences');
    if (existing) return existing;
    var current = read();
    var option = function (key, label, text, locked) {
      var id = 'privacy-preferences-' + key;
      return el('div', { class: 'privacy-option' }, [
        el('input', { type: 'checkbox', id: id, name: key, checked: locked || current[key] === 'yes', disabled: locked }),
        el('label', { for: id, text: label }),
        el('p', { class: 'privacy-option__text', text: text }),
      ]);
    };
    var dialog = el('dialog', { id: 'privacy-preferences', class: 'privacy-preferences', 'aria-labelledby': 'privacy-preferences-title' }, [
      el('div', { class: 'privacy-preferences__header' }, [
        el('h2', { id: 'privacy-preferences-title', text: 'Cookie preferences' }),
        el('button', { type: 'button', class: 'privacy-preferences__close', 'aria-label': 'Close', 'data-privacy-close': true, text: '✕' }),
      ]),
      el('p', { text: 'Choose which cookies the store may use. Essential cookies keep the cart and the store working.' }),
      option('essential', 'Essential', 'The cart, the country and these choices.', true),
      option('analytics', 'Analytics', 'How visitors use the store.', false),
      option('marketing', 'Marketing', 'Advertising on other sites.', false),
      option('preferences', 'Preferences', 'Remembered settings, such as the language.', false),
      el('div', { class: 'privacy-preferences__actions' }, [
        el('button', { type: 'button', 'data-privacy': 'decline-all', text: 'Decline all' }),
        el('button', { type: 'button', 'data-privacy': 'accept-all', text: 'Accept all' }),
        el('button', { type: 'button', 'data-privacy': 'save', class: 'button--primary', text: 'Save my choices' }),
      ]),
    ]);
    dialog.addEventListener('click', function (event) {
      var action = event.target.closest('[data-privacy]');
      if (event.target.closest('[data-privacy-close]')) { dialog.close(); return; }
      if (!action) return;
      var kind = action.getAttribute('data-privacy');
      if (kind === 'accept-all') choose(all(true));
      if (kind === 'decline-all') choose(all(false));
      if (kind === 'save') {
        var pick = function (k) { return dialog.querySelector('[name="' + k + '"]').checked; };
        choose({ analytics: pick('analytics'), marketing: pick('marketing'), preferences: pick('preferences'), sale_of_data: pick('marketing') });
      }
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showPreferences() {
    var dialog = preferencesDialog();
    var current = read();
    ['analytics', 'marketing', 'preferences'].forEach(function (k) {
      dialog.querySelector('[name="' + k + '"]').checked = current[k] === 'yes';
    });
    if (!dialog.open) dialog.showModal();
    return Promise.resolve();
  }

  window.privacyBanner = { showPreferences: showPreferences };

  function showBanner() {
    if (document.getElementById('privacy-banner')) return;
    var banner = el('div', { id: 'privacy-banner', class: 'privacy-banner', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'privacy-banner-title', 'aria-describedby': 'privacy-banner-text' }, [
      el('h2', { id: 'privacy-banner-title', text: 'We value your privacy' }),
      el('p', { id: 'privacy-banner-text' }, [
        document.createTextNode('This store uses cookies to keep your cart, to measure visits and for marketing. '),
        el('a', { href: (config.root || '/') + 'policies/privacy-policy', text: 'Privacy policy' }),
      ]),
      el('div', { class: 'privacy-banner__actions' }, [
        el('button', { type: 'button', 'data-privacy': 'manage', text: 'Manage preferences' }),
        el('button', { type: 'button', 'data-privacy': 'decline', text: 'Decline' }),
        el('button', { type: 'button', 'data-privacy': 'accept', class: 'button--primary', text: 'Accept' }),
      ]),
    ]);
    banner.addEventListener('click', function (event) {
      var action = event.target.closest('[data-privacy]');
      if (!action) return;
      var kind = action.getAttribute('data-privacy');
      if (kind === 'accept') choose(all(true));
      if (kind === 'decline') choose(all(false));
      if (kind === 'manage') showPreferences();
    });
    document.body.appendChild(banner);
  }

  function start() {
    shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], function (error) {
      if (error) return;
      if (shopify.customerPrivacy.shouldShowBanner() && undecided()) showBanner();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
