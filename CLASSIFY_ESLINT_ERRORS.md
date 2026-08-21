# CLASSIFICAÇÃO DOS ERROS ESLINT

## A - Código de produção realmente utilizado (src/)

### src/services/cashMovementService.ts
- 6x @typescript-eslint/no-explicit-any
- 2x @typescript-eslint/no-unused-vars

### src/services/saleService.ts
- 6x @typescript-eslint/no-explicit-any
- 2x @typescript-eslint/no-unused-vars

### src/services/salePaymentService.ts
- 6x @typescript-eslint/no-explicit-any

### src/services/stockService.ts
- 4x @typescript-eslint/no-explicit-any
- 2x @typescript-eslint/no-unused-vars

### src/services/purchaseService.ts
- (verificar contagem específica)

### src/lib/prisma.ts
- (verificar se tem erros)

## B - Testes

### auditService.test.ts
- 7x @typescript-eslint/no-unused-vars
- 5x @typescript-eslint/no-explicit-any

### paymentService.test.ts
- 8x @typescript-eslint/no-explicit-any
- 2x @typescript-eslint/no-unused-vars

### saleService.test.ts
- 7x @typescript-eslint/no-explicit-any
- 2x @typescript-eslint/no-unused-vars

### customerService.test.ts
- 4x @typescript-eslint/no-unused-vars
- 4x @typescript-eslint/no-explicit-any

### stockService.test.ts
- 6x @typescript-eslint/no-unused-vars
- 2x @typescript-eslint/no-explicit-any

### cashMovementService.test.ts
- 5x @typescript-eslint/no-explicit-any
- 1x @typescript-eslint/no-unused-vars

### categoryService.test.ts
- (verificar contagem específica)

### supplierService.test.ts
- (verificar contagem específica)

### priceHistoryService.test.ts
- 1x @typescript-eslint/no-unused-vars

## C - Scripts debug/check

### debug*.js files
- (verificar se têm erros ESLint)

### check-*.js files
- (verificar se têm erros ESLint)

### test-*.js files
- (verificar se têm erros ESLint)

## D - Arquivos temporários
### temp/
- (verificar se têm erros ESLint)

## E - Arquivos gerados
### src/generated/prisma/*
- (arquivos gerados pelo Prisma CLI - normalmente não devem ter erros de lint)

## F - Configuração
### .eslintrc.js ou similar
- (verificar configuração do ESLint)