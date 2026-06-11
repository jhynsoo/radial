import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  TrackerClientError,
  attachLink,
  createComment,
  createIssue,
  createIssueView,
  createRelation,
  deactivateComment,
  deleteIssueView,
  getCurrentUser,
  getIssue,
  listComments,
  listIssueViews,
  listTeams,
  listWorkflowStates,
  listLinks,
  searchIssues,
  updateComment,
  updateIssueState,
  updateIssueView,
} from "./client"

const originalEnv = process.env
const issue = {
  id: "issue-1",
  identifier: "RAD-1",
  title: "Issue 1",
  description: null,
  priority: null,
  state: "Todo",
  branch_name: null,
  url: null,
  labels: [],
  blocked_by: [],
  created_at: null,
  updated_at: null,
  project: "radial",
  comments: [],
  links: [],
  relations: [],
}
const comment = {
  id: "comment-1",
  issue_id: "issue-1",
  body: "Comment body",
  resolved: false,
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}
const link = {
  id: "link-1",
  issue_id: "issue-1",
  url: "https://example.com",
  title: "Example",
  type: "reference",
  created_at: "2026-05-12T00:00:00.000Z",
}
const relation = {
  id: "relation-1",
  source_issue_id: "issue-1",
  relation_type: "blocked_by" as const,
  target_issue_id: "issue-2",
  created_at: "2026-05-12T00:00:00.000Z",
}
const currentUser = {
  id: "user-1",
  name: "Radial User",
  email: "user@example.com",
}
const workflowState = {
  id: "workflow-state-1",
  team_key: "RAD",
  name: "QA Review",
  type: "started" as const,
  position: 1,
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}
const team = {
  key: "RAD",
  name: "Radial Team",
  description: null,
  workflow_states: [workflowState],
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}
const issueView = {
  id: "issue-view-1",
  project_slug: "radial-api",
  name: "My work",
  filters: {
    query: "API",
    states: ["Todo"],
    assignee: "me",
    labels: ["backend"],
  },
  display_options: {
    layout: "kanban" as const,
    group_by: "state" as const,
    sort_by: "priority" as const,
    show_empty_states: false,
  },
  created_at: "2026-05-12T00:00:00.000Z",
  updated_at: "2026-05-12T00:00:00.000Z",
}

beforeEach(() => {
  vi.restoreAllMocks()
  process.env = {
    ...originalEnv,
    TRACKER_API_BASE_URL: "http://tracker.test/api/v1",
    TRACKER_API_KEY: "secret-token",
  }
})

afterEach(() => {
  process.env = originalEnv
})

describe("tracker client", () => {
  it("searches issues with bearer auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      searchIssues({
        project: "radial",
        states: ["Todo"],
      })
    ).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/search",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token",
        },
        body: JSON.stringify({ project: "radial", states: ["Todo"] }),
        cache: "no-store",
      })
    )
  })

  it("normalizes backend error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            category: "tracker_not_found",
            message: "Issue missing.",
          },
        }),
      })
    )

    await expect(getIssue("issue-1")).rejects.toMatchObject({
      category: "tracker_not_found",
      message: "Issue missing.",
      status: 404,
    })
  })

  it("uses a request-failed error when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"))
    vi.stubGlobal("fetch", fetchMock)

    const request = getIssue("issue-1")

    await expect(request).rejects.toBeInstanceOf(TrackerClientError)
    await expect(request).rejects.toMatchObject({
      category: "tracker_request_failed",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it("wraps successful response json decode failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input")
        },
      })
    )

    await expect(getIssue("issue-1")).rejects.toMatchObject({
      category: "tracker_decode_error",
      status: 200,
    })
  })

  it("creates issues and unwraps the issue", async () => {
    const body = {
      project: "radial",
      title: "New issue",
      labels: ["bug"],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issue }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(createIssue(body)).resolves.toEqual(issue)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      })
    )
  })

  it("updates issue state and unwraps the issue", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issue }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(updateIssueState("issue/1", "In Progress")).resolves.toEqual(
      issue
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ state: "In Progress" }),
      })
    )
  })

  it("lists unresolved comments by default and unwraps comments", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [comment] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(listComments("issue/1")).resolves.toEqual([comment])
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/comments",
      expect.objectContaining({
        method: "GET",
      })
    )
  })

  it("lists comments with resolved comments when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comments: [comment] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(listComments("issue/1", true)).resolves.toEqual([comment])
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/comments?include_resolved=true",
      expect.objectContaining({
        method: "GET",
      })
    )
  })

  it("creates comments and unwraps the comment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comment }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(createComment("issue/1", "Comment body")).resolves.toEqual(
      comment
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ body: "Comment body" }),
      })
    )
  })

  it("updates comments and unwraps the comment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comment }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(updateComment("comment/1", "Updated body")).resolves.toEqual(
      comment
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/comments/comment%2F1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ body: "Updated body" }),
      })
    )
  })

  it("deactivates comments and unwraps the comment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comment }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(deactivateComment("comment/1")).resolves.toEqual(comment)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/comments/comment%2F1",
      expect.objectContaining({
        method: "DELETE",
      })
    )
  })

  it("lists links and unwraps links", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ links: [link] }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(listLinks("issue/1")).resolves.toEqual([link])
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/links",
      expect.objectContaining({
        method: "GET",
      })
    )
  })

  it("attaches links and unwraps the link", async () => {
    const body = {
      url: "https://example.com",
      title: "Example",
      type: "reference",
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ link }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(attachLink("issue/1", body)).resolves.toEqual(link)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/links",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      })
    )
  })

  it("creates relations and unwraps the relation", async () => {
    const body = {
      relation_type: "blocked_by" as const,
      target_issue_id: "issue-2",
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ relation }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(createRelation("issue/1", body)).resolves.toEqual(relation)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/issues/issue%2F1/relations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(body),
      })
    )
  })

  it("manages saved issue views", async () => {
    const createBody = {
      name: "My work",
      filters: {
        query: "API",
      },
    }
    const updateBody = {
      name: "Backend review",
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ views: [issueView] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ view: issueView }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ view: { ...issueView, name: "Backend review" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ view: issueView }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(listIssueViews("radial/api")).resolves.toEqual([issueView])
    await expect(createIssueView("radial/api", createBody)).resolves.toEqual(
      issueView
    )
    await expect(updateIssueView("issue-view/1", updateBody)).resolves.toEqual({
      ...issueView,
      name: "Backend review",
    })
    await expect(deleteIssueView("issue-view/1")).resolves.toEqual(issueView)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://tracker.test/api/v1/projects/radial%2Fapi/views",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://tracker.test/api/v1/projects/radial%2Fapi/views",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(createBody),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://tracker.test/api/v1/views/issue-view%2F1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(updateBody),
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://tracker.test/api/v1/views/issue-view%2F1",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("lists teams and workflow states", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ teams: [team] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ states: [workflowState] }),
      })
    vi.stubGlobal("fetch", fetchMock)

    await expect(listTeams()).resolves.toEqual([team])
    await expect(listWorkflowStates("RAD")).resolves.toEqual([workflowState])

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://tracker.test/api/v1/teams",
      expect.objectContaining({ method: "GET" })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://tracker.test/api/v1/teams/RAD/workflow-states",
      expect.objectContaining({ method: "GET" })
    )
  })

  it("gets the current user and unwraps the user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: currentUser }),
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(getCurrentUser()).resolves.toEqual(currentUser)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tracker.test/api/v1/users/me",
      expect.objectContaining({
        method: "GET",
      })
    )
  })
})
