import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { resolve } from "path"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { PrismaModule } from "./database/prisma.module"
import { ISSUE_REPOSITORY } from "./issues/issue.repository"
import { IssueTrackerController } from "./issues/issue-tracker.controller"
import { IssueTrackerService } from "./issues/issue-tracker.service"
import { PrismaIssueRepository } from "./issues/prisma-issue.repository"
import { TrackerAuthGuard } from "./issues/tracker-auth.guard"

const isTestEnvironment = process.env.NODE_ENV === "test"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: isTestEnvironment,
      envFilePath: [
        resolve(process.cwd(), ".env.local"),
        resolve(process.cwd(), "../../.env.local"),
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "../../.env"),
      ],
    }),
    PrismaModule,
  ],
  controllers: [AppController, IssueTrackerController],
  providers: [
    AppService,
    IssueTrackerService,
    TrackerAuthGuard,
    {
      provide: ISSUE_REPOSITORY,
      useClass: PrismaIssueRepository,
    },
  ],
})
export class AppModule {}
