@must-fail
Feature: Assertions that must fail: The product page
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: A value an option does not have
    Fails with: Expected "Purple" among the values of "Color", but there is none.

    Given I am on "/products/wool-beanie"
    When I choose "Purple" for "Color"

  Scenario: An option the product does not have
    Fails with: Expected an option "Weight" in the variant picker, but there is none.

    Given I am on "/products/wool-beanie"
    When I choose "Heavy" for "Weight"

  Scenario: A value that is not chosen
    Fails with: Expected "Navy" to be chosen for "Color", but it is not.

    Given I am on "/products/wool-beanie"
    Then "Navy" should be chosen for "Color"

  Scenario: A chosen value, said not to be
    Fails with: Expected "Grey" not to be chosen for "Color", but it is.

    Given I am on "/products/wool-beanie"
    Then "Grey" should not be chosen for "Color"

  Scenario: Another variant
    Fails with: Expected the selected variant "L/XL / Navy", but it is "S/M / Grey".

    Given I am on "/products/wool-beanie"
    Then the selected variant should be "L/XL / Navy"

  Scenario: The selected variant, said not to be
    Fails with: Expected the selected variant not to be "S/M / Grey", but it is.

    Given I am on "/products/wool-beanie"
    Then the selected variant should not be "S/M / Grey"

  Scenario: An available variant, said not to be
    Fails with: Expected the selected variant "S/M / Grey" not to be available, but it is.

    Given I am on "/products/wool-beanie"
    Then the selected variant should not be available

  Scenario: A sold-out variant, said to be available
    Fails with: Expected the selected variant "L/XL / Rust" to be available, but it is sold out.

    Given I am on "/products/wool-beanie"
    When I choose "L/XL" for "Size"
    And I choose "Rust" for "Color"
    Then the selected variant should be available

  Scenario: A product that can be bought, said to be sold out
    Fails with: Expected the product to be sold out, but "Default Title" can be added to the cart.

    Given I am on "/products/enamel-mug"
    Then the product should be sold out

  Scenario: A sold-out product, said not to be
    Fails with: Expected the product not to be sold out, but "Default Title" is.

    Given I am on "/products/linen-apron"
    Then the product should not be sold out

  Scenario: An add button that works, said to be disabled
    Fails with: Expected the add to cart button to be disabled, but "Add to cart" can be pressed.

    Given I am on "/products/enamel-mug"
    Then I should not be able to add the product to the cart

  Scenario: A disabled add button, said to work
    Fails with: Expected the add to cart button to work, but it is disabled.

    Given I am on "/products/linen-apron"
    Then I should be able to add the product to the cart

  Scenario: Adding a sold-out product
    Fails with: Expected to add the product to the cart, but its button "Sold out" is disabled.

    Given I am on "/products/linen-apron"
    When I add the product to the cart

  Scenario: An add the store accepted, said to be refused
    Fails with: Expected the store to refuse the add to the cart, but it accepted it (200).

    Given I am on "/products/enamel-mug"
    When I add the product to the cart
    Then adding to the cart should be refused

  @js-off
  Scenario: A refusal with other words
    Fails with: Expected the refusal "The product is gone." on the page, but it is not shown.

    Given I am on "/products/canvas-tote"
    When I set the quantity to 9
    And I add the product to the cart
    Then adding to the cart should be refused with "The product is gone."

  Scenario: The dynamic checkout button of a sold-out product
    Fails with: Expected the dynamic checkout button in the product form, but it is not shown.

    Given I am on "/products/linen-apron"
    Then I should see the dynamic checkout button

  Scenario: The dynamic checkout button, said not to be there
    Fails with: Expected no dynamic checkout button, but the product form shows one.

    Given I am on "/products/enamel-mug"
    Then I should not see the dynamic checkout button

  Scenario: Another price
    Fails with: Expected the product price "$99.00", but it is "$16.00".

    Given I am on "/products/enamel-mug"
    Then the product price should be "$99.00"

  Scenario: The price, said not to be
    Fails with: Expected the product price not to be "$16.00", but it is.

    Given I am on "/products/enamel-mug"
    Then the product price should not be "$16.00"

  Scenario: Another quantity
    Fails with: Expected the quantity 4, but it is 1.

    Given I am on "/products/enamel-mug"
    Then the quantity should be 4

  Scenario: The quantity, said not to be
    Fails with: Expected the quantity not to be 1, but it is.

    Given I am on "/products/enamel-mug"
    Then the quantity should not be 1
