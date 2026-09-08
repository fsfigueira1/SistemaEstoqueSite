import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // servidor auto-contido para empacotar no Electron
  output: "standalone",
  // Prisma + driver pg ficam como require() de verdade (não bundlados),
  // e o cliente gerado é copiado inteiro para o standalone.
  serverExternalPackages: ["@prisma/adapter-pg", "@prisma/client", "pg"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./src/generated/prisma/**/*",
      "./node_modules/@prisma/adapter-pg/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/pg/**/*",
      "./node_modules/pg-pool/**/*",
      "./node_modules/pg-connection-string/**/*",
      "./node_modules/pgpass/**/*",
      "./node_modules/pg-types/**/*",
      "./node_modules/postgres-array/**/*",
      "./node_modules/postgres-bytea/**/*",
      "./node_modules/postgres-date/**/*",
      "./node_modules/postgres-interval/**/*",
    ],
  },
};

export default nextConfig;
