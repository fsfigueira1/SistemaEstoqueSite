const { PrismaClient } = require('../src/generated/prisma')

const prisma = new PrismaClient()

async function main() {
  console.log("Creating system user...")

  // Create the default system user for the desktop app
  const systemUser = await prisma.user.upsert({
    where: { email: "system@lacolaria.local" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Sistema Laçolaria",
      email: "system@lacolaria.local",
      password: "system-user-no-login",
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

  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })