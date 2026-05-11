import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common"
import { IssueTrackerService } from "./issue-tracker.service"
import { TrackerAuthGuard } from "./tracker-auth.guard"

@Controller("v1")
@UseGuards(TrackerAuthGuard)
export class IssueTrackerController {
  constructor(private readonly issueTracker: IssueTrackerService) {}

  @Post("issues/search")
  @HttpCode(200)
  searchIssues(@Body() body: unknown) {
    return {
      issues: this.issueTracker.searchIssues(body),
    }
  }

  @Post("issues/lookup")
  @HttpCode(200)
  lookupIssues(@Body() body: unknown) {
    return {
      issues: this.issueTracker.lookupIssues(body),
    }
  }

  @Post("issues")
  createIssue(@Body() body: unknown) {
    return {
      issue: this.issueTracker.createIssue(body),
    }
  }

  @Get("issues/:issueId")
  getIssue(@Param("issueId") issueId: string) {
    return {
      issue: this.issueTracker.getIssue(issueId),
    }
  }

  @Patch("issues/:issueId")
  updateIssue(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      issue: this.issueTracker.updateIssue(issueId, body),
    }
  }

  @Get("issues/:issueId/comments")
  listComments(
    @Param("issueId") issueId: string,
    @Query("include_resolved") includeResolved?: string
  ) {
    return {
      comments: this.issueTracker.listComments(
        issueId,
        includeResolved === "true"
      ),
    }
  }

  @Post("issues/:issueId/comments")
  createComment(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      comment: this.issueTracker.createComment(issueId, body),
    }
  }

  @Patch("comments/:commentId")
  updateComment(@Param("commentId") commentId: string, @Body() body: unknown) {
    return {
      comment: this.issueTracker.updateComment(commentId, body),
    }
  }

  @Delete("comments/:commentId")
  deactivateComment(@Param("commentId") commentId: string) {
    return {
      comment: this.issueTracker.deactivateComment(commentId),
    }
  }

  @Get("issues/:issueId/links")
  listLinks(@Param("issueId") issueId: string) {
    return {
      links: this.issueTracker.listLinks(issueId),
    }
  }

  @Post("issues/:issueId/links")
  attachLink(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      link: this.issueTracker.attachLink(issueId, body),
    }
  }

  @Post("issues/:issueId/relations")
  createRelation(@Param("issueId") issueId: string, @Body() body: unknown) {
    return {
      relation: this.issueTracker.createRelation(issueId, body),
    }
  }

  @Get("users/me")
  getCurrentUser() {
    return {
      user: this.issueTracker.getCurrentUser(),
    }
  }
}
