# Step definitions

| File | Steps | Covers |
| --- | --- | --- |
| `shopify-store.steps.js` | 6 | The store behind a page, its page type and theme; marketing pop-ups. |
| `shopify-collection.steps.js` | 14 | Filters, the price range, the sort, the product list and its pages. |
| `shopify-product.steps.js` | 14 | The variant picker, the chosen variant, the quantity, adding to the cart, sold out, the dynamic checkout button, the price. |
| `shopify-cart.steps.js` | 20 | The cart drawer, the cart page, lines and note, the store's cart (`/cart.js`), checking out. |
| `shopify-search.steps.js` | 6 | Predictive search and search. |
| `shopify-localization.steps.js` | 6 | The country and language selectors, the store's country, language and currency. |
| `shopify-forms.steps.js` | 8 | The newsletter form (refusals) and the store password page. |
| `shopify-privacy.steps.js` | 7 | The cookie banner, the cookie preferences and the tracking consent. |
| `store-helpers.js` | | Shared plumbing, for these files and for a project's own steps: the wait budgets, running a probe in the page, polling, clicking like a person (closing a pop-up that covers the target), waiting for the store's requests, reading `/cart.js`, the failure messages. It registers no step. |
| `store-probe.js` | | The page side: put into every page, it finds the parts of a storefront by role, label and heading and by the platform's own hooks. It registers no step. |
