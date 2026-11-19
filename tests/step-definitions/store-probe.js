'use strict';

// The page side of the pack: a small library put into every page (window.__webshipStore). It
// finds the parts of a storefront the way a person does: by role, label, heading and the
// platform's own hooks (the forms by their actions and field names, the dynamic checkout
// button's container, the globals of window.Shopify and window.ShopifyAnalytics), never by one
// theme's class names. It registers no step.
//
// Every function here runs in the browser: keep it free of Node.js and of closures over this file.

function storeProbe() {
  if (window.__webshipStore && window.__webshipStore.version === 1) return;

  const CART_WORDS = /\b(cart|bag|basket|panier|warenkorb|carrito|carrello|winkelwagen|sacola)\b/i;
  const SEARCH_WORDS = /\b(search|recherche|rechercher|suche|suchen|buscar|cerca|zoeken)\b/i;
  const CLOSE_WORDS = /\b(close|dismiss|fermer|schlie(ß|ss)en|cerrar|chiudi|sluiten)\b|^(×|✕|x)$|no,? thanks/i;

  const norm = (t) => String(t === null || t === undefined ? '' : t)
    .replace(/[‘’‚‛′]/g, "'").replace(/[“”„″]/g, '"').replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const lower = (t) => norm(t).toLowerCase();

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    // A control hidden the accessible way (1 px, clipped) is not something a person sees.
    return r.width > 1 && r.height > 1;
  }

  function labelText(el) {
    if (!el) return '';
    const by = el.getAttribute && el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => n.textContent).join(' ');
      if (norm(t)) return norm(t);
    }
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria && norm(aria)) return norm(aria);
    if (el.labels && el.labels.length) return norm([...el.labels].map((l) => l.textContent).join(' '));
    return '';
  }

  /** The accessible name, near enough: aria-labelledby, aria-label, labels, then the text. */
  function nameOf(el) {
    if (!el) return '';
    const label = labelText(el);
    if (label) return label;
    if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type)) return norm(el.value);
    const text = norm(el.innerText || el.textContent);
    if (text) return text;
    return norm(el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder') || '');
  }

  /** How well a name matches: 3 exact, 2 starts with the wanted text, 1 holds it as words, 0 not. */
  function score(name, wanted) {
    const n = lower(name).replace(/\s*\(\d+\)$/, '').replace(/\s*\(\d+ [^)]*\)$/, '');
    const w = lower(wanted);
    if (!w) return 0;
    if (n === w) return 3;
    if (n.startsWith(w) && !/[a-z0-9]/i.test(n.charAt(w.length))) return 2;
    const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    return re.test(n) ? 1 : 0;
  }

  function best(list, wanted, nameFn) {
    let top = null;
    let topScore = 0;
    for (const el of list) {
      const s = score((nameFn || nameOf)(el), wanted) + (visible(el) ? 0.5 : 0);
      if (s > topScore + 0.25 && s >= 1) { top = el; topScore = s; }
    }
    return top;
  }

  const root = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const endsWithPath = (action, tail) => {
    try { return new URL(action || '', location.href).pathname.replace(/\/+$/, '').endsWith(tail); } catch (e) { return false; }
  };

  function inOverlay(el) {
    return !!(el && el.closest('dialog, [role="dialog"], [aria-modal="true"]'));
  }

  // -------------------------------------------------------------------------------------------
  // The page and the store

  function meta() {
    const m = window.ShopifyAnalytics && window.ShopifyAnalytics.meta;
    return m || null;
  }

  function storefront() {
    const s = window.Shopify || null;
    return {
      shop: s && s.shop ? String(s.shop) : '',
      locale: s && s.locale ? String(s.locale) : '',
      country: s && s.country ? String(s.country) : '',
      currency: s && s.currency && s.currency.active ? String(s.currency.active) : '',
      root: root(),
      theme: s && s.theme ? { name: s.theme.name || '', schema: s.theme.schema_name || '', storeId: s.theme.theme_store_id || null } : null,
      pageType: meta() && meta().page ? meta().page.pageType || '' : '',
      lang: document.documentElement.getAttribute('lang') || '',
      hasGlobals: !!(s && (s.shop || s.routes)),
    };
  }

  // -------------------------------------------------------------------------------------------
  // Overlays: the cart drawer, pop-ups

  function openOverlays() {
    const list = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')];
    return list.filter((el) => visible(el) && !list.some((other) => other !== el && other.contains(el) && visible(other)));
  }

  function holdsCart(el) {
    if (!el) return false;
    if ([...el.querySelectorAll('form')].some((f) => endsWithPath(f.getAttribute('action'), '/cart'))) return true;
    if (el.querySelector('[name="checkout"]')) return true;
    const heading = el.querySelector('h1, h2, h3, [role="heading"]');
    if (heading && CART_WORDS.test(heading.textContent)) return true;
    return CART_WORDS.test(labelText(el)) || /cart|minicart|mini-cart|side-cart/i.test(`${el.id} ${el.getAttribute('class') || ''}`);
  }

  function cartDrawer() {
    const open = openOverlays().filter(holdsCart);
    if (open.length) return open[0];
    // A drawer that is not a dialog: an element named as the cart, shown over the page.
    const named = [...document.querySelectorAll('[id*="cart" i], [class*="cart-drawer" i], [class*="drawer" i]')]
      .filter((el) => visible(el) && holdsCart(el) && /fixed|absolute/.test(getComputedStyle(el).position));
    return named[0] || null;
  }

  /** Store UI: the drawers and panels a step opened on purpose, not a pop-up. */
  function isStoreOverlay(el) {
    if (holdsCart(el)) return true;
    if (el.querySelector('input[name="q"], [role="combobox"]')) return true;
    if ([...el.querySelectorAll('form')].some((f) => endsWithPath(f.getAttribute('action'), '/localization'))) return true;
    if (el.querySelector('input[name^="filter."], [name="sort_by"]')) return true;
    if (/cookie|privacy|consent/i.test(`${el.id} ${labelText(el)} ${el.textContent.slice(0, 300)}`)) return true;
    return false;
  }

  /** Visible modal pop-ups that are not the store's own UI (marketing sign-ups, offers). */
  function popups() {
    return openOverlays().filter((el) => {
      const modal = el.getAttribute('aria-modal') === 'true' || (el.tagName === 'DIALOG' && el.matches(':modal'));
      return modal && !isStoreOverlay(el);
    });
  }

  function closeControl(el) {
    const controls = [...el.querySelectorAll('button, [role="button"], a')].filter(visible);
    return controls.find((b) => CLOSE_WORDS.test(nameOf(b))) || null;
  }

  // -------------------------------------------------------------------------------------------
  // Header controls

  function cartControls() {
    const list = [...document.querySelectorAll('a[href], button, [role="button"], summary')]
      .filter((el) => {
        const href = el.getAttribute('href') || '';
        const byHref = /\/cart\/?(\?.*)?$/.test(href.split('#')[0]);
        const name = nameOf(el);
        return (byHref || CART_WORDS.test(name) || /cart/i.test(el.id || ''))
          && !/close|remove|add to|delete|checkout|check out|continue/i.test(name)
          && !inOverlay(el);
      });
    const inHeader = list.filter((el) => el.closest('header, [role="banner"]'));
    return (inHeader.length ? inHeader : list).filter(visible);
  }

  function searchInputs() {
    return [...document.querySelectorAll('input[type="search"], input[name="q"]')]
      .filter((el) => !el.form || endsWithPath(el.form.getAttribute('action'), '/search') || el.getAttribute('role') === 'combobox');
  }

  function searchOpeners() {
    return [...document.querySelectorAll('button, a[href], summary, [role="button"]')]
      .filter((el) => visible(el) && SEARCH_WORDS.test(nameOf(el)) && !el.closest('form') && !inOverlay(el));
  }

  function suggestionsOf(input) {
    if (!input) return null;
    const id = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
    const byId = id && document.getElementById(id);
    if (byId) return byId;
    const form = input.form || input.closest('form, [role="search"], dialog');
    return (form && form.querySelector('[role="listbox"], predictive-search, [id*="predictive" i]')) || null;
  }

  function suggestionLinks(box) {
    if (!box) return [];
    return [...box.querySelectorAll('a[href]')].filter(visible);
  }

  // -------------------------------------------------------------------------------------------
  // The product form

  function productForms() {
    return [...document.querySelectorAll('form')].filter((f) => endsWithPath(f.getAttribute('action'), '/cart/add'));
  }

  function productForm() {
    const forms = productForms();
    const inMain = forms.filter((f) => f.closest('main, [role="main"]') && !inOverlay(f));
    const pool = inMain.length ? inMain : forms.filter((f) => !inOverlay(f));
    return pool.find((f) => visible(f) || [...f.elements].some(visible)) || pool[0] || null;
  }

  /** The part of the page that holds the product form and its title: where pickers live. */
  function productArea(form) {
    let el = form;
    while (el && el.parentElement && el !== document.body) {
      if (el.querySelector('h1')) return el;
      el = el.parentElement;
    }
    return document.querySelector('main, [role="main"]') || document.body;
  }

  /** The controls of a form, also those outside it that name it with form="…". */
  function controlsOf(form, selector) {
    const own = [...form.querySelectorAll(selector)];
    const linked = form.id ? [...document.querySelectorAll(`${selector}[form="${CSS.escape(form.id)}"]`)] : [];
    return own.concat(linked.filter((el) => !own.includes(el)));
  }

  function addButton(form) {
    const list = controlsOf(form, '[name="add"], button[type="submit"], input[type="submit"], button:not([type])')
      .filter((b) => b.getAttribute('name') !== 'checkout' && !b.closest('.shopify-payment-button, [data-shopify="payment-button"]'));
    return list.find(visible) || list[0] || null;
  }

  function quantityInput(form) {
    const list = controlsOf(form, '[name="quantity"]');
    const area = productArea(form);
    const near = list.length ? list : [...area.querySelectorAll('[name="quantity"]')];
    return near.find(visible) || near[0] || null;
  }

  function paymentButton(form) {
    const area = productArea(form);
    const list = [...area.querySelectorAll('[data-shopify="payment-button"], .shopify-payment-button, shopify-accelerated-checkout')];
    return list.find(visible) || null;
  }

  /** The option groups of the variant picker near the form: fieldsets, selects and radio groups. */
  function optionGroups(form) {
    const area = productArea(form);
    const groups = [];
    for (const fs of area.querySelectorAll('fieldset')) {
      if (fs.querySelector('input[type="radio"]') && !fs.closest('form:not([action$="/cart/add"])')) {
        const legend = fs.querySelector('legend');
        groups.push({ kind: 'radios', el: fs, name: norm(legend ? legend.textContent : labelText(fs)) });
      }
    }
    for (const g of area.querySelectorAll('[role="radiogroup"]')) {
      if (!g.closest('fieldset')) groups.push({ kind: 'roles', el: g, name: labelText(g) });
    }
    for (const s of area.querySelectorAll('select')) {
      if (s.name === 'id' || s.name === 'quantity' || s.closest('fieldset[data-ignore]')) continue;
      if (s.form && !endsWithPath(s.form.getAttribute('action'), '/cart/add') && s.form !== form) continue;
      groups.push({ kind: 'select', el: s, name: labelText(s) || norm((s.closest('fieldset') && s.closest('fieldset').querySelector('legend') || {}).textContent) });
    }
    return groups;
  }

  function optionGroup(form, wanted) {
    const groups = optionGroups(form);
    let top = null;
    let topScore = 0;
    for (const g of groups) {
      const head = g.name.split(':')[0];
      const s = Math.max(score(g.name, wanted), score(head, wanted) + 0.1);
      if (s > topScore && s >= 1) { top = g; topScore = s; }
    }
    return { group: top, names: groups.map((g) => g.name.split(':')[0]) };
  }

  function radioLabel(input) {
    if (input.labels && input.labels.length) return norm([...input.labels].map((l) => l.textContent).join(' '));
    return labelText(input) || norm(input.value);
  }

  function optionChoices(g) {
    if (!g) return [];
    if (g.kind === 'select') return [...g.el.options].map((o) => ({ el: o, value: o.value, label: norm(o.textContent), chosen: o.selected, disabled: o.disabled }));
    if (g.kind === 'roles') return [...g.el.querySelectorAll('[role="radio"]')].map((r) => ({ el: r, value: r.getAttribute('data-value') || nameOf(r), label: nameOf(r), chosen: r.getAttribute('aria-checked') === 'true', disabled: r.getAttribute('aria-disabled') === 'true' }));
    return [...g.el.querySelectorAll('input[type="radio"]')].map((r) => ({ el: r, value: r.value, label: radioLabel(r), chosen: r.checked, disabled: r.disabled }));
  }

  function optionChoice(g, wanted) {
    const choices = optionChoices(g);
    const exact = choices.find((c) => lower(c.value) === lower(wanted));
    if (exact) return exact;
    let top = null;
    let topScore = 0;
    for (const c of choices) {
      const s = Math.max(score(c.label, wanted), score(c.value, wanted));
      if (s > topScore && s >= 2) { top = c; topScore = s; }
    }
    return top;
  }

  function variantId(form) {
    const field = form && controlsOf(form, '[name="id"]')[0];
    return field ? String(field.value) : '';
  }

  function productHandle() {
    const m = meta();
    if (m && m.product && m.product.handle) return m.product.handle;
    const match = location.pathname.match(/\/products\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  // -------------------------------------------------------------------------------------------
  // Product lists (collection, search results)

  function productLinks(scope) {
    return [...(scope || document).querySelectorAll('a[href*="/products/"]')]
      .filter((a) => !a.closest('header, footer, nav, dialog, [role="dialog"], [role="listbox"], [role="banner"], [role="contentinfo"]'));
  }

  function handleOf(a) {
    const m = (a.getAttribute('href') || '').match(/\/products\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  /**
   * The product grid: the list in main that holds the most different products (a list, or a
   * container named as a grid), the innermost one when two hold as many. Without such a list, the
   * innermost element that holds every product link of main.
   */
  function productGrid() {
    const main = document.querySelector('main, [role="main"]') || document.body;
    const links = productLinks(main).filter((a) => handleOf(a));
    if (!links.length) return null;
    const counts = new Map();
    const LIST = 'ul, ol, [role="list"], [id*="product-grid" i], [id*="productgrid" i], [class*="product-grid" i], [class*="grid" i], [class*="list" i]';
    for (const a of links) {
      let el = a.parentElement;
      while (el && el !== main.parentElement) {
        if (el.matches(LIST) && !el.matches('li, [role="listitem"], article') && !/item|card/i.test(el.className || '')) {
          if (!counts.has(el)) counts.set(el, new Set());
          counts.get(el).add(handleOf(a));
        }
        el = el.parentElement;
      }
    }
    let top = null;
    let size = 0;
    for (const [box, handles] of counts) {
      if (handles.size > size || (handles.size === size && top && top.contains(box))) { top = box; size = handles.size; }
    }
    if (top) return top;
    let common = links[0].parentElement;
    while (common && !links.every((a) => common.contains(a))) common = common.parentElement;
    return common || main;
  }

  /** The products of the grid, in order: { handle, title }. */
  function gridProducts() {
    const grid = productGrid();
    if (!grid) return [];
    const seen = new Map();
    for (const a of productLinks(grid)) {
      const h = handleOf(a);
      const name = nameOf(a);
      if (!seen.has(h)) seen.set(h, { handle: h, title: name });
      else if (!seen.get(h).title && name) seen.get(h).title = name;
    }
    for (const item of seen.values()) {
      if (item.title) continue;
      const a = productLinks(grid).find((x) => handleOf(x) === item.handle);
      const card = a && a.closest('li, article, [role="listitem"], div');
      const heading = card && card.querySelector('h2, h3, h4, [class*="title" i]');
      item.title = heading ? norm(heading.textContent) : item.handle;
    }
    return [...seen.values()];
  }

  // -------------------------------------------------------------------------------------------
  // Facets and sort

  function facetInputs() {
    return [...document.querySelectorAll('input[name^="filter."]')].filter((i) => i.type === 'checkbox' || i.type === 'radio');
  }

  /** The heading of the group a filter input is in: legend, summary, labelled region, heading. */
  function facetGroupName(input) {
    const fs = input.closest('fieldset');
    if (fs && fs.querySelector('legend')) return norm(fs.querySelector('legend').textContent);
    const details = input.closest('details');
    if (details && details.querySelector('summary')) return norm(details.querySelector('summary').textContent);
    const labelled = input.closest('[aria-labelledby], [aria-label]');
    if (labelled && labelled !== input && !labelled.matches('form')) return labelText(labelled);
    let el = input.parentElement;
    while (el && !el.matches('form')) {
      const heading = el.querySelector(':scope > h2, :scope > h3, :scope > h4, :scope > button, :scope > [role="heading"]');
      if (heading) return norm(heading.textContent);
      el = el.parentElement;
    }
    return '';
  }

  function facetLabel(input) {
    if (input.labels && input.labels.length) {
      const visibleLabel = [...input.labels].find(visible) || input.labels[0];
      return norm(visibleLabel.textContent);
    }
    return labelText(input) || norm(input.value);
  }

  function findFacet(value, group) {
    const all = facetInputs();
    const scored = all.map((i) => {
      const gs = group ? Math.max(score(facetGroupName(i), group), score(facetGroupName(i).split(':')[0], group)) : 1;
      const vs = Math.max(score(facetLabel(i), value), lower(i.value) === lower(value) ? 3 : 0);
      return { i, s: gs >= 1 && vs >= 2 ? gs * 4 + vs + (visible(i) || (i.labels && [...i.labels].some(visible)) ? 0.5 : 0) : 0 };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    return {
      input: scored.length ? scored[0].i : null,
      groups: [...new Set(all.map(facetGroupName).filter(Boolean).map((n) => n.split(':')[0]))],
      values: [...new Set(all.filter((i) => !group || score(facetGroupName(i), group) >= 1 || score(facetGroupName(i).split(':')[0], group) >= 1).map(facetLabel))],
    };
  }

  function sortControls() {
    return [...document.querySelectorAll('select[name="sort_by"], input[name="sort_by"]')];
  }

  /** The value of a sort option by its label: "Price, low to high" -> "price-ascending". */
  function sortValue(label) {
    for (const c of sortControls()) {
      if (c.tagName === 'SELECT') {
        const o = [...c.options].find((x) => score(x.textContent, label) >= 2 || lower(x.value) === lower(label));
        if (o) return o.value;
      } else if (score(radioLabel(c), label) >= 2 || lower(c.value) === lower(label)) {
        return c.value;
      }
    }
    return null;
  }

  function sortLabels() {
    const out = [];
    for (const c of sortControls()) {
      if (c.tagName === 'SELECT') for (const o of c.options) out.push(norm(o.textContent));
      else out.push(radioLabel(c));
    }
    return [...new Set(out.filter(Boolean))];
  }

  function priceInputs() {
    return {
      gte: [...document.querySelectorAll('input[name="filter.v.price.gte"]')],
      lte: [...document.querySelectorAll('input[name="filter.v.price.lte"]')],
    };
  }

  // -------------------------------------------------------------------------------------------
  // Localization

  function localizationForms() {
    return [...document.querySelectorAll('form')].filter((f) => endsWithPath(f.getAttribute('action'), '/localization'));
  }

  /** The choices of the country or language selector: { code, name, el, kind, form }. */
  function localizationChoices(kind) {
    const field = kind === 'language' ? 'language_code' : 'country_code';
    const out = [];
    for (const form of localizationForms()) {
      const select = form.querySelector(`select[name="${field}"]`);
      if (select) {
        for (const o of select.options) out.push({ code: o.value, name: norm(o.textContent), el: o, kind: 'select', form, select });
        continue;
      }
      if (!form.querySelector(`[name="${field}"]`)) continue;
      const items = [...form.querySelectorAll('[data-value], button[name], a[hreflang]')]
        .filter((el) => (el.getAttribute('data-value') || el.value || el.getAttribute('hreflang')) && (!el.name || el.name === field));
      for (const el of items) {
        const code = el.getAttribute('data-value') || el.value || el.getAttribute('hreflang');
        if (kind === 'language' ? !/^[a-z]{2}(-[a-z]{2,4})?$/i.test(code) : !/^[A-Z]{2}$/.test(code)) continue;
        out.push({ code, name: norm(el.textContent), el, kind: 'list', form });
      }
    }
    return out;
  }

  /**
   * The selector's current value: the selected option, the hidden field, or the entry marked
   * current. Only the selectors a person sees count (a form with a visible control), so a hidden
   * form that suggests another country (a geolocation pop-up's) does not; when none is visible,
   * every form counts.
   */
  function localizationCurrent(kind) {
    const field = kind === 'language' ? 'language_code' : 'country_code';
    const read = (form) => {
      const values = [];
      const select = form.querySelector(`select[name="${field}"]`);
      if (select) return [select.value];
      const hidden = form.querySelector(`input[name="${field}"]`);
      if (hidden) values.push(hidden.value);
      const current = form.querySelector('[aria-current="true"][data-value], [aria-current="page"][data-value], [aria-selected="true"][data-value]');
      if (current) values.push(current.getAttribute('data-value'));
      return values;
    };
    const forms = localizationForms().filter((f) => f.querySelector(`[name="${field}"]`));
    const seen = forms.filter((f) => [...f.querySelectorAll('select, button, summary, a, [role="button"], [role="combobox"]')].some(visible));
    // A form in a pop-up (a dialog, or a box fixed over the page) may suggest another country:
    // the page's own selectors come first.
    const overPage = (f) => {
      if (inOverlay(f)) return true;
      for (let el = f.parentElement; el && el !== document.body; el = el.parentElement) {
        if (getComputedStyle(el).position === 'fixed' && !el.matches('header, [role="banner"]') && !el.closest('header, [role="banner"]')) return true;
      }
      return false;
    };
    const own = seen.filter((f) => !overPage(f));
    const values = (own.length ? own : seen.length ? seen : forms).flatMap(read);
    return [...new Set(values.filter(Boolean))];
  }

  // -------------------------------------------------------------------------------------------
  // Newsletter, password, cookie banner

  function newsletterForms() {
    return [...document.querySelectorAll('form')].filter((f) => {
      const type = f.querySelector('input[name="form_type"]');
      const email = f.querySelector('[name="contact[email]"]');
      return email && ((type && type.value === 'customer') || endsWithPath(f.getAttribute('action'), '/contact'));
    }).filter((f) => {
      const type = f.querySelector('input[name="form_type"]');
      return !type || type.value === 'customer';
    });
  }

  function newsletterForm() {
    const forms = newsletterForms();
    return forms.find((f) => visible(f.querySelector('[name="contact[email]"]'))) || forms[0] || null;
  }

  function formErrors(form) {
    if (!form) return [];
    const els = [...form.querySelectorAll('[role="alert"], .errors, .form__message, [id*="error" i], [class*="error" i]')]
      .filter((el) => visible(el) && norm(el.textContent));
    const field = form.querySelector('[aria-invalid="true"]');
    const described = field && field.getAttribute('aria-describedby');
    if (described) for (const id of described.split(/\s+/)) { const d = document.getElementById(id); if (d && visible(d)) els.push(d); }
    return [...new Set(els.map((el) => norm(el.textContent)))];
  }

  function passwordForm() {
    return [...document.querySelectorAll('form')].find((f) => {
      const type = f.querySelector('input[name="form_type"]');
      return (type && type.value === 'storefront_password') || (endsWithPath(f.getAttribute('action'), '/password') && f.querySelector('input[name="password"]'));
    }) || null;
  }

  function cookieBanner() {
    const own = document.getElementById('shopify-pc__banner');
    if (own && visible(own)) return own;
    const candidates = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="region"], dialog[open], aside, section, div[id*="cookie" i], div[class*="cookie" i], div[id*="consent" i], div[class*="consent" i]')]
      .filter((el) => visible(el) && /cookie|privacy|consent/i.test(`${labelText(el)} ${(el.textContent || '').slice(0, 600)}`))
      .filter((el) => [...el.querySelectorAll('button, [role="button"], a')].some((b) => visible(b) && /accept|agree|allow|ok\b/i.test(nameOf(b))))
      .filter((el) => !el.querySelector('[name="contact[email]"], form[action*="/cart"]'));
    candidates.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    return candidates[0] || null;
  }

  function cookiePreferences() {
    const own = document.getElementById('shopify-pc__prefs__dialog');
    if (own && visible(own)) return own;
    return openOverlays().find((el) => /cookie|privacy|consent/i.test(`${labelText(el)} ${(el.textContent || '').slice(0, 300)}`) && el.querySelector('input[type="checkbox"]')) || null;
  }

  function consent() {
    const api = window.Shopify && window.Shopify.customerPrivacy;
    if (!api || typeof api.currentVisitorConsent !== 'function') return null;
    try { return api.currentVisitorConsent(); } catch (e) { return null; }
  }

  // -------------------------------------------------------------------------------------------
  // Settled: no transition or animation running in an element.

  function settled(el) {
    if (!el || !el.getAnimations) return true;
    return el.getAnimations({ subtree: true }).every((a) => a.playState !== 'running' || (a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity));
  }

  let marks = 0;
  /** Tag an element so that Node can find it with a locator: returns its selector. */
  function mark(el) {
    if (!el) return null;
    if (!el.hasAttribute('data-webship-store')) { marks += 1; el.setAttribute('data-webship-store', String(marks)); }
    return `[data-webship-store="${el.getAttribute('data-webship-store')}"]`;
  }

  window.__webshipStore = {
    version: 1, mark, norm, lower, visible, nameOf, labelText, score, best, root, endsWithPath, inOverlay, meta, storefront,
    openOverlays, cartDrawer, holdsCart, popups, closeControl, cartControls, searchInputs, searchOpeners, suggestionsOf,
    suggestionLinks, productForms, productForm, productArea, controlsOf, addButton, quantityInput, paymentButton,
    optionGroups, optionGroup, optionChoices, optionChoice, variantId, productHandle, productLinks, handleOf,
    productGrid, gridProducts, facetInputs, facetGroupName, facetLabel, findFacet, sortControls, sortValue, sortLabels,
    priceInputs, radioLabel, localizationForms, localizationChoices, localizationCurrent, newsletterForms, newsletterForm,
    formErrors, passwordForm, cookieBanner, cookiePreferences, consent, settled,
  };
}

module.exports = { storeProbe };
