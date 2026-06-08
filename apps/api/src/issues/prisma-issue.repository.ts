import { Injectable } from "@nestjs/common"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../database/prisma.service"
import {
  IssueComment,
  IssueCycle,
  IssueLink,
  IssueProject,
  IssueProjectMilestone,
  IssueRecord,
  IssueRelation,
  IssueTeam,
  IssueView,
  IssueViewDisplayOptions,
  IssueViewFilters,
  IssueWorkflowState,
  ProjectStatus,
  WorkflowStateType,
} from "./issue.types"
import {
  IssueRepository,
  IssueUpdatePatch,
  IssueViewUpdatePatch,
  NewCycleRecord,
  NewIssueViewRecord,
  NewIssueRecord,
  NewProjectMilestoneRecord,
  NewProjectRecord,
  NewTeamRecord,
  NewWorkflowStateRecord,
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

const teamInclude = {
  workflowStates: {
    orderBy: {
      position: "asc",
    },
  },
} satisfies Prisma.TeamInclude

type PersistedIssue = Prisma.IssueGetPayload<{
  include: typeof issueInclude
}>
type PersistedTeam = Prisma.TeamGetPayload<{
  include: typeof teamInclude
}>

type ProjectRecord = Prisma.ProjectGetPayload<object>
type ProjectMilestoneRecord = Prisma.ProjectMilestoneGetPayload<object>
type CycleRecord = Prisma.CycleGetPayload<object>
type IssueViewRecord = Prisma.IssueViewGetPayload<object>
type IssueCommentRecord = Prisma.IssueCommentGetPayload<object>
type IssueLinkRecord = Prisma.IssueLinkGetPayload<object>
type IssueRelationRecord = Prisma.IssueRelationGetPayload<object>
type WorkflowStateRecord = Prisma.WorkflowStateGetPayload<object>

@Injectable()
export class PrismaIssueRepository implements IssueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listProjects(): Promise<IssueProject[]> {
    this.prisma.assertDatabaseConfigured()

    const projects = await this.prisma.project.findMany({
      orderBy: {
        slug: "asc",
      },
    })

    return projects.map(toIssueProject)
  }

  async findProjectBySlug(projectSlug: string): Promise<IssueProject | null> {
    this.prisma.assertDatabaseConfigured()

    const project = await this.prisma.project.findUnique({
      where: {
        slug: projectSlug,
      },
    })

    return project ? toIssueProject(project) : null
  }

  async createProject(project: NewProjectRecord): Promise<IssueProject> {
    this.prisma.assertDatabaseConfigured()

    const created = await this.prisma.project.create({
      data: toProjectCreateData(project),
    })

    return toIssueProject(created)
  }

  async listProjectMilestones(
    projectSlug: string
  ): Promise<IssueProjectMilestone[]> {
    this.prisma.assertDatabaseConfigured()

    const milestones = await this.prisma.projectMilestone.findMany({
      where: {
        projectSlug,
      },
      orderBy: {
        position: "asc",
      },
    })

    return milestones.map(toIssueProjectMilestone)
  }

  async createProjectMilestone(
    milestone: NewProjectMilestoneRecord
  ): Promise<IssueProjectMilestone | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.projectMilestone.create({
        data: toProjectMilestoneCreateData(milestone),
      })

      return toIssueProjectMilestone(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async listCycles(teamKey: string): Promise<IssueCycle[]> {
    this.prisma.assertDatabaseConfigured()

    const cycles = await this.prisma.cycle.findMany({
      where: {
        teamKey,
      },
      orderBy: {
        startsAt: "asc",
      },
    })

    return cycles.map(toIssueCycle)
  }

  async createCycle(cycle: NewCycleRecord): Promise<IssueCycle | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.cycle.create({
        data: toCycleCreateData(cycle),
      })

      return toIssueCycle(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async listIssueViews(projectSlug: string): Promise<IssueView[]> {
    this.prisma.assertDatabaseConfigured()

    const views = await this.prisma.issueView.findMany({
      where: {
        projectSlug,
      },
      orderBy: {
        name: "asc",
      },
    })

    return views.map(toIssueView)
  }

  async findIssueViewById(viewId: string): Promise<IssueView | null> {
    this.prisma.assertDatabaseConfigured()

    const view = await this.prisma.issueView.findUnique({
      where: {
        id: viewId,
      },
    })

    return view ? toIssueView(view) : null
  }

  async createIssueView(view: NewIssueViewRecord): Promise<IssueView | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const created = await this.prisma.issueView.create({
        data: toIssueViewCreateData(view),
      })

      return toIssueView(created)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async updateIssueView(
    viewId: string,
    patch: IssueViewUpdatePatch,
    updatedAt: string
  ): Promise<IssueView | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const updated = await this.prisma.issueView.update({
        where: {
          id: viewId,
        },
        data: {
          ...issueViewUpdateData(patch),
          updatedAt: new Date(updatedAt),
        },
      })

      return toIssueView(updated)
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

  async deleteIssueView(viewId: string): Promise<boolean> {
    this.prisma.assertDatabaseConfigured()

    try {
      await this.prisma.issueView.delete({
        where: {
          id: viewId,
        },
      })
    } catch (error) {
      if (isMissingRecordError(error)) {
        return false
      }

      throw error
    }

    return true
  }

  async listTeams(): Promise<IssueTeam[]> {
    this.prisma.assertDatabaseConfigured()

    const teams = await this.prisma.team.findMany({
      include: teamInclude,
      orderBy: {
        key: "asc",
      },
    })

    return teams.map(toIssueTeam)
  }

  async findTeamByKey(teamKey: string): Promise<IssueTeam | null> {
    this.prisma.assertDatabaseConfigured()

    const team = await this.prisma.team.findUnique({
      where: {
        key: teamKey,
      },
      include: teamInclude,
    })

    return team ? toIssueTeam(team) : null
  }

  async createTeam(
    team: NewTeamRecord,
    states: NewWorkflowStateRecord[]
  ): Promise<IssueTeam> {
    this.prisma.assertDatabaseConfigured()

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.team.create({
        data: {
          key: team.key,
          name: team.name,
          description: team.description,
          createdAt: new Date(team.created_at),
          updatedAt: new Date(team.updated_at),
        },
      })
      await tx.workflowState.createMany({
        data: states.map(toWorkflowStateCreateData),
      })

      return tx.team.findUnique({
        where: {
          key: team.key,
        },
        include: teamInclude,
      })
    })

    if (!created) {
      throw new Error(`Created team '${team.key}' could not be loaded.`)
    }

    return toIssueTeam(created)
  }

  async listWorkflowStates(teamKey: string): Promise<IssueWorkflowState[]> {
    this.prisma.assertDatabaseConfigured()

    const states = await this.prisma.workflowState.findMany({
      where: {
        teamKey,
      },
      orderBy: {
        position: "asc",
      },
    })

    return states.map(toIssueWorkflowState)
  }

  async replaceWorkflowStates(
    teamKey: string,
    states: NewWorkflowStateRecord[],
    updatedAt: string
  ): Promise<IssueWorkflowState[] | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: {
            key: teamKey,
          },
          data: {
            updatedAt: new Date(updatedAt),
          },
        })
        await tx.workflowState.deleteMany({
          where: {
            teamKey,
          },
        })
        await tx.workflowState.createMany({
          data: states.map(toWorkflowStateCreateData),
        })

        const updatedStates = await tx.workflowState.findMany({
          where: {
            teamKey,
          },
          orderBy: {
            position: "asc",
          },
        })

        return updatedStates.map(toIssueWorkflowState)
      })
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
  }

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
          milestoneId: issue.milestone_id,
          cycleId: issue.cycle_id,
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

  async updateIssue(
    issueId: string,
    patch: IssueUpdatePatch,
    updatedAt: string
  ): Promise<IssueRecord | null> {
    this.prisma.assertDatabaseConfigured()

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.issue.update({
          where: {
            id: issueId,
          },
          data: {
            ...issueUpdateData(patch),
            updatedAt: new Date(updatedAt),
          },
        })

        if (patch.labels !== undefined) {
          await tx.issueLabel.deleteMany({
            where: {
              issueId,
            },
          })

          if (patch.labels.length > 0) {
            await tx.issueLabel.createMany({
              data: patch.labels.map((label) => ({
                issueId,
                label,
              })),
              skipDuplicates: true,
            })
          }
        }

        if (
          patch.blocked_by_ids !== undefined ||
          patch.external_blockers !== undefined
        ) {
          await tx.issueBlocker.deleteMany({
            where: {
              issueId,
            },
          })
          await tx.issueExternalBlocker.deleteMany({
            where: {
              issueId,
            },
          })

          if (patch.blocked_by_ids && patch.blocked_by_ids.length > 0) {
            await tx.issueBlocker.createMany({
              data: patch.blocked_by_ids.map((blockerIssueId) => ({
                issueId,
                blockerIssueId,
              })),
              skipDuplicates: true,
            })
          }

          if (patch.external_blockers && patch.external_blockers.length > 0) {
            await tx.issueExternalBlocker.createMany({
              data: patch.external_blockers.map((blocker) => ({
                id: `external-blocker-${randomUUID()}`,
                issueId,
                blockerId: blocker.id,
                identifier: blocker.identifier,
                state: blocker.state,
              })),
            })
          }
        }

        return tx.issue.findUnique({
          where: {
            id: issueId,
          },
          include: issueInclude,
        })
      })

      return updated ? this.toIssueRecord(updated) : null
    } catch (error) {
      if (isMissingRecordError(error)) {
        return null
      }

      throw error
    }
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
      milestone_id: issue.milestoneId,
      cycle_id: issue.cycleId,
      created_at: issue.createdAt.toISOString(),
      updated_at: issue.updatedAt.toISOString(),
      comments: issue.comments.map(toIssueComment),
      links: issue.links.map(toIssueLink),
      relations: issue.relations.map(toIssueRelation),
    }
  }
}

function toProjectCreateData(project: NewProjectRecord) {
  return {
    slug: project.slug,
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: new Date(project.created_at),
    updatedAt: new Date(project.updated_at),
  }
}

function toProjectMilestoneCreateData(milestone: NewProjectMilestoneRecord) {
  return {
    id: milestone.id,
    projectSlug: milestone.project_slug,
    name: milestone.name,
    description: milestone.description,
    targetDate: milestone.target_date ? new Date(milestone.target_date) : null,
    position: milestone.position,
    createdAt: new Date(milestone.created_at),
    updatedAt: new Date(milestone.updated_at),
  }
}

function toCycleCreateData(cycle: NewCycleRecord) {
  return {
    id: cycle.id,
    teamKey: cycle.team_key,
    name: cycle.name,
    startsAt: new Date(cycle.starts_at),
    endsAt: new Date(cycle.ends_at),
    createdAt: new Date(cycle.created_at),
    updatedAt: new Date(cycle.updated_at),
  }
}

function toIssueViewCreateData(view: NewIssueViewRecord) {
  return {
    id: view.id,
    projectSlug: view.project_slug,
    name: view.name,
    filters: view.filters as unknown as Prisma.InputJsonValue,
    displayOptions: view.display_options as unknown as Prisma.InputJsonValue,
    createdAt: new Date(view.created_at),
    updatedAt: new Date(view.updated_at),
  }
}

function toWorkflowStateCreateData(state: NewWorkflowStateRecord) {
  return {
    id: state.id,
    teamKey: state.team_key,
    name: state.name,
    type: state.type,
    position: state.position,
    createdAt: new Date(state.created_at),
    updatedAt: new Date(state.updated_at),
  }
}

function toIssueProject(project: ProjectRecord): IssueProject {
  return {
    slug: project.slug,
    name: project.name,
    description: project.description,
    status: project.status as ProjectStatus,
    created_at: project.createdAt.toISOString(),
    updated_at: project.updatedAt.toISOString(),
  }
}

function toIssueProjectMilestone(
  milestone: ProjectMilestoneRecord
): IssueProjectMilestone {
  return {
    id: milestone.id,
    project_slug: milestone.projectSlug,
    name: milestone.name,
    description: milestone.description,
    target_date: milestone.targetDate?.toISOString() ?? null,
    position: milestone.position,
    created_at: milestone.createdAt.toISOString(),
    updated_at: milestone.updatedAt.toISOString(),
  }
}

function toIssueCycle(cycle: CycleRecord): IssueCycle {
  return {
    id: cycle.id,
    team_key: cycle.teamKey,
    name: cycle.name,
    starts_at: cycle.startsAt.toISOString(),
    ends_at: cycle.endsAt.toISOString(),
    created_at: cycle.createdAt.toISOString(),
    updated_at: cycle.updatedAt.toISOString(),
  }
}

function toIssueView(view: IssueViewRecord): IssueView {
  return {
    id: view.id,
    project_slug: view.projectSlug,
    name: view.name,
    filters: view.filters as unknown as IssueViewFilters,
    display_options: view.displayOptions as unknown as IssueViewDisplayOptions,
    created_at: view.createdAt.toISOString(),
    updated_at: view.updatedAt.toISOString(),
  }
}

function toIssueTeam(team: PersistedTeam): IssueTeam {
  return {
    key: team.key,
    name: team.name,
    description: team.description,
    created_at: team.createdAt.toISOString(),
    updated_at: team.updatedAt.toISOString(),
    workflow_states: team.workflowStates.map(toIssueWorkflowState),
  }
}

function toIssueWorkflowState(state: WorkflowStateRecord): IssueWorkflowState {
  return {
    id: state.id,
    team_key: state.teamKey,
    name: state.name,
    type: state.type as WorkflowStateType,
    position: state.position,
    created_at: state.createdAt.toISOString(),
    updated_at: state.updatedAt.toISOString(),
  }
}

function issueUpdateData(patch: IssueUpdatePatch): Prisma.IssueUpdateInput {
  const data: Prisma.IssueUpdateInput = {}

  if (patch.title !== undefined) {
    data.title = patch.title
  }
  if (patch.description !== undefined) {
    data.description = patch.description
  }
  if (patch.priority !== undefined) {
    data.priority = patch.priority
  }
  if (patch.state !== undefined) {
    data.state = patch.state
  }
  if (patch.branch_name !== undefined) {
    data.branchName = patch.branch_name
  }
  if (patch.url !== undefined) {
    data.url = patch.url
  }
  if (patch.assignee !== undefined) {
    data.assignee = patch.assignee
  }
  if (patch.milestone_id !== undefined) {
    data.milestone = patch.milestone_id
      ? { connect: { id: patch.milestone_id } }
      : { disconnect: true }
  }
  if (patch.cycle_id !== undefined) {
    data.cycle = patch.cycle_id
      ? { connect: { id: patch.cycle_id } }
      : { disconnect: true }
  }

  return data
}

function issueViewUpdateData(
  patch: IssueViewUpdatePatch
): Prisma.IssueViewUpdateInput {
  const data: Prisma.IssueViewUpdateInput = {}

  if (patch.name !== undefined) {
    data.name = patch.name
  }
  if (patch.filters !== undefined) {
    data.filters = patch.filters as unknown as Prisma.InputJsonValue
  }
  if (patch.display_options !== undefined) {
    data.displayOptions =
      patch.display_options as unknown as Prisma.InputJsonValue
  }

  return data
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
