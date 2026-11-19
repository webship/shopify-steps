/*
 * The demo theme's script: our own code. It makes the pages behave the way storefront themes
 * do, through the storefront Ajax API and the Section Rendering API the demo server stands in
 * for: the cart drawer, adding to the cart, the cart lines and the note, the variant picker, the
 * quantity buttons, the facets and the sort, predictive search and the localization form.
 */
(function () {
  'use strict';

  var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { timer = null; fn.apply(self, args); }, wait);
    };
  }

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    }).then(function (response) {
      return response.json().then(function (body) { return { ok: response.ok, status: response.status, body: body }; });
    });
  }

  // -------------------------------------------------------------------------------------------
  // The cart drawer

  var drawer = $('#CartDrawer');

  function openDrawer() {
    if (!drawer || drawer.open) return;
    drawer.classList.remove('is-closing');
    drawer.showModal();
    var icon = $('#cart-icon');
    if (icon) icon.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    if (!drawer || !drawer.open || drawer.classList.contains('is-closing')) return;
    drawer.classList.add('is-closing');
    var inner = $('.cart-drawer__inner', drawer);
    if (window.getComputedStyle(inner).animationName === 'none') {
      drawer.classList.remove('is-closing');
      drawer.close();
      return;
    }
    var done = function () {
      inner.removeEventListener('animationend', done);
      drawer.classList.remove('is-closing');
      drawer.close();
      var icon = $('#cart-icon');
      if (icon) { icon.setAttribute('aria-expanded', 'false'); icon.focus(); }
    };
    inner.addEventListener('animationend', done);
  }

  function renderSections(sections) {
    if (!sections) return;
    if (sections['cart-drawer'] !== undefined && drawer) {
      $('.cart-drawer__inner', drawer).innerHTML = sections['cart-drawer'];
    }
    if (sections['cart-icon'] !== undefined) {
      var icon = $('#cart-icon');
      var holder = document.createElement('div');
      holder.innerHTML = sections['cart-icon'];
      var fresh = holder.firstElementChild;
      if (icon && fresh) {
        icon.setAttribute('aria-label', fresh.getAttribute('aria-label'));
        icon.innerHTML = fresh.innerHTML;
      }
    }
  }

  function refreshCartPage() {
    var section = $('[data-section="main-cart"]');
    if (!section) return Promise.resolve();
    return fetch(root + 'cart').then(function (r) { return r.text(); }).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var fresh = doc.querySelector('[data-section="main-cart"]');
      if (fresh) section.innerHTML = fresh.innerHTML;
    });
  }

  document.addEventListener('click', function (event) {
    var icon = event.target.closest('#cart-icon');
    if (icon && drawer) { event.preventDefault(); openDrawer(); return; }
    if (event.target.closest('[data-cart-close]') && drawer && drawer.open) {
      event.preventDefault();
      closeDrawer();
    }
  });

  if (drawer) {
    drawer.addEventListener('cancel', function (event) { event.preventDefault(); closeDrawer(); });
    drawer.addEventListener('click', function (event) {
      if (event.target === drawer) closeDrawer();
    });
  }

  // -------------------------------------------------------------------------------------------
  // Cart lines (drawer and cart page): quantity, remove, note

  // A line is named by its key, which stays the same while other lines come and go.
  function changeLine(key, quantity) {
    var busy = $$('[data-cart-form]');
    busy.forEach(function (f) { f.setAttribute('aria-busy', 'true'); });
    return post(root + 'cart/change.js', { id: key, quantity: quantity, sections: 'cart-drawer,cart-icon' })
      .then(function (result) {
        if (result.ok) renderSections(result.body.sections);
        return refreshCartPage();
      })
      .then(function () { $$('[data-cart-form]').forEach(function (f) { f.removeAttribute('aria-busy'); }); });
  }

  document.addEventListener('change', function (event) {
    var input = event.target.closest('input[name="updates[]"]');
    if (input) {
      var value = parseInt(input.value, 10);
      changeLine(input.getAttribute('data-key'), Number.isFinite(value) && value >= 0 ? value : 0);
    }
  });

  document.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-remove-line]');
    if (remove) {
      event.preventDefault();
      changeLine(remove.closest('[data-key]').getAttribute('data-key'), 0);
      return;
    }
    var button = event.target.closest('.quantity__button');
    if (!button) return;
    var box = button.closest('[data-quantity]');
    var input = box && $('input', box);
    if (!input) return;
    var min = parseInt(input.getAttribute('min') || '0', 10);
    var now = parseInt(input.value, 10) || 0;
    var next = button.name === 'plus' ? now + 1 : Math.max(min, now - 1);
    if (next === now) return;
    input.value = String(next);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  var saveNote = debounce(function (value) {
    post(root + 'cart/update.js', { note: value });
  }, 300);

  document.addEventListener('input', function (event) {
    var note = event.target.closest('[data-cart-note]');
    if (note) saveNote(note.value);
  });

  // -------------------------------------------------------------------------------------------
  // The product form: variant picker, add to cart, buy it now

  function productState(form) {
    var section = form.closest('[data-product-handle]');
    var data = section && $('[data-product-json]', section);
    return data ? JSON.parse(data.textContent) : null;
  }

  function money(cents) {
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    var symbols = { USD: '$', CAD: '$', EUR: '€', GBP: '£' };
    var currency = (meta && meta.currency) || 'USD';
    var amount = (cents / 100).toFixed(2);
    return currency === 'USD' ? '$' + amount : symbols[currency] + amount + ' ' + currency;
  }

  function selectedOptions(form) {
    var values = [];
    $$('[data-option-index]', form).forEach(function (input) {
      var i = parseInt(input.getAttribute('data-option-index'), 10);
      if (input.tagName === 'SELECT') values[i] = input.value;
      else if (input.checked) values[i] = input.value;
    });
    return values;
  }

  function updateVariant(form) {
    var product = productState(form);
    if (!product) return;
    var wanted = selectedOptions(form);
    var variant = product.variants.find(function (v) {
      return v.options.every(function (value, i) { return wanted[i] === undefined || wanted[i] === value; });
    });
    var add = $('[name="add"]', form);
    var buyNow = $('.shopify-payment-button', form);
    var error = $('[data-product-error]', form);
    if (error) { error.hidden = true; error.textContent = ''; }
    var labels = window.__demoStrings || {};
    if (!variant) {
      add.disabled = true;
      add.setAttribute('aria-disabled', 'true');
      add.textContent = labels.unavailable || 'Unavailable';
      if (buyNow) buyNow.hidden = true;
      return;
    }
    $('[name="id"]', form).value = String(variant.id);
    add.disabled = !variant.available;
    if (variant.available) add.removeAttribute('aria-disabled'); else add.setAttribute('aria-disabled', 'true');
    add.textContent = variant.available ? (labels.addToCart || 'Add to cart') : (labels.soldOut || 'Sold out');
    if (buyNow) buyNow.hidden = !variant.available;
    markAvailability(form, product, wanted);
    $$('[data-option-value]', form).forEach(function (span) {
      var input = $('[data-option-index]', span.closest('fieldset'));
      var i = input ? parseInt(input.getAttribute('data-option-index'), 10) : -1;
      if (i >= 0) span.textContent = wanted[i];
    });
    var price = $('[data-product-price] .price__current');
    if (price) price.textContent = money(variant.price);
    var compare = $('[data-product-price] .price__compare');
    if (compare && variant.compare_at_price) compare.textContent = money(variant.compare_at_price);
    var meta = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    if (meta) meta.selectedVariantId = String(variant.id);
    var url = new URL(window.location.href);
    url.searchParams.set('variant', String(variant.id));
    window.history.replaceState({}, '', url.toString());
  }

  // Which values of each option can be bought with the other options as they are chosen now.
  function markAvailability(form, product, wanted) {
    var labels = window.__demoStrings || {};
    var soldOut = labels.soldOut || 'Sold out';
    $$('[data-option-index]', form).forEach(function (input) {
      var i = parseInt(input.getAttribute('data-option-index'), 10);
      var can = function (value) {
        return product.variants.some(function (v) {
          return v.available && v.options[i] === value && v.options.every(function (x, j) { return j === i || wanted[j] === undefined || wanted[j] === x; });
        });
      };
      if (input.tagName === 'SELECT') {
        $$('option', input).forEach(function (option) {
          option.textContent = option.value + (can(option.value) ? '' : ' - ' + soldOut);
        });
        return;
      }
      var label = form.querySelector('label[for="' + input.id + '"]');
      var ok = can(input.value);
      if (ok) input.removeAttribute('data-unavailable'); else input.setAttribute('data-unavailable', '');
      if (label) {
        label.classList.toggle('swatch--unavailable', !ok);
        label.textContent = input.value;
        if (!ok) {
          var hint = document.createElement('span');
          hint.className = 'visually-hidden';
          hint.textContent = ' (' + soldOut + ')';
          label.appendChild(hint);
        }
      }
    });
  }

  document.addEventListener('change', function (event) {
    var form = event.target.closest('[data-product-form]');
    if (form && event.target.matches('[data-option-index]')) updateVariant(form);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-product-form]');
    if (!form) return;
    event.preventDefault();
    var add = $('[name="add"]', form);
    if (add.disabled) return;
    var error = $('[data-product-error]', form);
    add.setAttribute('aria-busy', 'true');
    add.disabled = true;
    var data = {
      items: [{ id: parseInt($('[name="id"]', form).value, 10), quantity: parseInt(($('[name="quantity"]', form) || {}).value || '1', 10) || 1 }],
      sections: 'cart-drawer,cart-icon',
    };
    post(root + 'cart/add.js', data).then(function (result) {
      add.removeAttribute('aria-busy');
      add.disabled = false;
      if (!result.ok) {
        error.textContent = result.body.description || result.body.message || 'This item could not be added.';
        error.hidden = false;
        return fetch(root + '?sections=cart-drawer,cart-icon').then(function (r) { return r.json(); }).then(renderSections);
      }
      renderSections(result.body.sections);
      openDrawer();
      return null;
    });
  });

  document.addEventListener('click', function (event) {
    var buy = event.target.closest('[data-buy-now]');
    if (!buy) return;
    var form = buy.closest('[data-product-form]');
    var id = $('[name="id"]', form).value;
    var quantity = ($('[name="quantity"]', form) || {}).value || '1';
    var token = Math.random().toString(16).slice(2) + Date.now().toString(16);
    window.location.assign(root + 'checkouts/cn/' + token + '?buy_now=' + encodeURIComponent(id + ':' + quantity));
  });

  // -------------------------------------------------------------------------------------------
  // Facets and sort (collection page, search page)

  function sectionOf(form) {
    return form.closest('[data-section]');
  }

  function loadSection(url, push) {
    var section = $('[data-section="main-collection"]') || $('[data-section="main-search"]');
    if (!section) { window.location.assign(url); return; }
    var id = section.getAttribute('data-section');
    section.setAttribute('aria-busy', 'true');
    var target = new URL(url, window.location.href);
    var fetchUrl = new URL(target.toString());
    fetchUrl.searchParams.set('section_id', id);
    fetch(fetchUrl.toString()).then(function (r) { return r.text(); }).then(function (html) {
      var holder = document.createElement('div');
      holder.innerHTML = html;
      var fresh = holder.firstElementChild;
      if (fresh) section.replaceWith(fresh);
      if (push) window.history.pushState({ facets: true }, '', target.pathname + target.search);
    });
  }

  function facetsUrl(form) {
    var params = new URLSearchParams();
    new FormData(form).forEach(function (value, key) {
      if (value !== '') params.append(key, value);
    });
    var query = params.toString();
    return form.getAttribute('action') + (query ? '?' + query : '');
  }

  document.addEventListener('change', function (event) {
    var form = event.target.closest('[data-facets-form]');
    if (!form || event.target.type === 'number') return;
    if (event.target.closest('details')) {
      var details = event.target.closest('details');
      if (details.classList.contains('sort-disclosure__details')) details.open = false;
    }
    loadSection(facetsUrl(form), true);
  });

  var priceChange = debounce(function (form) { loadSection(facetsUrl(form), true); }, 400);
  document.addEventListener('input', function (event) {
    var form = event.target.closest('[data-facets-form]');
    if (form && event.target.type === 'number') priceChange(form);
  });

  document.addEventListener('click', function (event) {
    var link = event.target.closest('.active-facets a');
    if (!link) return;
    event.preventDefault();
    loadSection(link.getAttribute('href'), true);
  });

  window.addEventListener('popstate', function () {
    if ($('[data-section="main-collection"]') || $('[data-section="main-search"]')) loadSection(window.location.href, false);
  });

  // -------------------------------------------------------------------------------------------
  // Predictive search

  var input = $('#SiteSearch');
  var results = $('#predictive-search-results');
  var status = $('[data-predictive-status]');
  var active = -1;
  var lastQuery = '';

  function options() { return $$('[role="option"]', results); }

  function closeResults() {
    if (!results) return;
    results.hidden = true;
    results.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function esc(text) {
    var d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  function renderResults(q, data) {
    var r = data.resources.results;
    var labels = window.__demoStrings || {};
    var groups = [];
    var n = 0;
    var option = function (href, label, extra) {
      n += 1;
      return '<li role="option" id="predictive-search-option-' + n + '" aria-selected="false"><a href="' + esc(href) + '" tabindex="-1">' + label + '</a>' + (extra || '') + '</li>';
    };
    if (r.queries.length) groups.push(['Suggestions', r.queries.map(function (s) { return option(s.url, s.styled_text); })]);
    if (r.products.length) groups.push([labels.products || 'Products', r.products.map(function (p) { return option(p.url, esc(p.title), '<span class="predictive-search__price">' + esc(money(Math.round(parseFloat(p.price) * 100))) + '</span>'); })]);
    if (r.collections.length) groups.push([labels.collections || 'Collections', r.collections.map(function (c) { return option(c.url, esc(c.title)); })]);
    if (r.pages.length) groups.push([labels.pages || 'Pages', r.pages.map(function (pg) { return option(pg.url, esc(pg.title)); })]);
    var total = r.products.length + r.collections.length + r.pages.length;
    var html = groups.map(function (g, i) {
      return '<ul role="group" aria-labelledby="predictive-search-group-' + i + '"><li role="presentation" class="predictive-search__heading" id="predictive-search-group-' + i + '">' + esc(g[0]) + '</li>' + g[1].join('') + '</ul>';
    }).join('');
    html += '<ul role="group" aria-label="Search"><li role="option" id="predictive-search-option-all" aria-selected="false"><a href="' + root + 'search?q=' + encodeURIComponent(q) + '" tabindex="-1">Search for “' + esc(q) + '”</a></li></ul>';
    results.innerHTML = html;
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
    if (status) status.textContent = total ? total + (total === 1 ? ' result' : ' results') + ' for “' + q + '”' : 'No results for “' + q + '”';
  }

  var search = debounce(function () {
    var q = input.value.trim();
    if (!q) { closeResults(); return; }
    lastQuery = q;
    results.setAttribute('aria-busy', 'true');
    var url = root + 'search/suggest.json?q=' + encodeURIComponent(q) + '&resources[type]=query,product,collection,page&resources[limit]=4&resources[limit_scope]=each';
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      results.removeAttribute('aria-busy');
      if (q !== lastQuery || input.value.trim() !== q) return;
      renderResults(q, data);
    });
  }, 150);

  function move(step) {
    var list = options();
    if (!list.length) return;
    if (active >= 0 && list[active]) list[active].setAttribute('aria-selected', 'false');
    active = (active + step + list.length) % list.length;
    list[active].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', list[active].id);
  }

  if (input && results) {
    input.addEventListener('input', search);
    input.addEventListener('focus', function () { if (input.value.trim() && results.innerHTML) { results.hidden = false; input.setAttribute('aria-expanded', 'true'); } });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      else if (event.key === 'Escape') { closeResults(); }
      else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        var link = $('a', options()[active]);
        if (link) window.location.assign(link.href);
      }
    });
    document.addEventListener('click', function (event) {
      if (!event.target.closest('.site-search')) {
        if (!results.hidden) { results.hidden = true; input.setAttribute('aria-expanded', 'false'); }
      }
    });
  }

  // -------------------------------------------------------------------------------------------
  // Localization: the country select submits the form; the language list sets its field first.

  document.addEventListener('change', function (event) {
    var select = event.target.closest('select[data-autosubmit]');
    if (select) select.form.submit();
  });

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('.disclosure__button');
    if (toggle) {
      var list = document.getElementById(toggle.getAttribute('aria-controls'));
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      list.hidden = open;
      return;
    }
    var item = event.target.closest('.disclosure__link');
    if (item) {
      event.preventDefault();
      var form = item.closest('form');
      var field = $('input[name="language_code"]', form);
      field.value = item.getAttribute('data-value');
      form.submit();
      return;
    }
    $$('.disclosure__button[aria-expanded="true"]').forEach(function (button) {
      if (!button.parentElement.contains(event.target)) {
        button.setAttribute('aria-expanded', 'false');
        document.getElementById(button.getAttribute('aria-controls')).hidden = true;
      }
    });
    if (event.target.closest('[data-cookie-preferences]')) {
      event.preventDefault();
      if (window.privacyBanner) window.privacyBanner.showPreferences();
    }
  });

  // A marketing pop-up, shown over the page when it loads, like the ones many stores show.
  $$('dialog[data-popup-on-load]').forEach(function (popup) {
    popup.showModal();
    popup.addEventListener('click', function (event) {
      if (event.target.closest('[data-popup-close]')) popup.close();
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    $$('.disclosure__button[aria-expanded="true"]').forEach(function (button) {
      button.setAttribute('aria-expanded', 'false');
      document.getElementById(button.getAttribute('aria-controls')).hidden = true;
      button.focus();
    });
  });
})();
