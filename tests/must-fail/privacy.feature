@must-fail
Feature: Assertions that must fail: The cookie banner and the tracking consent
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: No banner, said to be shown
    Fails with: Expected the cookie banner, but none is shown.

    Given I am on the homepage
    Then I should see the cookie banner

  Scenario: A banner, said not to be shown
    Fails with: Expected no cookie banner, but one is shown.

    Given I am on the homepage
    When I choose "Germany" as the country
    Then I should not see the cookie banner

  Scenario: Another consent
    Fails with: Expected the tracking consent for "analytics" to be "yes", but it is "undecided".

    Given I am on the homepage
    Then the tracking consent for "analytics" should be "yes"

  Scenario: The consent, said not to be
    Fails with: Expected the tracking consent for "analytics" not to be "undecided", but it is.

    Given I am on the homepage
    Then the tracking consent for "analytics" should not be "undecided"

  Scenario: No choice, said to be made
    Fails with: Expected the visitor to have made a choice about tracking, but every purpose is undecided.

    Given I am on the homepage
    Then the visitor's tracking consent should be decided

  Scenario: A choice, said not to be made
    Fails with: Expected no choice about tracking yet, but the store records one

    Given I am on the homepage
    When I choose "Germany" as the country
    And I accept the cookies
    Then the visitor's tracking consent should not be decided

  Scenario: Accepting without a banner
    Fails with: Expected the cookie banner to accept the cookies, but none is shown.

    Given I am on the homepage
    When I accept the cookies

  Scenario: A kind of cookies the preferences do not have
    Fails with: Expected a choice "Fonts" in the cookie preferences, but there is none.

    Given I am on the homepage
    When I choose "Germany" as the country
    And I open the cookie preferences
    And I allow the "Fonts" cookies
