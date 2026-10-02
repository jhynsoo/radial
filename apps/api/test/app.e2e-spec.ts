import { Test, TestingModule } from "@nestjs/testing"
import { INestApplication } from "@nestjs/common"
import request from "supertest"
import { App } from "supertest/types"
import { AppModule } from "./../src/app.module"
import { InMemoryIssueRepository } from "../src/issues/in-memory-issue.repository"
import { ISSUE_REPOSITORY } from "../src/issues/issue.repository"
import { IssueDetail } from "../src/issues/issue.types"

interface IssueResponse {
  issue: IssueDetail
}

describe("AppController (e2e)", () => {
  let app: INestApplication<App>
  let originalApiKey: string | undefined

  beforeEach(async () => {
    originalApiKey = process.env.TRACKER_API_KEY
    delete process.env.TRACKER_API_KEY

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ISSUE_REPOSITORY)
      .useValue(new InMemoryIssueRepository())
      .compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix("api")
    await app.init()
  })

  it("/api/health (GET)", () => {
    return request(app.getHttpServer())
      .get("/api/health")
      .expect(200)
      .expect({ status: "ok" })
  })

  it("implements the core scheduler issue reads", async () => {
    const blocker = await createIssue({
      project: "radial",
      title: "Finish dependency",
      state_name: "In Progress",
      labels: ["Backend", "BUG"],
      priority: "1",
    })
    const todo = await createIssue({
      project: "radial",
      title: "Implement scheduler API",
      state_name: "Todo",
      labels: ["Backend", "backend"],
      priority: 2,
      blocked_by: [blocker.id],
    })
    const done = await createIssue({
      project: "radial",
      title: "Clean up workspace",
      state_name: "Done",
    })
    await createIssue({
      project: "other",
      title: "Out of scope",
      state_name: "Todo",
    })

    const candidates = await request(app.getHttpServer())
      .post("/api/v1/issues/search")
      .send({
        project: "radial",
        active_states: [" todo ", "IN PROGRESS"],
      })
      .expect(200)

    expect(issueIds(candidates.body)).toEqual([blocker.id, todo.id])
    expect(issueById(candidates.body, todo.id)).toEqual(
      expect.objectContaining({
        labels: ["backend"],
        priority: 2,
        state: "Todo",
        blocked_by: [
          {
            id: blocker.id,
            identifier: blocker.identifier,
            state: "In Progress",
          },
        ],
      })
    )

    await request(app.getHttpServer())
      .post("/api/v1/issues/search")
      .send({
        project: "radial",
        states: [],
      })
      .expect(200)
      .expect({ issues: [] })

    const lookup = await request(app.getHttpServer())
      .post("/api/v1/issues/lookup")
      .send({
        ids: [todo.id, "missing", blocker.id],
      })
      .expect(200)

    expect(issueIds(lookup.body)).toEqual([todo.id, blocker.id])
    expect(issueById(lookup.body, todo.id).blocked_by[0]?.state).toBe(
      "In Progress"
    )

    const terminal = await request(app.getHttpServer())
      .post("/api/v1/issues/search")
      .send({
        project: "radial",
        states: ["done"],
      })
      .expect(200)

    expect(issueIds(terminal.body)).toEqual([done.id])
    expect(issueById(terminal.body, done.id).created_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    )
  })

  it("implements the full workflow issue operations", async () => {
    const issue = await createIssue({
      project: "radial",
      title: "Implement workflow API",
      description: "Detailed body",
      state_name: "Todo",
      labels: ["Workflow"],
    })

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/issues/${issue.id}`)
      .expect(200)

    expect((detail.body as IssueResponse).issue).toEqual(
      expect.objectContaining({
        id: issue.id,
        description: "Detailed body",
        comments: [],
        links: [],
        relations: [],
      })
    )

    const createdComment = await request(app.getHttpServer())
      .post(`/api/v1/issues/${issue.id}/comments`)
      .send({
        body: "## Codex Workpad\nInitial notes",
      })
      .expect(201)
    const commentId = (createdComment.body as { comment: { id: string } })
      .comment.id

    await request(app.getHttpServer())
      .patch(`/api/v1/comments/${commentId}`)
      .send({
        body: "## Codex Workpad\nUpdated notes",
      })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          comment: { id: string; body: string; resolved: boolean }
        }

        expect(body.comment).toMatchObject({
          id: commentId,
          body: "## Codex Workpad\nUpdated notes",
          resolved: false,
        })
      })

    await request(app.getHttpServer())
      .delete(`/api/v1/comments/${commentId}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          comment: { id: string; resolved: boolean }
        }

        expect(body.comment).toMatchObject({
          id: commentId,
          resolved: true,
        })
      })

    await request(app.getHttpServer())
      .get(`/api/v1/issues/${issue.id}/comments`)
      .expect(200)
      .expect({ comments: [] })

    await request(app.getHttpServer())
      .get(`/api/v1/issues/${issue.id}`)
      .expect(200)
      .expect((response) => {
        expect((response.body as IssueResponse).issue.comments).toEqual([])
      })

    await request(app.getHttpServer())
      .get(`/api/v1/issues/${issue.id}/comments?include_resolved=true`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          comments: [
            expect.objectContaining({
              id: commentId,
              resolved: true,
            }),
          ],
        })
      })

    await request(app.getHttpServer())
      .patch(`/api/v1/issues/${issue.id}`)
      .send({
        state_name: "Human Review",
      })
      .expect(200)
      .expect((response) => {
        expect((response.body as IssueResponse).issue.state).toBe(
          "Human Review"
        )
      })

    await request(app.getHttpServer())
      .post(`/api/v1/issues/${issue.id}/links`)
      .send({
        url: "https://github.com/example/radial/pull/1",
        title_or_type: "pull_request",
      })
      .expect(201)

    await request(app.getHttpServer())
      .get(`/api/v1/issues/${issue.id}/links`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          links: [
            expect.objectContaining({
              url: "https://github.com/example/radial/pull/1",
              title: "pull_request",
            }),
          ],
        })
      })

    const followUp = await createIssue({
      project: "radial",
      title: "Follow up work",
      state_name: "Backlog",
    })

    await request(app.getHttpServer())
      .post(`/api/v1/issues/${issue.id}/relations`)
      .send({
        relation_type: "related",
        target_issue_id: followUp.id,
      })
      .expect(201)

    await request(app.getHttpServer())
      .post(`/api/v1/issues/${issue.id}/relations`)
      .send({
        relation_type: "blocked_by",
        target_issue_id: followUp.id,
      })
      .expect(201)

    const lookup = await request(app.getHttpServer())
      .post("/api/v1/issues/lookup")
      .send({
        ids: [issue.id],
      })
      .expect(200)

    expect(issueById(lookup.body, issue.id).blocked_by).toEqual([
      {
        id: followUp.id,
        identifier: followUp.identifier,
        state: "Backlog",
      },
    ])

    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .expect(200)
      .expect({
        user: {
          id: "me",
          name: "Radial API",
          email: null,
        },
      })
  })

  it("implements team workflow state catalog operations", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/teams")
      .send({
        key: "rad",
        name: "Radial Team",
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          team: {
            key: string
            name: string
            workflow_states: Array<{ name: string }>
          }
        }

        expect(body.team.key).toBe("RAD")
        expect(body.team.name).toBe("Radial Team")
        expect(
          body.team.workflow_states.some((state) => state.name === "Todo")
        ).toBe(true)
      })

    await request(app.getHttpServer())
      .get("/api/v1/teams")
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          teams: Array<{ key: string }>
        }

        expect(body.teams.map((team) => team.key)).toEqual(["RAD"])
      })

    await request(app.getHttpServer())
      .put("/api/v1/teams/RAD/workflow-states")
      .send({
        states: [
          { name: "Todo", type: "unstarted" },
          { name: "QA Review", type: "started" },
          { name: "Done", type: "completed" },
        ],
      })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          states: Array<{ name: string; type: string }>
        }

        expect(
          body.states.map((state) => `${state.name}:${state.type}`)
        ).toEqual(["Todo:unstarted", "QA Review:started", "Done:completed"])
      })

    const issue = await createIssue({
      project: "radial",
      title: "Move through custom workflow",
      state_name: "Todo",
    })

    await request(app.getHttpServer())
      .patch(`/api/v1/issues/${issue.id}`)
      .send({
        state: "QA Review",
      })
      .expect(200)
      .expect((response) => {
        expect((response.body as IssueResponse).issue.state).toBe("QA Review")
      })
  })

  it("implements project, milestone, and cycle catalog operations", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/teams")
      .send({
        key: "rad",
        name: "Radial Team",
      })
      .expect(201)

    const project = await request(app.getHttpServer())
      .post("/api/v1/projects")
      .send({
        slug: " radial-api ",
        name: " Radial API ",
        description: " Project metadata ",
        status: "planned",
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          project: {
            slug: string
            name: string
            description: string | null
            status: string
          }
        }

        expect(body.project).toMatchObject({
          slug: "radial-api",
          name: "Radial API",
          description: "Project metadata",
          status: "planned",
        })
      })
    const projectSlug = (project.body as { project: { slug: string } }).project
      .slug

    await request(app.getHttpServer())
      .get("/api/v1/projects")
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          projects: [expect.objectContaining({ slug: projectSlug })],
        })
      })

    const view = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectSlug}/views`)
      .send({
        name: " My work ",
        filters: {
          query: " API ",
          states: ["Todo"],
          assignee: " me ",
          labels: ["Backend", "backend"],
        },
        display_options: {
          layout: "kanban",
          group_by: "state",
          sort_by: "priority",
          show_empty_states: false,
        },
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          view: {
            project_slug: string
            name: string
            filters: {
              query: string | null
              states: string[]
              assignee: string | null
              labels: string[]
            }
            display_options: {
              sort_by: string
              show_empty_states: boolean
            }
          }
        }

        expect(body.view).toMatchObject({
          project_slug: projectSlug,
          name: "My work",
          filters: {
            query: "API",
            states: ["Todo"],
            assignee: "me",
            labels: ["backend"],
          },
          display_options: {
            sort_by: "priority",
            show_empty_states: false,
          },
        })
      })
    const viewId = (view.body as { view: { id: string } }).view.id

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectSlug}/views`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          views: [expect.objectContaining({ id: viewId })],
        })
      })

    await request(app.getHttpServer())
      .patch(`/api/v1/views/${viewId}`)
      .send({
        name: "Backend review",
        filters: {
          query: null,
          states: ["Human Review"],
          assignee: null,
          labels: ["api"],
        },
        display_options: {
          layout: "kanban",
          group_by: "state",
          sort_by: "updated_at",
          show_empty_states: true,
        },
      })
      .expect(200)
      .expect((response) => {
        const body = response.body as {
          view: {
            name: string
            filters: { states: string[] }
            display_options: { show_empty_states: boolean }
          }
        }

        expect(body.view.name).toBe("Backend review")
        expect(body.view.filters.states).toEqual(["Human Review"])
        expect(body.view.display_options.show_empty_states).toBe(true)
      })

    await request(app.getHttpServer())
      .delete(`/api/v1/views/${viewId}`)
      .expect(200)
      .expect((response) => {
        const body = response.body as { view: { id: string } }

        expect(body.view.id).toBe(viewId)
      })

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectSlug}/views`)
      .expect(200)
      .expect({ views: [] })

    const milestone = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectSlug}/milestones`)
      .send({
        name: " API parity ",
        description: " Linear-like API coverage ",
        target_date: "2026-07-01T00:00:00.000Z",
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          milestone: {
            project_slug: string
            name: string
            target_date: string | null
          }
        }

        expect(body.milestone).toMatchObject({
          project_slug: projectSlug,
          name: "API parity",
          target_date: "2026-07-01T00:00:00.000Z",
        })
      })
    const milestoneId = (milestone.body as { milestone: { id: string } })
      .milestone.id

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectSlug}/milestones`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          milestones: [expect.objectContaining({ id: milestoneId })],
        })
      })

    const cycle = await request(app.getHttpServer())
      .post("/api/v1/teams/RAD/cycles")
      .send({
        name: " Sprint 1 ",
        starts_at: "2026-06-01T00:00:00.000Z",
        ends_at: "2026-06-14T00:00:00.000Z",
      })
      .expect(201)
      .expect((response) => {
        const body = response.body as {
          cycle: {
            team_key: string
            name: string
            starts_at: string
            ends_at: string
          }
        }

        expect(body.cycle).toMatchObject({
          team_key: "RAD",
          name: "Sprint 1",
          starts_at: "2026-06-01T00:00:00.000Z",
          ends_at: "2026-06-14T00:00:00.000Z",
        })
      })
    const cycleId = (cycle.body as { cycle: { id: string } }).cycle.id

    await request(app.getHttpServer())
      .get("/api/v1/teams/RAD/cycles")
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          cycles: [expect.objectContaining({ id: cycleId })],
        })
      })

    const issue = await createIssue({
      project: projectSlug,
      title: "Schedule API work",
    })

    await request(app.getHttpServer())
      .patch(`/api/v1/issues/${issue.id}`)
      .send({
        milestone_id: milestoneId,
        cycle_id: cycleId,
      })
      .expect(200)
      .expect((response) => {
        expect((response.body as IssueResponse).issue).toEqual(
          expect.objectContaining({
            milestone_id: milestoneId,
            cycle_id: cycleId,
          })
        )
      })
  })

  it("distinguishes authentication failures when an API key is configured", async () => {
    process.env.TRACKER_API_KEY = "secret"

    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .expect(401)
      .expect((response) => {
        expect(response.body).toEqual({
          error: {
            category: "tracker_auth_failed",
            message: "Authorization header must contain a valid bearer token.",
          },
        })
      })

    await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer secret")
      .expect(200)
  })

  async function createIssue(payload: Record<string, unknown>) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/issues")
      .send(payload)
      .expect(201)

    return (response.body as IssueResponse).issue
  }

  function issueIds(body: unknown): string[] {
    return issuesFrom(body).map((issue) => issue.id)
  }

  function issueById(body: unknown, issueId: string): IssueDetail {
    const issue = issuesFrom(body).find((item) => item.id === issueId)

    if (!issue) {
      throw new Error(`Issue ${issueId} was not found in response.`)
    }

    return issue
  }

  function issuesFrom(body: unknown): IssueDetail[] {
    return (body as { issues: IssueDetail[] }).issues
  }

  afterEach(async () => {
    await app.close()
    if (originalApiKey === undefined) {
      delete process.env.TRACKER_API_KEY
    } else {
      process.env.TRACKER_API_KEY = originalApiKey
    }
  })
})
