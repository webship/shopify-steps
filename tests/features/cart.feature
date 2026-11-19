@cart
Feature: The cart drawer and the cart page
  As a shopper
  I want to see and change what is in my cart
  So that I check out with the right items

  @critical
  Scenario: An empty cart, in the drawer and in the store
    Given I am on the homepage
    Then the cart should be empty
    And the cart count should be 0
    When I open the cart drawer
    Then the cart drawer should be open
    And the cart drawer should be empty
    When I close the cart drawer
    Then the cart drawer should be closed

  Scenario: Changing the quantity of a line in the cart drawer
    Given the cart holds 1 of the product "wool-beanie" in "S/M / Navy"
    When I open the cart drawer
    Then the cart drawer should list "Wool Beanie"
    And the cart drawer should not list "Canvas Tote"
    When I change the quantity of "Wool Beanie" to 3 in the cart
    Then the cart should contain 3 of "Wool Beanie"
    And the cart should hold 3 items
    And the cart total should be "$72.00"
    And the cart count should be 3
    And the cart count should not be 1

  Scenario: Removing a line on the cart page
    Given the cart holds 2 of the product "enamel-mug"
    And the cart holds 1 of the product "field-notebook" in "128 pages"
    When I go to the cart page
    Then I should be on the cart page
    And the cart should hold 3 items
    And the cart total should be "$50.00"
    When I remove "Enamel Mug" from the cart
    Then the cart should not contain "Enamel Mug"
    And the cart should contain "Field Notebook"
    And the cart should hold 1 item
    When I change the quantity of "Field Notebook" to 0 in the cart
    Then the cart should be empty

  Scenario: The order note is kept by the store
    Given the cart holds 1 of the product "desk-tray"
    When I open the cart drawer
    And I write the cart note "Gift wrap, please"
    Then the cart note should be "Gift wrap, please"
    And the cart note should not be "Leave at the door"

  Scenario: Checking out leaves the store for the checkout
    Given the cart holds 2 of the product "canvas-tote" in "Black"
    When I go to the cart page
    And I check out
    Then I should be on the checkout
    And I should not be on the cart page
    And I should see "2 × Canvas Tote - Black"

  Scenario: The cart page of a visitor who has nothing in the cart
    When I go to the cart page
    Then I should be on the cart page
    And the cart should be empty
    And I should see "Your cart is empty"
