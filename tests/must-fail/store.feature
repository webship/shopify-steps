@must-fail
Feature: Assertions that must fail: The store behind the pages
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: The home page is not outside the store
    Fails with: Expected a page outside the store, but it is a storefront page

    Given I am on the homepage
    Then the page should not be a storefront page

  Scenario: The checkout is not a storefront page
    Fails with: Expected a storefront page, but the page carries none of the store's globals.

    Given I am on "/checkouts/cn/0123456789abcdef"
    Then the page should be a storefront page

  Scenario: Another store
    Fails with: Expected the page to belong to the store "another-store.example", but it belongs to "webship-demo-store.example".

    Given I am on the homepage
    Then the page should belong to the store "another-store.example"

  Scenario: The same store, said not to be
    Fails with: Expected the page not to belong to the store "webship-demo-store.example", but it does.

    Given I am on the homepage
    Then the page should not belong to the store "webship-demo-store.example"

  Scenario: Another page type
    Fails with: Expected the page type "product", but it is "home".

    Given I am on the homepage
    Then the page type should be "product"

  Scenario: The same page type, said not to be
    Fails with: Expected the page type not to be "home", but it is.

    Given I am on the homepage
    Then the page type should not be "home"

  Scenario: Another theme
    Fails with: Expected the store to use the theme "Retired theme", but it uses "Webship demo".

    Given I am on the homepage
    Then the store should use the theme "Retired theme"

  Scenario: The same theme, said not to be
    Fails with: Expected the store not to use the theme "Webship demo", but it does.

    Given I am on the homepage
    Then the store should not use the theme "Webship demo"

  Scenario: A pop-up covers the page
    Fails with: Expected no pop-up over the page, but one covers it.

    Given I am on "/pages/welcome"
    Then no pop-up should cover the page
