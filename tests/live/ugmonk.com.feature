# Read-only checks of the pack on a real public store, run by hand: npm run test:live -- ugmonk.com
# The store runs a free theme of the platform (from its theme store). The checks only read: they
# never add to a cart, sign in, place an order or send a form. Each scenario loads one page; the
# runner pauses between scenarios. The store belongs to its owner and changes: when a product or a
# name changes, update the check, not the step. Written from a visit from outside the US: the
# country the store shows depends on where the visitor is.
@live
Feature: A store on a free theme of the platform
  As the maintainer of the pack
  I want the steps to read what a real theme of the platform draws
  So that a team can trust them on its own store

  Scenario: The store, its empty cart drawer and its country selector
    Given I am on the homepage
    Then the page should be a storefront page
    And the page type should be "home"
    And the store should use the theme "Tinker"
    And the cart should be empty
    When I open the cart drawer
    Then the cart drawer should be open
    And the cart drawer should be empty
    When I close the cart drawer
    Then the cart drawer should be closed
    And the country selector should show the current country
    And the country selector should list "Canada"
    And the visitor's tracking consent should not be decided

  Scenario: Suggestions while typing in the search box behind its button
    Given I am on "/collections/all"
    Then the page type should be "collection"
    When I type "card" in the search box
    Then the search suggestions should be shown
    And the search suggestions should list "Analog Task Cards"
    When I close the search suggestions
    Then the search suggestions should not be shown

  Scenario: A product page and its product form
    Given I am on "/products/analog-starter-kit"
    Then the page type should be "product"
    And the selected variant should be available
    And the product should not be sold out
    And I should be able to add the product to the cart
