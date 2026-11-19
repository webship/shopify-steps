@must-fail
Feature: Assertions that must fail: The cart
  Each scenario asserts something that is not true on the demo store. Its last step must fail
  with the message its description announces, and a hint; the steps before it must pass.
  tests/check-must-fail.js runs them (npm run test:must-fail).

  Scenario: A closed drawer, said to be open
    Fails with: Expected the cart drawer to be open, but it is closed.

    Given I am on the homepage
    Then the cart drawer should be open

  Scenario: An open drawer, said to be closed
    Fails with: Expected the cart drawer to be closed, but it is open.

    Given I am on the homepage
    When I open the cart drawer
    Then the cart drawer should be closed

  Scenario: Closing a drawer that is not open
    Fails with: Expected an open cart drawer to close, but none is open.

    Given I am on the homepage
    When I close the cart drawer

  Scenario: A line the drawer does not list
    Fails with: Expected the cart drawer to list "Canvas Tote", but it does not.

    Given the cart holds 1 of the product "enamel-mug"
    When I open the cart drawer
    Then the cart drawer should list "Canvas Tote"

  Scenario: A line the drawer lists, said not to
    Fails with: Expected the cart drawer not to list "Enamel Mug", but it does.

    Given the cart holds 1 of the product "enamel-mug"
    When I open the cart drawer
    Then the cart drawer should not list "Enamel Mug"

  Scenario: An empty drawer, said to have lines
    Fails with: Expected the cart drawer to have lines, but it is empty.

    Given I am on the homepage
    When I open the cart drawer
    Then the cart drawer should not be empty

  Scenario: A drawer with lines, said to be empty
    Fails with: Expected the cart drawer to be empty, but it has lines.

    Given the cart holds 1 of the product "enamel-mug"
    When I open the cart drawer
    Then the cart drawer should be empty

  Scenario: An empty cart, said to hold something
    Fails with: Expected the cart to hold something, but it is empty.

    Given I am on the homepage
    Then the cart should not be empty

  Scenario: A cart with items, said to be empty
    Fails with: Expected the cart to be empty, but it holds 2 item(s).

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart should be empty

  Scenario: Another number of items
    Fails with: Expected the cart to hold 5 item(s), but it holds 2.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart should hold 5 items

  Scenario: A product the cart does not hold
    Fails with: Expected the cart to contain "Brass Pen", but it does not.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart should contain "Brass Pen"

  Scenario: A product the cart holds, said not to
    Fails with: Expected the cart not to contain "Enamel Mug", but it does.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart should not contain "Enamel Mug"

  Scenario: Another quantity of a product
    Fails with: Expected 9 of "Enamel Mug" in the cart, but it holds 2.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart should contain 9 of "Enamel Mug"

  Scenario: Another total
    Fails with: Expected the cart total $1.00, but it is 32.00 USD.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart total should be "$1.00"

  Scenario: Another count on the cart button
    Fails with: Expected the cart count 7, but the cart button shows 2.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart count should be 7

  Scenario: The count on the cart button, said not to be
    Fails with: Expected the cart count not to be 2, but it is.

    Given the cart holds 2 of the product "enamel-mug"
    Then the cart count should not be 2

  Scenario: Another note
    Fails with: Expected the cart note "Ring twice", but the store keeps "".

    Given the cart holds 1 of the product "enamel-mug"
    Then the cart note should be "Ring twice"

  Scenario: The note, said not to be
    Fails with: Expected the cart note not to be "", but it is.

    Given the cart holds 1 of the product "enamel-mug"
    Then the cart note should not be ""

  Scenario: The cart page, said to be the checkout
    Fails with: Expected the checkout, but the page is "/cart".

    Given the cart holds 1 of the product "enamel-mug"
    When I go to the cart page
    Then I should be on the checkout

  Scenario: The checkout, said to be the store
    Fails with: Expected to stay in the store, but the page is the checkout.

    Given the cart holds 1 of the product "enamel-mug"
    When I go to the cart page
    And I check out
    Then I should not be on the checkout

  Scenario: The home page, said to be the cart page
    Fails with: Expected the cart page, but the page is "/" (type "home").

    Given I am on the homepage
    Then I should be on the cart page

  Scenario: The cart page, said to be left
    Fails with: Expected to have left the cart page, but it is still shown.

    When I go to the cart page
    Then I should not be on the cart page

  Scenario: Changing a line the cart does not have
    Fails with: Expected a line "Brass Pen" in the cart drawer or on the cart page, but there is none.

    Given the cart holds 1 of the product "enamel-mug"
    When I go to the cart page
    And I change the quantity of "Brass Pen" to 2 in the cart

  Scenario: A product the store does not have
    Fails with: Expected to put 1 of "no-such-product" in the cart, but the store refused.

    Given the cart holds 1 of the product "no-such-product"

  Scenario: Checking out an empty cart
    Fails with: Expected a checkout button in the cart, but there is none.

    When I go to the cart page
    And I check out
