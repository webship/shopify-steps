@product
Feature: The product page
  As a shopper
  I want to choose a variant and a quantity and put the product in my cart
  So that I buy what I mean to buy

  @critical
  Scenario: Choosing the options of a product picks its variant
    Given I am on "/products/wool-beanie"
    Then "S/M" should be chosen for "Size"
    And "Grey" should be chosen for "Color"
    And the selected variant should be "S/M / Grey"
    When I choose "L/XL" for "Size"
    And I choose "Navy" for "Color"
    Then "Navy" should be chosen for "Color"
    And "Grey" should not be chosen for "Color"
    And the selected variant should be "L/XL / Navy"
    And the selected variant should not be "S/M / Grey"
    And the selected variant should be available
    And the product should not be sold out
    And I should be able to add the product to the cart

  Scenario: A variant that is sold out cannot be added to the cart
    Given I am on "/products/wool-beanie"
    When I choose "L/XL" for "Size"
    And I choose "Rust" for "Color"
    Then the selected variant should be "L/XL / Rust"
    And the selected variant should not be available
    And the product should be sold out
    And I should not be able to add the product to the cart
    And I should not see the dynamic checkout button

  Scenario: A product sold out in every variant
    Given I am on "/products/linen-apron"
    Then the product should be sold out
    And I should not be able to add the product to the cart

  Scenario: The price follows the chosen variant
    Given I am on "/products/field-notebook"
    Then the product price should be "$12.00"
    When I choose "128 pages" for "Pages"
    Then the product price should be "$18.00"
    And the product price should not be "$12.00"

  Scenario: A product on sale shows its sale price
    Given I am on "/products/cotton-socks"
    Then the product price should be "$9.00"
    And the product price should not be "$12.00"

  Scenario: The quantity, with its buttons and its field
    Given I am on "/products/enamel-mug"
    Then the quantity should be 1
    When I increase the quantity
    And I increase the quantity
    Then the quantity should be 3
    When I decrease the quantity
    Then the quantity should be 2
    When I set the quantity to 5
    Then the quantity should be 5
    And the quantity should not be 2

  @critical
  Scenario: Adding a variant to the cart
    Given I am on "/products/canvas-tote"
    When I choose "Black" for "Color"
    And I set the quantity to 2
    And I add the product to the cart
    Then the cart should contain 2 of "Canvas Tote"
    And the cart drawer should be open
    And the cart drawer should list "Canvas Tote"

  @js-off
  Scenario: The store refuses more than its stock and keeps what there is
    Given I am on "/products/canvas-tote"
    When I set the quantity to 9
    And I add the product to the cart
    Then adding to the cart should be refused with "You can't add more Canvas Tote - Natural to the cart."
    And the cart should contain 5 of "Canvas Tote"

  Scenario: The dynamic checkout button leaves the store for the checkout
    Given I am on "/products/brass-pen"
    Then I should see the dynamic checkout button
    When I choose "Polished" for "Finish"
    And I press the dynamic checkout button
    Then I should be on the checkout
    And I should see "1 × Brass Pen - Polished"
    And the page should not be a storefront page
