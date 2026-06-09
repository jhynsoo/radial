import { Prisma } from "@prisma/client"
import { PrismaService } from "../database/prisma.service"
import {
  IssueComment,
  IssueLink,
  IssueRelation,
  IssueViewDisplayOptions,
  IssueViewFilters,
} from "./issue.types"
import { NewIssueRecord } from "./issue.repository"
import { PrismaIssueRepository } from "./prisma-issue.repository"

describe("PrismaIssueRepository", () => {
  let prisma: PrismaMock
  let tx: TransactionMock
  let repository: PrismaIssueRepository

  beforeEach(() => {
    tx = createTransactionMock()
    prisma = createPrismaMock(tx)
    repository = new PrismaIssueRepository(prisma as unknown as PrismaService)
  })

  it("searches issues with case-insensitive states and skips empty state lists", async () => {
    prisma.issue.findMany.mockResolvedValue([persistedIssue()])

    await expect(
      repository.searchIssues({
        project: "radial",
        states: [],
        assignee: null,
      })
    ).resolves.toEqual([])
    expect(prisma.issue.findMany).not.toHaveBeenCalled()

    await expect(
      repository.searchIssues({
        project: "radial",
        states: ["Todo", "In Progress"],
        assignee: "me",
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: "issue-1",
        identifier: "RADIAL-1",
        labels: ["backend"],
      }),
    ])

    const searchCall = firstCallArg<FindManyCall>(prisma.issue.findMany)
    expect(searchCall.where).toEqual({
      project: "radial",
      assignee: "me",
      OR: [
        {
          state: {
            equals: "Todo",
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          state: {
            equals: "In Progress",
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    })
    expect(searchCall.include).toEqual(expect.any(Object))
    expect(searchCall.orderBy).toEqual({
      createdAt: "asc",
    })
    expect(prisma.assertDatabaseConfigured).toHaveBeenCalledTimes(2)
  })

  it("finds issue states currently in use", async () => {
    prisma.issue.findMany.mockResolvedValue([
      persistedIssue({ state: "QA Review" }),
    ])

    await expect(
      repository.findIssueStatesInUse(["QA Review", "Done"])
    ).resolves.toEqual(["QA Review"])

    const usageCall = firstCallArg<FindManyCall>(prisma.issue.findMany)
    expect(usageCall.where).toEqual({
      OR: [
        {
          state: {
            equals: "QA Review",
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          state: {
            equals: "Done",
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    })
    expect(usageCall.select).toEqual({
      state: true,
    })
    expect(usageCall.distinct).toEqual(["state"])
  })

  it("loads issues by id while preserving requested order", async () => {
    prisma.issue.findMany.mockResolvedValue([
      persistedIssue({ id: "issue-2", identifier: "RADIAL-2" }),
      persistedIssue({ id: "issue-1", identifier: "RADIAL-1" }),
    ])

    await expect(
      repository.findIssuesByIds(["issue-1", "missing", "issue-2"])
    ).resolves.toEqual([
      expect.objectContaining({ id: "issue-1" }),
      expect.objectContaining({ id: "issue-2" }),
    ])
    const lookupCall = firstCallArg<FindManyCall>(prisma.issue.findMany)
    expect(lookupCall.where).toEqual({
      id: {
        in: ["issue-1", "missing", "issue-2"],
      },
    })
    expect(lookupCall.include).toEqual(expect.any(Object))

    await expect(repository.findIssuesByIds([])).resolves.toEqual([])
    expect(prisma.issue.findMany).toHaveBeenCalledTimes(1)
  })

  it("finds individual issues and checks existence", async () => {
    prisma.issue.findUnique.mockResolvedValueOnce(persistedIssue())
    prisma.issue.findUnique.mockResolvedValueOnce(null)
    prisma.issue.count.mockResolvedValue(1)

    await expect(repository.findIssueById("issue-1")).resolves.toEqual(
      expect.objectContaining({ id: "issue-1" })
    )
    await expect(repository.findIssueById("missing")).resolves.toBeNull()
    await expect(repository.issueExists("issue-1")).resolves.toBe(true)
  })

  it("persists teams and replaces workflow states", async () => {
    prisma.team.findMany.mockResolvedValue([persistedTeam()])
    await expect(repository.listTeams()).resolves.toEqual([
      expect.objectContaining({
        key: "RAD",
        workflow_states: [expect.objectContaining({ name: "Todo" })],
      }),
    ])

    tx.team.findUnique.mockResolvedValue(persistedTeam())
    await expect(
      repository.createTeam(
        {
          key: "RAD",
          name: "Radial",
          description: null,
          created_at: timestamp(),
          updated_at: timestamp(),
        },
        [workflowStateRecord()]
      )
    ).resolves.toEqual(expect.objectContaining({ key: "RAD" }))
    expect(tx.team.create).toHaveBeenCalledWith({
      data: {
        key: "RAD",
        name: "Radial",
        description: null,
        createdAt: timestampDate(),
        updatedAt: timestampDate(),
      },
    })
    expect(tx.workflowState.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "workflow-state-1",
          teamKey: "RAD",
          name: "Todo",
          type: "unstarted",
          position: 0,
          createdAt: timestampDate(),
          updatedAt: timestampDate(),
        },
      ],
    })

    tx.workflowState.findMany.mockResolvedValue([
      persistedWorkflowState({ name: "QA Review", position: 1 }),
    ])
    await expect(
      repository.replaceWorkflowStates(
        "RAD",
        [workflowStateRecord({ name: "QA Review", position: 1 })],
        timestamp()
      )
    ).resolves.toEqual([expect.objectContaining({ name: "QA Review" })])
    expect(tx.team.update).toHaveBeenCalledWith({
      where: {
        key: "RAD",
      },
      data: {
        updatedAt: timestampDate(),
      },
    })
    expect(tx.workflowState.deleteMany).toHaveBeenCalledWith({
      where: {
        teamKey: "RAD",
      },
    })
  })

  it("persists projects, milestones, and cycles", async () => {
    prisma.project.findMany.mockResolvedValue([persistedProject()])
    await expect(repository.listProjects()).resolves.toEqual([
      expect.objectContaining({ slug: "radial-api" }),
    ])
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      orderBy: {
        slug: "asc",
      },
    })

    prisma.project.findUnique.mockResolvedValue(persistedProject())
    await expect(repository.findProjectBySlug("radial-api")).resolves.toEqual(
      expect.objectContaining({ slug: "radial-api" })
    )
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: {
        slug: "radial-api",
      },
    })

    prisma.project.create.mockResolvedValue(persistedProject())
    await expect(
      repository.createProject({
        slug: "radial-api",
        name: "Radial API",
        description: "Project metadata",
        status: "planned",
        created_at: timestamp(),
        updated_at: timestamp(),
      })
    ).resolves.toEqual(expect.objectContaining({ name: "Radial API" }))
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: {
        slug: "radial-api",
        name: "Radial API",
        description: "Project metadata",
        status: "planned",
        createdAt: timestampDate(),
        updatedAt: timestampDate(),
      },
    })

    prisma.projectMilestone.findMany.mockResolvedValue([persistedMilestone()])
    await expect(
      repository.listProjectMilestones("radial-api")
    ).resolves.toEqual([expect.objectContaining({ name: "API parity" })])
    expect(prisma.projectMilestone.findMany).toHaveBeenCalledWith({
      where: {
        projectSlug: "radial-api",
      },
      orderBy: {
        position: "asc",
      },
    })

    prisma.projectMilestone.create.mockResolvedValue(persistedMilestone())
    await expect(
      repository.createProjectMilestone({
        id: "project-milestone-1",
        project_slug: "radial-api",
        name: "API parity",
        description: null,
        target_date: "2026-07-01T00:00:00.000Z",
        position: 0,
        created_at: timestamp(),
        updated_at: timestamp(),
      })
    ).resolves.toEqual(expect.objectContaining({ id: "project-milestone-1" }))
    expect(prisma.projectMilestone.create).toHaveBeenCalledWith({
      data: {
        id: "project-milestone-1",
        projectSlug: "radial-api",
        name: "API parity",
        description: null,
        targetDate: new Date("2026-07-01T00:00:00.000Z"),
        position: 0,
        createdAt: timestampDate(),
        updatedAt: timestampDate(),
      },
    })

    prisma.cycle.findMany.mockResolvedValue([persistedCycle()])
    await expect(repository.listCycles("RAD")).resolves.toEqual([
      expect.objectContaining({ name: "Sprint 1" }),
    ])
    expect(prisma.cycle.findMany).toHaveBeenCalledWith({
      where: {
        teamKey: "RAD",
      },
      orderBy: {
        startsAt: "asc",
      },
    })

    prisma.cycle.create.mockResolvedValue(persistedCycle())
    await expect(
      repository.createCycle({
        id: "cycle-1",
        team_key: "RAD",
        name: "Sprint 1",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-06-14T00:00:00.000Z",
        created_at: timestamp(),
        updated_at: timestamp(),
      })
    ).resolves.toEqual(expect.objectContaining({ id: "cycle-1" }))
    expect(prisma.cycle.create).toHaveBeenCalledWith({
      data: {
        id: "cycle-1",
        teamKey: "RAD",
        name: "Sprint 1",
        startsAt: new Date("2026-06-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-14T00:00:00.000Z"),
        createdAt: timestampDate(),
        updatedAt: timestampDate(),
      },
    })
  })

  it("persists saved issue views", async () => {
    prisma.issueView.findMany.mockResolvedValue([persistedIssueView()])
    await expect(repository.listIssueViews("radial-api")).resolves.toEqual([
      expect.objectContaining({ name: "My work" }),
    ])
    expect(prisma.issueView.findMany).toHaveBeenCalledWith({
      where: {
        projectSlug: "radial-api",
      },
      orderBy: {
        name: "asc",
      },
    })

    prisma.issueView.findUnique.mockResolvedValue(persistedIssueView())
    await expect(repository.findIssueViewById("issue-view-1")).resolves.toEqual(
      expect.objectContaining({ id: "issue-view-1" })
    )

    prisma.issueView.create.mockResolvedValue(persistedIssueView())
    await expect(
      repository.createIssueView({
        id: "issue-view-1",
        project_slug: "radial-api",
        name: "My work",
        filters: issueViewFilters(),
        display_options: issueViewDisplayOptions(),
        created_at: timestamp(),
        updated_at: timestamp(),
      })
    ).resolves.toEqual(expect.objectContaining({ project_slug: "radial-api" }))
    expect(prisma.issueView.create).toHaveBeenCalledWith({
      data: {
        id: "issue-view-1",
        projectSlug: "radial-api",
        name: "My work",
        filters: issueViewFilters(),
        displayOptions: issueViewDisplayOptions(),
        createdAt: timestampDate(),
        updatedAt: timestampDate(),
      },
    })

    prisma.issueView.update.mockResolvedValue(
      persistedIssueView({ name: "Backend review" })
    )
    await expect(
      repository.updateIssueView(
        "issue-view-1",
        {
          name: "Backend review",
          filters: issueViewFilters({ query: null }),
          display_options: issueViewDisplayOptions({ sort_by: "updated_at" }),
        },
        timestamp()
      )
    ).resolves.toEqual(expect.objectContaining({ name: "Backend review" }))
    expect(prisma.issueView.update).toHaveBeenCalledWith({
      where: {
        id: "issue-view-1",
      },
      data: {
        name: "Backend review",
        filters: issueViewFilters({ query: null }),
        displayOptions: issueViewDisplayOptions({ sort_by: "updated_at" }),
        updatedAt: timestampDate(),
      },
    })

    prisma.issueView.delete.mockResolvedValue(persistedIssueView())
    await expect(repository.deleteIssueView("issue-view-1")).resolves.toBe(true)
    expect(prisma.issueView.delete).toHaveBeenCalledWith({
      where: {
        id: "issue-view-1",
      },
    })
  })

  it("creates issues with generated identifiers and related records", async () => {
    tx.projectCounter.upsert.mockResolvedValue({
      key: "RADIAL",
      nextNumber: 2,
      updatedAt: timestampDate(),
    })
    tx.issue.findUnique.mockResolvedValue(persistedIssue())

    await expect(repository.createIssue(newIssueRecord())).resolves.toEqual(
      expect.objectContaining({
        id: "issue-1",
        identifier: "RADIAL-1",
        blocked_by_ids: ["issue-0"],
        external_blockers: [
          {
            id: "external-1",
            identifier: "EXT-1",
            state: "Todo",
          },
        ],
      })
    )

    expect(tx.projectCounter.upsert).toHaveBeenCalledWith({
      where: {
        key: "RADIAL",
      },
      create: {
        key: "RADIAL",
        nextNumber: 2,
        updatedAt: timestampDate(),
      },
      update: {
        nextNumber: {
          increment: 1,
        },
        updatedAt: timestampDate(),
      },
    })
    const createCall = firstCallArg<{
      data: Record<string, unknown>
    }>(tx.issue.create)
    expect(createCall.data).toMatchObject({
      id: "issue-1",
      identifier: "RADIAL-1",
      project: "radial",
      createdAt: timestampDate(),
      updatedAt: timestampDate(),
    })
    expect(tx.issueLabel.createMany).toHaveBeenCalledWith({
      data: [
        {
          issueId: "issue-1",
          label: "backend",
        },
      ],
      skipDuplicates: true,
    })
    expect(tx.issueBlocker.createMany).toHaveBeenCalledWith({
      data: [
        {
          issueId: "issue-1",
          blockerIssueId: "issue-0",
        },
      ],
      skipDuplicates: true,
    })
    expect(tx.issueExternalBlocker.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          issueId: "issue-1",
          blockerId: "external-1",
          identifier: "EXT-1",
          state: "Todo",
        }),
      ],
    })
  })

  it("throws when a created issue cannot be reloaded", async () => {
    tx.projectCounter.upsert.mockResolvedValue({
      key: "RADIAL",
      nextNumber: 2,
      updatedAt: timestampDate(),
    })
    tx.issue.findUnique.mockResolvedValue(null)

    await expect(repository.createIssue(newIssueRecord())).rejects.toThrow(
      "Created issue 'issue-1' could not be loaded."
    )
  })

  it("updates issue states and returns null for missing records", async () => {
    prisma.issue.update.mockResolvedValue({})
    prisma.issue.findUnique.mockResolvedValue(persistedIssue({ state: "Done" }))

    await expect(
      repository.updateIssueState("issue-1", "Done", timestamp())
    ).resolves.toEqual(expect.objectContaining({ state: "Done" }))
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: {
        id: "issue-1",
      },
      data: {
        state: "Done",
        updatedAt: timestampDate(),
      },
    })

    prisma.issue.update.mockRejectedValueOnce({ code: "P2025" })
    await expect(
      repository.updateIssueState("missing", "Done", timestamp())
    ).resolves.toBeNull()
  })

  it("updates editable issue fields and replaces labels and blockers transactionally", async () => {
    tx.issue.findUnique.mockResolvedValue(
      persistedIssue({
        title: "Updated title",
        description: null,
        priority: null,
        state: "In Progress",
        branchName: null,
        url: null,
        assignee: null,
        labels: [{ label: "web" }, { label: "api" }],
        blockers: [{ blockerIssueId: "issue-2" }],
        externalBlockers: [
          {
            blockerId: "external-1",
            identifier: "EXT-1",
            state: null,
          },
        ],
      })
    )

    await expect(
      repository.updateIssue(
        "issue-1",
        {
          title: "Updated title",
          description: null,
          priority: null,
          state: "In Progress",
          branch_name: null,
          url: null,
          labels: ["web", "api"],
          blocked_by_ids: ["issue-2"],
          external_blockers: [
            {
              id: "external-1",
              identifier: "EXT-1",
              state: null,
            },
          ],
          assignee: null,
          milestone_id: "project-milestone-1",
          cycle_id: "cycle-1",
        },
        timestamp()
      )
    ).resolves.toEqual(
      expect.objectContaining({
        title: "Updated title",
        description: null,
        priority: null,
        state: "In Progress",
        branch_name: null,
        url: null,
        labels: ["web", "api"],
        blocked_by_ids: ["issue-2"],
      })
    )

    expect(tx.issue.update).toHaveBeenCalledWith({
      where: {
        id: "issue-1",
      },
      data: {
        title: "Updated title",
        description: null,
        priority: null,
        state: "In Progress",
        branchName: null,
        url: null,
        assignee: null,
        milestone: { connect: { id: "project-milestone-1" } },
        cycle: { connect: { id: "cycle-1" } },
        updatedAt: timestampDate(),
      },
    })
    expect(tx.issueLabel.deleteMany).toHaveBeenCalledWith({
      where: {
        issueId: "issue-1",
      },
    })
    expect(tx.issueLabel.createMany).toHaveBeenCalledWith({
      data: [
        { issueId: "issue-1", label: "web" },
        { issueId: "issue-1", label: "api" },
      ],
      skipDuplicates: true,
    })
    expect(tx.issueBlocker.deleteMany).toHaveBeenCalledWith({
      where: {
        issueId: "issue-1",
      },
    })
    expect(tx.issueBlocker.createMany).toHaveBeenCalledWith({
      data: [{ issueId: "issue-1", blockerIssueId: "issue-2" }],
      skipDuplicates: true,
    })
    expect(tx.issueExternalBlocker.deleteMany).toHaveBeenCalledWith({
      where: {
        issueId: "issue-1",
      },
    })
    expect(tx.issueExternalBlocker.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          issueId: "issue-1",
          blockerId: "external-1",
          identifier: "EXT-1",
          state: null,
        }),
      ],
    })
  })

  it("creates, updates, and deactivates comments while touching the issue", async () => {
    const comment = issueComment()

    tx.issueComment.create.mockResolvedValue(persistedComment())
    await expect(
      repository.createComment("issue-1", comment, timestamp())
    ).resolves.toEqual(comment)
    expect(tx.issue.update).toHaveBeenCalledWith({
      where: {
        id: "issue-1",
      },
      data: {
        updatedAt: timestampDate(),
      },
    })

    tx.issueComment.findUnique.mockResolvedValue(persistedComment())
    tx.issueComment.update.mockResolvedValue(
      persistedComment({ body: "Updated note" })
    )
    await expect(
      repository.updateComment("comment-1", "Updated note", timestamp())
    ).resolves.toEqual({
      ...comment,
      body: "Updated note",
    })

    tx.issueComment.update.mockResolvedValue(
      persistedComment({ resolved: true })
    )
    await expect(
      repository.deactivateComment("comment-1", timestamp())
    ).resolves.toEqual({
      ...comment,
      resolved: true,
    })

    tx.issueComment.findUnique.mockResolvedValueOnce(null)
    await expect(
      repository.updateComment("missing", "Updated note", timestamp())
    ).resolves.toBeNull()
  })

  it("attaches links and creates blocked_by relations", async () => {
    const link = issueLink()
    const relation = issueRelation()

    tx.issueLink.create.mockResolvedValue(persistedLink())
    await expect(
      repository.attachLink("issue-1", link, timestamp())
    ).resolves.toEqual(link)
    expect(tx.issueLink.create).toHaveBeenCalledWith({
      data: {
        id: "link-1",
        issueId: "issue-1",
        url: "https://example.com",
        title: "Example",
        type: "reference",
        createdAt: timestampDate(),
      },
    })

    tx.issueRelation.create.mockResolvedValue(persistedRelation())
    await expect(
      repository.createRelation(relation, timestamp())
    ).resolves.toEqual(relation)
    expect(tx.issueBlocker.upsert).toHaveBeenCalledWith({
      where: {
        issueId_blockerIssueId: {
          issueId: "issue-1",
          blockerIssueId: "issue-2",
        },
      },
      create: {
        issueId: "issue-1",
        blockerIssueId: "issue-2",
      },
      update: {},
    })
  })

  it("returns null when foreign key writes target missing issue records", async () => {
    tx.issueComment.create.mockRejectedValueOnce({ code: "P2003" })
    await expect(
      repository.createComment("missing", issueComment(), timestamp())
    ).resolves.toBeNull()

    tx.issueLink.create.mockRejectedValueOnce({ code: "P2003" })
    await expect(
      repository.attachLink("missing", issueLink(), timestamp())
    ).resolves.toBeNull()

    tx.issueRelation.create.mockRejectedValueOnce({ code: "P2003" })
    await expect(
      repository.createRelation(issueRelation(), timestamp())
    ).resolves.toBeNull()
  })
})

interface PrismaMock {
  assertDatabaseConfigured: jest.Mock
  issue: {
    findMany: jest.Mock
    findUnique: jest.Mock
    count: jest.Mock
    update: jest.Mock
  }
  project: {
    findMany: jest.Mock
    findUnique: jest.Mock
    create: jest.Mock
  }
  projectMilestone: {
    findMany: jest.Mock
    create: jest.Mock
  }
  cycle: {
    findMany: jest.Mock
    create: jest.Mock
  }
  issueView: {
    findMany: jest.Mock
    findUnique: jest.Mock
    create: jest.Mock
    update: jest.Mock
    delete: jest.Mock
  }
  team: {
    findMany: jest.Mock
    findUnique: jest.Mock
  }
  workflowState: {
    findMany: jest.Mock
  }
  $transaction: jest.Mock
}

interface TransactionMock {
  projectCounter: {
    upsert: jest.Mock
  }
  issue: {
    create: jest.Mock
    findUnique: jest.Mock
    update: jest.Mock
  }
  team: {
    create: jest.Mock
    findUnique: jest.Mock
    update: jest.Mock
  }
  workflowState: {
    createMany: jest.Mock
    deleteMany: jest.Mock
    findMany: jest.Mock
  }
  issueLabel: {
    createMany: jest.Mock
    deleteMany: jest.Mock
  }
  issueBlocker: {
    createMany: jest.Mock
    deleteMany: jest.Mock
    upsert: jest.Mock
  }
  issueExternalBlocker: {
    createMany: jest.Mock
    deleteMany: jest.Mock
  }
  issueComment: {
    create: jest.Mock
    findUnique: jest.Mock
    update: jest.Mock
  }
  issueLink: {
    create: jest.Mock
  }
  issueRelation: {
    create: jest.Mock
  }
}

interface FindManyCall {
  where: unknown
  include?: unknown
  select?: unknown
  distinct?: unknown
  orderBy?: unknown
}

function createPrismaMock(tx: TransactionMock): PrismaMock {
  return {
    assertDatabaseConfigured: jest.fn(),
    issue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    projectMilestone: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    cycle: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    issueView: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    workflowState: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: TransactionMock) => unknown) =>
      callback(tx)
    ),
  }
}

function createTransactionMock(): TransactionMock {
  return {
    projectCounter: {
      upsert: jest.fn(),
    },
    issue: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workflowState: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    issueLabel: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    issueBlocker: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    issueExternalBlocker: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    issueComment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    issueLink: {
      create: jest.fn(),
    },
    issueRelation: {
      create: jest.fn(),
    },
  }
}

function newIssueRecord(): NewIssueRecord {
  return {
    id: "issue-1",
    project: "radial",
    title: "Implement API",
    description: "Details",
    priority: 1,
    state: "Todo",
    branch_name: "feature/api",
    url: "http://localhost:3001/api/v1/issues/issue-1",
    labels: ["backend"],
    blocked_by_ids: ["issue-0"],
    external_blockers: [
      {
        id: "external-1",
        identifier: "EXT-1",
        state: "Todo",
      },
    ],
    assignee: "me",
    milestone_id: null,
    cycle_id: null,
    created_at: timestamp(),
    updated_at: timestamp(),
  }
}

function persistedIssue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "issue-1",
    identifier: "RADIAL-1",
    project: "radial",
    title: "Implement API",
    description: "Details",
    priority: 1,
    state: "Todo",
    branchName: "feature/api",
    url: "http://localhost:3001/api/v1/issues/issue-1",
    assignee: "me",
    milestoneId: null,
    cycleId: null,
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    labels: [
      {
        label: "backend",
      },
    ],
    blockers: [
      {
        blockerIssueId: "issue-0",
      },
    ],
    externalBlockers: [
      {
        blockerId: "external-1",
        identifier: "EXT-1",
        state: "Todo",
      },
    ],
    comments: [persistedComment()],
    links: [persistedLink()],
    relations: [persistedRelation()],
    ...overrides,
  }
}

function workflowStateRecord(
  overrides: Partial<ReturnType<typeof persistedWorkflowState>> = {}
) {
  const state = persistedWorkflowState(overrides)

  return {
    id: state.id,
    team_key: state.teamKey,
    name: state.name,
    type: "unstarted" as const,
    position: state.position,
    created_at: timestamp(),
    updated_at: timestamp(),
  }
}

function persistedTeam(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    key: "RAD",
    name: "Radial",
    description: null,
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    workflowStates: [persistedWorkflowState()],
    ...overrides,
  }
}

function persistedWorkflowState(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "workflow-state-1",
    teamKey: "RAD",
    name: "Todo",
    type: "unstarted",
    position: 0,
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function persistedProject(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: "radial-api",
    name: "Radial API",
    description: "Project metadata",
    status: "planned",
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function persistedMilestone(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "project-milestone-1",
    projectSlug: "radial-api",
    name: "API parity",
    description: null,
    targetDate: new Date("2026-07-01T00:00:00.000Z"),
    position: 0,
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function persistedCycle(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cycle-1",
    teamKey: "RAD",
    name: "Sprint 1",
    startsAt: new Date("2026-06-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-14T00:00:00.000Z"),
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function issueViewFilters(
  overrides: Partial<IssueViewFilters> = {}
): IssueViewFilters {
  return {
    query: "API",
    states: ["Todo"],
    assignee: "me",
    labels: ["backend"],
    ...overrides,
  }
}

function issueViewDisplayOptions(
  overrides: Partial<IssueViewDisplayOptions> = {}
): IssueViewDisplayOptions {
  return {
    layout: "kanban",
    group_by: "state",
    sort_by: "priority",
    show_empty_states: false,
    ...overrides,
  }
}

function persistedIssueView(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "issue-view-1",
    projectSlug: "radial-api",
    name: "My work",
    filters: issueViewFilters(),
    displayOptions: issueViewDisplayOptions(),
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function issueComment(): IssueComment {
  return {
    id: "comment-1",
    issue_id: "issue-1",
    body: "Initial note",
    resolved: false,
    created_at: timestamp(),
    updated_at: timestamp(),
  }
}

function persistedComment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "comment-1",
    issueId: "issue-1",
    body: "Initial note",
    resolved: false,
    createdAt: timestampDate(),
    updatedAt: timestampDate(),
    ...overrides,
  }
}

function issueLink(): IssueLink {
  return {
    id: "link-1",
    issue_id: "issue-1",
    url: "https://example.com",
    title: "Example",
    type: "reference",
    created_at: timestamp(),
  }
}

function persistedLink(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "link-1",
    issueId: "issue-1",
    url: "https://example.com",
    title: "Example",
    type: "reference",
    createdAt: timestampDate(),
    ...overrides,
  }
}

function issueRelation(): IssueRelation {
  return {
    id: "relation-1",
    source_issue_id: "issue-1",
    relation_type: "blocked_by",
    target_issue_id: "issue-2",
    created_at: timestamp(),
  }
}

function persistedRelation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "relation-1",
    sourceIssueId: "issue-1",
    relationType: "blocked_by",
    targetIssueId: "issue-2",
    createdAt: timestampDate(),
    ...overrides,
  }
}

function timestamp(): string {
  return "2026-05-12T00:00:00.000Z"
}

function timestampDate(): Date {
  return new Date(timestamp())
}

function firstCallArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as ReadonlyArray<ReadonlyArray<unknown>>

  return calls[0]?.[0] as T
}
