import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"

export async function getSystemUserId(): Promise<string> {
  try {
    const user = await prisma.user.findUnique({ where: { id: "1" } });
    if (user) {
      return "1";
    }
    // If not found, create a default user
    const createdUser = await prisma.user.create({
      data: {
        id: "1",
        name: "System User",
        email: "system@lacolaria.com.br",
        role: Role.OWNER,
        password: "dummy", // This is a dummy password, not used for actual authentication in this context
      },
    });
    return createdUser.id;
  } catch (error) {
    console.error('Error ensuring system user exists:', error);
    // Fallback to returning "1" anyway, hoping it exists
    return "1";
  }
}

export async function getSystemUser() {
  const id = await getSystemUserId();
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    return {
      id: user.id,
      name: user.name,
      role: user.role as Role,
    };
  }
  // Fallback
  return {
    id: "1",
    name: "System User",
    role: Role.OWNER as Role,
  };
}