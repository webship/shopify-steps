@collection
Feature: The collection page: filters, sort and pages
  As a shopper
  I want to narrow and order the products of a collection
  So that I find what I look for

  @critical
  Scenario: Filtering by availability keeps the products that can be bought
    Given I am on "/collections/all"
    When I filter the products by "In stock" under "Availability"
    Then the products should be filtered by "In stock" under "Availability"
    And the products should not be filtered by "Out of stock" under "Availability"
    And the product list should not include "Linen Apron"
    And the product list should include "Canvas Tote"

  Scenario: Two filters together, then one removed, then all cleared
    Given I am on "/collections/all"
    When I filter the products by "Apparel" under "Product type"
    And I filter the products by "Navy" under "Color"
    Then the product list should show 1 product
    And the product list should include "Wool Beanie"
    When I remove the "Navy" filter
    Then the products should not be filtered by "Navy" under "Color"
    And the product list should show 2 products
    When I clear all filters
    Then the products should not be filtered by "Apparel" under "Product type"
    And the product list should show 6 products

  Scenario: Filtering by a price range
    Given I am on "/collections/all"
    When I filter the products by price from 10 to 30
    Then the price filter should be from 10 to 30
    And the product list should show these products in order:
      | Canvas Tote    |
      | Wool Beanie    |
      | Enamel Mug     |
      | Field Notebook |
      | Desk Tray      |

  Scenario: Out of stock products are found by their filter
    Given I am on "/collections/all"
    When I filter the products by "Out of stock" under "Availability"
    Then the product list should show 3 products
    And the product list should include "Linen Apron"

  @critical
  Scenario: Sorting by price, low to high
    Given I am on "/collections/all"
    Then the products should be sorted by "Featured"
    When I sort the products by "Price, low to high"
    Then the products should be sorted by "Price, low to high"
    And the products should not be sorted by "Featured"
    And the product list should show these products in order:
      | Cotton Socks   |
      | Field Notebook |
      | Enamel Mug     |
      | Desk Tray      |
      | Wool Beanie    |
      | Canvas Tote    |

  Scenario: Sorting the search results, drawn as a list of choices behind a disclosure
    Given I am on "/search?q=co"
    When I sort the products by "Alphabetically, Z-A"
    Then the products should be sorted by "Alphabetically, Z-A"
    And the product list should show these products in order:
      | Cotton Socks |
      | Canvas Tote  |

  Scenario: Moving through the pages of a collection
    Given I am on "/collections/all"
    Then the product list should be on page 1
    And the product list should show 6 products
    When I go to page 2 of the product list
    Then the product list should be on page 2
    And the product list should show 2 products
    And the product list should include "Desk Tray"
    When I go to the previous page of the product list
    Then the product list should be on page 1
    When I go to the next page of the product list
    Then the product list should be on page 2

  Scenario: A filter keeps the sort, and the sort keeps the filter
    Given I am on "/collections/all"
    When I sort the products by "Price, high to low"
    And I filter the products by "Stationery" under "Product type"
    Then the products should be sorted by "Price, high to low"
    And the product list should show these products in order:
      | Brass Pen      |
      | Desk Tray      |
      | Field Notebook |
