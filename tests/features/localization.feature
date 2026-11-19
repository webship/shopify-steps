@localization
Feature: The country and language selectors
  As a shopper abroad
  I want to see the store in my country's currency and in my language
  So that I know what I pay and read what I buy

  @critical
  Scenario: Choosing a country changes the currency
    Given I am on "/products/canvas-tote"
    Then the store country should be "United States"
    And the store currency should be "USD"
    And the country selector should show the current country
    And the country selector should list "Canada"
    And the country selector should not list "Atlantis"
    When I choose "Canada" as the country
    Then the store country should be "Canada"
    And the store country should be "CA"
    And the store country should not be "United States"
    And the store currency should be "CAD"
    And the store currency should not be "USD"
    And the country selector should show the current country
    And the product price should be "$38.08 CAD"

  Scenario: Choosing a language, from a list behind a disclosure
    Given I am on "/collections/all"
    Then the store language should be "English"
    And the language selector should list "Français"
    And the language selector should not list "Klingon"
    When I choose "Français" as the language
    Then the store language should be "fr"
    And the store language should be "Français"
    And the store language should not be "English"
    And the language selector should show the current language
    And the page language should be "fr"

  Scenario: The country stays chosen on the next page, and a cart keeps its currency
    Given I am on the homepage
    When I choose "GB" as the country
    And I am on "/products/enamel-mug"
    Then the store country should be "United Kingdom"
    And the store currency should be "GBP"
    When I add the product to the cart
    Then the cart total should be "£12.64 GBP"
