@password
Feature: The store password page
  As the owner of a store that is not open yet
  I want visitors to enter a password first
  So that only the people I invite see the store

  # The demo serves a second storefront under /locked/, protected by a password.

  @critical
  Scenario: Every page of a protected store leads to its password page
    Given I am on "/locked/collections/all"
    Then I should see the store password page
    And the page type should be "password"
    And I should see "We open our doors soon."

  Scenario: A wrong password is refused
    Given I am on "/locked/"
    When I enter the store with the password "letmein"
    Then the store password should be refused with "Wrong password."
    And I should see the store password page

  Scenario: The right password lets the visitor in
    Given I am on "/locked/products/enamel-mug"
    When I enter the store with the password "webship-demo"
    Then I should be in the store
    And I should not see the store password page
    And the page type should be "home"

  Scenario: An open store has no password page
    Given I am on "/password"
    Then I should not see the store password page
    And I should be in the store
