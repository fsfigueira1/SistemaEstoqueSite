# MAPEAMENTO TÉCNICO: MODEL → SERVICE → FUTURA API

## Visão Geral
Este documento mapeia cada model do Prisma Schema para seu service responsável e indica as rotas API futuras recomendadas.

---

## �� 📋 MAPEAMENTO COMPLETO

### 1. User Model
```
Prisma Model: User
��↓
Service: UserService (src/services/userService.ts)
��↓
Métodos Disponíveis:
  - getUsers(filters): List users with pagination/filters
  - getUserById(id): Get user by ID
  - getUserByEmail(email): Get user by email
  - createUser(data): Create new user
  - updateUser(id, data): Update user
  - deactivateUser(id): Deactivate user (soft delete)
  - activateUser(id): Activate user
  - changeUserRole(id, role): Change user role
  - getUserStatistics(): Get user statistics
��↓
Futura API Route: /api/users
��↓
Principais Operações:
  - GET /api/users - List users (com filtros, paginação)
  - GET /api/users/:id - Get user by ID
  - GET /api/users/email/:email - Get user by email
  - POST /api/users - Create new user
  - PUT /api/users/:id - Update user
  - DELETE /api/users/:id - Deactivate user (soft delete)
  - PATCH /api/users/:id/role - Change user role
  - POST /api/users/:id/activate - Activate user
  - GET /api/users/statistics - Get user statistics
```

### 2. PriceHistory Model
```
Prisma Model: PriceHistory
��↓
Service: PriceHistoryService (src/services/priceHistoryService.ts)
��↓
Métodos Disponíveis:
  - getPriceHistory(filters): List price history with pagination/filters
  - getPriceHistoryById(id): Get price history record by ID
  - getPriceHistoryByProduct(productId, options): Get price history for specific product
  - getLatestPrice(productId): Get latest price for product
  - getPriceHistorySummary(productId): Get price history summary for product
��↓
Futura API Route: /api/price-history
��↓
Principais Operações:
  - GET /api/price-history - List price history records (com filtros, paginação)
  - GET /api/price-history/:id - Get price history record by ID
  - GET /api/price-history/product/:productId - Get price history for specific product
  - GET /api/price-history/product/:productId/latest - Get latest price for product
  - GET /api/price-history/product/:productId/summary - Get price history summary for product
```

### 3. Product Model
```
Prisma Model: Product
��↓
Service: ProductService (src/services/productService.ts)
��↓
Métodos Disponíveis:
  - getProducts(filters): List products with pagination/filters
  - getProductById(id): Get product by ID
  - getProductBySku(sku): Get product by SKU
  - getProductByBarcode(barcode): Get product by barcode
  - createProduct(data): Create new product
  - updateProduct(id, data): Update product
  - deactivateProduct(id, reason): Deactivate product (soft delete)
  - activateProduct(id): Activate product
  - getLowStockProducts(): Get low stock products
  - getStockMovements(productId, limit): Get stock movements for product
��↓
Futura API Route: /api/products
��↓
Principais Operações:
  - GET /api/products - List products (com filtros, paginação)
  - GET /api/products/:id - Get product by ID
  - GET /api/products/sku/:sku - Get product by SKU
  - GET /api/products/barcode/:barcode - Get product by barcode
  - POST /api/products - Create new product
  - PUT /api/products/:id - Update product
  - DELETE /api/products/:id - Deactivate product (soft delete)
  - PATCH /api/products/:id/activate - Activate product
  - GET /api/products/low-stock - Get low stock products
  - GET /api/products/:id/stock-movements - Get stock movements for product
```

### 4. StockMovement Model
```
Prisma Model: StockMovement
��↓
Service: StockService (src/services/stockService.ts)
��↓
Métodos Disponíveis:
  - getStockMovements(filters): List stock movements with pagination/filters
  - getStockMovementById(id): Get stock movement by ID
  - createStockMovement(data): Create new stock movement
��↓
Futura API Route: /api/stock-movements
��↓
Principais Operações:
  - GET /api/stock-movements - List stock movements (com filtros, paginação)
  - GET /api/stock-movements/:id - Get stock movement by ID
  - POST /api/stock-movements - Create new stock movement
```

### 5. Category Model
```
Prisma Model: Category
��↓
Service: CategoryService (src/services/categoryService.ts)
��↓
Métodos Disponíveis:
  - getCategories(filters): List categories with pagination/filters
  - getCategoryById(id): Get category by ID
  - createCategory(data): Create new category
  - updateCategory(id, data): Update category
  - deactivateCategory(id): Deactivate category (soft delete)
  - activateCategory(id): Activate category
��↓
Futura API Route: /api/categories
��↓
Principais Operações:
  - GET /api/categories - List categories (com filtros, paginação)
  - GET /api/categories/:id - Get category by ID
  - POST /api/categories - Create new category
  - PUT /api/categories/:id - Update category
  - DELETE /api/categories/:id - Deactivate category (soft delete)
  - PATCH /api/categories/:id/activate - Activate category
```

### 6. Supplier Model
```
Prisma Model: Supplier
��↓
Service: SupplierService (src/services/supplierService.ts)
��↓
Métodos Disponíveis:
  - getSuppliers(filters): List suppliers with pagination/filters
  - getSupplierById(id): Get supplier by ID
  - createSupplier(data): Create new supplier
  - updateSupplier(id, data): Update supplier
  - deactivateSupplier(id): Deactivate supplier (soft delete)
  - activateSupplier(id): Activate supplier
��↓
Futura API Route: /api/suppliers
��↓
Principais Operações:
  - GET /api/suppliers - List suppliers (com filtros, paginação)
  - GET /api/suppliers/:id - Get supplier by ID
  - POST /api/suppliers - Create new supplier
  - PUT /api/suppliers/:id - Update supplier
  - DELETE /api/suppliers/:id - Deactivate supplier (soft delete)
  - PATCH /api/suppliers/:id/activate - Activate supplier
```

### 7. Customer Model
```
Prisma Model: Customer
��↓
Service: CustomerService (src/services/customerService.ts)
��↓
Métodos Disponíveis:
  - getCustomers(filters): List customers with pagination/filters
  - getCustomerById(id): Get customer by ID
  - createCustomer(data): Create new customer
  - updateCustomer(id, data): Update customer
��↓
Futura API Route: /api/customers
��↓
Principais Operações:
  - GET /api/customers - List customers (com filtros, paginação)
  - GET /api/customers/:id - Get customer by ID
  - POST /api/customers - Create new customer
  - PUT /api/customers/:id - Update customer
```

### 8. Payment Model
```
Prisma Model: SalePayment
��↓
Service: PaymentService (src/services/paymentService.ts)
��↓
Métodos Disponíveis:
  - getPayments(filters): List payments with pagination/filters
  - getPaymentById(id): Get payment by ID
  - createPayment(data): Create new payment
  - updatePayment(id, data): Update payment
  - refundPayment(id): Refund payment
��↓
Futura API Route: /api/payments
��↓
Principais Operações:
  - GET /api/payments - List payments (com filtros, paginação)
  - GET /api/payments/:id - Get payment by ID
  - POST /api/payments - Create new payment
  - PUT /api/payments/:id - Update payment
  - POST /api/payments/:id/refund - Refund payment
```

### 9. Sale Model
```
Prisma Model: Sale
��↓
Service: SaleService (src/services/saleService.ts)
��↓
Métodos Disponíveis:
  - getSales(filters): List sales with pagination/filters
  - getSaleById(id): Get sale by ID
  - createSale(data): Create new sale
  - updateSale(id, data): Update sale
  - cancelSale(id): Cancel sale
  - refundSale(id): Refund sale
  - getSaleItems(saleId): Get items for sale
  - getSalePayments(saleId): Get payments for sale
��↓
Futura API Route: /api/sales
��↓
Principais Operações:
  - GET /api/sales - List sales (com filtros, paginação)
  - GET /api/sales/:id - Get sale by ID
  - POST /api/sales - Create new sale
  - PUT /api/sales/:id - Update sale
  - POST /api/sales/:id/cancel - Cancel sale
  - POST /api/sales/:id/refund - Refund sale
  - GET /api/sales/:id/items - Get sale items
  - GET /api/sales/:id/payments - Get sale payments
```

### 10. SaleItem Model
```
Prisma Model: SaleItem
��↓
Service: SaleService (via saleId relationship)
��↓
Métodos Disponíveis:
  - getSaleItems(saleId): Get items for sale (via SaleService)
��↓
Futura API Route: /api/sale-items (nested under sales)
��↓
Principais Operações:
  - GET /api/sales/:saleId/items - Get sale items for specific sale
```

### 11. SalePayment Model
```
Prisma Model: SalePayment
��↓
Service: PaymentService (via saleId relationship)
��↓
Métodos Disponíveis:
  - getSalePayments(saleId): Get payments for sale (via PaymentService)
��↓
Futura API Route: /api/sale-payments (nested under sales)
��↓
Principais Operações:
  - GET /api/sales/:saleId/payments - Get sale payments for specific sale
```

### 12. PurchaseOrder Model
```
Prisma Model: PurchaseOrder
��↓
Service: PurchaseService (src/services/purchaseService.ts)
��↓
Métodos Disponíveis:
  - getPurchaseOrders(filters): List purchase orders with pagination/filters
  - getPurchaseOrderById(id): Get purchase order by ID
  - createPurchaseOrder(data): Create new purchase order
  - updatePurchaseOrder(id, data): Update purchase order
��↓
Futura API Route: /api/purchase-orders
��↓
Principais Operações:
  - GET /api/purchase-orders - List purchase orders (com filtros, paginação)
  - GET /api/purchase-orders/:id - Get purchase order by ID
  - POST /api/purchase-orders - Create new purchase order
  - PUT /api/purchase-orders/:id - Update purchase order
```

### 13. PurchaseOrderItem Model
```
Prisma Model: PurchaseOrderItem
��↓
Service: PurchaseService (via purchaseOrderId relationship)
��↓
Métodos Disponíveis:
  - getPurchaseOrderItems(purchaseOrderId): Get items for purchase order (via PurchaseService)
��↓
Futura API Route: /api/purchase-order-items (nested under purchase-orders)
��↓
Principais Operações:
  - GET /api/purchase-orders/:purchaseOrderId/items - Get purchase order items for specific purchase order
```

### 14. CashRegister Model
```
Prisma Model: CashRegister
��↓
Service: CashRegisterService (src/services/cashRegisterService.ts)
��↓
Métodos Disponíveis:
  - getCashRegisters(filters): List cash registers with pagination/filters
  - getCashRegisterById(id): Get cash register by ID
  - createCashRegister(data): Create new cash register
  - updateCashRegister(id, data): Update cash register
  - deactivateCashRegister(id): Deactivate cash register (soft delete)
  - activateCashRegister(id): Activate cash register
��↓
Futura API Route: /api/cash-registers
��↓
Principais Operações:
  - GET /api/cash-registers - List cash registers (com filtros, paginação)
  - GET /api/cash-registers/:id - Get cash register by ID
  - POST /api/cash-registers - Create new cash register
  - PUT /api/cash-registers/:id - Update cash register
  - DELETE /api/cash-registers/:id - Deactivate cash register (soft delete)
  - PATCH /api/cash-registers/:id/activate - Activate cash register
```

### 15. CashSession Model
```
Prisma Model: CashSession
�↓
Service: CashSessionService (src/services/cashSessionService.ts)
��↓
Métodos Disponíveis:
  - getCashSessions(filters): List cash sessions with pagination/filters
  - getCashSessionById(id): Get cash session by ID
  - openCashSession(data): Open new cash session
  - closeCashSession(id, data): Close cash session
  - getCashSessionSummary(id): Get cash session summary
  - getExpectedAmount(sessionId): Get expected amount for session
��↓
Futura API Route: /api/cash-sessions
��↓
Principais Operações:
  - GET /api/cash-sessions - List cash sessions (com filtros, paginação)
  - GET /api/cash-sessions/:id - Get cash session by ID
  - POST /api/cash-sessions - Open new cash session
  - PUT /api/cash-sessions/:id - Close cash session
  - GET /api/cash-sessions/:id/summary - Get cash session summary
  - GET /api/cash-sessions/:id/expected-amount - Get expected amount for session
```

### 16. CashMovement Model
```
Prisma Model: CashMovement
��↓
Service: CashMovementService (src/services/cashMovementService.ts)
��↓
Métodos Disponíveis:
  - getCashMovements(filters): List cash movements with pagination/filters
  - getCashMovementById(id): Get cash movement by ID
  - createCashMovement(data): Create new cash movement
��↓
Futura API Route: /api/cash-movements
��↓
Principais Operações:
  - GET /api/cash-movements - List cash movements (com filtros, paginação)
  - GET /api/cash-movements/:id - Get cash movement by ID
  - POST /api/cash-movements - Create new cash movement
```

### 17. AuditLog Model
```
Prisma Model: AuditLog
��↓
Service: AuditService (src/services/auditService.ts)
��↓
Métodos Disponíveis:
  - createAuditLog(input): Create audit log entry
  - getAuditLogById(id): Get audit log by ID
  - getAuditLogsForEntity(options): Get audit logs for entity
  - getAuditLogsByUser(options): Get audit logs by user
  - getAuditLogs(options): Get audit logs with pagination/filters
  - getStatistics(options): Get audit log statistics
  - cleanupOldLogs(options): Cleanup old audit logs
��↓
Futura API Route: /api/audit-logs
��↓
Principais Operações:
  - POST /api/audit-logs - Create audit log entry
  - GET /api/audit-logs/:id - Get audit log by ID
  - GET /api/audit-logs/entity/:entity - Get audit logs for entity
  - GET /api/audit-logs/user/:userId - Get audit logs by user
  - GET /api/audit-logs - Get audit logs (com filtros, paginação)
  - GET /api/audit-logs/statistics - Get audit log statistics
  - DELETE /api/audit-logs/cleanup - Cleanup old audit logs
```

---

## �� 🔍 ANÁLISE DE COBERTURA

### � ✅ Models Com Services Dedicated (17/17)
- User � ✅
- PriceHistory � ✅
- Product � ✅
- StockMovement � ✅
- Category � ✅
- Supplier � ✅
- Customer � ✅
- SalePayment (Payment) � ✅
- Sale � ✅
- PurchaseOrder � ✅
- CashRegister � ✅
- CashSession � ✅
- CashMovement � ✅
- AuditLog � ✅

### �� 📝 Observações sobre Relacionamentos
Alguns models são acessados através de relacionamentos em outros services:
- SaleItem: Acessado via SaleService.getSaleItems(saleId)
- SalePayment: Acessado via PaymentService.getSalePayments(saleId)
- PurchaseOrderItem: Acessado via PurchaseService.getPurchaseOrderItems(purchaseOrderId)

Esta abordagem é aceitável mantém a separação de responsabilidades.

---

## �� 🎯 PRÓXIMOS PASSOS RECOMENDADOS PARA FASE 3

Baseado neste mapeamento, a FASE 3 (API Layer) deveria:

1. **Criar rotas API RESTful** seguindo o padrão estabelecido
2. **Manter consistência nos métodos HTTP** e códigos de status
3. **Implementar tratamento de erros padronizado**
4. **Validar dados de entrada** antes de chamar os services
5. **Manter a mesma estrutura de resposta** dos services (dados + paginação quando aplicável)
6. **Usar os services existentes** diretamente sem duplicar lógica
7. **Seguir as convenções de nomenclatura** estabelecidas
8. **Manter compatibilidade com Next.js App Router**

O mapeamento mostra que **todos os models têm services dedicados** e estão prontos para exposição via API, com exceção de alguns modelos de relacionamento que são naturalmente acessados através dos services principais.