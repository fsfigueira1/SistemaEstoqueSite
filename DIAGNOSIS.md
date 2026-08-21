# FASE 2.2.3 - Diagnosis Report

## Overview
This document summarizes the issues found in the four failing test suites: paymentService, cashMovementService, purchaseService, and saleService.

## 1. Payment Service Issues

### Root Cause
The tests expect a `PaymentService` class/module, but the actual implementation is in `salePaymentService.ts` as `SalePaymentService` class.

### Specific Issues
- **Import Error**: Tests import from `../src/services/paymentService` which doesn't exist
- **Validation Message Mismatch**: 
  - Service throws: "Amount must be positive"
  - Tests expect: "Payment amount must be positive"
- **Missing Validation**: Service doesn't validate that payment amount doesn't exceed sale total
- **Immediate Payment Confirmation**: Service creates payment as PENDING then immediately confirms to PAID, which may not align with test expectations

## 2. Cash Movement Service Issues

### Root Cause
Method name and parameter mismatches between service implementation and test expectations.

### Specific Issues
- **Missing Methods**:
  - Service missing: `getCashMovement`
  - Tests expect: `getCashMovementsBySession` but service has `getCashSessionMovements`
  - Tests expect: `getCashMovementsByType` but service has `getMovementsByType`
- **Parameter Name Mismatch**:
  - Service uses: `createdById`
  - Tests use/pass: `performedById`
- **Parameter Order Issues**: Some methods have different parameter ordering
- **Validation Messages**: 
  - Service throws: "Created by ID is required"
  - Tests expect validation for `performedById`

## 3. Purchase Service Issues

### Root Cause
Multiple issues including Decimal handling, missing business logic, and method mismatches.

### Specific Issues
- **Decimal Comparison Errors**: 
  - Service returns Prisma.Decimal objects
  - Tests expect primitive numbers
  - Fix: Convert Decimals to numbers using `.toNumber()` (pattern from cashSessionService)
- **Missing Business Logic**:
  - Tax calculation not applied (taxRate ignored)
  - Discount calculation not applied (discountAmount ignored)
  - Total amount should be: `(quantity × unitPrice) - discount + tax`
- **Validation Message Mismatch**:
  - Service throws: "Unit price must be positive for each item"
  - Tests expect: "Unit cost must be positive"
- **Missing Methods**:
  - Tests expect: `createPurchase` and `completePurchase`
  - Service has: `createPurchaseOrder` but no `completePurchase`
- **Supplier Validation**:
  - `listPurchaseOrders` doesn't validate supplier exists (returns empty array instead of throwing)

## 4. Sale Service Issues

### Root Cause
Similar to purchase service with Decimal issues, plus validation and business logic problems.

### Specific Issues
- **Decimal Comparison Errors**: Same as purchase service
- **Subtotal Calculation Errors**:
  - Tests expecting 100 but getting 15
  - Likely caused by not using product sale price correctly
- **Insufficient Stock Validation Not Working**:
  - Service doesn't check stock quantity before creating sale
  - Should throw error when product.stockQuantity < item.quantity
- **Invalid Payment Method Not Being Caught**:
  - Service validation happens after other operations
  - Should validate paymentMethod early in process
- **Customer ID Validation**:
  - Service lets Prisma throw foreign key error instead of validating first
  - Should check if customer exists before proceeding
- **Items Validation Message Mismatch**:
  - Service throws: "At least one item is required"
  - Tests expect: "Sale must have at least one item"
- **completeSale Return Value**:
  - Service returns `{ sale, payment }` 
  - Tests expect just the sale object
- **Error Message Inconsistencies**:
  - Various status transition error messages don't match test expectations
- **cancelSale Issues**:
  - Doesn't update SaleItem status to CANCELLED
  - Should mark related sale items as cancelled
- **refundSale Foreign Key Violations**:
  - Trying to create salePayment with hardcoded CASH method
  - CASH may not be a valid PaymentMethod in all contexts
  - Should use original payment method or validate method selection

## Common Patterns
1. **Decimal Handling**: Multiple services return Prisma.Decimal objects instead of converting to numbers for test compatibility
2. **Validation Messages**: Need to match test expectations exactly
3. **Method Naming**: Inconsistencies between service method names and test expectations
4. **Parameter Names**: Mismatches like `createdById` vs `performedById`
5. **Business Logic Missing**: Tax, discount, and stock validation calculations not implemented
6. **Return Value Mismatches**: Services returning different structures than tests expect

## Recommended Fix Approach
1. For Decimal issues: Apply `.toNumber()` conversion pattern from cashSessionService
2. For method mismatches: Either rename service methods to match tests or update tests (prefer service changes if tests are correct)
3. For validation messages: Update service to match test expectations
4. For missing business logic: Implement tax, discount, and stock validation calculations
5. For missing methods: Implement expected methods or create adapter/wrapper
6. For import issues: Create paymentService.ts that re-exports SalePaymentService or update test imports

## Next Steps
Proceed to Phase 2 (correction) by fixing each service in order:
1. Payment Service (create wrapper or update imports)
2. Cash Movement Service (fix method names and parameters)
3. Purchase Service (fix Decimals, add tax/discount logic, fix validation)
4. Sale Service (fix Decimals, validation, return values, etc.)