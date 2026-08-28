import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("\u{1F331} Starting database seed...")

  // Create the default system user for the desktop app
  // This user is used for all operations requiring a user ID (openedById, createdById, processedById)
  console.log("Creating system user...")
  const systemUser = await prisma.user.upsert({
    where: { email: "system@lacolaria.local" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Sistema Laçolaria",
      email: "system@lacolaria.local",
      password: "system-user-no-login", // This user CANNOT log in - password is invalid for auth
      role: "ADMIN",
      status: "ACTIVE",
    },
  })
  console.log("✅ System user created:", systemUser.id)

  // Create a default cash register if none exists
  console.log("Checking for cash registers...")
  const cashRegisterCount = await prisma.cashRegister.count()
  if (cashRegisterCount === 0) {
    const cashRegister = await prisma.cashRegister.create({
      data: {
        name: "Caixa Principal",
        description: "Caixa principal do sistema",
        isActive: true,
      },
    })
    console.log("✅ Default cash register created:", cashRegister.id)
  } else {
    console.log("✅ Cash registers already exist (" + cashRegisterCount + " found)")
  }

  // Create a default category if none exists
  console.log("Checking for categories...")
  const categoryCount = await prisma.category.count()
  if (categoryCount === 0) {
    const category = await prisma.category.create({
      data: {
        name: "Sem categoria",
        description: "Categoria padrão para produtos sem classificação",
        icon: "Tag",
        color: "#6B7280",
      },
    })
    console.log("✅ Default category created:", category.id)
  } else {
    console.log("✅ Categories already exist (" + categoryCount + " found)")
  }

  console.log("\u{1F389} Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })