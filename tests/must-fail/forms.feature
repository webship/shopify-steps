@must-fail
Feature: Assertions that must fail: The newsletter form and the store password page
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: The newsletter form, said not to be there
    Fails with: Expected no newsletter form, but the page shows one.

    Given I am on the homepage
    Then I should not see the newsletter form

  Scenario: A page without the newsletter form
    Fails with: Expected the newsletter form, but the page shows none.

    Given I am on "/checkouts/cn/0123456789abcdef"
    Then I should see the newsletter form

  Scenario: A required email field, said not to be
    Fails with: Expected the newsletter email field not to be required, but it is.

    Given I am on the homepage
    Then the newsletter email field should not be required

  Scenario: A browser refusal with the store's words
    Fails with: Expected the refusal "Email can't be blank.", but the browser refused with

    Given I am on the homepage
    When I sign up for the newsletter with "not-an-email"
    Then the newsletter sign-up should be refused with "Email can't be blank."

  Scenario: A store refusal with other words
    Fails with: Expected the newsletter sign-up to be refused with "Email can't be blank.", but the form shows no such error.

    Given I am on the homepage
    When I sign up for the newsletter with "jane@example"
    Then the newsletter sign-up should be refused with "Email can't be blank."

  Scenario: A refusal before any sign-up
    Fails with: Expected a refused newsletter sign-up, but the scenario has not signed up yet.

    Given I am on the homepage
    Then the newsletter sign-up should be refused

  Scenario: An open store, said to show its password page
    Fails with: Expected the store password page, but the page has no storefront password form.

    Given I am on the homepage
    Then I should see the store password page

  Scenario: The password page, said to be passed
    Fails with: Expected to be past the store password page, but it is shown.

    Given I am on "/locked/"
    Then I should not see the store password page

  Scenario: The right password, said to be refused
    Fails with: Expected the password to be refused, but the store let the visitor in.

    Given I am on "/locked/"
    When I enter the store with the password "webship-demo"
    Then the store password should be refused

  Scenario: A password refusal with other words
    Fails with: Expected the store password to be refused with "Try again.", but the form shows no such error.

    Given I am on "/locked/"
    When I enter the store with the password "letmein"
    Then the store password should be refused with "Try again."

  Scenario: The password page, said to be the store
    Fails with: Expected a page of the store, but the page is "/locked/password" (type "password").

    Given I am on "/locked/"
    Then I should be in the store
