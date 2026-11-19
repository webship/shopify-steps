@newsletter
Feature: The newsletter form
  As a store owner
  I want the newsletter form to refuse addresses it cannot use
  So that the list holds only real addresses

  # Refusals only: a sign-up that goes through makes a customer record in the store.

  @critical
  Scenario: The form and its required email field
    Given I am on the homepage
    Then I should see the newsletter form
    And the newsletter email field should be required

  Scenario: The browser refuses an address without an at sign
    Given I am on the homepage
    When I sign up for the newsletter with "not-an-email"
    Then the newsletter sign-up should be refused

  Scenario: The browser refuses an empty address
    Given I am on "/collections/all"
    When I sign up for the newsletter with ""
    Then the newsletter sign-up should be refused

  Scenario: The store refuses an address the browser accepts
    Given I am on the homepage
    When I sign up for the newsletter with "jane@example"
    Then the newsletter sign-up should be refused with "Email is invalid."
    And I should see the newsletter form
