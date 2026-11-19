@store
Feature: The store behind the pages
  As a tester of an online store
  I want to know which store, which theme and which kind of page I am on
  So that a scenario fails early when it runs against the wrong place

  @critical
  Scenario: The home page is a storefront page of the demo store
    Given I am on the homepage
    Then the page should be a storefront page
    And the page should belong to the store "webship-demo-store.example"
    And the page should not belong to the store "another-store.example"
    And the page type should be "home"
    And the store should use the theme "Webship demo"
    And the store should not use the theme "Retired theme"

  Scenario: Each kind of page reports its type
    Given I am on "/collections/all"
    Then the page type should be "collection"
    When I am on "/products/canvas-tote"
    Then the page type should be "product"
    And the page type should not be "collection"
    When I am on "/search?q=tote"
    Then the page type should be "searchresults"
    When I am on "/cart"
    Then the page type should be "cart"
    When I am on "/pages/about"
    Then the page type should be "page"

  Scenario: The hosted checkout is not a storefront page
    Given I am on "/checkouts/cn/0123456789abcdef"
    Then this page should not be a storefront page
    And I should be on the checkout

  Scenario: A marketing pop-up that covers the page is closed the way a person closes it
    Given I am on "/pages/welcome"
    Then I should see "Get 10% off your first order"
    When I close any pop-ups
    Then no pop-up should cover the page

  Scenario: A step closes a pop-up that covers what it clicks
    Given I am on "/pages/welcome"
    When I open the cart drawer
    Then the cart drawer should be open
    And no pop-up should cover the page
