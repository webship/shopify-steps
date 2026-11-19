@search
Feature: Search
  As a shopper
  I want suggestions while I type and a page of results
  So that I find a product by its name

  @critical
  Scenario: Suggestions while typing, and a suggestion opened
    Given I am on the homepage
    When I type "tote" in the search box
    Then the search suggestions should be shown
    And the search suggestions should list "Canvas Tote"
    And the search suggestions should not list "Wool Beanie"
    When I choose the search suggestion "Canvas Tote"
    Then the page type should be "product"
    And I should see "Canvas Tote" in the "h1" element

  Scenario: Suggestions list collections and pages too
    Given I am on "/collections/all"
    When I type "bag" in the search box
    Then the search suggestions should list "Bags"
    When I type "ship" in the search box
    Then the search suggestions should list "Shipping"

  Scenario: Escape closes the suggestions
    Given I am on the homepage
    When I type "wool" in the search box
    Then the search suggestions should list "Wool Beanie"
    When I close the search suggestions
    Then the search suggestions should not be shown

  Scenario: Searching the store leads to its results page
    Given I am on the homepage
    When I search the store for "co"
    Then the page type should be "searchresults"
    And the product list should show 2 products
    And the product list should include "Cotton Socks"
    And the product list should include "Canvas Tote"

  Scenario: A search that finds nothing
    Given I am on the homepage
    When I search the store for "submarine"
    Then the product list should show 0 products
    And I should see "No results found"
