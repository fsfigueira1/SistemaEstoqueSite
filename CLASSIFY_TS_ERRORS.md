# CLASSIFICAÇÃO DOS ERROS TYPESCRIPT

## A - Código de produção realmente utilizado (src/)

### src/services/purchaseService.ts
- Linha 163: TS2362 - Operação aritmética com tipo inadequado
- Linha 191: TS2339 - Propriedade 'unitCost' não existe  
- Linha 191: TS2339 - Propriedade 'unitCost' não existe (segunda ocorrência)
- Linha 349: TS2362 - Operação aritmética com tipo inadequado

### src/services/salePaymentService.ts
- Linha 451: TS2339 - Propriedade 'totalAmount' não existe 
- Linha 451: TS2339 - Propriedade 'totalAmount' não existe (segunda ocorrência)

### src/services/saleService.ts
- Linha 142: TS2358 - Expressão 'instanceof' com tipo inadequado
- Linha 715: TS7006 - Parâmetro 'p' tem tipo 'any' implícito

### src/lib/prisma.ts
- (verificar se tem erros)

## B - Testes

### tests/cashMovementService.test.ts
- Linha 46: TS2345 - Argumento incompatível para CreateCashMovementInput (propriedade 'type')

### tests/cashRegisterService.test.ts
- Linha 421: TS1117 - Objeto literal com propriedades duplicadas

### tests/cashSessionService.test.ts
- Linha 152: TS18047 - 'openSession' possivelmente 'null'
- Linha 153: TS18047 - 'openSession' possivelmente 'null' 
- Linha 291: TS18048 - 'overMovement' possivelmente 'undefined'
- Linha 341: TS18048 - 'shortMovement' possivelmente 'undefined'
- Linha 699: TS18047 - 'summary.closedBy' possivelmente 'null'

### tests/saleService.test.ts
- Múltiplas linhas: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas ('unitPrice' não existe)
- Linha 649: TS18048 - 'saleMovement' possivelmente 'undefined'
- Linha 650: TS18048 - 'saleMovement' possivelmente 'undefined'
- Linha 761: TS2339 - Propriedade 'status' não existe
- Linha 785: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas
- Linha 813: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas
- Linha 840: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas
- Linha 877: TS18048 - 'refundMovement' possivelmente 'undefined'
- Linha 878: TS18048 - 'refundMovement' possivelmente 'undefined'
- Linha 896: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas
- Linha 918: TS2353 - Objeto literal pode apenas especificar propriedades conhecidas

### tests/stockService.test.ts
- Linha 296: TS2339 - Propriedade 'message' não existe

### tests/check-*.ts
- Múltiplos arquivos: TS2503 - Não consegue encontrar namespace 'Prisma'

## C - Scripts debug/check

### debug-sale-test.ts
- Linha 9: TS2322 - Tipo não atribuível a ProductCreateInput (falta propriedade 'category')
- Linha 23: TS2322 - Tipo não atribuível a SaleCreateInput (faltam propriedades 'cashSession', 'createdBy')

### todo:
- debug.js
- debug_create.js
- debug_create.mjs
- debug-test.js
- debug.mjs
- debug_create.mjs

## D - Arquivos temporários
(Nenhum identificado ainda)

## E - Arquivos gerados
- src/generated/prisma/* (arquivos gerados pelo Prisma CLI)

## F - Configuração
(Não aplicável para TypeScript diretamente)