import { IssueTrackerController } from "./issue-tracker.controller"
import { IssueTrackerService } from "./issue-tracker.service"
import {
  IssueComment,
  IssueDetail,
  IssueLink,
  IssueRelation,
  NormalizedIssue,
} from "./issue.types"

describe("IssueTrackerController", () => {
  let controller: IssueTrackerController
  let issueTracker: IssueTrackerMock

  beforeEach(() => {
    issueTracker = {
      searchIssues: jest.fn(),
      lookupIssues: jest.fn(),
      createIssue: jest.fn(),
      getIssue: jest.fn(),
      updateIssue: jest.fn(),
      listComments: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      deactivateComment: jest.fn(),
      listLinks: jest.fn(),
      attachLink: jest.fn(),
      createRelation: jest.fn(),
      getCurrentUser: jest.fn(),
    }

    controller = new IssueTrackerController(
      issueTracker as unknown as IssueTrackerService
    )
  })

  it("wraps issue read and write results", async () => {
    const issue = issueDetail()
    const normalizedIssue = normalized(issue)
    const searchPayload = { project: "radial", active_states: ["Todo"] }
    const lookupPayload = { ids: [issue.id] }
    const createPayload = { project: "radial", title: "Implement API" }
    const updatePayload = { state_name: "Done" }

    issueTracker.searchIssues.mockResolvedValue([normalizedIssue])
    issueTracker.lookupIssues.mockResolvedValue([normalizedIssue])
    issueTracker.createIssue.mockResolvedValue(issue)
    issueTracker.getIssue.mockResolvedValue(issue)
    issueTracker.updateIssue.mockResolvedValue({ ...issue, state: "Done" })

    await expect(controller.searchIssues(searchPayload)).resolves.toEqual({
      issues: [normalizedIssue],
    })
    expect(issueTracker.searchIssues).toHaveBeenCalledWith(searchPayload)

    await expect(controller.lookupIssues(lookupPayload)).resolves.toEqual({
      issues: [normalizedIssue],
    })
    expect(issueTracker.lookupIssues).toHaveBeenCalledWith(lookupPayload)

    await expect(controller.createIssue(createPayload)).resolves.toEqual({
      issue,
    })
    expect(issueTracker.createIssue).toHaveBeenCalledWith(createPayload)

    await expect(controller.getIssue(issue.id)).resolves.toEqual({ issue })
    expect(issueTracker.getIssue).toHaveBeenCalledWith(issue.id)

    await expect(
      controller.updateIssue(issue.id, updatePayload)
    ).resolves.toEqual({
      issue: { ...issue, state: "Done" },
    })
    expect(issueTracker.updateIssue).toHaveBeenCalledWith(
      issue.id,
      updatePayload
    )
  })

  it("wraps comment operations and parses include_resolved", async () => {
    const comment = issueComment()

    issueTracker.listComments.mockResolvedValue([comment])
    issueTracker.createComment.mockResolvedValue(comment)
    issueTracker.updateComment.mockResolvedValue({
      ...comment,
      body: "Updated",
    })
    issueTracker.deactivateComment.mockResolvedValue({
      ...comment,
      resolved: true,
    })

    await expect(controller.listComments("issue-1")).resolves.toEqual({
      comments: [comment],
    })
    expect(issueTracker.listComments).toHaveBeenLastCalledWith("issue-1", false)

    await expect(controller.listComments("issue-1", "true")).resolves.toEqual({
      comments: [comment],
    })
    expect(issueTracker.listComments).toHaveBeenLastCalledWith("issue-1", true)

    await expect(
      controller.createComment("issue-1", { body: "Note" })
    ).resolves.toEqual({
      comment,
    })
    expect(issueTracker.createComment).toHaveBeenCalledWith("issue-1", {
      body: "Note",
    })

    await expect(
      controller.updateComment(comment.id, { body: "Updated" })
    ).resolves.toEqual({
      comment: { ...comment, body: "Updated" },
    })
    expect(issueTracker.updateComment).toHaveBeenCalledWith(comment.id, {
      body: "Updated",
    })

    await expect(controller.deactivateComment(comment.id)).resolves.toEqual({
      comment: { ...comment, resolved: true },
    })
    expect(issueTracker.deactivateComment).toHaveBeenCalledWith(comment.id)
  })

  it("wraps links, relations, and current user", async () => {
    const link = issueLink()
    const relation = issueRelation()
    const user = {
      id: "me",
      name: "Radial API",
      email: null,
    }

    issueTracker.listLinks.mockResolvedValue([link])
    issueTracker.attachLink.mockResolvedValue(link)
    issueTracker.createRelation.mockResolvedValue(relation)
    issueTracker.getCurrentUser.mockReturnValue(user)

    await expect(controller.listLinks("issue-1")).resolves.toEqual({
      links: [link],
    })
    expect(issueTracker.listLinks).toHaveBeenCalledWith("issue-1")

    await expect(
      controller.attachLink("issue-1", { url: "https://example.com" })
    ).resolves.toEqual({ link })
    expect(issueTracker.attachLink).toHaveBeenCalledWith("issue-1", {
      url: "https://example.com",
    })

    await expect(
      controller.createRelation("issue-1", {
        relation_type: "related",
        target_issue_id: "issue-2",
      })
    ).resolves.toEqual({ relation })
    expect(issueTracker.createRelation).toHaveBeenCalledWith("issue-1", {
      relation_type: "related",
      target_issue_id: "issue-2",
    })

    expect(controller.getCurrentUser()).toEqual({ user })
    expect(issueTracker.getCurrentUser).toHaveBeenCalledTimes(1)
  })
})

function issueDetail(): IssueDetail {
  return {
    id: "issue-1",
    identifier: "RADIAL-1",
    project: "radial",
    title: "Implement API",
    description: "Details",
    priority: 1,
    state: "Todo",
    branch_name: "feature/api",
    url: "http://localhost:3001/api/v1/issues/issue-1",
    labels: ["backend"],
    blocked_by: [],
    comments: [],
    links: [],
    relations: [],
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function normalized(issue: IssueDetail): NormalizedIssue {
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    state: issue.state,
    branch_name: issue.branch_name,
    url: issue.url,
    labels: issue.labels,
    blocked_by: issue.blocked_by,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
  }
}

function issueComment(): IssueComment {
  return {
    id: "comment-1",
    issue_id: "issue-1",
    body: "Initial note",
    resolved: false,
    created_at: "2026-05-12T00:00:00.000Z",
    updated_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueLink(): IssueLink {
  return {
    id: "link-1",
    issue_id: "issue-1",
    url: "https://example.com",
    title: "Example",
    type: "reference",
    created_at: "2026-05-12T00:00:00.000Z",
  }
}

function issueRelation(): IssueRelation {
  return {
    id: "relation-1",
    source_issue_id: "issue-1",
    relation_type: "related",
    target_issue_id: "issue-2",
    created_at: "2026-05-12T00:00:00.000Z",
  }
}

interface IssueTrackerMock {
  searchIssues: jest.Mock
  lookupIssues: jest.Mock
  createIssue: jest.Mock
  getIssue: jest.Mock
  updateIssue: jest.Mock
  listComments: jest.Mock
  createComment: jest.Mock
  updateComment: jest.Mock
  deactivateComment: jest.Mock
  listLinks: jest.Mock
  attachLink: jest.Mock
  createRelation: jest.Mock
  getCurrentUser: jest.Mock
}
