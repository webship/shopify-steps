@must-fail
Feature: Assertions that must fail: The country and language selectors
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: Another country
    Fails with: Expected the store country "Canada" (CA), but it is "US".

    Given I am on the homepage
    Then the store country should be "Canada"

  Scenario: The country, said not to be
    Fails with: Expected the store country not to be "US", but it is.

    Given I am on the homepage
    Then the store country should not be "US"

  Scenario: Another language
    Fails with: Expected the store language "Français" (fr), but it is "en".

    Given I am on the homepage
    Then the store language should be "Français"

  Scenario: The language, said not to be
    Fails with: Expected the store language not to be "English", but it is.

    Given I am on the homepage
    Then the store language should not be "English"

  Scenario: Another currency
    Fails with: Expected the store currency "EUR", but it is "USD".

    Given I am on the homepage
    Then the store currency should be "EUR"

  Scenario: The currency, said not to be
    Fails with: Expected the store currency not to be "USD", but it is.

    Given I am on the homepage
    Then the store currency should not be "USD"

  Scenario: A country the selector does not list
    Fails with: Expected the country selector to list "Atlantis", but it does not.

    Given I am on the homepage
    Then the country selector should list "Atlantis"

  Scenario: A listed country, said not to be
    Fails with: Expected the country selector not to list "Canada", but it does.

    Given I am on the homepage
    Then the country selector should not list "Canada"

  Scenario: Choosing a country the store does not sell to
    Fails with: Expected "Atlantis" in the country selector, but it is not there.

    Given I am on the homepage
    When I choose "Atlantis" as the country
