# Read-only checks of the pack on a real public store, run by hand: npm run test:live -- ripndip.com
# The store runs a paid theme, not one of the platform's. The checks only read: choosing a size and
# changing the quantity happen in the page; nothing is added to the cart. The store belongs to its
# owner and changes: when a product goes, pick another one.
@live
Feature: A store on a paid theme
  As the maintainer of the pack
  I want the steps to read the variant picker and the selectors of another theme
  So that they do not depend on the platform's own themes

  Scenario: The variant picker, the quantity and the add button of a product
    Given I am on "/products/burn-tee-white"
    Then the page type should be "product"
    And "Small" should be chosen for "Size"
    When I choose "Medium" for "Size"
    Then "Medium" should be chosen for "Size"
    And "Small" should not be chosen for "Size"
    And the selected variant should be "Medium"
    And the quantity should be 1
    When I increase the quantity
    Then the quantity should be 2
    And I should be able to add the product to the cart

  Scenario: The country selector drawn as a drop-down list, and the cart drawer
    Given I am on the homepage
    Then the page should be a storefront page
    And the country selector should show the current country
    And the country selector should list "Canada"
    When I open the cart drawer
    Then the cart drawer should be open
    And the cart drawer should be empty
    When I close the cart drawer
    Then the cart drawer should be closed
