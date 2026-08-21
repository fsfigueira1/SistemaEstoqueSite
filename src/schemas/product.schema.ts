import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  sku: z.string().min(3, "SKU must be at least 3 characters"),
  barcode: z.string().optional(),
  categoryId: z.string().uuid("Invalid category ID"),
  supplierId: z.string().uuid("Invalid supplier ID").optional(),
  purchasePrice: z.number().nonnegative("Purchase price must be non-negative"),
  salePrice: z.number().nonnegative("Sale price must be non-negative"),
  stockQuantity: z.number().int().nonnegative("Stock quantity must be a non-negative integer"),
  minStockLevel: z.number().int().nonnegative("Minimum stock level must be non-negative"),
  maxStockLevel: z.number().int().nonnegative("Maximum stock level must be non-negative"),
  unit: z.string().default("unidade"),
  weight: z.number().nonnegative().optional(),
  dimensions: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).default("ACTIVE"),
  isFeatured: z.boolean().default(false)
}).refine(
  (data) => data.salePrice >= data.purchasePrice,
  {
    message: "Sale price must be greater than or equal to purchase price",
    path: ["salePrice"]
  }
)

export const productIdSchema = z.string().uuid("Invalid product ID")

export type ProductFormValues = z.infer<typeof productSchema>
