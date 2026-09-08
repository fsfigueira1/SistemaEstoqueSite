import "dotenv/config";
import { hash } from "bcryptjs"
import { prisma } from "../lib/prisma.ts"

async function main() {
  console.log("Starting database seed...")

  // Linha única de configurações da loja
  await prisma.settings.upsert({ where: { id: "app" }, update: {}, create: { id: "app" } })

  // Create default categories
  const categories = await prisma.category.createManyAndReturn({
    data: [
      { name: "Escrita", description: "Canetas, lápis, marcadores", icon: "PenTool", color: "#3B82F6" },
      { name: "Papélaria", description: "Cadernos, blocos, papers", icon: "NotePen", color: "#10B981" },
      { name: "Arte", description: "Tintas, pincéis, papel desenho", icon: "Palette", color: "#F59E0B" },
      { name: "Escolar", description: "Mochilas, estojos, material escolar", icon: "Backpack", color: "#8B5CF6" },
      { name: "Informática", description: "CDs, DVDs, pendrives", icon: "Laptop", color: "#EF4444" }
    ]
  })
  
  console.log(`Created ${categories.length} categories`)
  
  // Create default suppliers
  const suppliers = await prisma.supplier.createManyAndReturn({
    data: [
      { 
        name: "Papélaria São Luiz", 
        contactName: "João Silva",
        email: "contato@saoluiz.com.br",
        phone: "(11) 3333-4444",
        address: "Rua das Flores, 123 - São Paulo, SP"
      },
      { 
        name: "Canetas Globo", 
        contactName: "Maria Oliveira",
        email: "vendas@globocanetas.com.br",
        phone: "(11) 9999-8888",
        address: "Av. Paulista, 1000 - São Paulo, SP"
      },
      { 
        name: "Arte Total", 
        contactName: "Carlos Santos",
        email: "contato@artetotal.com.br",
        phone: "(11) 5555-7777",
        address: "Rua Augusta, 500 - São Paulo, SP"
      }
    ]
  })
  
  console.log(`Created ${suppliers.length} suppliers`)
  
  // Create default admin user
  const hashedPassword = await hash("admin123", 12)
  
  const adminUser = await prisma.user.create({
    data: {
      name: "Administrador",
      email: "admin@lacolaria.com.br",
      password: hashedPassword,
      role: "ADMIN"
    }
  })
  
  console.log(`Created admin user: ${adminUser.email}`)

  // Create default cash register
  const cashRegister = await prisma.cashRegister.create({
    data: {
      name: "Caixa Principal",
      description: "Caixa principal da loja",
      isActive: true
    }
  })

  console.log(`Created cash register: ${cashRegister.name}`)

  // Create sample products
  const products = await prisma.product.createManyAndReturn({
    data: [
      {
        name: "Caneta Esferográfica BIC Cristal Azul",
        description: "Caneta esferográfica con tinta azul, escritura suave",
        sku: "BIC-CRI-AZ-001",
        barcode: "7891000123457",
        categoryId: categories[0].id, // Escrita
        supplierId: suppliers[0].id, // Papelaria São Luiz
        costPrice: 0.80,
        salePrice: 1.50,
        stockQuantity: 150,
        minStockLevel: 20,
        maxStockLevel: 500,
        unit: "unidade",
        status: "ACTIVE",
        isFeatured: true
      },
      {
        name: "Caderno Universitário 100 folhas - Capa Dura",
        description: "Caderno universitario con 100 folhas pautadas, tapa dura",
        sku: "CAD-UNI-100HD-001",
        barcode: "7891000123464",
        categoryId: categories[1].id, // Papelaria
        supplierId: suppliers[1].id, // Canetas Globo
        costPrice: 8.50,
        salePrice: 12.90,
        stockQuantity: 89,
        minStockLevel: 15,
        maxStockLevel: 200,
        unit: "unidade",
        status: "ACTIVE",
        isFeatured: true
      },
      {
        name: "Lápis HB #2 Faber-Castell",
        description: "Lápis grafite HB #2 para escritura y dibuj",
        sku: "FC-HB-001",
        barcode: "7891000123471",
        categoryId: categories[0].id, // Escrita
        supplierId: suppliers[0].id, // Papelaria São Luiz
        costPrice: 0.25,
        salePrice: 0.50,
        stockQuantity: 300,
        minStockLevel: 50,
        maxStockLevel: 1000,
        unit: "unidade",
        status: "ACTIVE"
      },
      {
        name: "Mochila Escolar Rodinha Infantil",
        description: "Mochila escolar con rodinha para niño, talla mediana",
        sku: "MOCH-ROD-INF-001",
        barcode: "7891000123488",
        categoryId: categories[3].id, // Escolar
        supplierId: suppliers[2].id, // Arte Total
        costPrice: 45.00,
        salePrice: 89.90,
        stockQuantity: 25,
        minStockLevel: 5,
        maxStockLevel: 100,
        unit: "unidade",
        status: "ACTIVE",
        isFeatured: false
      }
    ]
  })
  
  console.log(`Created ${products.length} products`)
  
  console.log("Database seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("Seeding failed: ", e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
