import { Injectable, OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const FALLBACK_DATABASE_URL = "postgresql://user:password@localhost:5432/radial"

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly databaseUrl: string | undefined

  constructor(configService: ConfigService) {
    const databaseUrl =
      configService.get<string>("DATABASE_URL") ?? process.env.DATABASE_URL

    super({
      adapter: new PrismaPg({
        connectionString: databaseUrl ?? FALLBACK_DATABASE_URL,
      }),
    })

    this.databaseUrl = databaseUrl
  }

  assertDatabaseConfigured(): void {
    if (!this.databaseUrl) {
      throw new Error("DATABASE_URL is required to use the Prisma issue store.")
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
