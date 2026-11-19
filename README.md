<p align="center"><img src="https://raw.githubusercontent.com/webship/shopify-steps/2.0.x/assets/logo.svg" alt="Shopify logo" width="96"></p>

# shopify-steps

Cucumber step definitions for online stores built on Shopify, for
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/shopify-steps` covers what a shopper does on a storefront, whatever
its theme: the collection page (its filters and its sort), the product page (the
variant picker, the quantity, adding to the cart, the sold-out state, the
dynamic checkout button), the cart drawer and the cart page (quantities, removing
a line, the order note), predictive search, the country and language selectors,
the newsletter form (through its refusals), the cookie banner and the visitor's
tracking consent, and the password page of a store that is not open yet. It
stops at the checkout button: the checkout and the customer accounts are the
platform's own hosted pages.

Themes differ: one draws a cart drawer, another a cart page; one puts its filters
in a side panel, another in a drawer behind a "Filter" button; one draws a size
as buttons, another as a drop-down list. The steps find those parts the way a
person does, by their role, label and heading, and lean on what the platform
puts on every storefront, whatever the theme: its forms by their actions and
field names (`/cart/add` with `id` and `quantity`, `/cart` with `updates[]` and
`note`, `/localization` with `country_code` and `language_code`, the newsletter
form with `contact[email]`, the storefront password form), the filter and sort
parameters of its collections (`filter.v.availability`, `filter.v.price.gte`,
`sort_by` ...), the storefront Ajax API (`/cart.js`, `/cart/add.js`,
`/cart/change.js`, `/search/suggest.json`), the dynamic checkout button's
container, the Customer Privacy API and the store's globals
(`window.Shopify`, `window.ShopifyAnalytics`). No step reads one theme's class
names, and no step sleeps for a fixed time: each waits for the store's own
answer (the request it sends, the address a theme pushes, the form's variant
field, a drawer that has opened and stopped moving).

No step phrase names the platform or a theme: a scenario reads `When I choose
"Navy" for "Color"`, `When I add the product to the cart` and `Then the cart
should contain 2 of "Wool Beanie"`.

CI starts the pack's demo store (`demo-site/`, see [The demo
store](#the-demo-store)) with DDEV on the runner and runs the whole suite against
it twice, then the assertions that must fail; and it runs the suite once more
against the same store served by its own small server, without a container. See
[`.github/workflows/test.yml`](.github/workflows/test.yml). The steps are also
proven, read-only, on real public stores: [`tests/live/`](tests/live/).

## From nothing to a green run

What the machine needs: git, Node.js 20 or later with npm, and, for the first way
below, Docker with [DDEV](https://ddev.com) (or another container tool).

**1. The store.** A store on the platform is hosted by the platform, so the pack
ships a demo store to start with: [`demo-site/`](demo-site/), our own pages and a
small server that stands in for the platform's side of a storefront (see [The demo
store](#the-demo-store)). It needs a server that answers the cart and search calls
with JSON, so it runs one of two ways, and both give the full store:

- in a container, with DDEV (the demo has its project in `demo-site/.ddev`; any
  container tool that runs Node.js 20 can run `node server.js` the same way):

  ```bash
  git clone https://github.com/webship/shopify-steps.git
  cd shopify-steps/demo-site
  ddev start
  ```

  The store answers at `http://shopify-steps-demo.ddev.site`.

- without a container, with the stand-in's own server (Node.js, no dependencies),
  from the `shopify-steps` folder; leave it running in its own terminal:

  ```bash
  git clone https://github.com/webship/shopify-steps.git
  cd shopify-steps
  npm run demo:serve
  ```

  The store answers at `http://127.0.0.1:8080` (`PORT=8090 npm run demo:serve`
  picks another port).

A plain static server, such as `npx http-server demo-site`, is not enough: it shows
no page (the server renders them) and answers no cart or search call.

The Webship Workspace has no plugin for this platform: its stores are hosted, so
there is nothing to build, and this demo store is the local target.

**2. A test project**, in another folder:

```bash
mkdir shopify-tests && cd shopify-tests
npm init -y
npm install --save-dev webship-js @webship-js/shopify-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/`
folders with a first feature and the `npm test` scripts, and installs Chromium.
npm usually runs it already when it installs webship-js; a second run changes
nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files
of webship-js and of the pack, the tags that keep the lanes of this repository out
of a normal run, and the address of the store. The suite needs no account.

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/shopify-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail and the checks of real stores stay out
    // of a normal run.
    tags: 'not @wip and not @must-fail and not @live',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://shopify-steps-demo.ddev.site',
      // Browser errors are reported, not failed. The demo store raises none; a real store's
      // third-party scripts often do.
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
    },
  },
};
```

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A product goes into the cart
    Given I am on "/products/canvas-tote"
    When I choose "Black" for "Color"
    And I add the product to the cart
    Then the cart drawer should be open
    And the cart should contain 1 of "Canvas Tote"

  Scenario: Suggestions while typing
    Given I am on the homepage
    When I type "tote" in the search box
    Then the search suggestions should list "Canvas Tote"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the store:
`http://shopify-steps-demo.ddev.site` for the demo started with DDEV, and
`http://127.0.0.1:8080` for the one `npm run demo:serve` serves.

```bash
LAUNCH_URL=http://shopify-steps-demo.ddev.site npm test
```

A green first run prints every step, then the summary (the starter feature of
`npx init-webship-js` and the two scenarios above, passed) and the HTML report it
wrote:

```
3 scenarios (3 passed)
10 steps (10 passed)
0m03.494s (executing steps: 0m03.461s)
[webship-js] HTML report → …/shopify-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also
ship in the package, under `node_modules/@webship-js/shopify-steps/tests/features/`):
together they use every step of the pack, against the pages of the demo store.

### On a store of your own

Point `LAUNCH_URL` at the store and write the features from what its pages show:
the titles of its products, the names of its options and filters, the words of its
buttons. Most steps only read the store and fit any store; the ones that change
something belong on a store you own and test, a staging copy or a development
store:

- the cart steps that add, change or remove (`When I add the product to the cart`,
  `When I change the quantity of …`, `When I remove …`, `When I write the cart
  note …`, `Given the cart holds …`) change the cart of the test's own browser,
  and nothing else;
- `When I sign up for the newsletter with …` sends the store's customer form: use
  it only with addresses the store must refuse (a sign-up that goes through makes
  a customer record);
- `When I enter the store with the password …` sends the password form of a store
  that is not open yet;
- `When I check out` and `When I press the dynamic checkout button` leave the store
  for the platform's checkout, where the pack stops: no order is placed.

A store that is password protected sends every page to its password page: enter it
first (`When I enter the store with the password "…"`). Many stores show a
marketing pop-up over their pages: the steps close one that covers what they click,
the way a person does, and `When I close any pop-ups` closes it on purpose.

### What the suite tests

The features of this repository run every step of the pack against the demo
store, in CI on every change: the store behind a page (its globals, the type of
page, its theme), a marketing pop-up closed by hand and by a click it covered; a
collection filtered by availability, by type and colour together, by a price
range, then a filter removed and all cleared; the sort of a collection (a
drop-down list) and of the search results (a list of choices behind a
disclosure), a filter that keeps the sort; the pages of a collection; the variant
picker drawn as buttons and as a drop-down list, the chosen variant and whether it
can be bought, a variant sold out and a product sold out in every variant, the
price that follows the variant and a sale price, the quantity with its buttons and
its field, adding to the cart, the store's refusal of more than its stock, the
dynamic checkout button and where it leads; the cart drawer (open, close, empty,
its lines, a quantity changed), the cart page (a line removed, a quantity set to
zero), the order note, the cart's count, items and total, checking out; search
suggestions while typing (products, collections, pages), choosing one, Escape, a
search and its results, a search that finds nothing; a country and its currency, a
language from a list behind a disclosure, a country kept on the next page with the
cart in its currency; the newsletter form (refused by the browser, refused by the
store); the cookie banner (accepted, declined, preferences chosen and changed from
the store's own link) and the tracking consent; and the password page of a store
that is not open yet (a wrong password, the right one, an open store).
[`tests/must-fail/`](tests/must-fail/) asserts the other side of every assertion:
each must fail, with its message and a hint.

Not covered, and said so: the checkout and the customer accounts (sign-in,
orders, addresses) live on the platform's own hosted pages, so the pack stops at
the button that leaves the store; gift cards, discounts at the checkout, selling
plans (subscriptions), product bundles, the store's blog, its contact form, the
theme editor and the store's admin. A successful newsletter sign-up is not tested
(it makes a customer record).

## Run the steps against real stores

[`tests/live/`](tests/live/) holds read-only checks of the steps on real public
stores, to prove that they read what real themes produce and not only what
`demo-site/` serves: a store on a free theme of the platform, one on a copy of its
newest free theme, one on a paid theme and one on a theme of the brand's own. The
file name is the store: `tests/live/ugmonk.com.feature` runs against
`https://ugmonk.com`.

```bash
npm run test:live                      # every store, one scenario at a time
npm run test:live -- www.thesill.com   # one store
```

They only read: they never add to a cart, sign in, place an order or send a form
(choosing a size, sorting a collection or typing in a search box loads pages and
suggestions, and nothing else). Each scenario loads one page, and the runner waits
eight seconds between scenarios (`LIVE_PAUSE_MS`). They are run by hand, never in
CI on every push: the stores belong to their owners, change without notice and may
look different from another country (the checks were written from outside the US).
On GitHub, the workflow [`live.yml`](.github/workflows/live.yml) runs them only when
started by hand (one store, or all). When a check fails because a store changed,
update the check, not the step.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A store on the platform, or the demo store of this repository

## Install

```bash
npm install --save-dev @webship-js/shopify-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`,
   after webship-js's own:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/shopify-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the store:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-store.example.com',
   },
   ```

3. Write a feature from what the store's pages show:

```gherkin
Feature: The winter collection
  Scenario: Only what can be bought, cheapest first
    Given I am on "/collections/winter"
    When I filter the products by "In stock" under "Availability"
    And I sort the products by "Price, low to high"
    Then the products should be sorted by "Price, low to high"
    And the product list should include "Wool Beanie"
```

Run `npx cucumber-js --dry-run` once: it reports any undefined or ambiguous step
before a browser opens. The pack loads beside webship-js's own steps, the visual
comparison pack (`@webship-js/diffy-steps`) and the step pack for the components of
any site (`@webship-js/bootstrap-steps`) without an ambiguous step; the check of this
repository loads the last one too. It shares its shop phrases on purpose with the
step packs of other store and site platforms (`@webship-js/magento-steps`,
`prestashop-steps`, `squarespace-steps`, `webflow-steps`, `odoo-steps` and
`hubspot-cms-steps`): `I add the product to the cart`, `the cart should contain "…"`,
`the product price should be "…"`, the pages of `the product list`, `I search the
store for "…"`, `I remove "…" from the cart`, `I accept the cookies` and `I should see
the cookie banner`, among others. A project that tests the stores of two platforms
loads each platform's pack in a profile of its own.

## Test users

None. The demo store has no sign-in, and the steps need no account on any store:
the customer accounts are the platform's own hosted pages, which the pack does not
cover. `cucumber.js` lists no accounts and no scenario signs in:

```json
{}
```

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `shopify-store.steps.js` (6): the store behind a page

- `Then the page should be a storefront page`
- `Then the page should belong to the store "webship-demo-store.example"`
- `Then the page type should be "product"`
- `Then the store should use the theme "Webship demo"`
- `When I close any pop-ups`
- `Then no pop-up should cover the page`

### `shopify-collection.steps.js` (14): filters, sort and pages

- `When I filter the products by "In stock" under "Availability"`
- `When I remove the "In stock" filter`
- `When I clear all filters`
- `Then the products should be filtered by "Navy" under "Color"`
- `When I filter the products by price from 10 to 30`
- `Then the price filter should be from 10 to 30`
- `When I sort the products by "Price, low to high"`
- `Then the products should be sorted by "Price, low to high"`
- `Then the product list should include "Canvas Tote"`
- `Then the product list should show 6 products`
- `Then the product list should show these products in order:` (a table of titles)
- `When I go to page 2 of the product list`
- `When I go to the next page of the product list`
- `Then the product list should be on page 2`

### `shopify-product.steps.js` (14): the product page

- `When I choose "Navy" for "Color"`
- `Then "Navy" should be chosen for "Color"`
- `Then the selected variant should be "S/M / Navy"`
- `Then the selected variant should be available`
- `When I set the quantity to 3`
- `When I increase the quantity`
- `Then the quantity should be 3`
- `When I add the product to the cart`
- `Then the product should be sold out`
- `Then I should be able to add the product to the cart`
- `Then adding to the cart should be refused with "You can't add more Canvas Tote - Natural to the cart."`
- `Then I should see the dynamic checkout button`
- `When I press the dynamic checkout button`
- `Then the product price should be "$24.00"`

### `shopify-cart.steps.js` (20): the cart drawer, the cart page and the cart

- `When I open the cart drawer`
- `When I close the cart drawer`
- `Then the cart drawer should be open`
- `Then the cart drawer should list "Wool Beanie"`
- `Then the cart drawer should be empty`
- `When I go to the cart page`
- `Then I should be on the cart page`
- `When I change the quantity of "Wool Beanie" to 2 in the cart`
- `When I remove "Wool Beanie" from the cart`
- `When I write the cart note "Gift wrap, please"`
- `Then the cart note should be "Gift wrap, please"`
- `Then the cart should be empty`
- `Then the cart should hold 2 items`
- `Then the cart should contain "Wool Beanie"`
- `Then the cart should contain 2 of "Wool Beanie"`
- `Then the cart total should be "$48.00"`
- `Then the cart count should be 2`
- `Given the cart holds 2 of the product "wool-beanie" in "S/M / Navy"`
- `When I check out`
- `Then I should be on the checkout`

### `shopify-search.steps.js` (6): predictive search and search

- `When I type "tote" in the search box`
- `Then the search suggestions should be shown`
- `Then the search suggestions should list "Canvas Tote"`
- `When I choose the search suggestion "Canvas Tote"`
- `When I close the search suggestions`
- `When I search the store for "tote"`

### `shopify-localization.steps.js` (6): the country and language selectors

- `When I choose "Canada" as the country`
- `Then the store country should be "Canada"`
- `Then the store language should be "Français"`
- `Then the store currency should be "CAD"`
- `Then the country selector should list "Canada"`
- `Then the country selector should show the current country`

### `shopify-forms.steps.js` (8): the newsletter form and the store password page

- `Then I should see the newsletter form`
- `Then the newsletter email field should be required`
- `When I sign up for the newsletter with "jane@example"`
- `Then the newsletter sign-up should be refused with "Email is invalid."`
- `Then I should see the store password page`
- `When I enter the store with the password "webship-demo"`
- `Then the store password should be refused with "Wrong password."`
- `Then I should be in the store`

### `shopify-privacy.steps.js` (7): the cookie banner and the tracking consent

- `Then I should see the cookie banner`
- `When I accept the cookies`
- `When I open the cookie preferences`
- `When I allow the "Analytics" cookies`
- `When I save the cookie preferences`
- `Then the tracking consent for "analytics" should be "yes"`
- `Then the visitor's tracking consent should be decided`

Every assertion takes `should` or `should not` where both make sense, every action
takes `I`, `we` or no pronoun, and every failure is a short message with what was
expected, what was found and a hint, not a stack trace. Text, links, buttons, the
plain filling of fields, the address, the keyboard and the accessibility audit are
webship-js's own steps (`I should see "…"`, `I press "…"`, `I fill in "…" with
"…"`, `I am on "…"`, `the page should have no serious accessibility violations`).

## How the steps find things and wait

| Area | What the steps read |
| --- | --- |
| The store | `window.Shopify` (`shop`, `locale`, `country`, `currency.active`, `routes.root`, `theme`) and `window.ShopifyAnalytics.meta` (`page.pageType`, `product.variants`), which the platform puts on every storefront page. Paths follow `Shopify.routes.root`, so a store with a language or market prefix (`/fr/`, `/en-ca/`) works. |
| Collection | Filter boxes by the heading of their group (a fieldset's legend, a disclosure's summary) and the label of their value, a count such as "(7)" ignored; the platform's parameters (`filter.v.availability`, `filter.p.product_type`, `filter.v.option.<name>`, `filter.v.price.gte` and `.lte`) in the address once the theme has applied them. The sort by the name of its option, through the theme's control for `sort_by`: a drop-down list, a list of choices, or the options of a menu. A closed group, a filter drawer or a sort menu is opened first, with the button that controls it. |
| Product list | The list in the page's main area that holds the most different products (links to `/products/…`), in order, named by their link or heading. |
| Pages of a list | The pagination's links (a navigation landmark named for pages), the `page` of the address and the page marked `aria-current="page"`. |
| Product | The product form (`form[action$="/cart/add"]`) and its `id` field, which holds the chosen variant; the variant picker near it: each option a fieldset by its legend ("Color: Grey" counts as "Color"), a radio group by its label, or a drop-down list by its label; the variant's data from `ShopifyAnalytics.meta.product` and `GET /products/<handle>.js`; the add button (`[name="add"]` or the form's submit button), disabled when sold out; the quantity field (`[name="quantity"]`) and its plus and minus buttons; the dynamic checkout button's container (`[data-shopify="payment-button"]`, `.shopify-payment-button`, `shopify-accelerated-checkout`); the first price of the product's price block, a crossed-out price left out. |
| Cart | The header's cart control (named as the cart or bag, or leading to `/cart`); the drawer as the open dialog or panel that holds the cart (a form posting to `/cart`, a `checkout` button, or a heading about the cart), done moving; its lines (a product link with a quantity field), their remove buttons; the note field (`note`); the checkout button (`name="checkout"`); and the store's own record of the cart, `GET /cart.js`, for the count, the items, the total and the note. |
| Search | The search field of the store's search form (`/search`), opened with the header's "Search" button first if it is hidden; the suggestions as the element the field controls (`aria-controls`), and their links; the store's request `GET /search/suggest` (or `/search/suggest.json`) as the signal that they came. |
| Selectors | The localization form (`form[action$="/localization"]`): `country_code` and `language_code`, drawn as a drop-down list or as a list of entries (`data-value`) behind a disclosure button; the store's answer in `Shopify.country`, `Shopify.locale` and `Shopify.currency.active`. |
| Forms | The newsletter form (`contact[email]`, `form_type` "customer"): the browser's own refusal (the field invalid) or the store's error in the form; the storefront password form (`password`, `form_type` "storefront_password"). |
| Privacy | The platform's banner (`#shopify-pc__banner` and its buttons) or any dialog or region about cookies with an accept button; the preferences as a dialog about cookies with a box per purpose; the consent from `Shopify.customerPrivacy.currentVisitorConsent()`. |
| Pop-ups | A modal dialog that is not the store's own (no cart, search, filters, selectors or cookie choices in it), closed with its close button or Escape. |

- **Waits.** An action waits for the store's answer to its request (`POST /cart/add`,
  `/cart/change`, `/cart/update`, `/localization`, `/contact`, `/password`, `GET
  /search/suggest`), for the address the theme pushes (a filter, a sort, a page),
  for the form's variant field, or for a drawer to open and stop moving (no running
  animation). An assertion looks at the page every 50 milliseconds, from Node.js,
  until it holds, for at least ten seconds (`minWaitTime.page` raises it;
  `STORE_WAIT_MS` sets it outright).
- **Failures say what was found.** `Expected the selected variant "L/XL / Navy", but
  it is "S/M / Grey".` with the page's address and a hint on where to look.

## Testing this package

```bash
npm install
npm run demo:serve &       # the demo store at http://127.0.0.1:8080 (or: cd demo-site && ddev start)
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
LAUNCH_URL=http://127.0.0.1:8080 npm test                # the suite
LAUNCH_URL=http://127.0.0.1:8080 npm run test:must-fail  # assertions that must fail, each with its message
npm run test:live -- ugmonk.com                          # read-only checks of one real store
```

`tests/must-fail/` holds scenarios that assert something that is not true on the
demo store. `npm run test:must-fail` runs them and checks that each one fails at its
last step, with the message it announces and a hint: a step that cannot fail proves
nothing. It runs them with a wait of 3 seconds (`STORE_WAIT_MS`), since each of them
waits its whole budget.

`LAUNCH_URL` points the suite at another copy of the store; `npx cucumber-js
tests/features/cart.feature` runs one feature and `npx cucumber-js
tests/features/cart.feature:<line>` one scenario (the line of its `Scenario:`);
`FEATURES` runs a subset too (`FEATURES=tests/features/cart.feature npm test`);
`CUCUMBER_TAGS=@critical` runs the smoke lane; `HEADLESS=false` shows the browser.

The suite leaves the store as it found it: every browser context gets a cart of its
own, which the demo keeps in memory, and every other choice (a country, a language,
cookies) lives in the context's cookies.

## The demo store

[`demo-site/`](demo-site/) is our own code, under the licence of this pack: a demo
store with eight products, written from the platform's public documentation of what
it puts on every storefront, whatever the theme. No code, markup, style or script
of the platform's own themes is in it: their licences allow their use only to build
themes for the platform, and one of them forbids passing on anything made from it.

What is a stand-in:

| Part | What stands in for the platform |
| --- | --- |
| `server.js` and `lib/` | The platform's side of a storefront: it renders the pages of the demo theme, keeps one cart per `cart` cookie in memory, and answers the storefront Ajax API (`GET /cart.js`, `POST /cart/add.js`, `/cart/change.js`, `/cart/update.js`, `/cart/clear.js`, `GET /products/<handle>.js`, `GET /search/suggest.json`) with the shapes and the errors the documentation gives, the Section Rendering API (`?section_id=`, `?sections=`, and the `sections` of the cart calls), and the forms by their actions (`/cart/add`, `/cart`, `/cart/change`, `/localization`, `/contact`, `/password`). Collections filter and sort with the platform's parameters, and page by six. |
| A second storefront under `/locked/` | A store that is not open yet: every page leads to its password page until the password `webship-demo` is given. |
| `/checkouts/cn/<token>` | The platform's hosted checkout: a page that says so and lists what it would sell. No order is placed. |
| `assets/platform.js` | The platform's scripts on the page: `Shopify.loadFeatures`, the Customer Privacy API (`Shopify.customerPrivacy`, its consent kept in a cookie), and a cookie banner with its preferences, shown to visitors whose country (from the selector) is in the EEA or the UK; the platform finds the visitor's region by itself. |
| The dynamic checkout button | A plain "Buy it now" button in the platform's container (`[data-shopify="payment-button"]`), which goes to the checkout stand-in with the chosen variant. |
| Prices | Four countries (US, CA, DE, GB) at fixed exchange rates, and two languages (English, and French under `/fr/`). |

`assets/theme.js` and `assets/theme.css` are the demo theme itself: the cart drawer, adding to the cart, the
cart lines and note, the variant picker, the quantity buttons, the facets, predictive search, the
selectors and a marketing pop-up on `/pages/welcome`.

## License

MIT

## Logo

The Shopify logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Shopify name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
