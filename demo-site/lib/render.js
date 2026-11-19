'use strict';

// The demo store's theme: our own markup, written for this repository. It carries what the
// platform puts on every storefront (the forms by their actions and field names, the dynamic
// checkout button's container, the globals of window.Shopify and window.ShopifyAnalytics) and,
// for the parts that differ between themes (the cart drawer, the facets, the variant picker),
// plain accessible markup a person finds by role, label and heading.

const S = require('./store');
const { strings } = require('./i18n');
const { SHOP, COUNTRIES, LANGUAGES, SORT_OPTIONS, CONSENT_REGIONS } = require('./catalog');

const esc = (v) => String(v === null || v === undefined ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function hiddenFormInputs(type) {
  return `<input type="hidden" name="form_type" value="${type}"><input type="hidden" name="utf8" value="✓">`;
}

// ---------------------------------------------------------------------------------------------
// Layout

function layout(ctx, page) {
  const t = strings(ctx.lang);
  const c = S.country(ctx.country);
  const cart = S.cartJs(ctx.cart, ctx);
  const globals = {
    shop: SHOP.domain,
    locale: ctx.lang,
    country: ctx.country,
    currency: { active: c.currency, rate: String(c.rate) },
    routes: { root: ctx.root },
    theme: { name: 'Webship demo theme', id: 1, schema_name: 'Webship demo', schema_version: '1.0.0', theme_store_id: null, role: 'main' },
  };
  const meta = Object.assign({ currency: c.currency, page: { pageType: page.pageType, resourceType: page.resourceType || null, resourceId: page.resourceId || null } }, page.meta || {});
  const privacy = { region: `${ctx.country}`, showBanner: CONSENT_REGIONS.includes(ctx.country), root: ctx.root };
  return `<!doctype html>
<html lang="${ctx.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} – ${esc(SHOP.name)}</title>
<link rel="stylesheet" href="/assets/theme.css">
${page.hosted ? '' : `<script>
window.Shopify = window.Shopify || {};
Object.assign(window.Shopify, ${json(globals)});
window.ShopifyAnalytics = window.ShopifyAnalytics || {};
window.ShopifyAnalytics.meta = ${json(meta)};
window.__demoPrivacy = ${json(privacy)};
window.__demoStrings = ${json({ addToCart: t.addToCart, soldOut: t.soldOut, unavailable: t.unavailable, products: t.products, collections: t.collections, pages: t.pagesHeading })};
</script>
<script src="/assets/platform.js" defer></script>
<script src="/assets/theme.js" defer></script>`}
</head>
<body class="template-${esc(page.pageType)}">
<a class="skip-link visually-hidden-focusable" href="#MainContent">${esc(t.skip)}</a>
${page.bare ? '' : header(ctx, cart)}
<main id="MainContent" tabindex="-1">
${page.body}
</main>
${page.bare ? '' : footer(ctx, page)}
${page.bare ? '' : cartDrawer(ctx, cart)}
</body>
</html>`;
}

function header(ctx, cart) {
  const t = strings(ctx.lang);
  const r = ctx.root;
  return `<header class="site-header">
  <a class="site-header__logo" href="${r}">${esc(SHOP.name)}</a>
  <nav class="site-nav" aria-label="${esc(t.mainMenu)}">
    <ul role="list">
      <li><a href="${r}collections/all">${esc(t.shopAll)}</a></li>
      <li><a href="${r}collections/bags">Bags</a></li>
      <li><a href="${r}collections/apparel">Apparel</a></li>
      <li><a href="${r}collections/kitchen">Kitchen</a></li>
      <li><a href="${r}collections/stationery">Stationery</a></li>
    </ul>
  </nav>
  <form class="site-search" action="${r}search" method="get" role="search">
    <label class="visually-hidden" for="SiteSearch">${esc(t.search)}</label>
    <input id="SiteSearch" type="search" name="q" placeholder="${esc(t.searchPlaceholder)}" autocomplete="off"
      role="combobox" aria-expanded="false" aria-controls="predictive-search-results" aria-autocomplete="list" aria-haspopup="listbox">
    <input type="hidden" name="options[prefix]" value="last">
    <button type="submit">${esc(t.search)}</button>
    <div id="predictive-search-results" class="predictive-search" role="listbox" aria-label="${esc(t.searchSuggestions)}" hidden></div>
    <div class="visually-hidden" role="status" aria-live="polite" data-predictive-status></div>
  </form>
  ${cartIcon(ctx, cart)}
</header>`;
}

function cartIcon(ctx, cart) {
  const t = strings(ctx.lang);
  const n = cart.item_count;
  return `<a href="${ctx.root}cart" id="cart-icon" class="cart-icon" aria-haspopup="dialog" aria-controls="CartDrawer" aria-label="${esc(t.cartLabel(n))}">
    <span aria-hidden="true">${esc(t.cart)}</span><span class="cart-icon__count" aria-hidden="true"${n ? '' : ' hidden'}>${n}</span>
  </a>`;
}

function footer(ctx, page) {
  const t = strings(ctx.lang);
  const r = ctx.root;
  const c = S.country(ctx.country);
  const lang = LANGUAGES.find((l) => l.code === ctx.lang);
  const ret = page.returnTo || ctx.pathNoRoot || '/';
  return `<footer class="site-footer">
  ${newsletter(ctx, page.newsletter || {})}
  <form method="post" action="${r}localization" id="localization_form" accept-charset="UTF-8" class="localization-form" enctype="multipart/form-data">
    ${hiddenFormInputs('localization')}<input type="hidden" name="_method" value="put"><input type="hidden" name="return_to" value="${esc(ret)}">
    <div class="localization-form__item">
      <label for="FooterCountry">${esc(t.country)}</label>
      <select id="FooterCountry" name="country_code" data-autosubmit>
        ${COUNTRIES.map((x) => `<option value="${x.code}"${x.code === c.code ? ' selected' : ''}>${esc(x.name)} (${x.currency} ${esc(x.symbol)})</option>`).join('')}
      </select>
    </div>
    <div class="localization-form__item disclosure">
      <h2 class="visually-hidden" id="FooterLanguageLabel">${esc(t.language)}</h2>
      <button type="button" class="disclosure__button" aria-expanded="false" aria-controls="FooterLanguageList" aria-describedby="FooterLanguageLabel">${esc(lang.name)}</button>
      <ul id="FooterLanguageList" class="disclosure__list" role="list" hidden>
        ${LANGUAGES.map((l) => `<li><a class="disclosure__link" href="#" hreflang="${l.code}" lang="${l.code}" data-value="${l.code}"${l.code === ctx.lang ? ' aria-current="true"' : ''}>${esc(l.name)}</a></li>`).join('')}
      </ul>
      <input type="hidden" name="language_code" value="${ctx.lang}">
    </div>
    <noscript><button type="submit">${esc(t.updateCountry)}</button></noscript>
  </form>
  <nav aria-label="${esc(t.footerMenu)}">
    <ul role="list">
      <li><a href="${r}pages/about">About us</a></li>
      <li><a href="${r}pages/shipping">Shipping</a></li>
      <li><a href="${r}policies/privacy-policy">Privacy policy</a></li>
      <li><a href="#" data-cookie-preferences>${esc(t.cookiePreferences)}</a></li>
    </ul>
  </nav>
  <p class="site-footer__copyright">© 2026 ${esc(SHOP.name)}. A demo store for testing; nothing is for sale.</p>
</footer>`;
}

function newsletter(ctx, state) {
  const t = strings(ctx.lang);
  const error = state.error ? (state.error === 'blank' ? t.emailBlank : t.emailInvalid) : '';
  return `<section class="newsletter" aria-labelledby="NewsletterHeading">
    <h2 id="NewsletterHeading">${esc(t.newsletterHeading)}</h2>
    <p>${esc(t.newsletterText)}</p>
    <form method="post" action="${ctx.root}contact#contact_form" id="contact_form" accept-charset="UTF-8" class="newsletter-form">
      ${hiddenFormInputs('customer')}
      <input type="hidden" name="contact[tags]" value="newsletter">
      <div class="field">
        <label for="NewsletterForm--footer">${esc(t.email)}</label>
        <input id="NewsletterForm--footer" type="email" name="contact[email]" value="${esc(state.email || '')}" autocomplete="email" required aria-required="true"${error ? ' aria-invalid="true" aria-describedby="Newsletter-error"' : ''}>
      </div>
      <button type="submit" name="commit">${esc(t.subscribe)}</button>
      ${error ? `<p class="form-message form-message--error" id="Newsletter-error" role="alert">${esc(error)}</p>` : ''}
      ${state.posted ? `<p class="form-message form-message--success" role="status">${esc(t.subscribed)}</p>` : ''}
    </form>
  </section>`;
}

// ---------------------------------------------------------------------------------------------
// The cart drawer and the cart page share their lines.

function cartLines(ctx, cart, where) {
  const t = strings(ctx.lang);
  return `<ul class="cart-lines" role="list">
    ${cart.items.map((item, i) => {
      const n = i + 1;
      const id = `${where}-quantity-${n}`;
      return `<li class="cart-line" data-line="${n}" data-key="${esc(item.key)}">
        <img src="${esc(item.image)}" alt="" width="64" height="64">
        <div class="cart-line__info">
          <a class="cart-line__title" href="${esc(item.url)}">${esc(item.product_title)}</a>
          ${item.variant_title ? `<p class="cart-line__variant">${esc(item.variant_title)}</p>` : ''}
          <p class="cart-line__price">${esc(S.money(item.final_price / S.country(ctx.country).rate, ctx))}</p>
        </div>
        <div class="quantity" data-quantity>
          <label class="visually-hidden" for="${id}">${esc(t.quantityFor(item.product_title))}</label>
          <button type="button" class="quantity__button" name="minus" aria-label="${esc(t.decreaseFor(item.product_title))}">−</button>
          <input class="quantity__input" type="number" id="${id}" name="updates[]" value="${item.quantity}" min="0" data-line="${n}" data-key="${esc(item.key)}">
          <button type="button" class="quantity__button" name="plus" aria-label="${esc(t.increaseFor(item.product_title))}">+</button>
        </div>
        <a class="cart-line__remove" href="${ctx.root}cart/change?line=${n}&amp;quantity=0" data-remove-line="${n}" aria-label="${esc(t.remove(item.product_title))}">✕</a>
        <p class="cart-line__total">${esc(S.money(item.final_line_price / S.country(ctx.country).rate, ctx))}</p>
      </li>`;
    }).join('')}
  </ul>`;
}

function cartFooter(ctx, cart, where) {
  const t = strings(ctx.lang);
  return `<div class="cart-footer">
    <div class="cart-note">
      <label for="${where}-note">${esc(t.note)}</label>
      <textarea id="${where}-note" name="note" rows="2" data-cart-note>${esc(cart.note)}</textarea>
    </div>
    <p class="cart-subtotal"><span>${esc(t.subtotal)}</span> <span data-cart-subtotal>${esc(S.money(cart.total_price / S.country(ctx.country).rate, ctx))}</span></p>
    <p class="cart-taxes">${esc(t.taxes)}</p>
    <button type="submit" name="checkout" class="button button--primary">${esc(t.checkout)}</button>
    <div class="additional-checkout-buttons" data-shopify="dynamic-checkout-cart"></div>
  </div>`;
}

function drawerInner(ctx, cart) {
  const t = strings(ctx.lang);
  if (!cart.items.length) {
    return `<div class="cart-drawer__header">
        <h2 id="CartDrawer-Heading" class="cart-drawer__heading">${esc(t.cartEmpty)}</h2>
        <button type="button" class="cart-drawer__close" data-cart-close aria-label="${esc(t.closeCart)}">✕</button>
      </div>
      <a class="button" href="${ctx.root}collections/all" data-cart-close>${esc(t.continueShopping)}</a>`;
  }
  return `<div class="cart-drawer__header">
      <h2 id="CartDrawer-Heading" class="cart-drawer__heading">${esc(t.yourCart)} <span class="cart-drawer__count">(${cart.item_count})</span></h2>
      <button type="button" class="cart-drawer__close" data-cart-close aria-label="${esc(t.closeCart)}">✕</button>
    </div>
    <form action="${ctx.root}cart" method="post" id="CartDrawer-Form" class="cart-form" data-cart-form>
      ${cartLines(ctx, cart, 'CartDrawer')}
      ${cartFooter(ctx, cart, 'CartDrawer')}
    </form>`;
}

function cartDrawer(ctx, cart) {
  return `<dialog id="CartDrawer" class="cart-drawer" aria-labelledby="CartDrawer-Heading">
    <div class="cart-drawer__inner" data-section="cart-drawer">${drawerInner(ctx, cart)}</div>
  </dialog>`;
}

function cartPage(ctx) {
  const t = strings(ctx.lang);
  const cart = S.cartJs(ctx.cart, ctx);
  const body = cart.items.length
    ? `<section class="cart-page" data-section="main-cart">
        <h1>${esc(t.yourCart)}</h1>
        <form action="${ctx.root}cart" method="post" id="cart" class="cart-form" data-cart-form>
          ${cartLines(ctx, cart, 'CartPage')}
          <button type="submit" name="update" class="button button--secondary">${esc(t.update)}</button>
          ${cartFooter(ctx, cart, 'CartPage')}
        </form>
      </section>`
    : `<section class="cart-page" data-section="main-cart">
        <h1>${esc(t.cartEmpty)}</h1>
        <a class="button" href="${ctx.root}collections/all">${esc(t.continueShopping)}</a>
      </section>`;
  return layout(ctx, { title: t.yourCart, pageType: 'cart', body });
}

// ---------------------------------------------------------------------------------------------
// Product cards, prices, grids

function priceHtml(p, ctx, variant) {
  const t = strings(ctx.lang);
  const v = variant || p.variants.find((x) => x.available) || p.variants[0];
  const compare = v.compareAtPrice;
  if (compare) {
    return `<div class="price price--on-sale">
      <span class="visually-hidden">${esc(t.salePrice)}</span><span class="price__current">${esc(S.money(v.price, ctx))}</span>
      <span class="visually-hidden">${esc(t.regularPrice)}</span><s class="price__compare">${esc(S.money(compare, ctx))}</s>
      <span class="badge">${esc(t.sale)}</span>
    </div>`;
  }
  return `<div class="price"><span class="price__current">${esc(S.money(v.price, ctx))}</span></div>`;
}

function productCard(p, ctx) {
  const t = strings(ctx.lang);
  return `<li class="grid__item">
    <article class="product-card" aria-labelledby="card-title-${p.id}">
      <img src="${esc(S.imageUrl(p))}" alt="" width="300" height="300" loading="lazy">
      <h3 class="product-card__title" id="card-title-${p.id}"><a href="${esc(S.productUrl(p, ctx))}">${esc(p.title)}</a></h3>
      ${priceHtml(p, ctx)}
      ${S.available(p) ? '' : `<span class="badge badge--sold-out">${esc(t.soldOut)}</span>`}
    </article>
  </li>`;
}

function productGrid(list, ctx) {
  const t = strings(ctx.lang);
  if (!list.length) return `<p class="grid-empty">${esc(t.noProducts)}</p>`;
  return `<ul id="product-grid" class="product-grid" role="list">${list.map((p) => productCard(p, ctx)).join('')}</ul>`;
}

function pagination(ctx, result, path, params) {
  const t = strings(ctx.lang);
  if (result.pages < 2) return '';
  const link = (n) => {
    const q = new URLSearchParams(params);
    if (n === 1) q.delete('page'); else q.set('page', String(n));
    const s = q.toString();
    return `${path}${s ? `?${s}` : ''}`;
  };
  const items = [];
  if (result.page > 1) items.push(`<li><a href="${esc(link(result.page - 1))}" aria-label="${esc(t.previous)}">‹</a></li>`);
  for (let n = 1; n <= result.pages; n += 1) {
    items.push(n === result.page
      ? `<li><span aria-current="page" aria-label="${esc(t.page(n))}">${n}</span></li>`
      : `<li><a href="${esc(link(n))}" aria-label="${esc(t.page(n))}">${n}</a></li>`);
  }
  if (result.page < result.pages) items.push(`<li><a href="${esc(link(result.page + 1))}" aria-label="${esc(t.next)}">›</a></li>`);
  return `<nav class="pagination" aria-label="${esc(t.pagination)}"><ul role="list">${items.join('')}</ul></nav>`;
}

// ---------------------------------------------------------------------------------------------
// Collection page, with the facets form (the platform's filter and sort parameters)

function facetsForm(ctx, result, path) {
  const t = strings(ctx.lang);
  const g = result.groups;
  const checkbox = (name, v, label) => {
    const id = `Filter-${name.replace(/[^a-z]/gi, '')}-${String(v.value).replace(/[^a-z0-9]/gi, '')}`;
    return `<li><input type="checkbox" id="${id}" name="${name}" value="${esc(v.value)}"${v.active ? ' checked' : ''}${v.count === 0 && !v.active ? ' disabled' : ''}>
      <label for="${id}">${esc(label)} <span class="facet-count">(${v.count})</span></label></li>`;
  };
  const active = [];
  for (const v of g.availability) if (v.active) active.push([v.key === 'inStock' ? t.inStock : t.outOfStock, 'filter.v.availability', v.value]);
  for (const v of g.types) if (v.active) active.push([v.label, 'filter.p.product_type', v.value]);
  for (const v of g.colors) if (v.active) active.push([v.label, 'filter.v.option.color', v.value]);
  if (g.price.gte !== null || g.price.lte !== null) active.push([`${g.price.gte === null ? '0' : g.price.gte} – ${g.price.lte === null ? g.price.max : g.price.lte}`, 'price', null]);
  const params = new URLSearchParams(ctx.query);
  const removeLink = (name, value) => {
    const q = new URLSearchParams(params);
    q.delete('page');
    if (name === 'price') { q.delete('filter.v.price.gte'); q.delete('filter.v.price.lte'); } else {
      const keep = q.getAll(name).filter((x) => x !== value);
      q.delete(name);
      keep.forEach((x) => q.append(name, x));
    }
    const s = q.toString();
    return `${path}${s ? `?${s}` : ''}`;
  };
  const clearAll = () => {
    const q = new URLSearchParams();
    if (params.get('sort_by')) q.set('sort_by', params.get('sort_by'));
    if (params.get('q')) q.set('q', params.get('q'));
    const s = q.toString();
    return `${path}${s ? `?${s}` : ''}`;
  };
  return `<form id="FacetFiltersForm" class="facets" action="${esc(path)}" method="get" data-facets-form>
    <h2 class="facets__heading">${esc(t.filters)}</h2>
    <fieldset class="facets__group">
      <legend>${esc(t.availability)}</legend>
      <ul role="list">${g.availability.map((v) => checkbox('filter.v.availability', v, v.key === 'inStock' ? t.inStock : t.outOfStock)).join('')}</ul>
    </fieldset>
    <details class="facets__group facets__group--price"${g.price.gte !== null || g.price.lte !== null ? ' open' : ''}>
      <summary>${esc(t.price)}</summary>
      <p class="facets__note">The highest price is ${esc(S.country(ctx.country).symbol)}${g.price.max}</p>
      <div class="facets__price">
        <label for="Filter-Price-GTE">${esc(t.from)}</label>
        <input type="number" id="Filter-Price-GTE" name="filter.v.price.gte" min="0" max="${g.price.max}" step="1" value="${g.price.gte === null ? '' : g.price.gte}" placeholder="0">
        <label for="Filter-Price-LTE">${esc(t.to)}</label>
        <input type="number" id="Filter-Price-LTE" name="filter.v.price.lte" min="0" max="${g.price.max}" step="1" value="${g.price.lte === null ? '' : g.price.lte}" placeholder="${g.price.max}">
      </div>
    </details>
    <fieldset class="facets__group">
      <legend>${esc(t.productType)}</legend>
      <ul role="list">${g.types.map((v) => checkbox('filter.p.product_type', v, v.label)).join('')}</ul>
    </fieldset>
    ${g.colors.length ? `<fieldset class="facets__group">
      <legend>${esc(t.color)}</legend>
      <ul role="list">${g.colors.map((v) => checkbox('filter.v.option.color', v, v.label)).join('')}</ul>
    </fieldset>` : ''}
    <div class="facets__sort">
      <label for="SortBy">${esc(t.sortBy)}</label>
      <select id="SortBy" name="sort_by">
        ${SORT_OPTIONS.map(([value, label]) => `<option value="${value}"${value === result.sortBy ? ' selected' : ''}>${esc(label)}</option>`).join('')}
      </select>
    </div>
    <noscript><button type="submit">${esc(t.apply)}</button></noscript>
    ${active.length ? `<div class="active-facets" aria-label="${esc(t.filters)}">
      ${active.map(([label, name, value]) => `<a class="active-facets__remove" href="${esc(removeLink(name, value))}" aria-label="${esc(t.removeFilter(label))}">${esc(label)} ✕</a>`).join('')}
      <a class="active-facets__clear" href="${esc(clearAll())}">${esc(t.clearAll)}</a>
    </div>` : ''}
  </form>`;
}

function collectionSection(ctx, c, result) {
  const t = strings(ctx.lang);
  const path = `${ctx.root}collections/${c.handle}`;
  return `<div id="MainCollection" data-section="main-collection">
    <div class="collection-layout">
      ${facetsForm(ctx, result, path)}
      <div class="collection-results">
        <p class="product-count" id="ProductCount" role="status">${esc(t.productCount(result.total))}</p>
        ${productGrid(result.products, ctx)}
        ${pagination(ctx, result, path, ctx.query)}
      </div>
    </div>
  </div>`;
}

function collectionPage(ctx, c) {
  const params = new URLSearchParams(ctx.query);
  const result = S.queryCollection(c, params, ctx);
  const body = `<section class="collection">
    <h1>${esc(c.title)}</h1>
    <p class="collection__description">${esc(c.description)}</p>
    ${collectionSection(ctx, c, result)}
  </section>`;
  return { html: layout(ctx, { title: c.title, pageType: 'collection', resourceType: 'collection', body }), section: collectionSection(ctx, c, result) };
}

// ---------------------------------------------------------------------------------------------
// Search results page: the sort here is a list of radio buttons in a disclosure, the other way
// themes build it.

function searchSection(ctx, result) {
  const t = strings(ctx.lang);
  const path = `${ctx.root}search`;
  const label = (SORT_OPTIONS.find(([v]) => v === result.sortBy) || SORT_OPTIONS[0])[1];
  return `<div id="MainSearch" data-section="main-search">
    <form class="search-page__form" action="${path}" method="get" role="search">
      <label class="visually-hidden" for="SearchPageInput">${esc(t.search)}</label>
      <input id="SearchPageInput" type="search" name="q" value="${esc(result.q)}">
      <button type="submit">${esc(t.search)}</button>
    </form>
    ${result.q ? `<p class="search-page__count" role="status">${esc(result.total ? t.resultsFor(result.total, result.q) : t.noResults(result.q))}</p>` : ''}
    ${result.total ? `<form id="SearchSortForm" class="sort-disclosure" action="${path}" method="get" data-facets-form>
      <input type="hidden" name="q" value="${esc(result.q)}">
      <details class="sort-disclosure__details">
        <summary>${esc(t.sortBy)}: <span>${esc(label)}</span></summary>
        <fieldset>
          <legend class="visually-hidden">${esc(t.sortBy)}</legend>
          ${SORT_OPTIONS.map(([value, l]) => `<div class="sort-disclosure__option"><input type="radio" id="SearchSort-${value}" name="sort_by" value="${value}"${value === result.sortBy ? ' checked' : ''}><label for="SearchSort-${value}">${esc(l)}</label></div>`).join('')}
        </fieldset>
      </details>
      <noscript><button type="submit">${esc(t.apply)}</button></noscript>
    </form>` : ''}
    ${result.total ? productGrid(result.products, ctx) : ''}
    ${pagination(ctx, result, path, ctx.query)}
  </div>`;
}

function searchPage(ctx) {
  const t = strings(ctx.lang);
  const result = S.querySearch(new URLSearchParams(ctx.query), ctx);
  const body = `<section class="search-page"><h1>${esc(t.searchResults)}</h1>${searchSection(ctx, result)}</section>`;
  return { html: layout(ctx, { title: t.searchResults, pageType: 'searchresults', body }), section: searchSection(ctx, result) };
}

// ---------------------------------------------------------------------------------------------
// Product page

function variantPicker(p, ctx, current) {
  const t = strings(ctx.lang);
  return p.options.map((o, i) => {
    const valueAvailable = (value) => p.variants.some((v) => v.available && v.options[i] === value
      && v.options.every((x, j) => j === i || x === current.options[j]));
    if (o.name === 'Color') {
      return `<fieldset class="variant-option variant-option--swatches">
        <legend>${esc(o.name)}: <span class="variant-option__value" data-option-value>${esc(current.options[i])}</span></legend>
        ${o.values.map((value, k) => {
          const id = `Option-${p.id}-${i}-${k}`;
          const ok = valueAvailable(value);
          return `<input type="radio" id="${id}" name="${esc(o.name)}" value="${esc(value)}" data-option-index="${i}"${value === current.options[i] ? ' checked' : ''}${ok ? '' : ' data-unavailable'}>
          <label for="${id}" class="swatch${ok ? '' : ' swatch--unavailable'}">${esc(value)}${ok ? '' : `<span class="visually-hidden"> (${esc(t.soldOut)})</span>`}</label>`;
        }).join('')}
      </fieldset>`;
    }
    const id = `Option-${p.id}-${i}`;
    return `<div class="variant-option variant-option--select">
      <label for="${id}">${esc(o.name)}</label>
      <select id="${id}" name="options[${esc(o.name)}]" data-option-index="${i}">
        ${o.values.map((value) => `<option value="${esc(value)}"${value === current.options[i] ? ' selected' : ''}>${esc(value)}${valueAvailable(value) ? '' : ` - ${esc(t.soldOut)}`}</option>`).join('')}
      </select>
    </div>`;
  }).join('');
}

function productPage(ctx, p, variantId) {
  const t = strings(ctx.lang);
  const current = p.variants.find((v) => v.id === variantId) || p.variants.find((v) => v.available) || p.variants[0];
  const formId = `product-form-${p.id}`;
  const productJs = S.productJs(p, ctx);
  const meta = {
    product: {
      id: p.id, gid: `gid://shopify/Product/${p.id}`, vendor: p.vendor, type: p.type, handle: p.handle,
      variants: p.variants.map((v) => ({ id: v.id, price: S.convert(v.price, ctx), name: S.hasOnlyDefaultVariant(p) ? p.title : `${p.title} - ${v.title}`, public_title: S.hasOnlyDefaultVariant(p) ? null : v.title, sku: v.sku })),
    },
    selectedVariantId: String(current.id),
  };
  const body = `<section class="product" data-product-handle="${esc(p.handle)}">
    <nav class="breadcrumbs" aria-label="${esc(t.breadcrumb)}"><ol role="list"><li><a href="${ctx.root}">${esc(t.home)}</a></li><li><a href="${ctx.root}collections/all">${esc(t.shopAll)}</a></li><li><span aria-current="page">${esc(p.title)}</span></li></ol></nav>
    <div class="product__media"><img src="${esc(S.imageUrl(p))}" alt="${esc(p.title)}" width="600" height="600"></div>
    <div class="product__info">
      <p class="product__vendor">${esc(p.vendor)}</p>
      <h1 class="product__title">${esc(p.title)}</h1>
      <div class="product__price" data-product-price>${priceHtml(p, ctx, current)}</div>
      <form method="post" action="${ctx.root}cart/add" id="${formId}" accept-charset="UTF-8" class="product-form" enctype="multipart/form-data" data-product-form novalidate>
        ${hiddenFormInputs('product')}
        <input type="hidden" name="id" value="${current.id}">
        ${variantPicker(p, ctx, current)}
        <div class="quantity product-form__quantity" data-quantity>
          <label for="Quantity-${p.id}">${esc(t.quantity)}</label>
          <button type="button" class="quantity__button" name="minus" aria-label="${esc(t.decrease)}">−</button>
          <input class="quantity__input" type="number" id="Quantity-${p.id}" name="quantity" value="1" min="1">
          <button type="button" class="quantity__button" name="plus" aria-label="${esc(t.increase)}">+</button>
        </div>
        <div class="product-form__error" role="alert" data-product-error hidden></div>
        <button type="submit" name="add" class="button button--primary product-form__submit"${current.available ? '' : ' disabled aria-disabled="true"'}>${esc(current.available ? t.addToCart : t.soldOut)}</button>
        <div data-shopify="payment-button" class="shopify-payment-button"${current.available ? '' : ' hidden'}>
          <shopify-accelerated-checkout><button type="button" class="shopify-payment-button__button" data-buy-now>${esc(t.buyItNow)}</button></shopify-accelerated-checkout>
        </div>
        <input type="hidden" name="product-id" value="${p.id}">
      </form>
      <div class="product__description">${productJs.description}</div>
    </div>
    <script type="application/json" data-product-json>${json(productJs)}</script>
  </section>`;
  return layout(ctx, { title: p.title, pageType: 'product', resourceType: 'product', resourceId: p.id, meta, body });
}

// ---------------------------------------------------------------------------------------------
// Other pages

function homePage(ctx, newsletterState) {
  const t = strings(ctx.lang);
  const featured = ['canvas-tote', 'wool-beanie', 'enamel-mug', 'field-notebook'].map((h) => S.productByHandle.get(h));
  const body = `<section class="hero">
      <h1>Things for the desk and the road</h1>
      <p>Bags, warm things, mugs and paper, made to last.</p>
      <a class="button button--primary" href="${ctx.root}collections/all">${esc(t.shopAll)}</a>
    </section>
    <section class="featured" aria-labelledby="FeaturedHeading">
      <h2 id="FeaturedHeading">Featured products</h2>
      ${productGrid(featured, ctx)}
    </section>`;
  return layout(ctx, { title: SHOP.name, pageType: 'home', body, newsletter: newsletterState, returnTo: '/' });
}

function contentPage(ctx, title, text, pageType, popup) {
  const offer = popup ? `<dialog id="WelcomeOffer" class="offer-popup" aria-labelledby="WelcomeOfferTitle" data-popup-on-load>
      <button type="button" class="offer-popup__close" aria-label="Close dialog" data-popup-close>✕</button>
      <h2 id="WelcomeOfferTitle">Get 10% off your first order</h2>
      <p>Join the list and we send you a code.</p>
      <button type="button" data-popup-close>No, thanks</button>
    </dialog>` : '';
  return layout(ctx, { title, pageType: pageType || 'page', body: `<section class="page"><h1>${esc(title)}</h1><p>${esc(text)}</p></section>${offer}` });
}

function notFoundPage(ctx) {
  const t = strings(ctx.lang);
  return layout(ctx, { title: t.notFound, pageType: '404', body: `<section class="page"><h1>${esc(t.notFound)}</h1><p>${esc(t.notFoundText)}</p><a href="${ctx.root}">${esc(t.home)}</a></section>` });
}

function checkoutPage(ctx, lines) {
  const t = strings(ctx.lang);
  const body = `<section class="checkout-stand-in">
    <h1>${esc(t.checkoutHeading)}</h1>
    <p>${esc(t.checkoutText)}</p>
    <ul role="list" aria-label="Order summary">${lines.map((l) => `<li>${esc(l.quantity)} × ${esc(l.title)}</li>`).join('')}</ul>
    <a href="${ctx.root}cart">${esc(t.backToCart)}</a>
  </section>`;
  // The hosted checkout is the platform's own application, not a storefront page: no store globals.
  return layout(ctx, { title: t.checkoutHeading, pageType: 'checkout', body, bare: true, hosted: true });
}

function passwordPage(ctx, state) {
  const t = strings(ctx.lang);
  const error = state && state.error;
  const body = `<section class="password-page">
    <h1>${esc(t.passwordHeading)}</h1>
    <p class="password-page__message">${esc(SHOP.passwordMessage)}</p>
    <form method="post" action="${ctx.root}password" id="login_form" accept-charset="UTF-8" class="storefront-password-form">
      ${hiddenFormInputs('storefront_password')}
      <h2 id="PasswordHeading">${esc(t.passwordLabel)}</h2>
      ${error ? `<div class="errors" id="PasswordError" role="alert"><ul><li>${esc(t.wrongPassword)}</li></ul></div>` : ''}
      <label for="Password">${esc(t.passwordField)}</label>
      <input type="password" name="password" id="Password" autocomplete="current-password" required${error ? ' aria-invalid="true" aria-describedby="PasswordError"' : ''}>
      <button type="submit" name="commit">${esc(t.enter)}</button>
    </form>
  </section>`;
  return layout(ctx, { title: t.passwordHeading, pageType: 'password', body, bare: true });
}

module.exports = {
  layout, cartPage, drawerInner, cartIcon, collectionPage, searchPage, productPage, homePage, contentPage,
  notFoundPage, checkoutPage, passwordPage, esc,
};
