# Read-only checks of the pack on a real public store, run by hand:
# npm run test:live -- www.thesill.com
# The store runs a copy of the platform's newest free theme. The checks only read: sorting and
# filtering a collection loads its pages with other parameters; nothing is sent to the store.
# The store belongs to its owner and changes: update the check when a filter changes.
@live
Feature: A store on a copy of a free theme of the platform
  As the maintainer of the pack
  I want the steps to find a theme's facets and sort by their names
  So that they hold whatever control a theme draws for them

  Scenario: Sorting and filtering a collection with the theme's own controls
    Given I am on "/collections/all"
    Then the page type should be "collection"
    And the store should use the theme "Horizon"
    And the products should be sorted by "Alphabetically, A-Z"
    When I sort the products by "Price, low to high"
    Then the products should be sorted by "Price, low to high"
    When I filter the products by "Low Light" under "Light Requirements"
    Then the products should be filtered by "Low Light" under "Light Requirements"
    And the products should be sorted by "Price, low to high"
