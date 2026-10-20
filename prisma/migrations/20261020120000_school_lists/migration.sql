-- Listas escolares salvas (aplicado também em runtime por src/lib/schemaUpgrade.ts)
CREATE TABLE IF NOT EXISTS "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "School_slug_key" ON "School"("slug");

CREATE TABLE IF NOT EXISTS "SchoolList" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "schoolYear" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolList_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolList_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolList_code_key" ON "SchoolList"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "SchoolList_schoolId_grade_schoolYear_key" ON "SchoolList"("schoolId", "grade", "schoolYear");

CREATE TABLE IF NOT EXISTS "SchoolListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "raw" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "productId" TEXT,
    CONSTRAINT "SchoolListItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SchoolList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchoolListItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SchoolListItem_listId_idx" ON "SchoolListItem"("listId");
CREATE INDEX IF NOT EXISTS "SchoolListItem_productId_idx" ON "SchoolListItem"("productId");
