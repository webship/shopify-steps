# Features

Reference features for the demo store of this repository (`demo-site/`, see the README's "The
demo store"). Together they use every step of the pack. Copy a feature into your project and
replace the addresses, product titles, option names and texts with those of your store.

| Feature | Covers |
| --- | --- |
| `store` | The store behind a page (its globals, the type of page, its theme), the hosted checkout outside the store, a marketing pop-up closed by hand and by a click it covered. |
| `collection` | Filters (availability, type and colour together, a price range, one removed, all cleared), the sort of a collection (a drop-down list) and of the search results (a list of choices behind a disclosure), a filter that keeps the sort, the pages of a collection. |
| `product` | The variant picker drawn as buttons and as a drop-down list, the chosen variant and whether it can be bought, sold-out variants and products, the price that follows the variant and a sale price, the quantity, adding to the cart, the store's refusal of more than its stock (`@js-off`: the browser logs the store's 422 answer), the dynamic checkout button. |
| `cart` | The cart drawer (open, close, empty, its lines, a quantity changed), the cart page (a line removed, a quantity set to zero), the order note, the count, items and total, checking out, an empty cart page. |
| `search` | Suggestions while typing (products, collections, pages), choosing one, Escape, a search and its results, a search that finds nothing. |
| `localization` | A country and its currency (a drop-down list), a language (a list behind a disclosure), a country kept on the next page with the cart in its currency. |
| `newsletter` | The form and its required field, refusals by the browser and by the store. Refusals only: a sign-up that goes through makes a customer record. |
| `privacy` | No banner for a region that needs none; the banner accepted, declined, the preferences chosen and changed later from the store's own link; the tracking consent. |
| `password` | The password page of a store that is not open yet: every page leads there, a wrong password, the right one, an open store. |

`@critical` marks the smoke lane (`CUCUMBER_TAGS=@critical npm test`). A run leaves the store as it
found it: every browser context gets a cart of its own, and every other choice lives in its
cookies.
