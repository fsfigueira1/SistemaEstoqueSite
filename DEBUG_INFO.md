# Debug Information

## Payment Service Issue
- Import error: `Cannot find module '../src/services/paymentService'`
- No paymentService.ts file exists in src/services/
- However, there is a salePaymentService.ts file
- The tests are expecting a PaymentService class/module
- Likely need to either:
  1. Create paymentService.ts that wraps/reexports SalePaymentService
  2. Update tests to use SalePaymentService instead
  3. Check if there's an export/index file that should exist

## Cash Movement Service Issues
From test output:
1. `Created by ID is required` - test uses `performedById`, service expects `createdById`
2. `CashMovementService.getCashMovement is not a function` - method missing
3. `CashMovementService.getCashMovementsBySession is not a function` - method missing (service has `getCashSessionMovements`)
4. `CashMovementService.getCashMovementsByType is not a function` - method missing (service has `getMovementsByType` with different param order)

## Purchase Service Issues
From test output:
1. Decimal comparison errors - tests expect numbers, service returns Prisma.Decimal objects
2. Tax calculation not working - expecting 1150 (1000 + 15%) but getting 1000
3. Discount calculation not working - expecting 475 (500 - 25) but getting 500
4. Tax + discount not working - expecting 1078 but getting 1000
5. Validation message mismatch - expecting "Unit cost must be positive" but getting "Unit price must be positive for each item"
6. Supplier validation - test expects error for non-existent supplier but service returns empty list
7. Missing methods: `completePurchase` and `createPurchase` (though createPurchase seems to exist in some contexts)

## Sale Service Issues
From test output:
1. Decimal comparison errors - similar to purchase service
2. Subtotal calculation errors - expecting 100 but getting 15
3. Insufficient stock validation not working - sale created despite insufficient stock
4. Invalid payment method not being caught - sale created despite invalid method
5. Customer ID validation - service lets Prisma throw FK error instead of validating first
6. Items validation - message mismatch ("At least one item is required" vs "Sale must have at least one item")
7. completeSale returning undefined instead of sale object
8. Error message inconsistencies for sale status transitions
9. cancelSale not updating SaleItem status to CANCELLED
10. refundSale having foreign key constraint violations

## Common Pattern
Many services are returning Prisma.Decimal objects instead of converting to numbers for test compatibility, similar to what was fixed in cashSessionService.

Some services are missing expected methods or have method name/signature mismatches.

Validation messages need to match test expectations.

Some business logic (tax, discount, stock validation) is missing or incorrect.