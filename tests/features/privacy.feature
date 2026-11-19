@privacy
Feature: The cookie banner and the tracking consent
  As a visitor from a region that needs consent
  I want to choose which cookies the store may use
  So that the store tracks me only as far as I allow

  # The demo store shows its banner to visitors whose country is in the EEA or the UK: a
  # scenario chooses Germany first. The platform finds the visitor's region by itself.

  Scenario: A visitor from a region without a banner sees none
    Given I am on the homepage
    Then I should not see the cookie banner
    And the visitor's tracking consent should not be decided
    And the tracking consent for "analytics" should be "undecided"

  @critical
  Scenario: Accepting the cookies
    Given I am on the homepage
    When I choose "Germany" as the country
    Then I should see the cookie banner
    And the visitor's tracking consent should not be decided
    When I accept the cookies
    Then I should not see the cookie banner
    And the visitor's tracking consent should be decided
    And the tracking consent for "analytics" should be "yes"
    And the tracking consent for "marketing" should be "yes"

  Scenario: Declining the cookies
    Given I am on "/collections/all"
    When I choose "Germany" as the country
    And I decline the cookies
    Then I should not see the cookie banner
    And the tracking consent for "marketing" should be "no"
    And the tracking consent for "analytics" should not be "yes"

  Scenario: Choosing in the cookie preferences
    Given I am on the homepage
    When I choose "Germany" as the country
    And I open the cookie preferences
    And I allow the "Analytics" cookies
    And I refuse the "Marketing" cookies
    And I save the cookie preferences
    Then I should not see the cookie banner
    And the tracking consent for "analytics" should be "yes"
    And the tracking consent for "marketing" should be "no"
    And the tracking consent for "preferences" should be "no"

  Scenario: The choice can be changed later from the store's own link
    Given I am on the homepage
    When I choose "Germany" as the country
    And I decline the cookies
    And I open the cookie preferences
    And I allow the "Analytics" cookies
    And I save the cookie preferences
    Then the tracking consent for "analytics" should be "yes"
    And the tracking consent for "marketing" should be "no"
