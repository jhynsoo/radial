import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"
import { AppService } from "./app.service"
import { IssueTrackerController } from "./issues/issue-tracker.controller"
import { IssueTrackerService } from "./issues/issue-tracker.service"
import { TrackerAuthGuard } from "./issues/tracker-auth.guard"

@Module({
  imports: [],
  controllers: [AppController, IssueTrackerController],
  providers: [AppService, IssueTrackerService, TrackerAuthGuard],
})
export class AppModule {}
