-- Chave de idempotência do PDV offline: vendas na fila local levam um
-- clientId (UUID gerado no navegador). No flush, se já existe venda com
-- esse clientId, o servidor devolve a existente em vez de duplicar.
ALTER TABLE "Sale" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_clientId_key" ON "Sale"("clientId");
