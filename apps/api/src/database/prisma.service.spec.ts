import { ConfigService } from "@nestjs/config"
import { PrismaService } from "./prisma.service"

describe("PrismaService", () => {
  let originalDatabaseUrl: string | undefined

  beforeEach(() => {
    originalDatabaseUrl = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
  })

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
      return
    }

    process.env.DATABASE_URL = originalDatabaseUrl
  })

  it("accepts DATABASE_URL from ConfigService", () => {
    const service = new PrismaService(configServiceWithDatabaseUrl())

    expect(() => service.assertDatabaseConfigured()).not.toThrow()
  })

  it("falls back to process env DATABASE_URL", () => {
    process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/env"
    const service = new PrismaService(configServiceWithoutDatabaseUrl())

    expect(() => service.assertDatabaseConfigured()).not.toThrow()
  })

  it("throws when DATABASE_URL is not configured", () => {
    const service = new PrismaService(configServiceWithoutDatabaseUrl())

    expect(() => service.assertDatabaseConfigured()).toThrow(
      "DATABASE_URL is required to use the Prisma issue store."
    )
  })

  it("disconnects when the module is destroyed", async () => {
    const service = new PrismaService(configServiceWithDatabaseUrl())
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue()

    await service.onModuleDestroy()

    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})

function configServiceWithDatabaseUrl(
  databaseUrl = "postgresql://user:password@localhost:5432/radial"
): ConfigService {
  return {
    get: jest.fn(() => databaseUrl),
  } as unknown as ConfigService
}

function configServiceWithoutDatabaseUrl(): ConfigService {
  return {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService
}
