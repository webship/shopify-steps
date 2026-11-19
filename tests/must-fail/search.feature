@must-fail
Feature: Assertions that must fail: Search
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: No suggestions yet, said to be shown
    Fails with: Expected the search suggestions to be shown, but they are not.

    Given I am on the homepage
    Then the search suggestions should be shown

  Scenario: Suggestions, said not to be shown
    Fails with: Expected no search suggestions, but they are shown.

    Given I am on the homepage
    When I type "tote" in the search box
    Then the search suggestions should not be shown

  Scenario: A suggestion that is not listed
    Fails with: Expected the search suggestions to list "Desk Tray", but they do not.

    Given I am on the homepage
    When I type "tote" in the search box
    Then the search suggestions should list "Desk Tray"

  Scenario: A listed suggestion, said not to be
    Fails with: Expected the search suggestions not to list "Canvas Tote", but they do.

    Given I am on the homepage
    When I type "tote" in the search box
    Then the search suggestions should not list "Canvas Tote"

  Scenario: Choosing a suggestion that is not listed
    Fails with: Expected a search suggestion "Desk Tray", but there is none.

    Given I am on the homepage
    When I type "tote" in the search box
    And I choose the search suggestion "Desk Tray"

  Scenario: Closing suggestions that are not shown
    Fails with: Expected search suggestions to close, but none are shown.

    Given I am on the homepage
    When I close the search suggestions
