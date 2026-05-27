import { config } from "dotenv";
// Load .env.local first (Vercel CLI pull), then fall back to .env
config({ path: ".env.local", override: true });
config({ path: ".env" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
