# Read-only checks of the pack on a real public store, run by hand:
# npm run test:live -- www.allbirds.com
# The store runs a theme of the brand's own. The check only reads: nothing is sent to the store.
@live
Feature: A store on a theme of the brand's own
  As the maintainer of the pack
  I want the steps to find the platform's own forms on any theme
  So that they work on stores far from the platform's themes

  Scenario: The newsletter form of the store
    Given I am on the homepage
    Then the page should be a storefront page
    And the store should not use the theme "Horizon"
    And I should see the newsletter form
    And the newsletter email field should be required
    And the cart should be empty
