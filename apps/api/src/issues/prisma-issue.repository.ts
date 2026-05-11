import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../database/prisma.service"
import {
  IssueComment,
  IssueLink,
  IssueRecord,
  IssueRelation,
} from "./issue.types"
import {
  IssueRepository,
  NewIssueRecord,
  issueIdentifierPrefix,
} from "./issue.repository"

const issueInclude = {
  labels: {
    orderBy: {
      label: "asc",
    },
  },
  blockers: true,
  externalBlockers: true,
  comments: {
    orderBy: {
      createdAt: "asc",
    },
  },
  links: {
    orderBy: {
      createdAt: "asc",
    },
  },
  relations: {
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.IssueInclude

type PersistedIssue = Prisma.IssueGetPayload<{
  include: typeof issueInclude
}>

type IssueCommentRecord = Prisma.IssueCommentGetPayload<object>
type IssueLinkRecord = Prisma.IssueLinkGetPayload<object>
type IssueRelationRecord = Prisma.IssueRelationGetPayload<object>

@Injectable()
export class PrismaIssueRepository implements IssueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchIssues(params: {
    project: string
    states: string[]
    assignee: string | null
  }): Promise<IssueRecord[]> {
    this.prisma.assertDatabaseConfigured()

    if (params.states.length === 0) {
      return []
    }

    const issues = await this.prisma.issue.findMany({
      where: {
        project: params.project,
        assignee: params.assignee === null ? undefined : params.assignee,
        OR: params.states.map((state) => ({
          state: {
            equals: state,
            mode: Prisma.QueryMode.insensitive,
          },
        })),
      },
      include: issueInclude,
      orderBy: {
        createdAt: "asc",
      },
    })

    return issues.map((issue) => this.toIssueRecord(issue))
  }

  async findIssuesByIds(ids: string[]): Promise<IssueRecord[]> {
    this.prisma.assertDatabaseConfigured()

    if (ids.length === 0) {
      return []
    }

    const issues = await this.prisma.issue.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      include: issueInclude,
    })
    const issuesById = new Map(
      issues.map((issue) => [issue.id, this.toIssueRecord(issue)])
    )

    return ids
      .map((id) => issuesById.get(id))
      .filter((issue): issue is IssueRecord => issue !== undefined)
  }

  async findIssueById(issueId: string): Promise<IssueRecord | null> {
    this.prisma.assertDatabaseConfigured()

    const issue = await this.prisma.issue.findUnique({
      where: {
        id: issueId,
      },
      include: issueInclude,
    })

    return issue ? this.toIssueRecord(issue) : null
  }

  async issueExists(issueId: string): Promise<boolean> {
    this.prisma.assertDatabaseConfigured()

    const count = await this.prisma.issue.count({
      where: {
        id: issueId,
      },
    })

    return count > 0
  }

  async createIssue(issue: NewIssueRecord): Promise<IssueRecord> {
    this.prisma.assertDatabaseConfigured()

    const created = await this.prisma.$transaction(async (tx) => {
      const identifier = await this.nextIdentifier(
        tx,
        issue.project,
        issue.created_at
      )

      await tx.issue.create({
        data: {
          id: issue.id,
          identifier,
          project: issue.project,
          title: issue.title,
          description: issue.description,
          priority: issue.priority,
          state: issue.state,
          branchName: issue.branch_name,
          url: issue.url,
          assignee: issue.assignee,
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
        },
      })

      if (issue.labels.length > 0) {
        await tx.issueLabel.createMany({
          data: issue.labels.map((label) => ({
            issueId: issue.id,
            label,
          })),
          skipDuplicates: true,
        })
      }

      if (issue.blocked_by_ids.length > 0) {
        await tx.issueBlocker.createMany({
          data: issue.blocked_by_ids.map((blockerIssueId) => ({
            issueId: issue.id,
            blockerIssueId,
          })),
          skipDuplicates: true,
        })
      }

      if (issue.external_blockers.length > 0) {
        await tx.issueExternalBlocker.createMany({
          data: issue.external_blockers.map((blocker) => ({
            id: `external-blocker-${randomUUID()}`,
            issueId: issue.id,
            blockerId: blocker.id,
            identifier: blocker.identifier,
            state: blocker.state,
          })),
        })
      }

      return tx.issue.findUnique({
        where: {
          id: issue.id,
        },
        include: issueInclude,
      })
    })

    if (!created) {
      throw new Error(`Created issue '${issue.id}' could not be loaded.`)
    }

    return this.toIssueRecord(created)
  }

  async updateIssueState(
    issueId: string,
    state: string,
    updatedAt: string
  ): Promise<IssueRecord | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      await this.prisma.issue.update({
        where: {
          id: issueId,
        },
        data: {
          state,
          updatedAt: new Date(updatedAt),
        },
      })
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }

    return this.findIssueById(issueId)
  }

  async createComment(
    issueId: string,
    comment: IssueComment,
    updatedAt: string
  ): Promise<IssueComment | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const createdComment = await tx.issueComment.create({
          data: {
            id: comment.id,
            issueId,
            body: comment.body,
            resolved: comment.resolved,
            createdAt: new Date(comment.created_at),
            updatedAt: new Date(comment.updated_at),
          },
        })

        await tx.issue.update({
          where: {
            id: issueId,
          },
          data: {
            updatedAt: new Date(updatedAt),
          },
        })

        return createdComment
      })

      return toIssueComment(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async updateComment(
    commentId: string,
    body: string,
    updatedAt: string
  ): Promise<IssueComment | null> {
    this.prisma.assertDatabaseConfigured()

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.issueComment.findUnique({
        where: {
          id: commentId,
        },
      })

      if (!existing) {
        return null
      }

      const updatedComment = await tx.issueComment.update({
        where: {
          id: commentId,
        },
        data: {
          body,
          updatedAt: new Date(updatedAt),
        },
      })

      await tx.issue.update({
        where: {
          id: existing.issueId,
        },
        data: {
          updatedAt: new Date(updatedAt),
        },
      })

      return updatedComment
    })

    return updated ? toIssueComment(updated) : null
  }

  async deactivateComment(
    commentId: string,
    updatedAt: string
  ): Promise<IssueComment | null> {
    this.prisma.assertDatabaseConfigured()

    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.issueComment.findUnique({
        where: {
          id: commentId,
        },
      })

      if (!existing) {
        return null
      }

      const updatedComment = await tx.issueComment.update({
        where: {
          id: commentId,
        },
        data: {
          resolved: true,
          updatedAt: new Date(updatedAt),
        },
      })

      await tx.issue.update({
        where: {
          id: existing.issueId,
        },
        data: {
          updatedAt: new Date(updatedAt),
        },
      })

      return updatedComment
    })

    return updated ? toIssueComment(updated) : null
  }

  async attachLink(
    issueId: string,
    link: IssueLink,
    updatedAt: string
  ): Promise<IssueLink | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const createdLink = await tx.issueLink.create({
          data: {
            id: link.id,
            issueId,
            url: link.url,
            title: link.title,
            type: link.type,
            createdAt: new Date(link.created_at),
          },
        })

        await tx.issue.update({
          where: {
            id: issueId,
          },
          data: {
            updatedAt: new Date(updatedAt),
          },
        })

        return createdLink
      })

      return toIssueLink(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async createRelation(
    relation: IssueRelation,
    updatedAt: string
  ): Promise<IssueRelation | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const createdRelation = await tx.issueRelation.create({
          data: {
            id: relation.id,
            sourceIssueId: relation.source_issue_id,
            relationType: relation.relation_type,
            targetIssueId: relation.target_issue_id,
            createdAt: new Date(relation.created_at),
          },
        })

        if (relation.relation_type === "blocked_by") {
          await tx.issueBlocker.upsert({
            where: {
              issueId_blockerIssueId: {
                issueId: relation.source_issue_id,
                blockerIssueId: relation.target_issue_id,
              },
            },
            create: {
              issueId: relation.source_issue_id,
              blockerIssueId: relation.target_issue_id,
            },
            update: {},
          })
        }

        await tx.issue.update({
          where: {
            id: relation.source_issue_id,
          },
          data: {
            updatedAt: new Date(updatedAt),
          },
        })

        return createdRelation
      })

      return toIssueRelation(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  private async nextIdentifier(
    tx: Prisma.TransactionClient,
    project: string,
    updatedAt: string
  ): Promise<string> {
    const prefix = issueIdentifierPrefix(project)
    const counter = await tx.projectCounter.upsert({
      where: {
        key: prefix,
      },
      create: {
        key: prefix,
        nextNumber: 2,
        updatedAt: new Date(updatedAt),
      },
      update: {
        nextNumber: {
          increment: 1,
        },
        updatedAt: new Date(updatedAt),
      },
    })

    return `${prefix}-${counter.nextNumber - 1}`
  }

  private toIssueRecord(issue: PersistedIssue): IssueRecord {
    return {
      id: issue.id,
      identifier: issue.identifier,
      project: issue.project,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      state: issue.state,
      branch_name: issue.branchName,
      url: issue.url,
      labels: issue.labels.map((label) => label.label),
      blocked_by_ids: issue.blockers.map((blocker) => blocker.blockerIssueId),
      external_blockers: issue.externalBlockers.map((blocker) => ({
        id: blocker.blockerId,
        identifier: blocker.identifier,
        state: blocker.state,
      })),
      assignee: issue.assignee,
      created_at: issue.createdAt.toISOString(),
      updated_at: issue.updatedAt.toISOString(),
      comments: issue.comments.map(toIssueComment),
      links: issue.links.map(toIssueLink),
      relations: issue.relations.map(toIssueRelation),
    }
  }
}

function toIssueComment(comment: IssueCommentRecord): IssueComment {
  return {
    id: comment.id,
    issue_id: comment.issueId,
    body: comment.body,
    resolved: comment.resolved,
    created_at: comment.createdAt.toISOString(),
    updated_at: comment.updatedAt.toISOString(),
  }
}

function toIssueLink(link: IssueLinkRecord): IssueLink {
  return {
    id: link.id,
    issue_id: link.issueId,
    url: link.url,
    title: link.title,
    type: link.type,
    created_at: link.createdAt.toISOString(),
  }
}

function toIssueRelation(relation: IssueRelationRecord): IssueRelation {
  return {
    id: relation.id,
    source_issue_id: relation.sourceIssueId,
    relation_type: relation.relationType as IssueRelation["relation_type"],
    target_issue_id: relation.targetIssueId,
    created_at: relation.createdAt.toISOString(),
  }
}

function isMissingRecordError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }

  return "code" in error && (error.code === "P2025" || error.code === "P2003")
}
