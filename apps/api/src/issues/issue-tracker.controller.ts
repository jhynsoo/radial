import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common"
import { IssueTrackerService } from "./issue-tracker.service"
import { TrackerAuthGuard } from "./tracker-auth.guard"

@Controller("v1")
@UseGuards(TrackerAuthGuard)
export class IssueTrackerController {
  constructor(private readonly issueTracker: IssueTrackerService) {}

  @Get("teams")
  async listTeams() {
    return {
      teams: await this.issueTracker.listTeams(),
    }
  }

  @Post("teams")
  async createTeam(@Body() body: unknown) {
    return {
      team: await this.issueTracker.createTeam(body),
    }
  }

  @Get("teams/:teamKey/workflow-states")
  async listWorkflowStates(@Param("teamKey") teamKey: string) {
    return {
      states: await this.issueTracker.listWorkflowStates(teamKey),
    }
  }

  @Put("teams/:teamKey/workflow-states")
  async replaceWorkflowStates(
    @Param("teamKey") teamKey: string,
    @Body() body: unknown
  ) {
    return {
      states: await this.issueTracker.replaceWorkflowStates(teamKey, body),
    }
  }

  @Get("projects")
  async listProjects() {
    return {
      projects: await this.issueTracker.listProjects(),
    }
  }

  @Post("projects")
  async createProject(@Body() body: unknown) {
    return {
      project: await this.issueTracker.createProject(body),
    }
  }

  @Get("projects/:projectSlug/milestones")
  async listProjectMilestones(@Param("projectSlug") projectSlug: string) {
    return {
      milestones: await this.issueTracker.listProjectMilestones(projectSlug),
    }
  }

  @Post("projects/:projectSlug/milestones")
  async createProjectMilestone(
    @Param("projectSlug") projectSlug: string,
    @Body() body: unknown
  ) {
    return {
      milestone: await this.issueTracker.createProjectMilestone(
        projectSlug,
        body
      ),
    }
  }

  @Get("teams/:teamKey/cycles")
  async listCycles(@Param("teamKey") teamKey: string) {
    return {
      cycles: await this.issueTracker.listCycles(teamKey),
    }
  }

  @Post("teams/:teamKey/cycles")
  async createCycle(@Param("teamKey") teamKey: string, @Body() body: unknown) {
    return {
      cycle: await this.issueTracker.createCycle(teamKey, body),
    }
  }

  @Get("projects/:projectSlug/views")
  async listIssueViews(@Param("projectSlug") projectSlug: string) {
    return {
      views: await this.issueTracker.listIssueViews(projectSlug),
    }
  }

  @Post("projects/:projectSlug/views")
  async createIssueView(
    @Param("projectSlug") projectSlug: string,
    @Body() body: unknown
  ) {
    return {
      view: await this.issueTracker.createIssueView(projectSlug, body),
    }
  }

  @Patch("views/:viewId")
  async updateIssueView(
    @Param("viewId") viewId: string,
    @Body() body: unknown
  ) {
    return {
      view: await this.issueTracker.updateIssueView(viewId, body),
    }
  }

  @Delete("views/:viewId")
  async deleteIssueView(@Param("viewId") viewId: string) {
    return {
      view: await this.issueTracker.deleteIssueView(viewId),
    }
  }

  @Post("issues/search")
  @HttpCode(200)
  async searchIssues(@Body() body: unknown) {
    return {
      issues: await this.issueTracker.searchIssues(body),
    }
  }

  @Post("issues/lookup")
  @HttpCode(200)
  async lookupIssues(@Body() body: unknown) {
    return {
      issues: await this.issueTracker.lookupIssues(body),
    }
  }

  @Post("issues")
  async createIssue(@Body() body: unknown) {
    return {
      issue: await this.issueTracker.createIssue(body),
    }
  }

  @Get("issues/:issueId")
  async getIssue(@Param("issueId") issueId: string) {
    return {
      issue: await this.issueTracker.getIssue(issueId),
    }
  }

  @Patch("issues/:issueId")
  async updateIssue(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      issue: await this.issueTracker.updateIssue(issueId, body),
    }
  }

  @Get("issues/:issueId/comments")
  async listComments(
    @Param("issueId") issueId: string,
    @Query("include_resolved") includeResolved?: string
  ) {
    return {
      comments: await this.issueTracker.listComments(
        issueId,
        includeResolved === "true"
      ),
    }
  }

  @Post("issues/:issueId/comments")
  async createComment(
    @Param("issueId") issueId: string,
    @Body() body: unknown
  ) {
    return {
      comment: await this.issueTracker.createComment(issueId, body),
    }
  }

  @Patch("comments/:commentId")
  async updateComment(
    @Param("commentId") commentId: string,
    @Body() body: unknown
  ) {
    return {
      comment: await this.issueTracker.updateComment(commentId, body),
    }
  }

  @Delete("comments/:commentId")
  async deactivateComment(@Param("commentId") commentId: string) {
    return {
      comment: await this.issueTracker.deactivateComment(commentId),
    }
  }

  @Get("issues/:issueId/links")
  async listLinks(@Param("issueId") issueId: string) {
    return {
      links: await this.issueTracker.listLinks(issueId),
    }
  }

  @Post("issues/:issueId/links")
  async attachLink(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      link: await this.issueTracker.attachLink(issueId, body),
    }
  }

  @Post("issues/:issueId/relations")
  async createRelation(
    @Param("issueId") issueId: string,
    @Body() body: unknown
  ) {
    return {
      relation: await this.issueTracker.createRelation(issueId, body),
    }
  }

  @Get("users/me")
  getCurrentUser() {
    return {
      user: this.issueTracker.getCurrentUser(),
    }
  }
}
