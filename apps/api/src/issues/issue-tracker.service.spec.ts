import { HttpException } from "@nestjs/common"
import { IssueTrackerService } from "./issue-tracker.service"
import { TrackerErrorBody } from "./issue.types"

describe("IssueTrackerService", () => {
  let service: IssueTrackerService
  let originalPublicUrl: string | undefined
  let originalUserName: string | undefined
  let originalUserEmail: string | undefined

  beforeEach(() => {
    originalPublicUrl = process.env.TRACKER_PUBLIC_URL
    originalUserName = process.env.TRACKER_USER_NAME
    originalUserEmail = process.env.TRACKER_USER_EMAIL
    delete process.env.TRACKER_PUBLIC_URL
    delete process.env.TRACKER_USER_NAME
    delete process.env.TRACKER_USER_EMAIL

    service = new IssueTrackerService()
  })

  afterEach(() => {
    restoreEnv("TRACKER_PUBLIC_URL", originalPublicUrl)
    restoreEnv("TRACKER_USER_NAME", originalUserName)
    restoreEnv("TRACKER_USER_EMAIL", originalUserEmail)
  })

  it("creates issues with normalized defaults and generated identifiers", () => {
    const issue = service.createIssue({
      project: " radial app ",
      title: " Implement API ",
      description: " Details ",
      state_name: " Todo ",
      labels: ["Backend", " backend ", ""],
      priority: "2",
      branch_name: " feature/radial ",
      assignee: "me",
    })

    expect(issue).toEqual(
      expect.objectContaining({
        identifier: "RADIAL-APP-1",
        project: "radial app",
        title: "Implement API",
        description: "Details",
        priority: 2,
        state: "Todo",
        branch_name: "feature/radial",
        labels: ["backend"],
        blocked_by: [],
        comments: [],
        links: [],
        relations: [],
      })
    )
    expect(issue.id).toMatch(/^issue-/)
    expect(issue.url).toBe(`http://localhost:3001/api/v1/issues/${issue.id}`)
    expect(issue.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(issue.updated_at).toBe(issue.created_at)

    expect(
      service.createIssue({
        project: "radial app",
        title: "Second issue",
      }).identifier
    ).toBe("RADIAL-APP-2")
    expect(
      service.createIssue({
        project: "@@@",
        title: "Fallback prefix",
      }).identifier
    ).toBe("ISSUE-1")
  })

  it("uses configured public URLs and current user profile values", () => {
    process.env.TRACKER_PUBLIC_URL = "https://tracker.example/api/v1/"
    process.env.TRACKER_USER_NAME = "Automation User"
    process.env.TRACKER_USER_EMAIL = "automation@example.com"

    const issue = service.createIssue({
      project: "radial",
      title: "Configured URL",
    })

    expect(issue.url).toBe(`https://tracker.example/api/v1/issues/${issue.id}`)
    expect(service.getCurrentUser()).toEqual({
      id: "me",
      name: "Automation User",
      email: "automation@example.com",
    })
  })

  it("searches by project, state, and assignee while lookup preserves requested order", () => {
    const assigned = service.createIssue({
      project: "radial",
      title: "Assigned work",
      state_name: "Todo",
      assignee: "me",
    })
    const unassigned = service.createIssue({
      project: "radial",
      title: "Unassigned work",
      state_name: "In Progress",
    })
    service.createIssue({
      project: "other",
      title: "Out of scope",
      state_name: "Todo",
      assignee: "me",
    })

    expect(
      service
        .searchIssues({
          project: "radial",
          active_states: [" todo ", "IN PROGRESS"],
          assignee: "me",
        })
        .map((issue) => issue.id)
    ).toEqual([assigned.id])
    expect(
      service
        .searchIssues({
          project: "radial",
          states: ["in progress"],
        })
        .map((issue) => issue.id)
    ).toEqual([unassigned.id])
    expect(
      service.searchIssues({
        project: "radial",
        states: [],
      })
    ).toEqual([])
    expect(
      service
        .lookupIssues({
          ids: [unassigned.id, "missing", assigned.id],
        })
        .map((issue) => issue.id)
    ).toEqual([unassigned.id, assigned.id])
    expect(service.lookupIssues({ ids: [] })).toEqual([])
  })

  it("resolves internal and external blockers with live internal state", () => {
    const blocker = service.createIssue({
      project: "radial",
      title: "Dependency",
      state_name: "Todo",
    })
    const issue = service.createIssue({
      project: "radial",
      title: "Blocked work",
      blocked_by: [
        blocker.id,
        blocker.id,
        {
          id: "external-1",
          identifier: "EXT-1",
          state: "In Progress",
        },
        "external-2",
      ],
    })

    expect(issue.blocked_by).toEqual([
      {
        id: blocker.id,
        identifier: blocker.identifier,
        state: "Todo",
      },
      {
        id: "external-1",
        identifier: "EXT-1",
        state: "In Progress",
      },
      {
        id: "external-2",
        identifier: "external-2",
        state: null,
      },
    ])

    service.updateIssue(blocker.id, {
      state_name: "Done",
    })

    expect(service.lookupIssues({ ids: [issue.id] })[0]?.blocked_by[0]).toEqual(
      {
        id: blocker.id,
        identifier: blocker.identifier,
        state: "Done",
      }
    )
  })

  it("updates issues only to registered states", () => {
    const issue = service.createIssue({
      project: "radial",
      title: "Review work",
    })

    expect(
      service.updateIssue(issue.id, {
        state_name: "human review",
      }).state
    ).toBe("Human Review")
    expectTrackerError(
      () => service.updateIssue(issue.id, {}),
      "tracker_invalid_state_transition"
    )
    expectTrackerError(
      () =>
        service.updateIssue(issue.id, {
          state_name: "Unknown",
        }),
      "tracker_state_not_found"
    )
  })

  it("creates, updates, resolves, and filters comments", () => {
    const issue = service.createIssue({
      project: "radial",
      title: "Commented issue",
    })
    const comment = service.createComment(issue.id, {
      body: " Initial note ",
    })

    expect(comment).toEqual(
      expect.objectContaining({
        issue_id: issue.id,
        body: "Initial note",
        resolved: false,
      })
    )
    expect(service.listComments(issue.id, false)).toEqual([comment])

    const updated = service.updateComment(comment.id, {
      body: " Updated note ",
    })
    expect(updated.body).toBe("Updated note")

    const resolved = service.deactivateComment(comment.id)
    expect(resolved.resolved).toBe(true)
    expect(service.listComments(issue.id, false)).toEqual([])
    expect(service.listComments(issue.id, true)).toEqual([resolved])
    expectTrackerError(
      () => service.updateComment("missing-comment", { body: "Nope" }),
      "tracker_comment_not_found"
    )
  })

  it("attaches valid links and rejects invalid link payloads", () => {
    const issue = service.createIssue({
      project: "radial",
      title: "Linked issue",
    })

    const link = service.attachLink(issue.id, {
      url: "https://github.com/example/radial/pull/1",
      title_or_type: "pull_request",
      type: "pull_request",
    })

    expect(link).toEqual(
      expect.objectContaining({
        issue_id: issue.id,
        url: "https://github.com/example/radial/pull/1",
        title: "pull_request",
        type: "pull_request",
      })
    )
    expect(service.listLinks(issue.id)).toEqual([link])
    expectTrackerError(
      () =>
        service.attachLink(issue.id, {
          url: "not a url",
        }),
      "tracker_link_attach_failed"
    )
    expectTrackerError(
      () => service.attachLink(issue.id, {}),
      "tracker_link_attach_failed"
    )
  })

  it("creates relations and keeps blocked_by relations visible on issues", () => {
    const source = service.createIssue({
      project: "radial",
      title: "Source",
    })
    const target = service.createIssue({
      project: "radial",
      title: "Target",
      state_name: "Backlog",
    })

    const related = service.createRelation(source.id, {
      relation_type: "related",
      target_issue_id: target.id,
    })
    const blockedBy = service.createRelation(source.id, {
      relation_type: "blocked_by",
      target_issue_id: target.id,
    })
    service.createRelation(source.id, {
      relation_type: "blocked_by",
      target_issue_id: target.id,
    })

    expect(related.relation_type).toBe("related")
    expect(blockedBy.relation_type).toBe("blocked_by")
    expect(service.getIssue(source.id).relations).toHaveLength(3)
    expect(service.lookupIssues({ ids: [source.id] })[0]?.blocked_by).toEqual([
      {
        id: target.id,
        identifier: target.identifier,
        state: "Backlog",
      },
    ])
    expectTrackerError(
      () =>
        service.createRelation(source.id, {
          relation_type: "duplicates",
          target_issue_id: target.id,
        }),
      "tracker_relation_create_failed"
    )
    expectTrackerError(
      () =>
        service.createRelation(source.id, {
          relation_type: "related",
          target_issue_id: "missing",
        }),
      "tracker_not_found"
    )
  })

  it("returns tracker error categories for invalid payloads", () => {
    expectTrackerError(
      () => service.createIssue(null),
      "tracker_unknown_payload"
    )
    expectTrackerError(
      () =>
        service.createIssue({
          project: "radial",
        }),
      "tracker_issue_create_failed"
    )
    expectTrackerError(
      () =>
        service.createIssue({
          project: "radial",
          title: "Invalid priority",
          priority: 1.5,
        }),
      "tracker_unknown_payload"
    )
    expectTrackerError(
      () =>
        service.createIssue({
          project: "radial",
          title: "Invalid blockers",
          blocked_by: "not-a-list",
        }),
      "tracker_unknown_payload"
    )
    expectTrackerError(
      () => service.searchIssues({ states: ["Todo"] }),
      "missing_tracker_project_slug"
    )
    expectTrackerError(
      () => service.searchIssues({ project: "radial" }),
      "tracker_unknown_payload"
    )
    expectTrackerError(
      () => service.lookupIssues({}),
      "tracker_unknown_payload"
    )
    expectTrackerError(() => service.getIssue("missing"), "tracker_not_found")
  })
})

function expectTrackerError(
  action: () => unknown,
  category: TrackerErrorBody["error"]["category"]
) {
  try {
    action()
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException)
    const response = (error as HttpException).getResponse() as TrackerErrorBody
    expect(response.error.category).toBe(category)
    return
  }

  throw new Error(`Expected tracker error '${category}' to be thrown.`)
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}
