-- Etiquetas de gôndola e promoção (aplicado também em runtime por src/lib/schemaUpgrade.ts)
CREATE TABLE IF NOT EXISTS "ProductLabel" (
    "productId" TEXT NOT NULL,
    "compareAtPrice" DECIMAL(65,30),
    "promoUntil" TIMESTAMP(3),
    "labelPrice" DECIMAL(65,30),
    "labelCompareAt" DECIMAL(65,30),
    "labelPrintedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductLabel_pkey" PRIMARY KEY ("productId"),
    CONSTRAINT "ProductLabel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
