@must-fail
Feature: Assertions that must fail: The collection page
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: A filter that is not chosen
    Fails with: Expected the products to be filtered by "Out of stock" under "Availability", but they are not.

    Given I am on "/collections/all"
    When I filter the products by "In stock" under "Availability"
    Then the products should be filtered by "Out of stock" under "Availability"

  Scenario: A chosen filter, said not to be
    Fails with: Expected the products not to be filtered by "In stock", but they are.

    Given I am on "/collections/all"
    When I filter the products by "In stock" under "Availability"
    Then the products should not be filtered by "In stock" under "Availability"

  Scenario: A filter the collection does not have
    Fails with: Expected a filter "Purple" under "Color", but there is none.

    Given I am on "/collections/all"
    When I filter the products by "Purple" under "Color"

  Scenario: Removing a filter that is not chosen
    Fails with: Expected the filter "In stock" to be chosen, so that it can be removed, but it is not.

    Given I am on "/collections/all"
    When I remove the "In stock" filter

  Scenario: Another price range
    Fails with: Expected the price filter from 1 to 2, but it is from 10 to 30.

    Given I am on "/collections/all"
    When I filter the products by price from 10 to 30
    Then the price filter should be from 1 to 2

  Scenario: Another sort
    Fails with: Expected the products to be sorted by "Price, high to low" (price-descending), but they are sorted by manual.

    Given I am on "/collections/all"
    Then the products should be sorted by "Price, high to low"

  Scenario: The same sort, said not to be
    Fails with: Expected the products not to be sorted by "Featured", but they are.

    Given I am on "/collections/all"
    Then the products should not be sorted by "Featured"

  Scenario: A sort option the store does not have
    Fails with: Expected a sort option "Most expensive first", but there is none.

    Given I am on "/collections/all"
    When I sort the products by "Most expensive first"

  Scenario: A product the list does not show
    Fails with: Expected the product list to include "Linen Apron", but it does not.

    Given I am on "/collections/all"
    When I filter the products by "In stock" under "Availability"
    Then the product list should include "Linen Apron"

  Scenario: A product the list shows, said not to
    Fails with: Expected the product list not to include "Canvas Tote", but it does.

    Given I am on "/collections/all"
    Then the product list should not include "Canvas Tote"

  Scenario: Another number of products
    Fails with: Expected the product list to show 3 product(s), but it shows 6.

    Given I am on "/collections/all"
    Then the product list should show 3 products

  Scenario: Another order of products
    Fails with: Expected the product list to show, in order: "Desk Tray", "Canvas Tote".

    Given I am on "/collections/stationery"
    Then the product list should show these products in order:
      | Desk Tray   |
      | Canvas Tote |

  Scenario: Another page of the list
    Fails with: Expected page 2 of the product list, but the address says 1 and the pagination marks 1.

    Given I am on "/collections/all"
    Then the product list should be on page 2

  Scenario: A page the list does not have
    Fails with: Expected a link to page 5 of the product list, but there is none.

    Given I am on "/collections/all"
    When I go to page 5 of the product list
