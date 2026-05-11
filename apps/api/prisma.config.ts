import { resolve } from "node:path"
import { config } from "dotenv"
import { defineConfig } from "prisma/config"

if (!process.env["DATABASE_URL"]) {
  for (const envFilePath of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "../../.env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    config({ path: envFilePath, override: false, quiet: true })
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
